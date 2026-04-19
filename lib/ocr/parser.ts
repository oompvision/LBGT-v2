import type { VisionResponse, VisionWord, Vertex } from "./vision"
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

  const players: ParsedPlayer[] = []
  for (const row of playerRows) {
    const parsed = parsePlayerRow(row, anchors)
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
  // Group words by rough y-bands, then find the band that contains the most
  // HOLES_ANCHOR_LABELS tokens — that's the HOLES row.
  const candidates: Map<number, VisionWord[]> = new Map()
  for (const w of words) {
    const y = Math.round(wordCenter(w).y / 10) * 10 // 10-px bucket
    if (!candidates.has(y)) candidates.set(y, [])
    candidates.get(y)!.push(w)
  }

  let bestBand: VisionWord[] = []
  let bestScore = 0
  for (const [, band] of candidates) {
    const hits = band.filter((w) =>
      HOLES_ANCHOR_LABELS.includes(w.text as (typeof HOLES_ANCHOR_LABELS)[number]),
    )
    if (hits.length > bestScore) {
      bestScore = hits.length
      bestBand = band
    }
  }

  // Need at least most of the 21 labels to trust the anchor.
  if (bestScore < 10) return null

  // Build one anchor per label; for duplicate labels ("1" appears in hole 1 AND
  // hole 10/11/12/... as a digit of the two-digit number — but Vision tokenizes
  // "10" as a single word), we pick the leftmost-to-rightmost match order.
  const labelled = bestBand
    .filter((w) =>
      HOLES_ANCHOR_LABELS.includes(w.text as (typeof HOLES_ANCHOR_LABELS)[number]),
    )
    .map((w) => ({ text: w.text, x: wordCenter(w).x }))
    .sort((a, b) => a.x - b.x)

  // Map labels to anchors in left-to-right order.
  const anchors: AnchoredColumn[] = []
  const remaining = [...HOLES_ANCHOR_LABELS]
  for (const item of labelled) {
    const idx = remaining.findIndex((label) => label === item.text)
    if (idx === -1) continue
    // Consume this label only if it's the next expected one (prevents a stray
    // "1" elsewhere in the card from stealing the anchor for hole 1).
    if (idx === 0) {
      anchors.push({ label: remaining[0], x: item.x })
      remaining.shift()
    }
  }

  if (anchors.length < 10) return null
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
}

// Anything whose name matches one of these is a printed course-info row, not
// a player — we skip it even though it shares the player-row layout.
const PRINTED_ROW_LABELS = /^(par|blue|white|gold|red|hcp|pace|holes|out|in|total|yard|yards|yardage|scorer|attest|initial|a\/e|p\/k|ard)$/i

function groupPlayerRows(
  words: VisionWord[],
  holesRowY: number,
  anchors: AnchoredColumn[],
): PlayerRow[] {
  const hole1 = anchors.find((a) => a.label === "1")
  const hole18 = anchors.find((a) => a.label === "18")
  if (!hole1 || !hole18) return []

  // Cluster words above the HOLES row by y-proximity. Threshold: 20px is tight
  // enough to separate typical golf-scorecard rows (~30–50px tall each) and
  // loose enough to keep a single row's words together even if it's tilted.
  const Y_CLUSTER_THRESHOLD = 20
  const above = words
    .filter((w) => wordCenter(w).y < holesRowY - 10)
    .sort((a, b) => wordCenter(a).y - wordCenter(b).y)

  const clusters: VisionWord[][] = []
  for (const w of above) {
    const y = wordCenter(w).y
    const last = clusters[clusters.length - 1]
    if (last && Math.abs(averageY(last) - y) <= Y_CLUSTER_THRESHOLD) {
      last.push(w)
    } else {
      clusters.push([w])
    }
  }

  const rows: PlayerRow[] = []
  for (const cluster of clusters) {
    const sorted = [...cluster].sort((a, b) => wordCenter(a).x - wordCenter(b).x)

    // Name is everything in the leftmost column (x < hole-1 anchor).
    const nameWords = sorted.filter((w) => wordCenter(w).x < hole1.x - 10 && !/^\d+$/.test(w.text))
    const name = nameWords.map((w) => w.text).join(" ").trim()
    if (!name) continue
    if (PRINTED_ROW_LABELS.test(name)) continue

    // Require at least 3 digit tokens inside the hole-columns area — otherwise
    // this row isn't a scores row at all.
    const scoreDigits = sorted.filter(
      (w) =>
        /^\d{1,3}$/.test(w.text) &&
        wordCenter(w).x >= hole1.x - 15 &&
        wordCenter(w).x <= hole18.x + 15,
    )
    if (scoreDigits.length < 3) continue

    rows.push({ name, words: sorted })
  }

  return rows
}

// ---- per-row score extraction ------------------------------------------

function parsePlayerRow(row: PlayerRow, anchors: AnchoredColumn[]): ParsedPlayer | null {
  const hole1 = anchors.find((a) => a.label === "1")
  const hole2 = anchors.find((a) => a.label === "2")
  if (!hole1 || !hole2) return null

  // Half the inter-column distance = tolerance on either side of an anchor x.
  const colWidth = hole2.x - hole1.x
  const tol = colWidth * 0.55

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
    const value = extractScoreInColumn(row.words, anchor.x, tol)
    if (value !== null) scores[i] = value
  }

  // Validate using Out / In / Total from the scorecard.
  const outAnchor = anchors.find((a) => a.label === "Out")
  const inAnchor = anchors.find((a) => a.label === "In")
  const totalAnchor = anchors.find((a) => a.label === "Total")

  const reportedOut = outAnchor
    ? extractScoreInColumn(row.words, outAnchor.x, tol, { maxValue: 200 })
    : null
  const reportedIn = inAnchor
    ? extractScoreInColumn(row.words, inAnchor.x, tol, { maxValue: 200 })
    : null
  const reportedTotal = totalAnchor
    ? extractScoreInColumn(row.words, totalAnchor.x, tol, { maxValue: 400 })
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
