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
  const dayOfWeek = date.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7
  if (daysUntilFriday === 0 && date.getHours() >= 18) {
    // If it's Friday after 6 PM, get next Friday
    date.setDate(date.getDate() + 7)
  } else {
    date.setDate(date.getDate() + daysUntilFriday)
  }
  return date
}

export function getUpcomingFridayForSeason(): Date {
  const today = new Date()
  const seasonStart = new Date(2025, 4, 23) // May 23, 2025
  const seasonEnd = new Date(2025, 8, 26) // September 26, 2025

  if (today < seasonStart) {
    return seasonStart
  }

  const nextFriday = getNextFriday(today)
  return nextFriday <= seasonEnd ? nextFriday : seasonEnd
}

export function getSeasonFridays(): Date[] {
  const fridays: Date[] = []
  const seasonStart = new Date(2025, 4, 23) // May 23, 2025
  const seasonEnd = new Date(2025, 8, 26) // September 26, 2025

  const currentFriday = new Date(seasonStart)

  while (currentFriday <= seasonEnd) {
    fridays.push(new Date(currentFriday))
    currentFriday.setDate(currentFriday.getDate() + 7)
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
