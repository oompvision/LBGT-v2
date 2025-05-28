"use server"

import { createClient } from "@/lib/supabase/server"
import { generateTeeTimes, getUpcomingFridayForSeason, getNextFriday, formatDate } from "@/lib/utils"
import { revalidatePath } from "next/cache"

// Function to get available tee times for a specific date
export async function getAvailableTeeTimesByDate(date: string) {
  const supabase = createClient()

  try {
    // Format the date to ensure consistency
    const formattedDate = formatDate(new Date(date)).split("T")[0]

    console.log(`Getting available tee times for date: ${formattedDate}`)

    // IMPORTANT: Use the get_valid_tee_times function to get only valid tee times
    const { data: teeTimes, error: teeTimesError } = await supabase.rpc("get_valid_tee_times", {
      p_date: formattedDate,
    })

    if (teeTimesError) {
      console.error("Error fetching tee times:", teeTimesError)
      return { success: false, error: teeTimesError.message }
    }

    console.log(`Found ${teeTimes.length} tee times for date ${formattedDate}`)

    return { success: true, teeTimes }
  } catch (error: any) {
    console.error("Error in getAvailableTeeTimesByDate:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get all tee times for a specific week
export async function getAllTeeTimesByWeek(startDate: string, endDate: string) {
  const supabase = createClient()

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
  const supabase = createClient()

  try {
    // Get all tee times
    const { data: teeTimes, error: teeTimesError } = await supabase
      .from("tee_times")
      .select("*")
      .order("date")
      .order("time")

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
  const supabase = createClient()

  try {
    // Format the date to ensure consistency
    const formattedDate = formatDate(new Date(data.date)).split("T")[0]

    // Insert the new tee time
    const { data: newTeeTime, error } = await supabase.from("tee_times").insert({
      date: formattedDate,
      time: data.time,
      max_slots: data.maxSlots,
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
  const supabase = createClient()

  try {
    console.log(`Updating tee time ${teeTimeId} availability to ${isAvailable}`)

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
      console.log(`Updating existing availability entry for tee time ${teeTimeId}`)
      updateResult = await supabase
        .from("tee_time_availability")
        .update({ is_available: isAvailable })
        .eq("tee_time_id", teeTimeId)
    } else {
      // Otherwise, insert a new entry
      console.log(`Creating new availability entry for tee time ${teeTimeId}`)
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

    console.log(`Verified tee time ${teeTimeId} availability is now ${verifyData.is_available}`)

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
export async function deleteTeeTime(id: string) {
  const supabase = createClient()

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
      return {
        success: false,
        error: "Cannot delete tee time with existing reservations. Please delete the reservations first.",
      }
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
}) {
  const supabase = createClient()

  try {
    console.log(`Creating reservation for tee time ${data.teeTimeId}`)

    // First, check if the tee time is available in tee_time_availability
    const { data: availabilityData, error: availabilityError } = await supabase
      .from("tee_time_availability")
      .select("is_available")
      .eq("tee_time_id", data.teeTimeId)
      .single()

    if (availabilityError && availabilityError.code !== "PGRST116") {
      console.error("Error checking tee time availability:", availabilityError)
      return { success: false, error: availabilityError.message }
    }

    // If there's no entry or is_available is false, the tee time is not available
    if (!availabilityData || !availabilityData.is_available) {
      console.error(`Tee time ${data.teeTimeId} is not available for booking`)
      return { success: false, error: "This tee time is not available for booking" }
    }

    console.log(`Tee time ${data.teeTimeId} is available for booking`)

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

    // Create the reservation
    const { error } = await supabase.from("reservations").insert({
      tee_time_id: data.teeTimeId,
      user_id: data.userId,
      slots: data.slots,
      player_names: data.playerNames,
      play_for_money: data.playForMoney,
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
  const supabase = createClient()

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
  const supabase = createClient()

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
  const supabase = createClient()

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

// Function to check if tee times exist for the upcoming Friday and generate them if they don't
export async function checkAndGenerateTeeTimes() {
  const supabase = createClient()

  try {
    // Get the upcoming Friday date
    const upcomingFriday = getUpcomingFridayForSeason()

    // If there's no upcoming Friday (season is over), return success
    if (!upcomingFriday) {
      return { success: true, message: "No upcoming Friday available" }
    }

    // Check if tee times already exist for this date
    const { data: existingTeeTimes, error: checkError } = await supabase
      .from("tee_times")
      .select("id")
      .eq("date", upcomingFriday)

    if (checkError) {
      console.error("Error checking existing tee times:", checkError)
      return { success: false, error: checkError.message }
    }

    // If tee times already exist, return success
    if (existingTeeTimes && existingTeeTimes.length > 0) {
      return { success: true, message: "Tee times already exist for this date" }
    }

    // Generate tee times (3:00 PM to 4:40 PM in 10-minute increments)
    const times = generateTeeTimes()

    // Create tee times in the database
    const teeTimesToInsert = times.map((time) => ({
      date: upcomingFriday,
      time,
      max_slots: 4, // Each tee time can have up to 4 players
      is_available: true, // New tee times are available by default
    }))

    const { error: insertError } = await supabase.from("tee_times").insert(teeTimesToInsert)

    if (insertError) {
      console.error("Error creating tee times:", insertError)
      return { success: false, error: insertError.message }
    }

    // Get the inserted tee times to set availability
    const { data: newTeeTimes, error: selectError } = await supabase
      .from("tee_times")
      .select("id")
      .eq("date", upcomingFriday)

    if (selectError) {
      console.error("Error fetching inserted tee times:", selectError)
      // Don't return error here as tee times were created successfully
    } else if (newTeeTimes) {
      // Also insert into tee_time_availability to explicitly mark them as available
      const availabilityEntries = newTeeTimes.map((teeTime) => ({
        tee_time_id: teeTime.id,
        is_available: true,
      }))

      const { error: availabilityError } = await supabase.from("tee_time_availability").insert(availabilityEntries)

      if (availabilityError) {
        console.error("Error setting tee time availability:", availabilityError)
        // Don't return an error here, as the tee times were created successfully
      }
    }

    // Revalidate relevant paths
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/tee-times")

    return { success: true, message: "Tee times created successfully" }
  } catch (error: any) {
    console.error("Error in checkAndGenerateTeeTimes:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to update the system to the next Friday
export async function updateToNextFriday() {
  const supabase = createClient()

  try {
    // Get the current upcoming Friday
    const currentFriday = getUpcomingFridayForSeason()

    // If there's no current Friday (season is over), return an error
    if (!currentFriday) {
      return { success: false, error: "The golf season is over." }
    }

    // Parse the current Friday to a Date object
    const currentDate = new Date(currentFriday)

    // Get the next Friday
    const nextFriday = getNextFriday(currentDate)
    const nextFridayStr = formatDate(nextFriday)

    // Check if tee times already exist for the next Friday
    const { data: existingTeeTimes, error: checkError } = await supabase
      .from("tee_times")
      .select("id")
      .eq("date", nextFridayStr)

    if (checkError) {
      console.error("Error checking existing tee times:", checkError)
      return { success: false, error: checkError.message }
    }

    // If tee times already exist, return a message
    if (existingTeeTimes && existingTeeTimes.length > 0) {
      return { success: true, message: "Tee times already exist for the next Friday." }
    }

    // Generate tee times for the next Friday
    const times = generateTeeTimes()

    // Create tee times in the database
    const teeTimesToInsert = times.map((time) => ({
      date: nextFridayStr,
      time,
      max_slots: 4, // Each tee time can have up to 4 players
      is_available: true, // New tee times are available by default
    }))

    const { error: insertError } = await supabase.from("tee_times").insert(teeTimesToInsert)

    if (insertError) {
      console.error("Error creating tee times:", insertError)
      return { success: false, error: insertError.message }
    }

    // Get the inserted tee times to set availability
    const { data: newTeeTimes, error: selectError } = await supabase
      .from("tee_times")
      .select("id")
      .eq("date", nextFridayStr)

    if (selectError) {
      console.error("Error fetching inserted tee times:", selectError)
      // Don't return error here as tee times were created successfully
    } else if (newTeeTimes) {
      // Also insert into tee_time_availability to explicitly mark them as available
      const availabilityEntries = newTeeTimes.map((teeTime) => ({
        tee_time_id: teeTime.id,
        is_available: true,
      }))

      const { error: availabilityError } = await supabase.from("tee_time_availability").insert(availabilityEntries)

      if (availabilityError) {
        console.error("Error setting tee time availability:", availabilityError)
        // Don't return an error here, as the tee times were created successfully
      }
    }

    // Revalidate relevant paths
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/tee-times")

    return { success: true, message: "Successfully updated to the next Friday." }
  } catch (error: any) {
    console.error("Error in updateToNextFriday:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to check if a specific tee time is available
export async function checkTeeTimeAvailability(teeTimeId: string) {
  const supabase = createClient()

  try {
    console.log(`Checking availability for tee time ${teeTimeId}`)

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

    console.log(`Tee time ${teeTimeId} is available in tee_time_availability`)

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

    console.log(`Tee time ${teeTimeId} has ${availableSlots} available slots`)

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
