"use server"

import { createClient } from "@/lib/supabase/server"

// Helper to get active season
async function getActiveSeason() {
  const supabase = await createClient()
  const { data } = await supabase.from("seasons").select("year").eq("is_active", true).single()

  return data?.year || new Date().getFullYear()
}

// Get available tee times for booking (respects booking windows)
export async function getAvailableTeeTimesForBooking(date: string) {
  const supabase = await createClient()

  try {
    const activeSeason = await getActiveSeason()

    const { data, error } = await supabase
      .from("available_tee_times")
      .select("*")
      .eq("date", date)
      .eq("is_available", true)
      .eq("season", activeSeason)
      .gt("available_slots", 0)
      .order("time")

    if (error) {
      console.error("Error getting available tee times for booking:", error)
      return { success: false, error: error.message, teeTimes: [] }
    }

    // Also get booking window info from tee_times table
    const teeTimeIds = data?.map((tt) => tt.id) || []
    let bookingWindows: Record<string, { booking_opens_at: string | null; booking_closes_at: string | null }> = {}

    if (teeTimeIds.length > 0) {
      const { data: windowData } = await supabase
        .from("tee_times")
        .select("id, booking_opens_at, booking_closes_at")
        .in("id", teeTimeIds)

      if (windowData) {
        bookingWindows = Object.fromEntries(windowData.map((w) => [w.id, w]))
      }
    }

    const now = new Date().toISOString()

    return {
      success: true,
      teeTimes: (data || []).map((tt) => {
        const window = bookingWindows[tt.id]
        let bookingOpen = true
        let bookingStatus = "open"

        if (window?.booking_opens_at && window?.booking_closes_at) {
          if (now < window.booking_opens_at) {
            bookingOpen = false
            bookingStatus = "not_yet_open"
          } else if (now > window.booking_closes_at) {
            bookingOpen = false
            bookingStatus = "closed"
          }
        }

        return {
          ...tt,
          availableSlots: tt.available_slots,
          booking_open: bookingOpen,
          booking_status: bookingStatus,
          booking_opens_at: window?.booking_opens_at || null,
          booking_closes_at: window?.booking_closes_at || null,
        }
      }),
    }
  } catch (error: any) {
    console.error("Error in getAvailableTeeTimesForBooking:", error)
    return { success: false, error: error.message || "An unexpected error occurred", teeTimes: [] }
  }
}

// Check if a specific tee time is available for booking (respects booking windows)
export async function checkTeeTimeAvailableForBooking(teeTimeId: string) {
  const supabase = await createClient()

  try {
    // Get availability from view
    const { data, error } = await supabase
      .from("available_tee_times")
      .select("is_available, available_slots")
      .eq("id", teeTimeId)
      .single()

    if (error) {
      return { success: false, error: error.message, isAvailable: false }
    }

    // Check booking window from tee_times table
    const { data: teeTime } = await supabase
      .from("tee_times")
      .select("booking_opens_at, booking_closes_at")
      .eq("id", teeTimeId)
      .single()

    const now = new Date().toISOString()
    if (teeTime?.booking_opens_at && teeTime?.booking_closes_at) {
      if (now < teeTime.booking_opens_at) {
        return { success: false, error: "Booking has not opened yet", isAvailable: false }
      }
      if (now > teeTime.booking_closes_at) {
        return { success: false, error: "Booking has closed", isAvailable: false }
      }
    }

    const isAvailable = data.is_available && data.available_slots > 0
    return { success: true, isAvailable }
  } catch (error: any) {
    console.error("Error in checkTeeTimeAvailableForBooking:", error)
    return { success: false, error: error.message || "An unexpected error occurred", isAvailable: false }
  }
}
