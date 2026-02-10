"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import { generateTeeTimes } from "@/lib/utils"

// Function to generate tee times for all Fridays in the season
export async function generateNewTeeTimesForSeason() {
  const supabase = await createClient()

  try {
    // Get all Fridays in the season
    const fridays = []
    const seasonStart = new Date(2025, 4, 23) // May 23, 2025
    const seasonEnd = new Date(2025, 7, 29) // August 29, 2025

    const current = new Date(seasonStart)
    while (current <= seasonEnd) {
      if (current.getDay() === 5) {
        // 5 = Friday
        fridays.push(new Date(current))
      }
      current.setDate(current.getDate() + 1)
    }

    // Generate tee times for each Friday
    let createdCount = 0
    for (const friday of fridays) {
      const formattedDate = format(friday, "yyyy-MM-dd")

      // Delete existing tee times for this date that are outside our new range
      const { error: deleteError } = await supabase
        .from("tee_times")
        .delete()
        .eq("date", formattedDate)
        .or(`time.lt.15:30:00,time.gt.16:20:00`)

      if (deleteError) {
        console.error(`Error deleting old tee times for ${formattedDate}:`, deleteError)
      }

      // Get the specific times we want
      const times = generateTeeTimes()

      // Create tee times for each time slot
      for (const time of times) {
        // Check if this tee time already exists
        const { data: existingTeeTime, error: checkError } = await supabase
          .from("tee_times")
          .select("id")
          .eq("date", formattedDate)
          .eq("time", `${time}:00`)
          .maybeSingle()

        if (checkError) {
          console.error(`Error checking existing tee time for ${formattedDate} ${time}:`, checkError)
          continue
        }

        // If it doesn't exist, create it
        if (!existingTeeTime) {
          const { error: insertError } = await supabase.from("tee_times").insert({
            date: formattedDate,
            time: `${time}:00`,
            max_slots: 4,
            is_available: true,
          })

          if (insertError) {
            console.error(`Error creating tee time for ${formattedDate} ${time}:`, insertError)
          } else {
            createdCount++
          }
        }
      }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/reservations/[id]", "page")

    return {
      success: true,
      message: `Successfully generated ${createdCount} new tee times for the season.`,
    }
  } catch (error: any) {
    console.error("Error generating new tee times:", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    }
  }
}
