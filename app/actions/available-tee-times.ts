"use server"

import { createClient } from "@/lib/supabase/server"

async function getActiveSeason() {
  const supabase = await createClient()
  const { data } = await supabase.from("seasons").select("year").eq("is_active", true).single()

  return data?.year || new Date().getFullYear()
}

export async function getAvailableTeeTimesForDate(date: string) {
  try {
    const supabase = await createClient()
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
      .eq("season", activeSeason)
      .eq("is_available", true)
      .gt("max_slots", 0)
      .order("time", { ascending: true })

    if (error) {
      console.error("Error fetching tee times:", error)
      return { success: false, error: error.message, teeTimes: [] }
    }

    const now = new Date().toISOString()

    // Calculate available slots and check booking window
    const availableTeeTimes =
      teeTimes
        ?.map((teeTime) => {
          const reservedSlots =
            teeTime.reservations?.reduce((sum: number, reservation: { slots: number }) => sum + reservation.slots, 0) || 0
          const availableSlots = (teeTime.max_slots || 4) - reservedSlots

          // Determine booking window status
          let bookingOpen = true
          let bookingStatus = "open"
          if (teeTime.booking_opens_at && teeTime.booking_closes_at) {
            if (now < teeTime.booking_opens_at) {
              bookingOpen = false
              bookingStatus = "not_yet_open"
            } else if (now > teeTime.booking_closes_at) {
              bookingOpen = false
              bookingStatus = "closed"
            }
          }

          return {
            ...teeTime,
            available_slots: availableSlots,
            reserved_slots: reservedSlots,
            time_slot: teeTime.time,
            booking_open: bookingOpen,
            booking_status: bookingStatus,
          }
        })
        .filter((teeTime) => teeTime.available_slots > 0) || []

    return { success: true, teeTimes: availableTeeTimes }
  } catch (error: any) {
    console.error("Error in getAvailableTeeTimesForDate:", error)
    return { success: false, error: error.message || "An unexpected error occurred", teeTimes: [] }
  }
}

export async function checkTeeTimeAvailability(teeTimeId: string, requestedSlots: number) {
  try {
    const supabase = await createClient()

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
      return { success: false, error: error.message, available: false }
    }

    if (!teeTime) {
      return { success: false, error: "Tee time not found", available: false }
    }

    // Check booking window
    const now = new Date().toISOString()
    if (teeTime.booking_opens_at && teeTime.booking_closes_at) {
      if (now < teeTime.booking_opens_at) {
        return { success: false, error: "Booking has not opened yet for this tee time", available: false }
      }
      if (now > teeTime.booking_closes_at) {
        return { success: false, error: "Booking has closed for this tee time", available: false }
      }
    }

    const reservedSlots =
      teeTime.reservations?.reduce((sum: number, reservation: { slots: number }) => sum + reservation.slots, 0) || 0
    const availableSlots = (teeTime.max_slots || 4) - reservedSlots
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
