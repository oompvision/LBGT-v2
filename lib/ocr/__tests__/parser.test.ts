import { describe, it, expect } from "vitest"
import { parseScorecard } from "../parser"
import type { VisionResponse, VisionWord } from "../vision"

// Helper: build a VisionWord with a bounding box at the given (x, y) center.
function word(text: string, x: number, y: number, confidence = 0.95): VisionWord {
  const w = 20
  const h = 20
  return {
    text,
    confidence,
    vertices: [
      { x: x - w / 2, y: y - h / 2 },
      { x: x + w / 2, y: y - h / 2 },
      { x: x + w / 2, y: y + h / 2 },
      { x: x - w / 2, y: y + h / 2 },
    ],
  }
}

// Column x-positions for the 23 cells across the scorecard. Matches the
// spacing seen on the real Long Beach scorecard.
const COL_X: Record<string, number> = {
  name: 60,
  "1": 150,
  "2": 200,
  "3": 250,
  "4": 300,
  "5": 350,
  "6": 400,
  "7": 450,
  "8": 500,
  "9": 550,
  Out: 605,
  Initial: 660,
  "10": 715,
  "11": 765,
  "12": 815,
  "13": 865,
  "14": 915,
  "15": 965,
  "16": 1015,
  "17": 1065,
  "18": 1115,
  In: 1170,
  Total: 1230,
}

// Build a synthetic Vision response that looks like our scorecard: a HOLES
// row near y=800 with player rows at y=500, 560, 620, 680.
function buildResponse(
  playerRows: Array<{
    y: number
    name: string
    scores: (string | null)[] // length 18; null means no score visible
    out?: string
    in_?: string
    total?: string
  }>,
): VisionResponse {
  const words: VisionWord[] = []

  // HOLES anchor row
  const holesY = 800
  for (const label of [
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
  ]) {
    words.push(word(label, COL_X[label], holesY))
  }

  // Printed rows above (Par, yardages, etc.) — mostly ignored, but include a
  // "Par" row so the parser sees something other than player rows above holes.
  for (const h of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    words.push(word("4", COL_X[h], 350))
  }

  for (const row of playerRows) {
    words.push(word(row.name, COL_X.name, row.y))
    const holeKeys = [
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
    ]
    row.scores.forEach((s, i) => {
      if (s !== null) words.push(word(s, COL_X[holeKeys[i]], row.y))
    })
    if (row.out) words.push(word(row.out, COL_X.Out, row.y))
    if (row.in_) words.push(word(row.in_, COL_X.In, row.y))
    if (row.total) words.push(word(row.total, COL_X.Total, row.y))
  }

  return { words, fullText: "" }
}

