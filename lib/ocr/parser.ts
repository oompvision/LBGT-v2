import type { VisionResponse, VisionWord } from "./vision"
import { wordCenter } from "./vision"

// Parsed output for one handwritten player row on the scorecard.
// scores[i] === null means "OCR couldn't read this cell — user must fill it in".
export type ParsedPlayer = {
  name: string
  scores: (number | null)[] // length 18
  warnings: string[] // e.g. "Front 9 sum (46) doesn't match Out column (48)"
}

export type ParsedScorecard = {
  players: ParsedPlayer[]
  warnings: string[] // scorecard-level warnings (e.g. "Couldn't find HOLES row")
}

// The HOLES row on the scorecard has the printed labels:
//   1 2 3 4 5 6 7 8 9 Out 10 11 12 13 14 15 16 17 18 In Total
// We use it as the anchor for every score column's x-position.
const HOLES_ANCHOR_LABELS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "Out",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "In",
  "Total",
] as const

// Words that appear as stamps or printed markings inside score cells.
// If the OCR text starts with any of these we treat the cell as unreadable.
const IGNORE_TOKENS = ["CART", "PATH", "ONLY", "GIR", "GR", "CR"]

// Any row whose name column contains ONE OF these words is a printed course-
// info row (Blue, Blue Hcp, White Hcp, Par, etc.), not a player row.
const BLACKLIST_WORDS = new Set([
  "par",
  "blue",
  "white",
  "gold",
  "red",
  "hcp",
  "pace",
  "holes",
  "out",
  "in",
  "total",
  "yard",
  "yards",
  "yardage",
  "scorer",
  "attest",
  "initial",
  "play",
  "ard", // partial OCR of "yard"
])

type AnchoredColumn = {
  label: (typeof HOLES_ANCHOR_LABELS)[number]
  x: number // center x of the HOLES-row label
}

export function parseScorecard(response: VisionResponse): ParsedScorecard {
  const warnings: string[] = []

  const anchorResult = findColumnAnchors(response.words)
  if (!anchorResult) {
    return {
      players: [],
      warnings: [
        "Couldn't find the HOLES row on the scorecard. Make sure the whole card is in frame and the photo is well-lit.",
      ],
    }
  }

  const { anchors, holesRowY } = anchorResult

  // Player rows sit ABOVE the HOLES row (the photo orientation puts handwritten
  // player scores between the printed course info and the HOLES label row).
  const playerRows = groupPlayerRows(response.words, holesRowY, anchors)

  // Estimate row height from the spacing between detected name rows, so we
  // can set a sensible y-tolerance when pulling score tokens for each row.
  const rowHeight = estimateRowHeight(playerRows)

  const players: ParsedPlayer[] = []
  for (const row of playerRows) {
    const parsed = parsePlayerRow(row, anchors, response.words, rowHeight)
    if (parsed) players.push(parsed)
  }

  if (players.length === 0) {
    warnings.push(
      "Couldn't detect any player rows. Make sure names and scores are clearly visible.",
    )
  }

  return { players, warnings }
}

// ---- anchor detection ---------------------------------------------------

