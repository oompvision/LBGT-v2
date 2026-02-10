"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Define the exact structure of the tee time availability result
interface TeeTimeAvailability {
  id: string
  time_slot: string
  is_available: boolean
  reserved_slots: number
  max_slots: number
}

// Function to get tee time availability for a specific date using direct SQL
export async function getTeeTimeAvailability(date: string) {
  const supabase = await createClient()

  try {
    // First, get the tee times
    const { data: teeTimes, error: teeTimesError } = await supabase
      .from("tee_times")
      .select("id, time, is_available, max_slots")
      .eq("date", date)
      .order("time")

    if (teeTimesError) {
      console.error("Error getting tee times:", teeTimesError)
      return { success: false, error: teeTimesError.message }
    }

    // Then, get the reservations for these tee times
    const teeTimeIds = teeTimes.map((tt) => tt.id)

    // If there are no tee times, return an empty array
    if (teeTimeIds.length === 0) {
      return { success: true, teeTimeAvailability: [] }
    }

    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("tee_time_id, slots")
      .in("tee_time_id", teeTimeIds)

    if (reservationsError) {
      console.error("Error getting reservations:", reservationsError)
      return { success: false, error: reservationsError.message }
    }

    // Calculate reserved slots for each tee time
    const reservedSlotsByTeeTime = {}
    reservations.forEach((reservation) => {
      if (!reservedSlotsByTeeTime[reservation.tee_time_id]) {
        reservedSlotsByTeeTime[reservation.tee_time_id] = 0
      }
      reservedSlotsByTeeTime[reservation.tee_time_id] += reservation.slots
    })

    // Format the data to match our expected structure
    const formattedData = teeTimes.map((teeTime) => ({
      id: teeTime.id,
      time_slot: teeTime.time,
      is_available: teeTime.is_available,
      reserved_slots: reservedSlotsByTeeTime[teeTime.id] || 0,
      max_slots: teeTime.max_slots,
    }))

    return { success: true, teeTimeAvailability: formattedData }
  } catch (error: any) {
    console.error("Error in getTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to update a single tee time's availability
export async function updateSingleTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  const supabase = await createClient()

  try {
    // Use a direct update instead of RPC
    const { data, error } = await supabase
      .from("tee_times")
      .update({ is_available: isAvailable })
      .eq("id", teeTimeId)
      .select()

    if (error) {
      console.error("Error updating tee time availability:", error)
      return { success: false, error: error.message }
    }

    // Revalidate all relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/admin/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/reservations/[id]", "page")

    return { success: true, updated: data }
  } catch (error: any) {
    console.error("Error in updateSingleTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to bulk update tee time availability
export async function bulkUpdateTeeTimeAvailability(updates: { id: string; is_available: boolean }[]) {
  const supabase = await createClient()

  try {
    // Process updates one by one to avoid structure mismatch issues
    const results = await Promise.all(
      updates.map(async (update) => {
        const { data, error } = await supabase
          .from("tee_times")
          .update({ is_available: update.is_available })
          .eq("id", update.id)
          .select()

        return {
          id: update.id,
          success: !error,
          error: error?.message,
        }
      }),
    )

    // Check if all updates were successful
    const allSuccessful = results.every((result) => result.success)

    // Revalidate all relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/admin/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/reservations/[id]", "page")

    return {
      success: allSuccessful,
      results,
      error: allSuccessful ? null : "Some updates failed. Check the results for details.",
    }
  } catch (error: any) {
    console.error("Error in bulkUpdateTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get tee time logs
export async function getTeeTimeLogs(teeTimeId?: string) {
  const supabase = await createClient()

  try {
    let query = supabase.from("tee_time_logs").select("*").order("changed_at", { ascending: false })

    if (teeTimeId) {
      query = query.eq("tee_time_id", teeTimeId)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      console.error("Error getting tee time logs:", error)
      return { success: false, error: error.message }
    }

    return { success: true, logs: data }
  } catch (error: any) {
    console.error("Error in getTeeTimeLogs:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
