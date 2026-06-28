"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/utils"
import { revalidatePath } from "next/cache"

async function getActiveSeason() {
  const supabase = await createClient()
  const { data } = await supabase.from("seasons").select("year").eq("is_active", true).single()

  return data?.year || new Date().getFullYear()
}

// Function to get available tee times for a specific date
export async function getAvailableTeeTimesByDate(date: string) {
  const supabase = await createClient()

  try {
    // Format the date to ensure consistency
    const formattedDate = formatDate(new Date(date)).split("T")[0]

    // IMPORTANT: Use the get_valid_tee_times function to get only valid tee times
    const { data: teeTimes, error: teeTimesError } = await supabase.rpc("get_valid_tee_times", {
      p_date: formattedDate,
    })

    if (teeTimesError) {
      console.error("Error fetching tee times:", teeTimesError)
      return { success: false, error: teeTimesError.message }
    }

    return { success: true, teeTimes }
  } catch (error: any) {
    console.error("Error in getAvailableTeeTimesByDate:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get all tee times for a specific week
export async function getAllTeeTimesByWeek(startDate: string, endDate: string) {
  const supabase = await createClient()

  try {
    // Get all tee times
    const { data: teeTimes, error: teeTimesError } = await supabase
      .from("tee_times")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date")
      .order("time")

    if (teeTimesError) {
      console.error("Error fetching tee times:", teeTimesError)
      return { success: false, error: teeTimesError.message }
    }

    return { success: true, teeTimes }
  } catch (error: any) {
    console.error("Error in getAllTeeTimesByWeek:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get all tee times for the admin dashboard
export async function getAllTeeTimes() {
  const supabase = await createClient()

  try {
    // Get all tee times
    const { data: teeTimes, error: teeTimesError } = await supabase
      .from("tee_times")
      .select("*")
      .order("date", { ascending: false })
      .order("time")
      .limit(200)

    if (teeTimesError) {
      console.error("Error fetching tee times:", teeTimesError)
      return { success: false, error: teeTimesError.message }
    }

    return { success: true, teeTimes }
  } catch (error: any) {
    console.error("Error in getAllTeeTimes:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to create a new tee time
export async function createTeeTime(data: {
  date: string
  time: string
  maxSlots: number
}) {
  const supabase = await createClient()

  try {
    const activeSeason = await getActiveSeason()

    // Format the date to ensure consistency
    const formattedDate = formatDate(new Date(data.date)).split("T")[0]

    // Insert the new tee time
    const { data: newTeeTime, error } = await supabase.from("tee_times").insert({
      date: formattedDate,
      time: data.time,
      max_slots: data.maxSlots,
      season: activeSeason, // Add season to new tee time
      is_available: true, // New tee times are available by default
    })

    if (error) {
      console.error("Error creating tee time:", error)
      return { success: false, error: error.message }
    }

    // Get the inserted tee time
    const { data: insertedTeeTime, error: selectError } = await supabase
      .from("tee_times")
      .select("*")
      .eq("date", formattedDate)
      .eq("time", data.time)
      .single()

    if (selectError) {
      console.error("Error fetching inserted tee time:", selectError)
      return { success: false, error: selectError.message }
    }

    // Also insert into tee_time_availability to explicitly mark it as available
    const { error: availabilityError } = await supabase.from("tee_time_availability").insert({
      tee_time_id: insertedTeeTime.id,
      is_available: true,
    })

    if (availabilityError) {
      console.error("Error setting tee time availability:", availabilityError)
      // Don't return an error here, as the tee time was created successfully
    }

    revalidatePath("/admin/tee-times")
    revalidatePath("/admin/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    return { success: true, teeTime: insertedTeeTime }
  } catch (error: any) {
    console.error("Error in createTeeTime:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to update tee time availability
export async function updateTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  const supabase = await createClient()

  try {
    // First, check if there's an entry in tee_time_availability
    const { data: existingAvailability, error: checkError } = await supabase
      .from("tee_time_availability")
      .select("id")
      .eq("tee_time_id", teeTimeId)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing availability:", checkError)
      return { success: false, error: checkError.message }
    }

    let updateResult

    // If there's an existing entry, update it
    if (existingAvailability) {
      updateResult = await supabase
        .from("tee_time_availability")
        .update({ is_available: isAvailable })
        .eq("tee_time_id", teeTimeId)
    } else {
      // Otherwise, insert a new entry
      updateResult = await supabase.from("tee_time_availability").insert({
        tee_time_id: teeTimeId,
        is_available: isAvailable,
      })
    }

    if (updateResult.error) {
      console.error("Error updating tee time availability:", updateResult.error)
      return { success: false, error: updateResult.error.message }
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
      console.error(`Verification failed: expected ${isAvailable}, got ${verifyData.is_available}`)
      return { success: false, error: "Verification failed: availability not updated correctly" }
    }

    revalidatePath("/admin/tee-times")
    revalidatePath("/admin/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Error in updateTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to delete a tee time
export async function deleteTeeTime(id: string, options: { force?: boolean } = {}) {
  // Use the service-role client: tee_times RLS only grants SELECT to
  // authenticated users, so a delete through the user-scoped client matches
  // zero rows and silently "succeeds" while the row stays put. This action is
  // admin-only and gated by the admin UI, so bypassing RLS here is correct.
  const supabase = createAdminClient()

  try {
    // Check if there are any reservations for this tee time
    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("id")
      .eq("tee_time_id", id)

    if (reservationsError) {
      console.error("Error checking reservations:", reservationsError)
      return { success: false, error: reservationsError.message }
    }

    if (reservations && reservations.length > 0) {
      if (!options.force) {
        return {
          success: false,
          error: "Cannot delete tee time with existing reservations. Please delete the reservations first.",
        }
      }

      const { error: delReservationsError } = await supabase
        .from("reservations")
        .delete()
        .eq("tee_time_id", id)

      if (delReservationsError) {
        console.error("Error deleting reservations:", delReservationsError)
        return { success: false, error: delReservationsError.message }
      }
    }

    // Clean up availability row (non-fatal if it fails)
    const { error: delAvailabilityError } = await supabase
      .from("tee_time_availability")
      .delete()
      .eq("tee_time_id", id)

    if (delAvailabilityError) {
      console.error("Error deleting tee_time_availability row:", delAvailabilityError)
    }

    // Delete the tee time
    const { error } = await supabase.from("tee_times").delete().eq("id", id)

    if (error) {
      console.error("Error deleting tee time:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/tee-times")
    revalidatePath("/admin/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteTeeTime:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to create a new reservation
export async function createReservation(data: {
  teeTimeId: string
  userId: string
  slots: number
  playerNames: string[]
  playForMoney: boolean[]
  playerUserIds?: (string | null)[]
}) {
  const supabase = await createClient()

  try {
    // Block bookings from users who are pending or have been deactivated by
    // an admin. The picker already hides them, but enforce server-side too.
    const { data: bookerStatus, error: bookerStatusError } = await supabase
      .from("users")
      .select("is_confirmed, is_active")
      .eq("id", data.userId)
      .single()

    if (bookerStatusError) {
      console.error("Error fetching booker status:", bookerStatusError)
      return { success: false, error: bookerStatusError.message }
    }

    if (!bookerStatus?.is_confirmed) {
      return { success: false, error: "Your account is pending admin approval and cannot book tee times yet." }
    }

    if (!bookerStatus?.is_active) {
      return { success: false, error: "Your account is inactive. Contact a league admin to book tee times." }
    }

    // Reject any linked players who are no longer active. This catches the
    // race where someone is added to the form, then deactivated before submit.
    const linkedIdsForCheck = (data.playerUserIds || []).filter((id): id is string => !!id)
    if (linkedIdsForCheck.length > 0) {
      const { data: linkedStatuses, error: linkedStatusError } = await supabase
        .from("users")
        .select("id, name, is_confirmed, is_active")
        .in("id", linkedIdsForCheck)

      if (linkedStatusError) {
        console.error("Error fetching linked player statuses:", linkedStatusError)
        return { success: false, error: linkedStatusError.message }
      }

      const blocked = (linkedStatuses || []).filter((u) => !u.is_confirmed || !u.is_active)
      if (blocked.length > 0) {
        const names = blocked.map((u) => u.name).join(", ")
        return {
          success: false,
          error: `These players can't be added right now (inactive or pending approval): ${names}.`,
        }
      }
    }

    // Check if the tee time exists and has enough available slots
    const { data: teeTime, error: teeTimeError } = await supabase
      .from("tee_times")
      .select("*")
      .eq("id", data.teeTimeId)
      .single()

    if (teeTimeError) {
      console.error("Error fetching tee time:", teeTimeError)
      return { success: false, error: teeTimeError.message }
    }

    // tee_times.is_available is the single source of truth for whether a slot
    // can be booked (this is what the admin disable toggle writes). The older
    // tee_time_availability table is no longer authoritative — template-
    // generated tee times never get a row there, so we only treat an explicit
    // is_available=false on that table as a block for backwards compatibility.
    if (teeTime.is_available === false) {
      console.error(`Tee time ${data.teeTimeId} is disabled and not available for booking`)
      return { success: false, error: "This tee time is not available for booking" }
    }

    const { data: availabilityData } = await supabase
      .from("tee_time_availability")
      .select("is_available")
      .eq("tee_time_id", data.teeTimeId)
      .maybeSingle()

    if (availabilityData && availabilityData.is_available === false) {
      console.error(`Tee time ${data.teeTimeId} is not available for booking`)
      return { success: false, error: "This tee time is not available for booking" }
    }

    // Enforce the booking window. Admins can book outside the window so they
    // can fix mistakes — for everyone else, the open/close timestamps on the
    // tee_times row are authoritative.
    const { data: bookerRoleRow } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", data.userId)
      .single()
    const isBookerAdmin = !!bookerRoleRow?.is_admin

    if (!isBookerAdmin) {
      const now = new Date()
      if (teeTime.booking_opens_at) {
        const opensAt = new Date(teeTime.booking_opens_at)
        if (now < opensAt) {
          return {
            success: false,
            error: `Booking for this tee time hasn't opened yet. Try again after ${opensAt.toLocaleString()}.`,
          }
        }
      }
      if (teeTime.booking_closes_at) {
        const closesAt = new Date(teeTime.booking_closes_at)
        if (now > closesAt) {
          return {
            success: false,
            error: "Booking for this tee time has closed.",
          }
        }
      }
    }

    // Get existing reservations for this tee time
    const { data: existingReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("slots")
      .eq("tee_time_id", data.teeTimeId)

    if (reservationsError) {
      console.error("Error fetching reservations:", reservationsError)
      return { success: false, error: reservationsError.message }
    }

    // Calculate total reserved slots
    const reservedSlots = existingReservations.reduce((sum, r) => sum + r.slots, 0)
    const availableSlots = teeTime.max_slots - reservedSlots

    if (data.slots > availableSlots) {
      return {
        success: false,
        error: `Not enough available slots. Only ${availableSlots} slots available.`,
      }
    }

    // Enforce one-tee-time-per-day for everyone in the group (booker + linked users).
    const linkedUserIds = (data.playerUserIds || []).filter((id): id is string => !!id)
    const allPlayerIds = [data.userId, ...linkedUserIds]
    if (allPlayerIds.length > 0) {
      const { data: sameDayReservations, error: conflictError } = await supabase
        .from("reservations")
        .select("id, user_id, player_user_ids, tee_times!inner ( date, time )")
        .eq("tee_times.date", teeTime.date)

      if (conflictError) {
        console.error("Error checking day conflicts:", conflictError)
        return { success: false, error: conflictError.message }
      }

      const targetIds = new Set(allPlayerIds)
      const conflictedIds = new Set<string>()
      for (const r of sameDayReservations || []) {
        if (targetIds.has(r.user_id)) conflictedIds.add(r.user_id)
        for (const uid of ((r.player_user_ids as (string | null)[] | null) || [])) {
          if (uid && targetIds.has(uid)) conflictedIds.add(uid)
        }
      }
      if (conflictedIds.size > 0) {
        const { data: conflictUsers } = await supabase
          .from("users")
          .select("id, name")
          .in("id", Array.from(conflictedIds))
        const names = (conflictUsers || []).map((u) => u.name).join(", ")
        return {
          success: false,
          error: `One of the players already has a reservation on this date: ${names}. Each player can only book one tee time per day.`,
        }
      }
    }

    // Create the reservation
    const { error } = await supabase.from("reservations").insert({
      tee_time_id: data.teeTimeId,
      user_id: data.userId,
      slots: data.slots,
      player_names: data.playerNames,
      play_for_money: data.playForMoney,
      player_user_ids: data.playerUserIds || [],
      season: teeTime.season,
    })

    if (error) {
      console.error("Error creating reservation:", error)
      return { success: false, error: error.message }
    }

    // Get the created reservation
    const { data: newReservation, error: selectError } = await supabase
      .from("reservations")
      .select("*")
      .eq("tee_time_id", data.teeTimeId)
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (selectError) {
      console.error("Error fetching created reservation:", selectError)
      // Don't return error here as reservation was created successfully
    }

    revalidatePath("/dashboard")
    revalidatePath("/reservations")
    return { success: true, reservation: newReservation }
  } catch (error: any) {
    console.error("Error in createReservation:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get reservations for a specific user
export async function getUserReservations(userId: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        *,
        tee_times (
          date,
          time
        ),
        users (
          name,
          email
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching user reservations:", error)
      return { success: false, error: error.message }
    }

    return { success: true, reservations: data }
  } catch (error: any) {
    console.error("Error in getUserReservations:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get all reservations for the admin dashboard
export async function getAllReservations() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        *,
        tee_times (
          date,
          time
        ),
        users (
          name,
          email
        )
      `)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      console.error("Error fetching all reservations:", error)
      return { success: false, error: error.message }
    }

    return { success: true, reservations: data }
  } catch (error: any) {
    console.error("Error in getAllReservations:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to delete a reservation
export async function deleteReservation(id: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.from("reservations").delete().eq("id", id)

    if (error) {
      console.error("Error deleting reservation:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/dashboard")
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/tee-times")
    revalidatePath("/schedule")
    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteReservation:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to check if a specific tee time is available
export async function checkTeeTimeAvailability(teeTimeId: string) {
  const supabase = await createClient()

  try {
    // First, check if the tee time is available in tee_time_availability
    const { data: availabilityData, error: availabilityError } = await supabase
      .from("tee_time_availability")
      .select("is_available")
      .eq("tee_time_id", teeTimeId)
      .single()

    if (availabilityError && availabilityError.code !== "PGRST116") {
      console.error("Error checking tee time availability:", availabilityError)
      return { success: false, error: availabilityError.message }
    }

    // If there's no entry or is_available is false, the tee time is not available
    if (!availabilityData || !availabilityData.is_available) {
      console.error(`Tee time ${teeTimeId} is not available for booking`)
      return { success: false, isAvailable: false, reason: "This tee time is not available for booking" }
    }

    // Get the tee time details
    const { data: teeTime, error: teeTimeError } = await supabase
      .from("tee_times")
      .select("*")
      .eq("id", teeTimeId)
      .single()

    if (teeTimeError) {
      console.error("Error fetching tee time:", teeTimeError)
      return { success: false, error: teeTimeError.message }
    }

    // Get existing reservations for this tee time
    const { data: existingReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("slots")
      .eq("tee_time_id", teeTimeId)

    if (reservationsError) {
      console.error("Error fetching reservations:", reservationsError)
      return { success: false, error: reservationsError.message }
    }

    // Calculate total reserved slots
    const reservedSlots = existingReservations.reduce((sum, r) => sum + r.slots, 0)
    const availableSlots = teeTime.max_slots - reservedSlots

    if (availableSlots <= 0) {
      console.error(`Tee time ${teeTimeId} has no available slots`)
      return { success: false, isAvailable: false, reason: "No available slots" }
    }

    return {
      success: true,
      isAvailable: true,
      teeTime,
      availableSlots,
    }
  } catch (error: any) {
    console.error("Error in checkTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
