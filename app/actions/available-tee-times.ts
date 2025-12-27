"use server"

import { createClient } from "@/lib/supabase/server"

async function getActiveSeason() {
  const supabase = createClient()
  const { data } = await supabase.from("seasons").select("year").eq("is_active", true).single()

  return data?.year || new Date().getFullYear()
}

export async function getAvailableTeeTimesForDate(date: string) {
  try {
    console.log(`Getting available tee times for date: ${date}`)

    const supabase = createClient()

    const activeSeason = await getActiveSeason()

    const { data: teeTimes, error } = await supabase
      .from("tee_times")
      .select(`
        *,
        reservations (
          id,
          slots
        )
      `)
      .eq("date", date)
      .eq("season", activeSeason) // Filter by active season
      .gt("max_slots", 0)
      .order("time", { ascending: true })

    if (error) {
      console.error("Error fetching tee times:", error)
      return { success: false, error: error.message, teeTimes: [] }
    }

    // Calculate available slots for each tee time
    const availableTeeTimes =
      teeTimes
        ?.map((teeTime) => {
          const reservedSlots =
            teeTime.reservations?.reduce((sum: number, reservation: any) => sum + reservation.slots, 0) || 0
          const availableSlots = (teeTime.max_slots || 4) - reservedSlots

          return {
            ...teeTime,
            available_slots: availableSlots,
            reserved_slots: reservedSlots,
            time_slot: teeTime.time, // For compatibility
          }
        })
        .filter((teeTime) => teeTime.available_slots > 0) || [] // Only return tee times with available slots

    console.log(`Found ${availableTeeTimes.length} available tee times for ${date}`)

    return { success: true, teeTimes: availableTeeTimes }
  } catch (error: any) {
    console.error("Error in getAvailableTeeTimesForDate:", error)
    return { success: false, error: error.message || "An unexpected error occurred", teeTimes: [] }
  }
}

export async function checkTeeTimeAvailability(teeTimeId: string, requestedSlots: number) {
  try {
    console.log(`Checking availability for tee time ${teeTimeId}, requested slots: ${requestedSlots}`)

    const supabase = createClient()

    // Get the tee time with current reservations
    const { data: teeTime, error } = await supabase
      .from("tee_times")
      .select(`
        *,
        reservations (
          id,
          slots
        )
      `)
      .eq("id", teeTimeId)
      .single()

    if (error) {
      console.error("Error fetching tee time:", error)
      return { success: false, error: error.message, available: false }
    }

    if (!teeTime) {
      return { success: false, error: "Tee time not found", available: false }
    }

    // Calculate current reserved slots
    const reservedSlots =
      teeTime.reservations?.reduce((sum: number, reservation: any) => sum + reservation.slots, 0) || 0
    const availableSlots = (teeTime.max_slots || 4) - reservedSlots

    console.log(`Tee time ${teeTimeId}: ${availableSlots} slots available, ${requestedSlots} requested`)

    const isAvailable = availableSlots >= requestedSlots

    return {
      success: true,
      available: isAvailable,
      availableSlots,
      reservedSlots,
      maxSlots: teeTime.max_slots || 4,
      teeTime,
    }
  } catch (error: any) {
    console.error("Error in checkTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred", available: false }
  }
}
