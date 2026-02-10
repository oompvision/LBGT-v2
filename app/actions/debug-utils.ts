"use server"

import { createClient } from "@/lib/supabase/server"

// Function to log debug information to the console
export async function logDebugInfo(message: string, data?: any) {
  console.log(`[DEBUG] ${message}`, data)
}

// Function to check if a tee time's availability matches what we expect
export async function verifyTeeTimeAvailability(teeTimeId: string, expectedAvailability: boolean) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("tee_times")
      .select("id, time, is_available")
      .eq("id", teeTimeId)
      .single()

    if (error) {
      console.error(`[VERIFY] Error checking tee time ${teeTimeId}:`, error)
      return {
        success: false,
        error: error.message,
        matches: false,
      }
    }

    const matches = data.is_available === expectedAvailability

    console.log(
      `[VERIFY] Tee time ${teeTimeId} availability: expected=${expectedAvailability}, actual=${data.is_available}, matches=${matches}`,
    )

    return {
      success: true,
      matches,
      actual: data.is_available,
      expected: expectedAvailability,
    }
  } catch (error: any) {
    console.error(`[VERIFY] Unexpected error checking tee time ${teeTimeId}:`, error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
      matches: false,
    }
  }
}

// Function to directly update a tee time's availability in the database
export async function forceUpdateTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  const supabase = await createClient()

  try {
    console.log(`[FORCE] Updating tee time ${teeTimeId} availability to ${isAvailable}`)

    const { data, error } = await supabase
      .from("tee_times")
      .update({ is_available: isAvailable })
      .eq("id", teeTimeId)
      .select()

    if (error) {
      console.error(`[FORCE] Error updating tee time ${teeTimeId}:`, error)
      return {
        success: false,
        error: error.message,
      }
    }

    console.log(`[FORCE] Successfully updated tee time ${teeTimeId}`)

    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error(`[FORCE] Unexpected error updating tee time ${teeTimeId}:`, error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    }
  }
}