function findColumnAnchors(
  words: VisionWord[],
): { anchors: AnchoredColumn[]; holesRowY: number } | null {
  // Candidates are any word whose text matches one of the HOLES labels.
  // Note: numeric labels ("1"-"18") can appear elsewhere on the card (printed
  // handicap rows, yardages), so we locate the HOLES row by finding the
  // y-band that contains the MOST of these candidates at once.
  const HOLES_SET = new Set<string>(HOLES_ANCHOR_LABELS)
  const candidates = words.filter((w) => HOLES_SET.has(w.text))
  if (candidates.length < 8) return null

  // Sliding window over each candidate's y: count how many candidates fall
  // within ±BAND_RADIUS of that y. Handles tilted / slightly warped photos
  // where the HOLES row spans 20-40px of y-range.
  const BAND_RADIUS = 25
  let bestBand: VisionWord[] = []
  for (const c of candidates) {
    const centerY = wordCenter(c).y
    const band = candidates.filter(
      (other) => Math.abs(wordCenter(other).y - centerY) <= BAND_RADIUS,
    )
    if (band.length > bestBand.length) bestBand = band
  }

  // Need at least 8 of the 21 labels to trust the anchor.
  if (bestBand.length < 8) return null

  // Build anchors in left-to-right order, consuming expected labels one at a
  // time. This prevents a stray duplicate (e.g. a printed "1" at the far
  // right) from stealing the anchor for hole 1.
  const labelled = bestBand
    .map((w) => ({ text: w.text, x: wordCenter(w).x }))
    .sort((a, b) => a.x - b.x)

  const anchors: AnchoredColumn[] = []
  const remaining: string[] = [...HOLES_ANCHOR_LABELS]
  for (const item of labelled) {
    if (remaining.length === 0) break
    if (item.text === remaining[0]) {
      anchors.push({ label: remaining[0] as AnchoredColumn["label"], x: item.x })
      remaining.shift()
    }
  }

  if (anchors.length < 8) return null
  return { anchors, holesRowY: averageY(bestBand) }
}

function averageY(words: VisionWord[]): number {
  if (words.length === 0) return 0
  return words.reduce((sum, w) => sum + wordCenter(w).y, 0) / words.length
}

// ---- row grouping -------------------------------------------------------

type PlayerRow = {
  name: string
  words: VisionWord[]
  rowY: number // anchored y of this player's name (used to filter scores by y)
}

function isBlacklisted(name: string): boolean {
  return name
    .toLowerCase()
    .split(/\s+/)
    .some((w) => BLACKLIST_WORDS.has(w.replace(/[^a-z]/g, "")))
}

// Anchor rows on NAME tokens rather than clustering every word by y. This is
// much more robust on folded/tilted photos where a player's left-side and
// right-side scores sit at different y values — the name is the stable anchor
// we associate scores with.
function groupPlayerRows(
  words: VisionWord[],
  holesRowY: number,
  anchors: AnchoredColumn[],
): PlayerRow[] {
  const hole1 = anchors.find((a) => a.label === "1")
  if (!hole1) return []

  // Candidate name tokens: any word sitting in the leftmost column above the
  // HOLES row that looks like a name (letters, 2+ characters).
  const nameCandidates = words.filter((w) => {
    const { x, y } = wordCenter(w)
    if (y >= holesRowY - 10) return false
    if (x >= hole1.x - 5) return false
    if (w.text.length < 2) return false
    if (!/[a-zA-Z]/.test(w.text)) return false
    if (/^\d+$/.test(w.text)) return false
    return true
  })

  // A name can be split across tokens (e.g. "J" + "Smith"). Merge adjacent
  // name candidates that are close in both x and y into a single row-name.
  const merged: { name: string; y: number }[] = []
  const sorted = [...nameCandidates].sort((a, b) => wordCenter(a).y - wordCenter(b).y)
  for (const w of sorted) {
    const { y } = wordCenter(w)
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.y - y) <= 20) {
      last.name = `${last.name} ${w.text}`.trim()
      last.y = (last.y + y) / 2
    } else {
      merged.push({ name: w.text, y })
    }
  }

  const rows: PlayerRow[] = []
  for (const m of merged) {
    if (isBlacklisted(m.name)) continue
    rows.push({ name: m.name, words: [], rowY: m.y })
  }
  return rows
}

// ---- per-row score extraction ------------------------------------------

function estimateRowHeight(rows: PlayerRow[]): number {
  if (rows.length < 2) return 45
  const ys = rows.map((r) => r.rowY).sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < ys.length; i++) gaps.push(ys[i] - ys[i - 1])
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)]
  return Math.max(30, Math.min(80, median))
}

