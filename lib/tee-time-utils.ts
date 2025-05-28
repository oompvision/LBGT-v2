// NEW FILE - Updated tee time logic without touching existing utils
import { format } from "date-fns"

// Season constants
const SEASON_START = new Date(2025, 4, 23) // May 23, 2025
const SEASON_END = new Date(2025, 8, 1) // September 1, 2025 (Labor Day)

// Generate the 5 specific tee times you want
export function generateNewTeeTimes(): string[] {
  return [
    "15:40", // 3:40 PM
    "15:50", // 3:50 PM
    "16:00", // 4:00 PM
    "16:10", // 4:10 PM
    "16:20", // 4:20 PM
  ]
}

// Get the current active Friday (May 30th since we're simulating Saturday May 24th)
export function getCurrentActiveFriday(): string {
  // Simulate it's May 24, 2025 (Saturday after first Friday)
  const simulatedNow = new Date(2025, 4, 24) // May 24, 2025 (Saturday)

  // Since it's Saturday, show next Friday's tee times (May 30th)
  const nextFriday = new Date(2025, 4, 30) // May 30, 2025 (Friday)

  return format(nextFriday, "yyyy-MM-dd") // Returns "2025-05-30"
}

// Get all season Fridays for calendar
export function getNewSeasonFridays(): Date[] {
  const fridays: Date[] = []
  const current = new Date(SEASON_START)

  while (current <= SEASON_END) {
    if (current.getDay() === 5) {
      // Friday
      fridays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return fridays
}
