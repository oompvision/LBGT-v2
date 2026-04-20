// Gemini 2.5 Flash scorecard extractor.
//
// Replaces the Google Vision + custom parser pipeline. Gemini reads the
// scorecard photo holistically and returns structured JSON, so we skip the
// entire anchor-detection / column-alignment / digit-assignment machinery
// the old parser needed. Much simpler, and empirically more accurate on
// handwritten tables with folds and stamps.

import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai"

const MODEL_ID = "gemini-2.5-flash"

const SYSTEM_PROMPT = `You are extracting data from a handwritten golf scorecard photo.
Return valid JSON matching the provided schema, no other text.

Scores per hole are integers, almost always 1-12. Par is usually 3, 4, or 5.

CRITICAL — when to return null for a hole:
- The cell is obscured by a "CART PATH ONLY" stamp (or any stamp). ALWAYS null.
- The cell is blank.
- The handwriting is genuinely illegible and you are less than highly confident.
Never guess. A wrong number is worse than null. If you are even a little unsure,
return null and add a warning. The user will fill in blanks manually.

For each player, ALSO return a "lowConfidenceHoles" array listing the hole
numbers (1-18) where your confidence in the score is below ~90% — i.e., you
had to look carefully, the digit is ambiguous (e.g. could be 4 or 9, 6 or 0,
3 or 8), or the writing is partially smudged. Be honest about this — the UI
will highlight those cells so the user can verify them. Only include holes
where you DID return a number; don't list nulls.

If the card shows Out (holes 1-9), In (holes 10-18), or Total, verify your
per-hole numbers sum correctly and flag mismatches in the warnings array.
A sum mismatch usually means one of your per-hole numbers is wrong — double
check before returning it, and if you're still uncertain, return null for the
ambiguous hole.

The scorecard has up to 4 player rows. Each row has a handwritten name on
the left and 18 hole scores across. Output the players in the order they
appear on the card (top to bottom). Return names exactly as written;
don't normalize capitalization or spelling.`

// Matches OcrResult shape in app/actions/ocr.ts so the server action can
// pass this straight through to the client.
export type GeminiScorecardResult = {
  players: Array<{
    name: string
    scores: (number | null)[] // exactly length 18
    // 0-indexed hole positions Gemini flagged as low-confidence. The score
    // value is always null for these — we drop Gemini's best guess and let
    // the user fill in manually, with the cell highlighted in the UI.
    uncertainHoles: number[]
    warnings: string[]
  }>
  warnings: string[] // scorecard-level warnings
}

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    players: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          scores: {
            type: SchemaType.ARRAY,
            items: {
              // Nullable integer so Gemini can express "unreadable" (CART
              // PATH ONLY stamp, blank cell, illegible handwriting) directly
              // rather than being forced to guess a number that fits the
              // schema. In testing, forcing non-null types made Gemini fill
              // in stamped cells with invented scores.
              type: SchemaType.INTEGER,
              nullable: true,
            },
          },
          lowConfidenceHoles: {
            type: SchemaType.ARRAY,
            // 1-indexed hole numbers (1-18) where Gemini's confidence is
            // <~90%. We null those scores in the adapter and highlight them
            // in the UI so the user verifies / re-enters them.
            items: { type: SchemaType.INTEGER },
          },
          warnings: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["name", "scores", "lowConfidenceHoles", "warnings"],
      },
    },
    warnings: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["players", "warnings"],
}

