import { BASE_TEE_TIME_COST } from "@/lib/constants"

export type BookingPlayerSummary = {
  index: number
  name: string
  isBooker: boolean
  optedIn: boolean
  entryAmount: number
  owe: number
  email: string | null
  userId: string | null
}

export type BookingSummary = {
  reservationId: string | null
  date: string
  time: string
  cashGameTitle: string | null
  cashGameEntry: number
  players: BookingPlayerSummary[]
}

export function computePlayerOwed(optedIn: boolean, cashGameEntry: number): number {
  return BASE_TEE_TIME_COST + (optedIn ? cashGameEntry : 0)
}

// Format "14:30" or "14:30:00" to "2:30 PM".
export function formatTimeOfDay(timeString: string): string {
  try {
    const [h, m] = timeString.split(":")
    const hour = Number.parseInt(h, 10)
    const minute = Number.parseInt(m ?? "0", 10)
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
  } catch {
    return timeString
  }
}

// Returns the UTC ms for a tee time's wall-clock start in America/New_York,
// correctly handling EST/EDT for the date in question.
export function getTeeTimeStartMs(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split("-").map((s) => Number.parseInt(s, 10))
  const [hh, mm] = timeStr.split(":")
  const h = Number.parseInt(hh, 10)
  const mi = Number.parseInt(mm ?? "0", 10)

  // Pick a UTC instant with the requested wall-clock numbers, then ask
  // America/New_York what wall-clock that instant is at — the diff is the
  // offset to apply to recover the intended NY-local instant.
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcGuess))
  const lookup: Record<string, string> = {}
  for (const p of parts) lookup[p.type] = p.value
  const nyMs = Date.UTC(
    Number.parseInt(lookup.year, 10),
    Number.parseInt(lookup.month, 10) - 1,
    Number.parseInt(lookup.day, 10),
    Number.parseInt(lookup.hour, 10),
    Number.parseInt(lookup.minute, 10),
  )
  const offsetMs = utcGuess - nyMs
  return utcGuess + offsetMs
}

// True when the booking_closes_at timestamp is missing or still in the future.
export function isBookingWindowOpen(bookingClosesAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!bookingClosesAt) return true
  return nowMs < new Date(bookingClosesAt).getTime()
}

// True when the tee time hasn't started, with a buffer.
export function isBeforeCutoff(
  dateStr: string,
  timeStr: string,
  bufferMinutes: number,
  nowMs = Date.now(),
): boolean {
  const start = getTeeTimeStartMs(dateStr, timeStr)
  return nowMs < start - bufferMinutes * 60_000
}
