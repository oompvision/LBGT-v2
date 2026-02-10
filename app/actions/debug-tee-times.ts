"use server"

import { createClient } from "@/lib/supabase/server"

// Function to debug tee time availability
export async function debugTeeTimeAvailability(teeTimeId: string) {
  const supabase = await createClient()

  try {
    // Get the tee time details
    const { data: teeTime, error: teeTimeError } = await supabase
      .from("tee_times")
      .select("*")
      .eq("id", teeTimeId)
      .single()

    if (teeTimeError) {
      return {
        success: false,
        error: teeTimeError.message,
        stage: "fetching_tee_time",
      }
    }

    // Check if the is_available column exists
    const { data: columnExists, error: columnError } = await supabase.rpc("check_column_exists", {
      p_table: "tee_times",
      p_column: "is_available",
    })

    if (columnError) {
      return {
        success: false,
        error: columnError.message,
        stage: "checking_column",
      }
    }

    // Get existing reservations for this tee time
    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("*")
      .eq("tee_time_id", teeTimeId)

    if (reservationsError) {
      return {
        success: false,
        error: reservationsError.message,
        stage: "fetching_reservations",
      }
    }

    // Return all debug information
    return {
      success: true,
      teeTime,
      columnExists,
      reservations,
      isAvailable: teeTime.is_available === true,
      reservedSlots: reservations?.reduce((sum, r) => sum + r.slots, 0) || 0,
      availableSlots: teeTime.max_slots - (reservations?.reduce((sum, r) => sum + r.slots, 0) || 0),
    }
  } catch (error: any) {
    console.error("Error debugging tee time availability:", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
      stage: "unexpected_error",
    }
  }
}
