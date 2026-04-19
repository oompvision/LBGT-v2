"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { detectDocumentText } from "@/lib/ocr/vision"
import { parseScorecard } from "@/lib/ocr/parser"
import { preprocessImage, type PreprocessOptions } from "@/lib/ocr/preprocess"

// TODO: drop back to 5 once the parser is dialed in. Tuning requires many
// upload attempts per day, and we're well inside the 1000/month free tier.
const DAILY_LIMIT = 100
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (phone photos can be big)
const STORAGE_BUCKET = "scorecards"

export type OcrPlayerResult = {
  name: string // raw OCR'd name — user picks the matching player manually
  scores: (number | null)[] // length 18; null = couldn't read
  warnings: string[]
}

export type OcrResult =
  | {
      success: true
      imagePath: string // storage path (not a URL) — we sign URLs on read
      processedImagePath?: string
      preprocessSteps: string[]
      players: OcrPlayerResult[]
      warnings: string[]
      debug?: unknown // parser diagnostic — shown in UI while the feature is new
    }
  | { success: false; error: string }

// Parse form-data fields of the form `opt-<name>` into PreprocessOptions.
// Anything not present falls back to module defaults.
function parsePreprocessOptions(formData: FormData): PreprocessOptions {
  const bool = (key: string): boolean | undefined => {
    const v = formData.get(key)
    if (v === null) return undefined
    return v === "true" || v === "on" || v === "1"
  }
  return {
    grayscale: bool("opt-grayscale"),
    perspective: bool("opt-perspective"),
    upscale: bool("opt-upscale"),
    denoise: bool("opt-denoise"),
    threshold: bool("opt-threshold"),
  }
}

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

    const apiKey = process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      console.error("GOOGLE_VISION_API_KEY is not set")
      return { success: false, error: "Scorecard OCR is not configured on the server." }
    }

    // Convert file to a base64 string for the Vision request and a Buffer for storage.
    const arrayBuffer = await file.arrayBuffer()
    const rawBuffer = Buffer.from(arrayBuffer)

    // Upload the raw image first so we always have the source, even if OCR or
    // preprocessing fails — makes debugging user-reported issues much easier.
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

    // Record the rate-limit event AFTER successful upload but BEFORE OCR, so
    // that a spam-retrying user burns their daily quota even if OCR throws.
    await admin.from("ocr_uploads").insert({ user_id: session.user.id })

    // Preprocess. Any per-step toggles arrive as form fields so the client can
    // A/B test stages without a redeploy.
    const preprocessOptions = parsePreprocessOptions(formData)
    let processed
    try {
      processed = await preprocessImage(rawBuffer, preprocessOptions)
    } catch (err: any) {
      console.error("preprocess error — falling back to raw image", err)
      processed = {
        buffer: rawBuffer,
        steps: [`preprocess failed: ${err?.message ?? "unknown"}`],
        width: 0,
        height: 0,
      }
    }

    // Save the processed image alongside the raw for side-by-side comparison.
    // Failures here are non-fatal — worst case we can't diff, but OCR still runs.
    const processedImagePath = `${session.user.id}/${timestamp}-processed.png`
    const { error: processedUploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(processedImagePath, processed.buffer, {
        contentType: "image/png",
        upsert: false,
      })
    if (processedUploadError) {
      console.warn("processed image upload failed:", processedUploadError)
    }

    const base64 = processed.buffer.toString("base64")

    // Call Vision and parse.
    let parsed
    try {
      const vision = await detectDocumentText(base64, apiKey, {
        languageHints: ["en"],
      })
      parsed = parseScorecard(vision)

      // Always log a compact diagnostic for now — easier to tune the parser
      // against real photos than to ask users to reproduce issues.
      console.log("[ocr] parse summary", {
        rawImagePath: imagePath,
        processedImagePath,
        preprocessSteps: processed.steps,
        userId: session.user.id,
        totalWords: vision.words.length,
        playersFound: parsed.players.length,
        warnings: parsed.warnings,
        playerSummary: parsed.players.map((p) => ({
          name: p.name,
          scoresFilled: p.scores.filter((s) => s !== null).length,
          warnings: p.warnings,
        })),
      })
    } catch (err: any) {
      console.error("Vision API / parser error:", err)
      return {
        success: false,
        error:
          "We couldn't read the scorecard. Try a clearer photo or fill out the form manually.",
      }
    }

    return {
      success: true,
      imagePath,
      processedImagePath: processedUploadError ? undefined : processedImagePath,
      preprocessSteps: processed.steps,
      players: parsed.players.map((p) => ({
        name: p.name,
        scores: p.scores,
        warnings: p.warnings,
      })),
      warnings: parsed.warnings,
      debug: parsed.debug,
    }
  } catch (error: any) {
    console.error("Error in uploadAndParseScorecard:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Produce a short-lived signed URL for a previously-uploaded scorecard image.
// Used by the submit flow so the final saved round URL is accessible to
// admins later; never exposes raw bucket paths.
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
