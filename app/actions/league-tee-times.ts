"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { format, parse, isValid } from "date-fns"

// League date range
const LEAGUE_START_DATE = new Date(2025, 4, 23) // May 23, 2025
const LEAGUE_END_DATE = new Date(2025, 7, 29) // August 29, 2025

// Time range
const START_HOUR = 15 // 3:00 PM
const END_HOUR = 17 // 5:00 PM

// Function to validate if a date is within the league range
function isValidLeagueDate(date: Date): boolean {
  return (
    date >= LEAGUE_START_DATE && date <= LEAGUE_END_DATE && date.getDay() === 5 // 5 = Friday
  )
}

// Function to generate tee times between 3:00 PM and 5:00 PM in 10-minute increments
function generateLeagueTeeTimesForDate(date: string): string[] {
  const times: string[] = []

  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      // Skip times after 5:00 PM
      if (hour === END_HOUR && minute > 0) {
        continue
      }

      const formattedHour = hour.toString().padStart(2, "0")
      const formattedMinute = minute.toString().padStart(2, "0")
      times.push(`${formattedHour}:${formattedMinute}:00`)
    }
  }

  return times
}

// Function to get all league dates
export async function getAllLeagueDates() {
  try {
    // Get all Fridays between May 23, 2025 and August 29, 2025
    const dates: Date[] = []
    const currentDate = new Date(LEAGUE_START_DATE)

    while (currentDate <= LEAGUE_END_DATE) {
      if (currentDate.getDay() === 5) {
        // 5 = Friday
        dates.push(new Date(currentDate))
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return { success: true, dates }
  } catch (error: any) {
    console.error("Error in getAllLeagueDates:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get tee times for a specific date
export async function getLeagueTeeTimesByDate(date: string) {
  const supabase = createClient()

  try {
    // Validate the date
    const parsedDate = parse(date, "yyyy-MM-dd", new Date())

    if (!isValid(parsedDate) || !isValidLeagueDate(parsedDate)) {
      return {
        success: false,
        error: "Invalid date. Please select a Friday between May 23, 2025 and August 29, 2025.",
      }
    }

    // Get all tee times for the specified date
    const { data: teeTimes, error: teeTimesError } = await supabase
      .from("tee_times")
      .select("*")
      .eq("date", date)
      .order("time")

    if (teeTimesError) {
      console.error("Error fetching tee times:", teeTimesError)
      return { success: false, error: teeTimesError.message }
    }

    // Get reservations for these tee times to calculate reserved slots
    const teeTimeIds = teeTimes?.map((tt) => tt.id) || []

    if (teeTimeIds.length > 0) {
      const { data: reservations, error: reservationsError } = await supabase
        .from("reservations")
        .select("tee_time_id, slots")
        .in("tee_time_id", teeTimeIds)

      if (reservationsError) {
        console.error("Error fetching reservations:", reservationsError)
        return { success: false, error: reservationsError.message }
      }

      // Calculate reserved slots for each tee time
      const teeTimesWithReservations = teeTimes?.map((teeTime) => {
        const teeTimeReservations = reservations?.filter((r) => r.tee_time_id === teeTime.id) || []
        const reservedSlots = teeTimeReservations.reduce((sum, r) => sum + r.slots, 0)

        return {
          ...teeTime,
          reserved_slots: reservedSlots,
        }
      })

      return { success: true, teeTimes: teeTimesWithReservations || [] }
    }

    return { success: true, teeTimes: teeTimes || [] }
  } catch (error: any) {
    console.error("Error in getLeagueTeeTimesByDate:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to update tee time availability
export async function updateTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  const supabase = createClient()

  try {
    // Update the tee time
    const { error } = await supabase.from("tee_times").update({ is_available: isAvailable }).eq("id", teeTimeId)

    if (error) {
      console.error("Error updating tee time availability:", error)
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/reservations/[id]", "page")

    return { success: true }
  } catch (error: any) {
    console.error("Error in updateTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to bulk update tee time availability
export async function bulkUpdateTeeTimeAvailability(updates: { id: string; is_available: boolean }[]) {
  const supabase = createClient()

  try {
    // Create an array of promises for all updates
    const updatePromises = updates.map(async (update) => {
      const { error } = await supabase
        .from("tee_times")
        .update({ is_available: update.is_available })
        .eq("id", update.id)

      if (error) {
        console.error(`Error updating tee time ${update.id}:`, error)
        return { id: update.id, success: false, error: error.message }
      }

      return { id: update.id, success: true }
    })

    // Wait for all updates to complete
    const results = await Promise.all(updatePromises)

    // Check if any updates failed
    const failures = results.filter((result) => !result.success)

    if (failures.length > 0) {
      console.error("Some updates failed:", failures)
      return {
        success: false,
        error: `${failures.length} updates failed. Please try again.`,
        failures,
      }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/reservations/[id]", "page")

    return { success: true }
  } catch (error: any) {
    console.error("Error in bulkUpdateTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to generate tee times for a specific date
export async function generateTeeTimesForDate(date: string) {
  const supabase = createClient()

  try {
    // Validate the date
    const parsedDate = parse(date, "yyyy-MM-dd", new Date())

    if (!isValid(parsedDate) || !isValidLeagueDate(parsedDate)) {
      return {
        success: false,
        error: "Invalid date. Please select a Friday between May 23, 2025 and August 29, 2025.",
      }
    }

    // Check if tee times already exist for this date
    const { data: existingTeeTimes, error: checkError } = await supabase.from("tee_times").select("id").eq("date", date)

    if (checkError) {
      console.error("Error checking existing tee times:", checkError)
      return { success: false, error: checkError.message }
    }

    // If tee times already exist, return a message
    if (existingTeeTimes && existingTeeTimes.length > 0) {
      return {
        success: true,
        message: "Tee times already exist for this date. You can modify their availability.",
      }
    }

    // Generate tee times for the date
    const times = generateLeagueTeeTimesForDate(date)

    // Create tee times in the database
    const teeTimesToInsert = times.map((time) => ({
      date,
      time,
      max_slots: 4, // Each tee time can have up to 4 players
      is_available: true, // New tee times are available by default
    }))

    const { error: insertError } = await supabase.from("tee_times").insert(teeTimesToInsert)

    if (insertError) {
      console.error("Error creating tee times:", insertError)
      return { success: false, error: insertError.message }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/reservations/[id]", "page")

    return { success: true, message: "Tee times generated successfully" }
  } catch (error: any) {
    console.error("Error in generateTeeTimesForDate:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get all tee times for the admin dashboard
export async function getAllLeagueTeeTimesForAdmin() {
  const supabase = createClient()

  try {
    // Get all tee times within the league date range
    const { data: teeTimes, error: teeTimesError } = await supabase
      .from("tee_times")
      .select("*")
      .gte("date", format(LEAGUE_START_DATE, "yyyy-MM-dd"))
      .lte("date", format(LEAGUE_END_DATE, "yyyy-MM-dd"))
      .order("date")
      .order("time")

    if (teeTimesError) {
      console.error("Error fetching tee times:", teeTimesError)
      return { success: false, error: teeTimesError.message }
    }

    return { success: true, teeTimes: teeTimes || [] }
  } catch (error: any) {
    console.error("Error in getAllLeagueTeeTimesForAdmin:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
