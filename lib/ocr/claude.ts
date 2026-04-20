// Claude Sonnet 4.6 scorecard extractor.
//
// Replaces the Gemini pipeline. Uses:
//   - Forced tool use for guaranteed-valid structured output (the
//     `submit_scorecard` tool's input_schema matches our JSON contract;
//     tool_choice: {type: "tool"} forces Claude to produce that exact shape).
//   - Prompt caching on the system prompt (`cache_control: {type: "ephemeral"}`)
//     — identical across calls, so we pay the cache-write premium once and
//     then ~10% of base input price on every subsequent call.
//   - Typed error classes from the SDK (Anthropic.RateLimitError, etc.) —
//     no string matching on error messages.
//
// The SDK auto-retries 429s and 5xx errors with exponential backoff
// (max_retries=2 default), so we don't need a custom retry loop.

import Anthropic from "@anthropic-ai/sdk"

const MODEL_ID = "claude-sonnet-4-6"
// Plenty of headroom for our JSON output (~500-800 tokens typical) while
// staying well under Sonnet 4.6's 64K output cap.
const MAX_TOKENS = 4096

const SYSTEM_PROMPT = `You are extracting data from a handwritten golf scorecard photo.

Scores per hole are integers, almost always 1-12. Par is usually 3, 4, or 5.

CRITICAL — when to return null for a hole:
- The cell is blank.
- The handwriting is genuinely illegible and you are less than highly confident.
- A stamp (e.g. "CART PATH ONLY") fully obscures the handwritten digit so
  you cannot see it at all. Return null.
Never guess. A wrong number is worse than null. If you are even a little unsure,
return null and add a warning. The user will fill in blanks manually.

STAMPS — partially obscured cells:
If a stamp like "CART PATH ONLY" OVERLAPS a cell but you can still see the
handwritten digit through or around the stamp AND are confident in the
reading, DO return the score. But in that case also add the hole number to
lowConfidenceHoles so the UI flags it for user verification. In short:
- Stamp + digit visible + confident → return the score AND add to
  lowConfidenceHoles.
- Stamp fully obscures digit, or you're guessing → return null.

For each player, ALSO return a "lowConfidenceHoles" array listing the hole
numbers (1-18) where your confidence in the score is below ~90% — i.e., you
had to look carefully, the digit is ambiguous (e.g. could be 4 or 9, 6 or 0,
3 or 8), the writing is partially smudged, or you read the digit through a
stamp. Be honest about this — the UI will highlight those cells so the user
can verify. Only include holes where you DID return a number; don't list nulls.

If the card shows Out (holes 1-9), In (holes 10-18), or Total, verify your
per-hole numbers sum correctly. A sum mismatch usually means one of your
per-hole numbers is wrong — double check, and if you're still uncertain,
return null for the ambiguous hole.

The scorecard has up to 4 player rows. Each row has a handwritten name on
the left and 18 hole scores across. Output the players in the order they
appear on the card (top to bottom). Return names exactly as written;
don't normalize capitalization or spelling.

Call the submit_scorecard tool with the extracted data.`

// Shape returned to callers. Matches ScorecardResult in app/actions/ocr.ts.
export type ClaudeScorecardResult = {
  players: Array<{
    name: string
    scores: (number | null)[] // exactly length 18
    // 0-indexed hole positions flagged as low-confidence. Value remains in
    // `scores`; the UI highlights these yellow so the user can verify.
    uncertainHoles: number[]
    warnings: string[]
  }>
  warnings: string[]
  modelUsed: typeof MODEL_ID
  /** Input/output tokens from the Messages API response — logged for
   *  cost tracking. Cache-read tokens cost ~10% of base; cache-write ~1.25x. */
  tokenUsage: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheCreationInputTokens: number
  }
}

const SUBMIT_SCORECARD_TOOL: Anthropic.Tool = {
  name: "submit_scorecard",
  description:
    "Submit the extracted scorecard data. Call this exactly once with all players and warnings.",
  input_schema: {
    type: "object",
    properties: {
      players: {
        type: "array",
        description: "One entry per player row on the scorecard, top to bottom.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Player name as written on the card, verbatim.",
            },
            scores: {
              type: "array",
              description:
                "Exactly 18 hole scores in order. Use null for blank or illegible cells.",
              items: { type: ["integer", "null"] },
              minItems: 18,
              maxItems: 18,
            },
            lowConfidenceHoles: {
              type: "array",
              description:
                "1-indexed hole numbers (1-18) where confidence in the score is below ~90%. Only list holes where you DID return a number.",
              items: { type: "integer", minimum: 1, maximum: 18 },
            },
            warnings: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["name", "scores", "lowConfidenceHoles", "warnings"],
        },
      },
      warnings: {
        type: "array",
        description: "Scorecard-level warnings (not per-player).",
        items: { type: "string" },
      },
    },
    required: ["players", "warnings"],
  },
}

export type ClaudeErrorCategory =
  | "rate-limit"
  | "auth"
  | "server"
  | "timeout"
  | "not-available"
  | "bad-request"
  | "refusal"
  | "parse"
  | "empty"
  | "unknown"