export async function extractScorecardWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  apiKey: string,
): Promise<GeminiScorecardResult> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0, // deterministic-ish; avoid random number hallucination
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  })

  let result
  try {
    result = await model.generateContent([
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      },
      {
        text: "Extract the scorecard per the system instructions. Return null for any hole you can't read with high confidence, especially cells covered by CART PATH ONLY stamps. List shaky but-readable holes in lowConfidenceHoles.",
      },
    ])
  } catch (err: any) {
    // Log everything we can about the SDK error — users see only the
    // classified category, but Vercel logs should have the full diagnostic.
    console.error("[ocr] Gemini SDK raw error:", {
      name: err?.name,
      message: err?.message,
      status: err?.status ?? err?.code ?? err?.response?.status,
      cause: err?.cause?.message ?? err?.cause,
      stack: err?.stack?.split("\n").slice(0, 5).join("\n"),
    })
    throw classifyGeminiError(err)
  }

  let text: string
  try {
    text = result.response.text()
  } catch (err: any) {
    throw new GeminiError("empty", "Gemini returned an empty response (may have been blocked by safety filters). Try a different photo.")
  }

  let parsed
  try {
    parsed = JSON.parse(text) as {
      players: Array<{
        name: string
        scores: Array<number | null>
        lowConfidenceHoles?: number[]
        warnings: string[]
      }>
      warnings: string[]
    }
  } catch (err: any) {
    throw new GeminiError("parse", `Gemini returned non-JSON output: ${text.slice(0, 200)}`)
  }

  return {
    players: parsed.players.map((p) => {
      // Convert 1-indexed hole numbers from Gemini into 0-indexed slot
      // positions for the UI, and drop any that are out of range.
      const uncertainHoles = Array.from(
        new Set(
          (p.lowConfidenceHoles ?? [])
            .filter((h): h is number => typeof h === "number" && h >= 1 && h <= 18)
            .map((h) => h - 1),
        ),
      )
      const scores = normalizeScores(p.scores, uncertainHoles)
      return {
        name: p.name,
        scores,
        uncertainHoles,
        warnings: Array.isArray(p.warnings) ? p.warnings : [],
      }
    }),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  }
}

// Categorize errors from the Gemini SDK so the caller can translate each
// category into a useful user-facing message and decide whether to retry.
export type GeminiErrorCategory =
  | "rate-limit"
  | "auth"
  | "server"
  | "timeout"
  | "parse"
  | "empty"
  | "unknown"

export class GeminiError extends Error {
  constructor(
    public readonly category: GeminiErrorCategory,
    message: string,
  ) {
    super(message)
    this.name = "GeminiError"
  }
}

function classifyGeminiError(err: any): GeminiError {
  // Pull every bit of information the SDK exposes. Different SDK versions put
  // the actual status in different places (message, status, code, cause).
  const message = err?.message ?? String(err)
  const causeMessage = err?.cause?.message ?? ""
  const status = err?.status ?? err?.code ?? err?.response?.status ?? err?.cause?.status
  const haystack = `${message} ${causeMessage} ${status ?? ""}`

  if (/429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(haystack)) {
    return new GeminiError(
      "rate-limit",
      "Gemini rate limit reached. Free tier allows ~10 requests per minute — wait a minute and try again.",
    )
  }
  if (/401|403|API key|unauthorized|permission/i.test(haystack)) {
    return new GeminiError(
      "auth",
      "Gemini API key is invalid or missing. Check GEMINI_API_KEY in Vercel environment variables.",
    )
  }
  // Fetch-level failures show up as "Error fetching from ..." from the SDK,
  // with the real HTTP status (if any) hidden in cause/response. Check the
  // fetch-failure pattern BEFORE the 5xx regex so the user gets the more
  // accurate "timeout — try again" message for those cases.
  if (/fetch|network|ETIMEDOUT|ECONNRESET|aborted|timeout|Error fetching/i.test(haystack)) {
    return new GeminiError(
      "timeout",
      `Couldn't reach Gemini (${message.slice(0, 140)}). Gemini's free tier can be flaky — wait 30 seconds and try again.`,
    )
  }
  if (/500|502|503|504|UNAVAILABLE|internal/i.test(haystack)) {
    return new GeminiError(
      "server",
      `Gemini server error (${message.slice(0, 140)}). Usually transient — try again in a few seconds.`,
    )
  }
  return new GeminiError("unknown", message)
}

// Coerce Gemini's scores array to exactly 18 entries of (number | null).
// - Out-of-range integers (<1 or >15) are nulled defensively.
// - Any slot Gemini flagged as low-confidence is nulled so the UI shows it
//   blank. We keep the flag (in uncertainHoles) so the cell can be styled.
function normalizeScores(
  scores: Array<number | null>,
  uncertainHoles: number[],
): (number | null)[] {
  const uncertain = new Set(uncertainHoles)
  const out: (number | null)[] = Array(18).fill(null)
  for (let i = 0; i < 18; i++) {
    if (uncertain.has(i)) continue
    const v = scores[i]
    if (typeof v !== "number") continue
    if (v < 1 || v > 15) continue
    out[i] = v
  }
  return out
}
