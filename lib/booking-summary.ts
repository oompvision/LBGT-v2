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
