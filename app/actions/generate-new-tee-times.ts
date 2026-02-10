"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import { generateTeeTimes } from "@/lib/utils"
import { getSeasonFridays } from "@/lib/tee-time-utils"

// Function to generate tee times for all Fridays in the active season
export async function generateNewTeeTimesForSeason() {
  const supabase = await createClient()

  try {
    // Fetch active season from the database
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .single()

    if (seasonError || !season) {
      return { success: false, error: "No active season found. Please set an active season first." }
    }

    const seasonStart = new Date(season.start_date)
    const seasonEnd = new Date(season.end_date)
    const fridays = getSeasonFridays(seasonStart, seasonEnd)

    if (fridays.length === 0) {
      return { success: false, error: "No Fridays found in the active season date range." }
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
      message: `Successfully generated ${createdCount} new tee times for the ${season.name} (${fridays.length} Fridays).`,
    }
  } catch (error: any) {
    console.error("Error generating new tee times:", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    }
  }
}
