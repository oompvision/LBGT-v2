"use server"

import { createClient } from "@/lib/supabase/server"
import { generateNewTeeTimes, getCurrentActiveFriday } from "@/lib/tee-time-utils"
import { revalidatePath } from "next/cache"

// Function to generate tee times for the current active Friday
export async function generateTeeTimesForCurrentWeek() {
  const supabase = createClient()

  try {
    const activeFriday = getCurrentActiveFriday() // Gets "2025-05-30"
    const times = generateNewTeeTimes() // Gets the 5 time slots

    // Check if tee times already exist for this date
    const { data: existingTeeTimes, error: checkError } = await supabase
      .from("tee_times")
      .select("id")
      .eq("date", activeFriday)

    if (checkError) {
      console.error("Error checking existing tee times:", checkError)
      return { success: false, error: checkError.message }
    }

    // If tee times already exist, return success
    if (existingTeeTimes && existingTeeTimes.length > 0) {
      return { success: true, message: "Tee times already exist for this date" }
    }

    // Create tee times in the database
    const teeTimesToInsert = times.map((time) => ({
      date: activeFriday,
      time,
      max_slots: 4, // Each tee time can have up to 4 players
      is_available: true,
    }))

    const { error: insertError } = await supabase.from("tee_times").insert(teeTimesToInsert)

    if (insertError) {
      console.error("Error creating tee times:", insertError)
      return { success: false, error: insertError.message }
    }

    // Get the inserted tee times to set availability
    const { data: newTeeTimes, error: selectError } = await supabase
      .from("tee_times")
      .select("id")
      .eq("date", activeFriday)

    if (!selectError && newTeeTimes) {
      // Mark them as available
      const availabilityEntries = newTeeTimes.map((teeTime) => ({
        tee_time_id: teeTime.id,
        is_available: true,
      }))

      await supabase.from("tee_time_availability").insert(availabilityEntries)
    }

    revalidatePath("/dashboard")
    return { success: true, message: "Tee times created successfully for " + activeFriday }
  } catch (error: any) {
    console.error("Error in generateTeeTimesForCurrentWeek:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
