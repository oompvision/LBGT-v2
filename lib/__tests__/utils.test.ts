import { describe, it, expect } from "vitest"
import { getNextFriday, formatDateForDB, formatDate, formatTime, cn } from "../utils"

describe("getNextFriday", () => {
  it("returns next Friday from a Monday", () => {
    // Monday Jan 6, 2025
    const monday = new Date(2025, 0, 6)
    const result = getNextFriday(monday)
    expect(result.getDay()).toBe(5) // Friday
    expect(result.getDate()).toBe(10) // Jan 10
  })

  it("returns next Friday from a Wednesday", () => {
    // Wednesday Jan 8, 2025
    const wednesday = new Date(2025, 0, 8)
    const result = getNextFriday(wednesday)
    expect(result.getDay()).toBe(5)
    expect(result.getDate()).toBe(10)
  })

  it("skips to next week on a Friday", () => {
    // Friday Jan 10, 2025
    const friday = new Date(2025, 0, 10)
    const result = getNextFriday(friday)
    expect(result.getDay()).toBe(5)
    expect(result.getDate()).toBe(17) // Next Friday
  })

  it("returns next Friday from a Saturday", () => {
    // Saturday Jan 11, 2025
    const saturday = new Date(2025, 0, 11)
    const result = getNextFriday(saturday)
    expect(result.getDay()).toBe(5)
    expect(result.getDate()).toBe(17) // 6 days later
  })

  it("returns next Friday from a Sunday", () => {
    // Sunday Jan 12, 2025
    const sunday = new Date(2025, 0, 12)
    const result = getNextFriday(sunday)
    expect(result.getDay()).toBe(5)
    expect(result.getDate()).toBe(17)
  })
})

describe("formatDateForDB", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const date = new Date(2025, 4, 23) // May 23, 2025
    expect(formatDateForDB(date)).toBe("2025-05-23")
  })

  it("zero-pads single-digit months and days", () => {
    const date = new Date(2025, 0, 5) // Jan 5, 2025
    expect(formatDateForDB(date)).toBe("2025-01-05")
  })
})

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("handles conditional classes", () => {
    expect(cn("px-2", false && "hidden", "py-1")).toBe("px-2 py-1")
  })

  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
