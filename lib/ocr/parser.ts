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
  debug?: ParseDebug
}

// Diagnostic info surfaced in the UI and logs so we can tune the parser on
// real photos without asking users to reproduce issues.
export type ParseDebug = {
  totalWords: number
  holesRowY: number | null
  anchors: Array<{ label: string; x: number }>
  nameCandidates: Array<{ text: string; x: number; y: number }>
  mergedNames: Array<{ name: string; y: number; blacklisted: boolean }>
  // Every digit-like token between the top of the card and the HOLES row,
  // with which row (by name) it was assigned to. Helps diagnose column /
  // row misalignment on a real photo without re-running OCR.
  digitTokens: Array<{
    text: string
    x: number
    y: number
    assignedTo: string | null
  }>
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
      debug: {
        totalWords: response.words.length,
        holesRowY: null,
        anchors: [],
        nameCandidates: [],
        mergedNames: [],
        digitTokens: [],
      },
    }
  }

  const { anchors, holesRowY } = anchorResult

  // Player rows sit ABOVE the HOLES row (the photo orientation puts handwritten
  // player scores between the printed course info and the HOLES label row).
  const { rows: playerRows, debug: rowsDebug } = groupPlayerRows(
    response.words,
    holesRowY,
    anchors,
  )

  // Partition digit tokens between the top of the card and HOLES row across
  // the detected player rows by NEAREST rowY. This avoids both gaps and
  // overlaps from a fixed y-tolerance window.
  const { tokensByRow, debugTokens } = assignDigitsToRows(
    response.words,
    playerRows,
    holesRowY,
    anchors,
  )

  const players: ParsedPlayer[] = []
  for (const row of playerRows) {
    const parsed = parsePlayerRow(row, anchors, tokensByRow.get(row.rowY) ?? [])
    if (parsed) players.push(parsed)
  }

  const debug: ParseDebug = {
    totalWords: response.words.length,
    holesRowY: Math.round(holesRowY),
    anchors: anchors.map((a) => ({ label: a.label, x: Math.round(a.x) })),
    nameCandidates: rowsDebug.nameCandidates,
    mergedNames: rowsDebug.mergedNames,
    digitTokens: debugTokens,
  }

  if (players.length === 0) {
    warnings.push(
      "Couldn't detect any player rows. Make sure names and scores are clearly visible.",
    )
  }

  return { players, warnings, debug }
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
): {
  rows: PlayerRow[]
  debug: {
    nameCandidates: Array<{ text: string; x: number; y: number }>
    mergedNames: Array<{ name: string; y: number; blacklisted: boolean }>
  }
} {
  const hole1 = anchors.find((a) => a.label === "1")
  const hole2 = anchors.find((a) => a.label === "2")
  if (!hole1 || !hole2) {
    return { rows: [], debug: { nameCandidates: [], mergedNames: [] } }
  }

  // Scale y-thresholds to image resolution. A column is one "unit" wide;
  // player rows are ~0.8-1.0 units tall. This lets the parser work on
  // 800px thumbnails and 4000px high-res phone photos equally.
  const colWidth = hole2.x - hole1.x
  const mergeY = colWidth * 0.4 // merge name tokens within this y-distance

  // Candidate name tokens: any word sitting LEFT of hole 1 and above HOLES,
  // with some letters in it. Kept intentionally permissive — the blacklist
  // filters out printed course-info rows later.
  const nameCandidates = words.filter((w) => {
    const { x, y } = wordCenter(w)
    if (y >= holesRowY - 8) return false
    if (x >= hole1.x) return false
    if (w.text.length < 1) return false
    if (!/[a-zA-Z]/.test(w.text)) return false
    if (/^\d+$/.test(w.text)) return false
    return true
  })

  // A name can be split across tokens (e.g. "J" + "Smith"). Merge adjacent
  // candidates that share a y-band into a single row-name.
  const merged: { name: string; y: number }[] = []
  const sorted = [...nameCandidates].sort((a, b) => wordCenter(a).y - wordCenter(b).y)
  for (const w of sorted) {
    const { y } = wordCenter(w)
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.y - y) <= mergeY) {
      last.name = `${last.name} ${w.text}`.trim()
      last.y = (last.y + y) / 2
    } else {
      merged.push({ name: w.text, y })
    }
  }

  const rows: PlayerRow[] = []
  const mergedDebug: Array<{ name: string; y: number; blacklisted: boolean }> = []
  for (const m of merged) {
    const blacklisted = isBlacklisted(m.name)
    mergedDebug.push({ name: m.name, y: Math.round(m.y), blacklisted })
    if (blacklisted) continue
    rows.push({ name: m.name, words: [], rowY: m.y })
  }

  return {
    rows,
    debug: {
      nameCandidates: nameCandidates.map((w) => ({
        text: w.text,
        x: Math.round(wordCenter(w).x),
        y: Math.round(wordCenter(w).y),
      })),
      mergedNames: mergedDebug,
    },
  }
}

