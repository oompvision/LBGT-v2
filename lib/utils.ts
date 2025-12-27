import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date and time formatting utilities
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// Tee time generation utilities
export function getNextFriday(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate)
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // If it's Saturday (6), we want the next Friday (6 days ahead)
  if (dayOfWeek === 6) {
    date.setDate(date.getDate() + 6)
    return date
  }

  // For all other days, calculate days until next Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7

  // If it's Friday and we're past a certain time, get next Friday
  if (daysUntilFriday === 0) {
    date.setDate(date.getDate() + 7)
  } else {
    date.setDate(date.getDate() + daysUntilFriday)
  }

  return date
}

export function getUpcomingFridayForSeason(): string {
  const today = new Date()
  const nextFriday = getNextFriday(today)
  return formatDateForDB(nextFriday)
}

// Helper function to format date for database storage (YYYY-MM-DD)
export function formatDateForDB(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getSeasonFridays(): Date[] {
  const fridays: Date[] = []
  const today = new Date()
  const currentFriday = getNextFriday(today)

  // Return upcoming Fridays for the next 26 weeks (half year)
  for (let i = 0; i < 26; i++) {
    const friday = new Date(currentFriday)
    friday.setDate(friday.getDate() + i * 7)
    fridays.push(friday)
  }

  return fridays
}

export function generateTeeTimes(date: Date): Array<{ time: string; available: boolean }> {
  const teeTimes = []
  const startHour = 7 // 7:00 AM
  const endHour = 17 // 5:00 PM

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
      teeTimes.push({
        time: timeString,
        available: Math.random() > 0.3, // Random availability for demo
      })
    }
  }

  return teeTimes
}