export class ClaudeError extends Error {
  constructor(
    public readonly category: ClaudeErrorCategory,
    message: string,
  ) {
    super(message)
    this.name = "ClaudeError"
  }
}

export async function extractScorecardWithClaude(
  imageBuffer: Buffer,
  mimeType: string,
  apiKey: string,
): Promise<ClaudeScorecardResult> {
  // Only the four base64-friendly image types are accepted by the API.
  const mediaType = normalizeMediaType(mimeType)

  const client = new Anthropic({ apiKey })

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      // Array form so we can attach cache_control to the system text —
      // saves ~90% of input cost on this block across every call.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [SUBMIT_SCORECARD_TOOL],
      // Force Claude to call submit_scorecard (not optional). Combined with
      // the input_schema above, this is our guaranteed-valid JSON contract.
      tool_choice: { type: "tool", name: "submit_scorecard" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Extract the scorecard from this photo. Call submit_scorecard with the data.",
            },
          ],
        },
      ],
    })
  } catch (err: unknown) {
    console.error("[ocr] Claude SDK raw error:", serializeError(err))
    throw classifyClaudeError(err)
  }

  if (response.stop_reason === "refusal") {
    throw new ClaudeError(
      "refusal",
      "Claude declined to process this image. Try a different photo or fill the form manually.",
    )
  }

  const toolUseBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_scorecard",
  )
  if (!toolUseBlock) {
    throw new ClaudeError(
      "empty",
      `Claude didn't call submit_scorecard (stop_reason=${response.stop_reason}).`,
    )
  }

  let parsed
  try {
    parsed = toolUseBlock.input as {
      players: Array<{
        name: string
        scores: Array<number | null>
        lowConfidenceHoles?: number[]
        warnings?: string[]
      }>
      warnings?: string[]
    }
    if (!Array.isArray(parsed?.players)) {
      throw new Error("players missing or not an array")
    }
  } catch (err: any) {
    throw new ClaudeError("parse", `Tool input didn't match the expected shape: ${err?.message}`)
  }

  return {
    players: parsed.players.map((p) => {
      const uncertainHoles = Array.from(
        new Set(
          (p.lowConfidenceHoles ?? [])
            .filter((h): h is number => typeof h === "number" && h >= 1 && h <= 18)
            .map((h) => h - 1),
        ),
      )
      return {
        name: p.name,
        scores: normalizeScores(p.scores),
        uncertainHoles,
        warnings: Array.isArray(p.warnings) ? p.warnings : [],
      }
    }),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    modelUsed: MODEL_ID,
    tokenUsage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  }
}

// Pad/truncate to 18 entries and defensively null out implausible values
// (<1 or >15). We keep all confident values — the UI handles uncertainty
// via the separate uncertainHoles flag.
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

function normalizeMediaType(
  mimeType: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const mt = mimeType.toLowerCase()
  if (mt === "image/jpeg" || mt === "image/jpg") return "image/jpeg"
  if (mt === "image/png") return "image/png"
  if (mt === "image/gif") return "image/gif"
  if (mt === "image/webp") return "image/webp"
  // Unknown — Claude will reject anything else with a 400; default to jpeg
  // since our preprocess step re-encodes to jpeg.
  return "image/jpeg"
}

// Anthropic SDK error classes are exported on the default export as a
// namespace. Using instanceof avoids string-matching on error messages.
function classifyClaudeError(err: unknown): ClaudeError {
  if (err instanceof Anthropic.RateLimitError) {
    return new ClaudeError(
      "rate-limit",
      "Anthropic rate limit reached. Wait a minute and try again.",
    )
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new ClaudeError(
      "auth",
      "Anthropic API key is invalid or missing. Check ANTHROPIC_API_KEY in Vercel.",
    )
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError(
      "auth",
      "Anthropic API key lacks permission for this model.",
    )
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new ClaudeError(
      "not-available",
      `Model "${MODEL_ID}" is not available on this API key.`,
    )
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new ClaudeError(
      "bad-request",
      `Anthropic rejected the request: ${err.message.slice(0, 200)}`,
    )
  }
  if (err instanceof Anthropic.InternalServerError) {
    return new ClaudeError(
      "server",
      "Anthropic server error. Usually transient — try again in a few seconds.",
    )
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ClaudeError(
      "timeout",
      "Couldn't reach Anthropic (connection error). Try again.",
    )
  }
  if (err instanceof Anthropic.APIError) {
    // Catch-all for anything with a status code that didn't match the
    // specific subclasses above.
    if (err.status && err.status >= 500) {
      return new ClaudeError(
        "server",
        `Anthropic server error ${err.status}. Try again.`,
      )
    }
    return new ClaudeError("unknown", `Anthropic API error (${err.status}): ${err.message}`)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new ClaudeError("unknown", message)
}

function serializeError(err: unknown): Record<string, unknown> {
  const e = err as any
  return {
    name: e?.name,
    message: e?.message,
    status: e?.status,
    constructor: e?.constructor?.name,
    stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 5).join("\n") : undefined,
  }
}
