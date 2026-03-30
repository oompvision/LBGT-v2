# Scorecard Image Upload + OCR Feature

## Context
Users currently enter 18-hole scores manually for up to 4 players — a tedious process. This feature lets users photograph their physical scorecard and have AI extract the scores automatically, pre-filling the form. Uncertain scores are highlighted for manual correction.

## Approach: Claude Vision API via Next.js API Route

Use the Anthropic SDK with Claude Sonnet's vision capability to analyze scorecard photos. An API route (not a server action) handles the image because:
- Server actions have a 1MB default body limit; phone photos can exceed this
- The Claude API call takes 3-10 seconds, better suited to an API route
- Cost: ~$0.01-0.02 per scan using `claude-sonnet-4-20250514`

## UX Flow

1. User selects players (existing flow — gives context for who's on the card)
2. User uploads/photographs their scorecard via a new upload component
3. App sends image + player names to `/api/ocr`
4. API route calls Claude Vision with a structured prompt including course data (pars, layout)
5. Claude returns JSON with per-player, per-hole scores + confidence levels
6. Form inputs are pre-filled; color-coded borders indicate confidence:
   - Green = high confidence (auto-filled)
   - Yellow = medium confidence (auto-filled, review recommended)
   - Red = low confidence (auto-filled, needs verification)
   - Empty = unreadable (user must enter manually)
7. User reviews, corrects as needed, submits normally (existing flow)

## Files to Create

### 1. `app/api/ocr/route.ts` — OCR API endpoint
- Accepts POST with `FormData` (image file + player names JSON)
- Verifies auth via Supabase server client (same pattern as `app/actions/scores.ts`)
- Converts image to base64, sends to Claude Vision API
- Prompt includes `COURSE_DATA` from `lib/constants.ts` (pars, handicap indices) for accuracy
- Parses structured JSON response, validates structure (18 holes, correct player count)
- Returns `OCRResponse` typed result
- Config: `export const maxDuration = 30`

### 2. `components/scorecard-upload.tsx` — Upload UI component
- File input with `accept="image/*" capture="environment"` (opens camera on mobile)
- Image preview in collapsible area
- "Scan Scorecard" button with loading spinner
- Disabled until at least one player is selected
- Props: `players`, `onScoresExtracted` callback, `disabled`
- Client-side image size validation (max 10MB)

### 3. `types/ocr.ts` — Shared types
```typescript
export interface ExtractedScore {
  hole: number
  score: number | null
  confidence: "high" | "medium" | "low" | "unreadable" | "empty"
}
export interface ExtractedPlayerScores {
  playerIndex: number
  scores: ExtractedScore[]
}
export interface OCRResponse {
  success: boolean
  players?: ExtractedPlayerScores[]
  error?: string
}
```

## Files to Modify

### 4. `app/scores/submit/score-submission-form.tsx`
- Import and render `ScorecardUpload` between date card and scores table
- Add `scoreConfidence` state: `Record<string, string>` keyed by `${playerIndex}-${holeIndex}`
- Add `onScoresExtracted` handler that calls existing `handleScoreChange` for each extracted score
- Add confidence-based border colors to score `<Input>` elements via `cn()`
- Clear confidence styling when user manually edits a cell
- Add small color legend below the upload component

### 5. `next.config.mjs` — (only if needed)
- May need to add `experimental.serverActions.bodySizeLimit` — but since we're using an API route with `FormData`, the default API route limit (4MB) should suffice for most photos

## Dependencies

- `pnpm add @anthropic-ai/sdk` — Anthropic SDK for Claude Vision API
- Environment variable: `ANTHROPIC_API_KEY` (add to Vercel + `.env.local`)

## Key Implementation Details

**Claude Vision Prompt Strategy:**
- Embed course layout: 18 holes, pars `[4,4,3,4,5,3,4,4,5,3,4,4,5,4,4,3,4,5]`
- Include player names in order (top-to-bottom on card)
- Request structured JSON with confidence per cell
- Golf score sanity checks: typical range 2-8 per hole

**Reuse Existing Patterns:**
- Auth check pattern from `app/actions/scores.ts` (lines 10-18)
- Supabase server client from `lib/supabase/server.ts`
- `COURSE_DATA` from `lib/constants.ts`
- `cn()` utility from `lib/utils.ts` for conditional classNames
- `Loader2` icon already imported in the form
- shadcn `Card`, `Button`, `Alert` components already in use

**Security:**
- API route checks Supabase session before processing
- `ANTHROPIC_API_KEY` is server-only, never exposed to client
- Optional: rate-limit OCR calls per user (e.g., 5/hour)

## Verification

1. **Manual test:** Select 1-2 players, upload a clear scorecard photo, verify scores populate correctly with green borders
2. **Edge cases:** Test with blurry photo (expect more yellow/red borders), test with no players selected (upload should be disabled)
3. **Build check:** `pnpm build` passes
4. **Existing flow:** Submit scores normally without using OCR — no regression
