import { format } from "date-fns"

// Default 6 tee time slots: 3:30 PM - 4:20 PM in 10-minute blocks
export const DEFAULT_TIME_SLOTS = [
  "15:30", // 3:30 PM
  "15:40", // 3:40 PM
  "15:50", // 3:50 PM
  "16:00", // 4:00 PM
  "16:10", // 4:10 PM
  "16:20", // 4:20 PM
]

// Generate the default tee time slots
export function generateNewTeeTimes(): string[] {
  return [...DEFAULT_TIME_SLOTS]
}

// Get the next upcoming Friday from today (or today if it's Friday)
export function getCurrentActiveFriday(): string {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 5=Fri

  let daysUntilFriday: number
  if (dayOfWeek === 5) {
    daysUntilFriday = 0
  } else if (dayOfWeek === 6) {
    daysUntilFriday = 6
  } else {
    daysUntilFriday = 5 - dayOfWeek
  }

  const nextFriday = new Date(now)
  nextFriday.setDate(now.getDate() + daysUntilFriday)

  return format(nextFriday, "yyyy-MM-dd")
}

// Get all Fridays between a start and end date
export function getSeasonFridays(startDate: Date, endDate: Date): Date[] {
  const fridays: Date[] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    if (current.getDay() === 5) {
      fridays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return fridays
}

// Get all dates matching a specific day of week between start and end
export function getSeasonDatesForDay(startDate: Date, endDate: Date, dayOfWeek: number): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    if (current.getDay() === dayOfWeek) {
      dates.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return dates
}

// Convert a local time in a timezone to a UTC ISO string
// e.g., toUTC("2026-05-15", "21:00", "America/New_York") → UTC ISO string
export function toUTC(dateStr: string, timeStr: string, timezone: string): string {
  // Create a reference date at noon UTC on the target date
  const refDate = new Date(`${dateStr}T12:00:00Z`)

  // Get the timezone offset in milliseconds
  const offsetMs = getTimezoneOffsetMs(refDate, timezone)

  // Normalize time to HH:MM:SS format
  const timeParts = timeStr.split(":")
  const normalizedTime = timeParts.length >= 3
    ? `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`
    : `${timeStr}:00`

  // Create the "local" time as if it were UTC, then adjust by the offset
  const fakeUTC = new Date(`${dateStr}T${normalizedTime}Z`)
  const actualUTC = new Date(fakeUTC.getTime() - offsetMs)

  return actualUTC.toISOString()
}

// Get timezone offset in milliseconds (positive = ahead of UTC)
function getTimezoneOffsetMs(utcDate: Date, timezone: string): number {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }

  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(utcDate)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "00"

  // en-CA formats as YYYY-MM-DD
  const localStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
  const localAsUTC = new Date(localStr)

  return localAsUTC.getTime() - utcDate.getTime()
}
