"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { extractScorecardWithGemini } from "@/lib/ocr/gemini"
import { preprocessImage, type PreprocessResult } from "@/lib/ocr/preprocess"

// TODO: drop back to 5 once the Gemini pipeline is dialed in. Free tier is
// 1500 requests/day so we're nowhere near it even at 100/user/day.
const DAILY_LIMIT = 100
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const STORAGE_BUCKET = "scorecards"

export type OcrPlayerResult = {
  name: string // raw name as OCR'd — user picks the matching player manually
  scores: (number | null)[] // length 18; null = couldn't read
  warnings: string[]
}

export type OcrResult =
  | {
      success: true
      imagePath: string
      processedImagePath?: string
      preprocessSteps: string[]
      players: OcrPlayerResult[]
      warnings: string[]
      // Raw Gemini JSON output, kept for UI debug panel while we evaluate.
      debug?: unknown
    }
  | { success: false; error: string }

export async function uploadAndParseScorecard(formData: FormData): Promise<OcrResult> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to upload a scorecard" }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("is_confirmed")
      .eq("id", session.user.id)
      .single()

    if (!userData?.is_confirmed) {
      return { success: false, error: "Your account is pending admin approval." }
    }

    const file = formData.get("scorecard") as File | null
    if (!file || file.size === 0) {
      return { success: false, error: "Please select a scorecard image to upload" }
    }
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "File must be an image" }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "Image must be smaller than 10MB" }
    }

    // Rate limit: count OCR calls by this user in the last 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount, error: countError } = await admin
      .from("ocr_uploads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .gte("created_at", since)

    if (countError) {
      console.error("ocr rate-limit check failed:", countError)
      return { success: false, error: "Could not verify upload limit. Please try again." }
    }

    if ((recentCount ?? 0) >= DAILY_LIMIT) {
      return {
        success: false,
        error: `You've used all ${DAILY_LIMIT} scorecard uploads for today. Try again tomorrow.`,
      }
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set")
      return { success: false, error: "Scorecard OCR is not configured on the server." }
    }

    const arrayBuffer = await file.arrayBuffer()
    const rawBuffer = Buffer.from(arrayBuffer)

    // Save the raw image first so we always have the source, even if OCR
    // fails — helps debug user-reported issues later.
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
    const timestamp = Date.now()
    const imagePath = `${session.user.id}/${timestamp}.${ext}`
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(imagePath, rawBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error("scorecard upload failed:", uploadError)
      return { success: false, error: `Failed to save image: ${uploadError.message}` }
    }

    // Record the rate-limit event AFTER successful upload but BEFORE Gemini,
    // so spam retries burn their daily quota even if extraction throws.
    await admin.from("ocr_uploads").insert({ user_id: session.user.id })

    // Preprocess (just EXIF rotation + upscale-if-small; no grayscale/denoise).
    let processed: PreprocessResult
    try {
      processed = await preprocessImage(rawBuffer)
    } catch (err: any) {
      console.error("preprocess error — falling back to raw image", err)
      processed = {
        buffer: rawBuffer,
        steps: [`preprocess failed: ${err?.message ?? "unknown"}`],
        mimeType: file.type,
        width: 0,
        height: 0,
      }
    }

    // Save the processed image alongside the raw for side-by-side eval.
    // Failures here are non-fatal.
    const processedImagePath = `${session.user.id}/${timestamp}-processed.jpg`
    const { error: processedUploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(processedImagePath, processed.buffer, {
        contentType: processed.mimeType,
        upsert: false,
      })
    if (processedUploadError) {
      console.warn("processed image upload failed:", processedUploadError)
    }

    // Call Gemini with a single retry on transient errors. Gemini's free tier
    // occasionally 503s under load; one retry is usually enough.
    let result
    try {
      result = await withRetry(() =>
        extractScorecardWithGemini(processed.buffer, processed.mimeType, apiKey),
      )
    } catch (err: any) {
      console.error("Gemini extraction failed:", err)
      return {
        success: false,
        error:
          "We couldn't read the scorecard. Try a clearer photo or fill out the form manually.",
      }
    }

    console.log("[ocr] gemini result", {
      rawImagePath: imagePath,
      processedImagePath,
      preprocessSteps: processed.steps,
      userId: session.user.id,
      playersFound: result.players.length,
      warnings: result.warnings,
      playerSummary: result.players.map((p) => ({
        name: p.name,
        scoresFilled: p.scores.filter((s) => s !== null).length,
        warnings: p.warnings,
      })),
    })

    return {
      success: true,
      imagePath,
      processedImagePath: processedUploadError ? undefined : processedImagePath,
      preprocessSteps: processed.steps,
      players: result.players.map((p) => ({
        name: p.name,
        scores: p.scores,
        warnings: p.warnings,
      })),
      warnings: result.warnings,
      debug: result,
    }
  } catch (error: any) {
    console.error("Error in uploadAndParseScorecard:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Produce a short-lived signed URL for a previously-uploaded scorecard image.
export async function getScorecardSignedUrl(
  imagePath: string,
): Promise<{ url: string } | { error: string }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(imagePath, 60 * 60 * 24 * 7) // 7 days
    if (error || !data) {
      return { error: error?.message ?? "Could not generate signed URL" }
    }
    return { url: data.signedUrl }
  } catch (error: any) {
    return { error: error.message || "Unexpected error" }
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    // One retry, no backoff — Gemini latency is already multi-second and
    // exponential backoff would blow the server-action timeout budget.
    console.warn("[ocr] gemini retry after first failure:", err)
    return await fn()
  }
}
