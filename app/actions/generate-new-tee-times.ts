"use server"

import { createClient } from "@/lib/supabase/server"
import { generateTeeTimesFromTemplate } from "@/app/actions/tee-time-templates"

// Generate tee times for the active season using the saved template
export async function generateNewTeeTimesForSeason() {
  const supabase = await createClient()

  try {
    // Get active season
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single()

    if (seasonError || !season) {
      return { success: false, error: "No active season found. Please set an active season first." }
    }

    // Delegate to template-based generation
    return await generateTeeTimesFromTemplate(season.id)
  } catch (error: any) {
    console.error("Error generating new tee times:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
