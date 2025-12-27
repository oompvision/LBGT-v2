"use server"

import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/utils"

// Helper to get active season
async function getActiveSeason() {
  const supabase = createClient()
  const { data } = await supabase.from("seasons").select("year").eq("is_active", true).single()

  return data?.year || new Date().getFullYear()
}

// Function to get available tee times for booking
export async function getAvailableTeeTimesForBooking(date: string) {
  const supabase = createClient()

  try {
    console.log(`Getting available tee times for booking on date: ${date}`)

    const activeSeason = await getActiveSeason()

    const formattedDate = formatDate(new Date(date)).split("T")[0]

    const { data, error } = await supabase
      .from("available_tee_times")
      .select("*")
      .eq("date", formattedDate)
      .eq("is_available", true)
      .eq("season", activeSeason) // Filter by active season
      .gt("available_slots", 0)
      .order("time")

    if (error) {
      console.error("Error getting available tee times for booking:", error)
      return { success: false, error: error.message, teeTimes: [] }
    }

    console.log(`Found ${data?.length || 0} available tee times for booking on ${date}`)

    return {
      success: true,
      teeTimes: data.map((tt) => ({
        ...tt,
        availableSlots: tt.available_slots,
      })),
    }
  } catch (error: any) {
    console.error("Error in getAvailableTeeTimesForBooking:", error)
    return { success: false, error: error.message || "An unexpected error occurred", teeTimes: [] }
  }
}

// Function to check if a specific tee time is available for booking
export async function checkTeeTimeAvailableForBooking(teeTimeId: string) {
  const supabase = createClient()

  try {
    console.log(`Checking if tee time ${teeTimeId} is available for booking`)

    // Query the available_tee_times view
    const { data, error } = await supabase
      .from("available_tee_times")
      .select("is_available, available_slots")
      .eq("id", teeTimeId)
      .single()

    if (error) {
      console.error("Error checking tee time availability for booking:", error)
      return { success: false, error: error.message, isAvailable: false }
    }

    // Check if the tee time is available and has available slots
    const isAvailable = data.is_available && data.available_slots > 0

    console.log(`Tee time ${teeTimeId} is ${isAvailable ? "available" : "not available"} for booking`)

    return { success: true, isAvailable }
  } catch (error: any) {
    console.error("Error in checkTeeTimeAvailableForBooking:", error)
    return { success: false, error: error.message || "An unexpected error occurred", isAvailable: false }
  }
}
