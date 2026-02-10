import { format } from "date-fns"

// Generate the 5 specific tee times for each Friday
export function generateNewTeeTimes(): string[] {
  return [
    "15:40", // 3:40 PM
    "15:50", // 3:50 PM
    "16:00", // 4:00 PM
    "16:10", // 4:10 PM
    "16:20", // 4:20 PM
  ]
}

// Get the next upcoming Friday from today (or today if it's Friday and before tee times)
export function getCurrentActiveFriday(): string {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 5=Fri

  let daysUntilFriday: number
  if (dayOfWeek === 5) {
    // It's Friday — use today
    daysUntilFriday = 0
  } else if (dayOfWeek === 6) {
    // Saturday — next Friday is 6 days away
    daysUntilFriday = 6
  } else {
    // Sun(0)→5, Mon(1)→4, Tue(2)→3, Wed(3)→2, Thu(4)→1
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
