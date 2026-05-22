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
  // 10-digit US phone (digits only) for guest seats; null for league players
  // and the booker. Only the booker and admins are authorized to see these.
  guestPhone: string | null
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

// True when the current time is inside the tee time's booking window:
// at or after booking_opens_at (if set) and strictly before booking_closes_at
// (if set). A missing endpoint is treated as unbounded on that side, so a
// tee time with no window stored is always considered open.
export function isBookingWindowOpen(
  teeTime:
    | {
        booking_opens_at?: string | null
        booking_closes_at?: string | null
      }
    | null
    | undefined,
  nowMs = Date.now(),
): boolean {
  if (!teeTime) return true
  const opensAt = teeTime.booking_opens_at
  if (opensAt && nowMs < new Date(opensAt).getTime()) return false
  const closesAt = teeTime.booking_closes_at
  if (closesAt && nowMs >= new Date(closesAt).getTime()) return false
  return true
}

// True when the booking-close deadline hasn't passed (or isn't set). Use
// this when gating edits to a reservation that already exists — booking_opens_at
// only governs new bookings, so an existing reservation can be edited up
// until close even if its opens_at is somehow in the future.
export function isBeforeBookingClose(
  bookingClosesAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!bookingClosesAt) return true
  return nowMs < new Date(bookingClosesAt).getTime()
}

// True for reservations created by an admin where they aren't on the tee
// time as a player. We disambiguate by the array shape, not by `is_admin`
// on the booker, so the answer doesn't drift if a user gets promoted to
// admin later: regular bookings keep `slots = 1 + player_names.length`
// (booker + additional players), while admin-owned ones keep
// `slots = player_names.length` (booker is metadata only, every entry in
// player_names is an actual player).
export function isAdminCreatedReservation(reservation: {
  slots: number
  player_names: string[] | null
}): boolean {
  return (reservation.player_names?.length ?? 0) === reservation.slots
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
