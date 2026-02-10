"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Get tee time availability for a specific date
export async function getTeeTimeAvailabilityByDate(date: string) {
  const supabase = await createClient()

  try {
    console.log(`Getting tee time availability for date: ${date}`)

    // Use a direct query to the available_tee_times view
    const { data, error } = await supabase
      .from("available_tee_times")
      .select("id, date, time, max_slots, is_available, reserved_slots, available_slots")
      .eq("date", date)
      .order("time")

    if (error) {
      console.error("Error getting tee time availability:", error)
      return { success: false, error: error.message, teeTimeAvailability: [] }
    }

    console.log(`Found ${data?.length || 0} tee times for ${date}`)

    // Ensure data is an array
    if (!Array.isArray(data)) {
      console.error("Data is not an array:", data)
      return { success: false, error: "Invalid data format", teeTimeAvailability: [] }
    }

    // Transform the data to match the expected structure
    const transformedData = data.map((item) => ({
      id: item.id,
      tee_time_id: item.id, // Use the same ID for both
      time_slot: item.time,
      is_available: item.is_available,
      max_slots: item.max_slots,
      reserved_slots: item.reserved_slots,
    }))

    return { success: true, teeTimeAvailability: transformedData }
  } catch (error: any) {
    console.error("Error in getTeeTimeAvailabilityByDate:", error)
    return { success: false, error: error.message || "An unexpected error occurred", teeTimeAvailability: [] }
  }
}

// Set tee time availability
export async function setTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  const supabase = await createClient()

  try {
    console.log(`Setting tee time ${teeTimeId} availability to ${isAvailable}`)

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Insert or update the tee_time_availability record
    const { error } = await supabase.from("tee_time_availability").upsert({
      tee_time_id: teeTimeId,
      is_available: isAvailable,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })

    if (error) {
      console.error("Error setting tee time availability:", error)
      return { success: false, error: error.message }
    }

    // Verify the update was successful
    const { data: verifyData, error: verifyError } = await supabase
      .from("tee_time_availability")
      .select("is_available")
      .eq("tee_time_id", teeTimeId)
      .single()

    if (verifyError) {
      console.error("Error verifying tee time availability update:", verifyError)
      return { success: false, error: verifyError.message }
    }

    if (verifyData.is_available !== isAvailable) {
      console.error("Tee time availability update verification failed")
      return { success: false, error: "Failed to update tee time availability" }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/reservations")

    return { success: true, updated: true }
  } catch (error: any) {
    console.error("Error in setTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Check if a tee time is available
export async function checkTeeTimeAvailability(teeTimeId: string) {
  const supabase = await createClient()

  try {
    console.log(`Checking availability for tee time: ${teeTimeId}`)

    // Query the tee_time_availability table directly
    const { data, error } = await supabase
      .from("tee_time_availability")
      .select("is_available")
      .eq("tee_time_id", teeTimeId)
      .single()

    if (error) {
      // If no record is found, default to true
      if (error.code === "PGRST116") {
        return { success: true, isAvailable: true }
      }

      console.error("Error checking tee time availability:", error)
      return { success: false, error: error.message, isAvailable: false }
    }

    return { success: true, isAvailable: data.is_available }
  } catch (error: any) {
    console.error("Error in checkTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred", isAvailable: false }
  }
}
