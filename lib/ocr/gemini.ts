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

If the card shows Out (holes 1-9), In (holes 10-18), or Total, verify your
per-hole numbers sum correctly and flag mismatches in the warnings array.
A sum mismatch usually means one of your per-hole numbers is wrong — double
check before returning it.

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
          warnings: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["name", "scores", "warnings"],
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

  const result = await model.generateContent([
    {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType,
      },
    },
    {
      text: "Extract the scorecard per the system instructions. Return null for any hole you can't read with high confidence, especially cells covered by CART PATH ONLY stamps.",
    },
  ])

  const text = result.response.text()
  const parsed = JSON.parse(text) as {
    players: Array<{
      name: string
      scores: Array<number | null>
      warnings: string[]
    }>
    warnings: string[]
  }

  return {
    players: parsed.players.map((p) => ({
      name: p.name,
      scores: normalizeScores(p.scores),
      warnings: Array.isArray(p.warnings) ? p.warnings : [],
    })),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  }
}

// Coerce Gemini's scores array to exactly 18 entries of (number | null).
// Clamps out-of-range integers to null defensively — a real per-hole score
// is 1-15; anything else is almost certainly a model error.
function normalizeScores(scores: Array<number | null>): (number | null)[] {
  const out: (number | null)[] = Array(18).fill(null)
  for (let i = 0; i < 18; i++) {
    const v = scores[i]
    if (typeof v !== "number") continue
    if (v < 1 || v > 15) continue
    out[i] = v
  }
  return out
}