describe("parseScorecard", () => {
  it("extracts all 18 scores for a clean player row", () => {
    const response = buildResponse([
      {
        y: 500,
        name: "Anthony",
        scores: [
          "5",
          "7",
          "4",
          "5",
          "5",
          "3",
          "6",
          "5",
          "6",
          "5",
          "6",
          "5",
          "5",
          "5",
          "6",
          "4",
          "6",
          "6",
        ],
        out: "46",
        in_: "48",
        total: "94",
      },
    ])
    const result = parseScorecard(response)

    expect(result.players).toHaveLength(1)
    const p = result.players[0]
    expect(p.name).toBe("Anthony")
    expect(p.scores).toEqual([5, 7, 4, 5, 5, 3, 6, 5, 6, 5, 6, 5, 5, 5, 6, 4, 6, 6])
    expect(p.warnings).toEqual([])
  })

  it("returns null for unreadable cells (CART PATH ONLY stamps)", () => {
    // Pat's holes 3 and 6 are obscured by "CART PATH ONLY" stamps.
    const response = buildResponse([
      {
        y: 500,
        name: "Pat",
        scores: [
          "5",
          "7",
          null,
          "7",
          "6",
          null,
          "4",
          "7",
          "6",
          "5",
          "6",
          "7",
          "7",
          "8",
          "5",
          null,
          "5",
          "7",
        ],
      },
    ])
    // Simulate "CART" and "PATH" text tokens in the score columns for holes 3/6/16.
    response.words.push(
      word("CART", COL_X["3"], 500),
      word("PATH", COL_X["6"], 500),
      word("ONLY", COL_X["16"], 500),
    )

    const result = parseScorecard(response)
    expect(result.players).toHaveLength(1)
    const p = result.players[0]
    expect(p.scores[2]).toBeNull() // hole 3
    expect(p.scores[5]).toBeNull() // hole 6
    expect(p.scores[15]).toBeNull() // hole 16
    expect(p.scores[0]).toBe(5) // hole 1 readable
    expect(p.scores[17]).toBe(7) // hole 18 readable
  })

  it("flags a warning when front-9 sum doesn't match the Out column", () => {
    const response = buildResponse([
      {
        y: 500,
        name: "Kev",
        scores: [
          "6",
          "6",
          "3",
          "4",
          "6",
          "3",
          "4",
          "5",
          "10",
          "4",
          "6",
          "6",
          "6",
          "6",
          "3",
          "3",
          "4",
          "5",
        ],
        // Sum of front-9 is 47, but scorecard says 49.
        out: "49",
        in_: "43",
        total: "92",
      },
    ])
    const result = parseScorecard(response)
    const p = result.players[0]
    expect(p.warnings.some((w) => /Front 9/.test(w))).toBe(true)
  })

  it("detects multiple player rows in top-to-bottom order", () => {
    const scoresFilled = [
      "5",
      "5",
      "4",
      "5",
      "5",
      "3",
      "4",
      "4",
      "5",
      "5",
      "4",
      "4",
      "5",
      "5",
      "4",
      "3",
      "4",
      "5",
    ]
    const response = buildResponse([
      { y: 500, name: "Anthony", scores: scoresFilled },
      { y: 560, name: "Pat", scores: scoresFilled },
      { y: 620, name: "Rob", scores: scoresFilled },
      { y: 680, name: "Kev", scores: scoresFilled },
    ])
    const result = parseScorecard(response)
    expect(result.players.map((p) => p.name)).toEqual(["Anthony", "Pat", "Rob", "Kev"])
  })

  it("returns a warning when the HOLES anchor row is missing", () => {
    const response: VisionResponse = { words: [word("Random", 100, 100)], fullText: "" }
    const result = parseScorecard(response)
    expect(result.players).toEqual([])
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/HOLES/)
  })

  it("ignores printed course-info rows like 'Blue Hcp' and 'White Hcp'", () => {
    // Simulate the printed handicap rows that sit above the handwritten
    // player rows. They have the same layout (name on the left, digits in
    // score columns) so must be rejected by the name blacklist.
    const handicaps = ["13", "9", "15", "5", "1", "17", "3", "11", "7"]
    const response = buildResponse([
      {
        y: 200,
        name: "Blue Hcp",
        scores: [...handicaps, null, null, null, null, null, null, null, null, null],
      },
      {
        y: 260,
        name: "White Hcp",
        scores: [...handicaps, null, null, null, null, null, null, null, null, null],
      },
      {
        y: 320,
        name: "Par",
        scores: [
          "4",
          "4",
          "3",
          "4",
          "5",
          "3",
          "4",
          "4",
          "5",
          "3",
          "4",
          "4",
          "5",
          "4",
          "4",
          "3",
          "4",
          "5",
        ],
      },
      {
        y: 500,
        name: "Anthony",
        scores: [
          "5",
          "7",
          "4",
          "5",
          "5",
          "3",
          "6",
          "5",
          "6",
          "5",
          "6",
          "5",
          "5",
          "5",
          "6",
          "4",
          "6",
          "6",
        ],
      },
    ])
    // Split "Blue Hcp" and "White Hcp" into two word tokens each, as Vision
    // would return them.
    for (const row of response.words.filter((w) => w.text === "Blue Hcp")) {
      // Replace with two word tokens.
    }
    const result = parseScorecard(response)
    expect(result.players.map((p) => p.name)).toEqual(["Anthony"])
  })

  it("handles tilted rows where word y-values vary across the row", () => {
    // Simulate a row that tilts 20px from left to right (common when the
    // scorecard is photographed on a table with a slight angle).
    const response: VisionResponse = { words: [], fullText: "" }
    // HOLES anchor row — also tilted.
    const holes = [
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
    ]
    holes.forEach((label, i) => {
      response.words.push(word(label, COL_X[label], 800 + i * 1)) // drifts up to +20px
    })
    // Player row: tilts by 15px across its length.
    response.words.push(word("Anthony", COL_X.name, 500))
    const scores = [
      "5",
      "7",
      "4",
      "5",
      "5",
      "3",
      "6",
      "5",
      "6",
      "5",
      "6",
      "5",
      "5",
      "5",
      "6",
      "4",
      "6",
      "6",
    ]
    const holeKeys = [
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
    ]
    scores.forEach((s, i) => {
      response.words.push(word(s, COL_X[holeKeys[i]], 500 + i * 0.8))
    })

    const result = parseScorecard(response)
    expect(result.players).toHaveLength(1)
    expect(result.players[0].name).toBe("Anthony")
    expect(result.players[0].scores.filter((s) => s !== null)).toHaveLength(18)
  })

  it("ignores out-of-range score values (e.g. OCR misread '5' as '55')", () => {
    const response = buildResponse([
      {
        y: 500,
        name: "Anthony",
        scores: [
          "55", // implausible single-hole score — should be rejected
          "7",
          "4",
          "5",
          "5",
          "3",
          "6",
          "5",
          "6",
          "5",
          "6",
          "5",
          "5",
          "5",
          "6",
          "4",
          "6",
          "6",
        ],
      },
    ])
    const result = parseScorecard(response)
    expect(result.players[0].scores[0]).toBeNull()
  })
})