// ---- per-row score extraction ------------------------------------------

// Assign every digit-like token above the HOLES row to exactly one player
// row using nearest-rowY boundaries. This fully partitions the card by
// midpoints between adjacent name y-values, so a digit can never fall into
// the "gap" between two rows (which a fixed yTol window was prone to).
function assignDigitsToRows(
  words: VisionWord[],
  rows: PlayerRow[],
  holesRowY: number,
  anchors: AnchoredColumn[],
): {
  tokensByRow: Map<number, VisionWord[]>
  debugTokens: ParseDebug["digitTokens"]
} {
  const tokensByRow = new Map<number, VisionWord[]>()
  for (const r of rows) tokensByRow.set(r.rowY, [])
  const debugTokens: ParseDebug["digitTokens"] = []

  if (rows.length === 0) return { tokensByRow, debugTokens }

  const sortedRows = [...rows].sort((a, b) => a.rowY - b.rowY)
  const hole1 = anchors.find((a) => a.label === "1")
  const totalAnchor = anchors.find((a) => a.label === "Total")
  const leftX = hole1 ? hole1.x - 30 : 0
  const rightX = totalAnchor ? totalAnchor.x + 40 : Number.POSITIVE_INFINITY

  // Keep a tight buffer above HOLES row. The HOLES labels ("1"-"18") are
  // numeric and visually close in y, so they'd otherwise be assigned to the
  // bottom-most player row.
  const holesGuard = holesRowY - 12

  for (const w of words) {
    if (!/^\d{1,3}$/.test(w.text)) continue
    const { x, y } = wordCenter(w)
    if (y >= holesGuard) continue
    if (x < leftX || x > rightX) continue
    // Also skip digits above the topmost row (printed yardages / par row).
    if (y < sortedRows[0].rowY - 25) continue

    // Find the row whose rowY is closest to this token's y.
    let best = sortedRows[0]
    let bestDist = Math.abs(best.rowY - y)
    for (const r of sortedRows) {
      const d = Math.abs(r.rowY - y)
      if (d < bestDist) {
        best = r
        bestDist = d
      }
    }

    // Guard against catching tokens that drift closer to HOLES than to the
    // nearest row (e.g. HOLES labels slightly above the anchor line).
    if (best.rowY < holesRowY && bestDist > holesRowY - best.rowY) continue

    tokensByRow.get(best.rowY)!.push(w)
    debugTokens.push({
      text: w.text,
      x: Math.round(x),
      y: Math.round(y),
      assignedTo: best.name,
    })
  }

  // Include unassigned digit tokens in debug so we can see what got skipped.
  for (const w of words) {
    if (!/^\d{1,3}$/.test(w.text)) continue
    const { x, y } = wordCenter(w)
    if (debugTokens.some((d) => d.x === Math.round(x) && d.y === Math.round(y))) continue
    debugTokens.push({
      text: w.text,
      x: Math.round(x),
      y: Math.round(y),
      assignedTo: null,
    })
  }

  return { tokensByRow, debugTokens }
}

function parsePlayerRow(
  row: PlayerRow,
  anchors: AnchoredColumn[],
  rowDigits: VisionWord[],
): ParsedPlayer | null {
  const hole1 = anchors.find((a) => a.label === "1")
  const hole2 = anchors.find((a) => a.label === "2")
  if (!hole1 || !hole2) return null

  // Half the inter-column distance = tolerance on either side of an anchor x.
  const colWidth = hole2.x - hole1.x
  const xTol = colWidth * 0.55

  if (rowDigits.length < 1) return null

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
