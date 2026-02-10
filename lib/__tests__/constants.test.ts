import { describe, it, expect } from "vitest"
import {
  DEFAULT_MAX_PLAYERS_PER_TEE_TIME,
  MAX_STROKES_GIVEN,
  COURSE_DATA,
  DEFAULT_BOOKING_OPENS_DAYS_BEFORE,
  DEFAULT_BOOKING_CLOSES_DAYS_BEFORE,
} from "../constants"

describe("COURSE_DATA", () => {
  it("has 18 holes", () => {
    expect(COURSE_DATA.holes).toHaveLength(18)
    expect(COURSE_DATA.holes[0]).toBe(1)
    expect(COURSE_DATA.holes[17]).toBe(18)
  })

  it("has 18 par values", () => {
    expect(COURSE_DATA.pars).toHaveLength(18)
  })

  it("has 18 handicap values", () => {
    expect(COURSE_DATA.whiteHdcp).toHaveLength(18)
  })

  it("handicap values contain 1-18 exactly once each", () => {
    const sorted = [...COURSE_DATA.whiteHdcp].sort((a, b) => a - b)
    expect(sorted).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  })

  it("front nine par matches sum of first 9 holes", () => {
    const frontSum = COURSE_DATA.pars.slice(0, 9).reduce((a, b) => a + b, 0)
    expect(COURSE_DATA.frontNinePar).toBe(frontSum)
  })

  it("back nine par matches sum of last 9 holes", () => {
    const backSum = COURSE_DATA.pars.slice(9).reduce((a, b) => a + b, 0)
    expect(COURSE_DATA.backNinePar).toBe(backSum)
  })

  it("total par equals front + back", () => {
    expect(COURSE_DATA.totalPar).toBe(COURSE_DATA.frontNinePar + COURSE_DATA.backNinePar)
  })
})

describe("tee time defaults", () => {
  it("max players is 4", () => {
    expect(DEFAULT_MAX_PLAYERS_PER_TEE_TIME).toBe(4)
  })

  it("booking opens before closes", () => {
    expect(DEFAULT_BOOKING_OPENS_DAYS_BEFORE).toBeGreaterThan(DEFAULT_BOOKING_CLOSES_DAYS_BEFORE)
  })
})

describe("handicap defaults", () => {
  it("max strokes given is reasonable", () => {
    expect(MAX_STROKES_GIVEN).toBeGreaterThan(0)
    expect(MAX_STROKES_GIVEN).toBeLessThanOrEqual(36)
  })
})
