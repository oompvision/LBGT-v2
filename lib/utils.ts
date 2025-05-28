import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Constants for date validation
const FIRST_VALID_DATE = new Date(2025, 4, 23) // May 23, 2025
const SEASON_START = new Date(2025, 4, 23) // May 23, 2025
const SEASON_END = new Date(2025, 8, 1) // September 1, 2025 (Labor Day)

// Helper function to ensure a date is valid and at least May 23, 2025
export function ensureValidDate(dateString: string): string {
  try {
    const date = parseISO(dateString)
    if (!isValid(date) || date < FIRST_VALID_DATE) {
      console.warn(`Correcting invalid date: ${dateString} to 2025-05-23`)
      return "2025-05-23"
    }
    return dateString
  } catch (error) {
    console.error("Error validating date:", error)
    return "2025-05-23"
  }
}

// Function to generate specific tee times: 3:40, 3:50, 4:00, 4:10, 4:20
export function generateTeeTimes(): string[] {
  // Return the specific times requested (5 slots)
  return [
    "15:40", // 3:40 PM
    "15:50", // 3:50 PM
    "16:00", // 4:00 PM
    "16:10", // 4:10 PM
    "16:20", // 4:20 PM
  ]
}

// Function to format a date object into a string (e.g., "May 23, 2025")
export function formatDate(date: Date): string {
  try {
    return format(date, "MMMM d, yyyy")
  } catch (error) {
    console.error("Error formatting date:", error)
    return "May 23, 2025" // Default to May 23, 2025 if there's an error
  }
}

// Function to format a time string (HH:MM) into a more readable format (e.g., 3:30 PM)
export function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(":")
    let period = "AM"
    let hour = Number.parseInt(hours)

    if (hour >= 12) {
      period = "PM"
      if (hour > 12) {
        hour -= 12
      }
    }

    return `${hour}:${minutes} ${period}`
  } catch (error) {
    console.error("Error formatting time:", error)
    return time || "3:40 PM" // Default to 3:40 PM if there's an error
  }
}

// Get time options for the tee time selector
export function getTeeTimeOptions(): { value: string; label: string }[] {
  const times = [
    "15:40:00", // 3:40 PM
    "15:50:00", // 3:50 PM
    "16:00:00", // 4:00 PM
    "16:10:00", // 4:10 PM
    "16:20:00", // 4:20 PM
  ]

  return times.map((timeValue) => ({
    value: timeValue,
    label: format(new Date(`2000-01-01T${timeValue}`), "h:mm a"),
  }))
}

// Format a date as YYYY-MM-DD
export function formatDateForDatabase(date: Date): string {
  // Ensure the date is at least May 23, 2025
  if (date < FIRST_VALID_DATE) {
    console.warn(`Correcting invalid date: ${date.toISOString()} to 2025-05-23`)
    return "2025-05-23"
  }
  return format(date, "yyyy-MM-dd")
}

// Get all season Fridays
export function getSeasonFridays(year = 2025): Date[] {
  const fridays: Date[] = []
  const current = new Date(SEASON_START)

  // Add all Fridays from season start to season end
  while (current <= SEASON_END) {
    if (current.getDay() === 5) {
      // 5 = Friday
      fridays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return fridays
}

export function isValidLeagueFriday(date: Date): boolean {
  return date.getDay() === 5 && date >= SEASON_START && date <= SEASON_END
}

export function getUpcomingFridayFor2025(): string {
  // Simulate it's May 24, 2025 (Saturday) so next Friday is May 30th
  const simulatedNow = new Date(2025, 4, 24) // May 24, 2025 (Saturday)

  // Since it's Saturday, show next Friday's tee times (May 30th)
  const nextFriday = getNextFriday(simulatedNow)
  return nextFriday.toISOString().split("T")[0] // Returns "2025-05-30"
}

export function getNextFriday(date: Date = new Date()): Date {
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 // Calculate days until next Friday (5)

  // If it's already Friday, get next Friday (7 days later)
  const daysToAdd = daysUntilFriday === 0 ? 7 : daysUntilFriday

  const nextFriday = new Date(date)
  nextFriday.setDate(date.getDate() + daysToAdd)

  // Ensure the date is at least May 23, 2025
  if (nextFriday < FIRST_VALID_DATE) {
    return new Date(2025, 4, 23) // May 23, 2025
  }

  return nextFriday
}

export function getUpcomingFridayForSeason(): string {
  // Simulate it's May 24, 2025 (Saturday) so next Friday is May 30th
  const simulatedNow = new Date(2025, 4, 24) // May 24, 2025 (Saturday)

  // Since it's Saturday, show next Friday's tee times (May 30th)
  const nextFriday = getNextFriday(simulatedNow)
  return nextFriday.toISOString().split("T")[0] // Returns "2025-05-30"
}

export function getAllLeagueDates(): Date[] {
  return getSeasonFridays(2025)
}
