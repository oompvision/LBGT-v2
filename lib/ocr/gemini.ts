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
If the card shows Out (holes 1-9), In (holes 10-18), or Total, verify your
per-hole numbers sum correctly and flag mismatches in the warnings array.
If a hole number is illegible, set it to null and add a warning.
Never guess — prefer null over a wrong number.

The scorecard has up to 4 player rows. Each row has a handwritten name on
the left and 18 hole scores across. Some cells may have "CART PATH ONLY"
stamps or other obstructions — return null for those cells.

Output the players in the order they appear on the card (top to bottom).
For each player, return the name exactly as written (don't normalize
capitalization or spelling). Include the 18 hole scores in order, using
null for any you can't read confidently.`

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
              // Gemini's JSON schema doesn't support union types, so we use
              // INTEGER and treat out-of-bounds / null as "unreadable" later.
              // The prompt tells it to use 0 for unreadable; we convert back
              // to null in the adapter.
              type: SchemaType.INTEGER,
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

// Gemini's structured output doesn't support nullable integers in the same
// array. Telling the model "use 0 for unreadable" and then mapping 0 → null
// here keeps the schema simple while preserving the "user must fill blank
// cells" UX the submit form relies on.
const UNREADABLE_SENTINEL = 0

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
      text: "Extract the scorecard per the system instructions. Use 0 for any hole score you cannot read confidently — do not guess.",
    },
  ])

  const text = result.response.text()
  const parsed = JSON.parse(text) as {
    players: Array<{
      name: string
      scores: number[]
      warnings: string[]
    }>
    warnings: string[]
  }

  // Normalize: 0 is our "unreadable" sentinel → null. Also pad/truncate
  // scores to exactly 18 entries so downstream code can rely on the shape.
  return {
    players: parsed.players.map((p) => ({
      name: p.name,
      scores: normalizeScores(p.scores),
      warnings: Array.isArray(p.warnings) ? p.warnings : [],
    })),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  }
}

function normalizeScores(scores: number[]): (number | null)[] {
  const out: (number | null)[] = Array(18).fill(null)
  for (let i = 0; i < 18; i++) {
    const v = scores[i]
    if (typeof v !== "number" || v === UNREADABLE_SENTINEL) continue
    // Clamp to plausible range — a legit hole score is 1-15 basically ever.
    if (v < 1 || v > 15) continue
    out[i] = v
  }
  return out
}
