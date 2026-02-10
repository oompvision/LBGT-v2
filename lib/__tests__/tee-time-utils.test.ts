import { describe, it, expect } from "vitest"
import { DEFAULT_TIME_SLOTS, generateNewTeeTimes, getSeasonFridays, getSeasonDatesForDay, toUTC } from "../tee-time-utils"

describe("DEFAULT_TIME_SLOTS", () => {
  it("has 6 slots", () => {
    expect(DEFAULT_TIME_SLOTS).toHaveLength(6)
  })

  it("starts at 15:30 and ends at 16:20", () => {
    expect(DEFAULT_TIME_SLOTS[0]).toBe("15:30")
    expect(DEFAULT_TIME_SLOTS[5]).toBe("16:20")
  })

  it("slots are in 10-minute increments", () => {
    for (let i = 1; i < DEFAULT_TIME_SLOTS.length; i++) {
      const [prevH, prevM] = DEFAULT_TIME_SLOTS[i - 1].split(":").map(Number)
      const [currH, currM] = DEFAULT_TIME_SLOTS[i].split(":").map(Number)
      const diffMinutes = (currH * 60 + currM) - (prevH * 60 + prevM)
      expect(diffMinutes).toBe(10)
    }
  })
})

describe("generateNewTeeTimes", () => {
  it("returns a copy of default slots", () => {
    const result = generateNewTeeTimes()
    expect(result).toEqual(DEFAULT_TIME_SLOTS)
    // Verify it's a copy, not the same reference
    expect(result).not.toBe(DEFAULT_TIME_SLOTS)
  })
})

describe("getSeasonFridays", () => {
  it("returns only Fridays within the date range", () => {
    // May 1 - May 31, 2025
    const start = new Date(2025, 4, 1)
    const end = new Date(2025, 4, 31)
    const fridays = getSeasonFridays(start, end)

    for (const f of fridays) {
      expect(f.getDay()).toBe(5) // Friday
      expect(f >= start).toBe(true)
      expect(f <= end).toBe(true)
    }
  })

  it("returns correct count for May 2025 (5 Fridays)", () => {
    const start = new Date(2025, 4, 1)
    const end = new Date(2025, 4, 31)
    const fridays = getSeasonFridays(start, end)
    // May 2025: Fri 2, 9, 16, 23, 30
    expect(fridays).toHaveLength(5)
  })

  it("returns empty for a range with no Fridays", () => {
    // Mon-Thu range
    const start = new Date(2025, 4, 5) // Monday
    const end = new Date(2025, 4, 8)   // Thursday
    const fridays = getSeasonFridays(start, end)
    expect(fridays).toHaveLength(0)
  })
})

describe("getSeasonDatesForDay", () => {
  it("returns all Mondays in a range", () => {
    const start = new Date(2025, 4, 1)
    const end = new Date(2025, 4, 31)
    const mondays = getSeasonDatesForDay(start, end, 1) // 1 = Monday
    for (const d of mondays) {
      expect(d.getDay()).toBe(1)
    }
  })
})

describe("toUTC", () => {
  it("converts Eastern time to UTC (EDT, UTC-4)", () => {
    // May 15, 2025 at 9 PM Eastern (EDT = UTC-4)
    const result = toUTC("2025-05-15", "21:00", "America/New_York")
    // 9 PM EDT = 1 AM UTC next day
    expect(result).toBe("2025-05-16T01:00:00.000Z")
  })

  it("converts Eastern time to UTC (EST, UTC-5)", () => {
    // Jan 15, 2025 at 9 PM Eastern (EST = UTC-5)
    const result = toUTC("2025-01-15", "21:00", "America/New_York")
    // 9 PM EST = 2 AM UTC next day
    expect(result).toBe("2025-01-16T02:00:00.000Z")
  })

  it("handles time with seconds", () => {
    const result = toUTC("2025-05-15", "21:00:00", "America/New_York")
    expect(result).toBe("2025-05-16T01:00:00.000Z")
  })
})