function parsePlayerRow(
  row: PlayerRow,
  anchors: AnchoredColumn[],
  allWords: VisionWord[],
  rowHeight: number,
): ParsedPlayer | null {
  const hole1 = anchors.find((a) => a.label === "1")
  const hole2 = anchors.find((a) => a.label === "2")
  if (!hole1 || !hole2) return null

  // Half the inter-column distance = tolerance on either side of an anchor x.
  const colWidth = hole2.x - hole1.x
  const xTol = colWidth * 0.55
  // y tolerance: keep it below half a row-height so we don't grab the next
  // player's digits. If rowHeight is 50, tolerance is ~22px — enough to
  // absorb fold-related y drift within a single row.
  const yTol = Math.max(15, rowHeight * 0.45)

  // Digits associated with this player row: within yTol of the name's y.
  const rowDigits = allWords.filter((w) => {
    const { y } = wordCenter(w)
    if (Math.abs(y - row.rowY) > yTol) return false
    return /^\d{1,3}$/.test(w.text)
  })

  if (rowDigits.length < 2) return null

  const scores: (number | null)[] = Array(18).fill(null)
  const warnings: string[] = []

  const holeLabels = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
  ] as const

  for (let i = 0; i < 18; i++) {
    const anchor = anchors.find((a) => a.label === holeLabels[i])
    if (!anchor) continue
    const value = extractScoreInColumn(rowDigits, anchor.x, xTol)
    if (value !== null) scores[i] = value
  }

  // Validate using Out / In / Total from the scorecard.
  const outAnchor = anchors.find((a) => a.label === "Out")
  const inAnchor = anchors.find((a) => a.label === "In")
  const totalAnchor = anchors.find((a) => a.label === "Total")

  const reportedOut = outAnchor
    ? extractScoreInColumn(rowDigits, outAnchor.x, xTol, { maxValue: 200 })
    : null
  const reportedIn = inAnchor
    ? extractScoreInColumn(rowDigits, inAnchor.x, xTol, { maxValue: 200 })
    : null
  const reportedTotal = totalAnchor
    ? extractScoreInColumn(rowDigits, totalAnchor.x, xTol, { maxValue: 400 })
    : null

  const frontSum = sumOrNull(scores.slice(0, 9))
  const backSum = sumOrNull(scores.slice(9, 18))

  if (frontSum !== null && reportedOut !== null && frontSum !== reportedOut) {
    warnings.push(
      `Front 9 scores sum to ${frontSum} but the Out column reads ${reportedOut}. Double-check holes 1–9.`,
    )
  }
  if (backSum !== null && reportedIn !== null && backSum !== reportedIn) {
    warnings.push(
      `Back 9 scores sum to ${backSum} but the In column reads ${reportedIn}. Double-check holes 10–18.`,
    )
  }
  if (
    frontSum !== null &&
    backSum !== null &&
    reportedTotal !== null &&
    frontSum + backSum !== reportedTotal
  ) {
    warnings.push(
      `Scores sum to ${frontSum + backSum} but the Total column reads ${reportedTotal}.`,
    )
  }

  return { name: row.name, scores, warnings }
}

function extractScoreInColumn(
  words: VisionWord[],
  centerX: number,
  tol: number,
  opts: { maxValue?: number } = {},
): number | null {
  const maxValue = opts.maxValue ?? 20 // single-hole scores are basically always ≤ 15

  // Candidates: numeric tokens inside the column's x-tolerance, sorted by confidence.
  const candidates = words
    .filter((w) => {
      const cx = wordCenter(w).x
      return Math.abs(cx - centerX) <= tol
    })
    .filter((w) => {
      const t = w.text.toUpperCase()
      if (IGNORE_TOKENS.some((ignore) => t.includes(ignore))) return false
      return /^\d{1,3}$/.test(w.text)
    })
    .map((w) => ({ value: parseInt(w.text, 10), confidence: w.confidence }))
    .filter((c) => c.value > 0 && c.value <= maxValue)
    .sort((a, b) => b.confidence - a.confidence)

  if (candidates.length === 0) return null
  return candidates[0].value
}

function sumOrNull(arr: (number | null)[]): number | null {
  if (arr.some((v) => v === null)) return null
  return (arr as number[]).reduce((sum, v) => sum + v, 0)
}
