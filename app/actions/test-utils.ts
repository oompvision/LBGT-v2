"use server"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from "uuid"

export async function createTestReservation() {
  try {
    console.log("Creating test reservation...")

    // Create an admin client with the service role key to bypass RLS
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Get the first admin user to use as the reservation owner
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("is_admin", true)
      .limit(1)

    if (adminError || !adminUsers || adminUsers.length === 0) {
      console.error("Error finding admin user:", adminError)
      return { success: false, error: "Could not find an admin user" }
    }

    const userId = adminUsers[0].id
    console.log(`Using admin user ID: ${userId}`)

    // Create a tee time for today with a random time to avoid conflicts
    const today = new Date()
    const teeTimeDate = today.toISOString().split("T")[0]

    // Generate a random time between 7:00 AM and 4:00 PM
    const hour = Math.floor(Math.random() * 10) + 7 // 7 AM to 4 PM
    const minute = Math.floor(Math.random() * 12) * 5 // 0, 5, 10, ..., 55
    const teeTimeHour = hour.toString().padStart(2, "0")
    const teeTimeMinute = minute.toString().padStart(2, "0")
    const teeTime = `${teeTimeHour}:${teeTimeMinute}:00`

    console.log(`Using tee time: ${teeTimeDate} ${teeTime}`)

    // Check if a tee time already exists for this date and time
    const { data: existingTeeTimes, error: teeTimeCheckError } = await supabaseAdmin
      .from("tee_times")
      .select("id")
      .eq("date", teeTimeDate)
      .eq("time", teeTime)
      .limit(1)

    if (teeTimeCheckError) {
      console.error("Error checking for existing tee time:", teeTimeCheckError)
      return { success: false, error: "Could not check for existing tee time" }
    }

    let teeTimeId

    if (existingTeeTimes && existingTeeTimes.length > 0) {
      // Use the existing tee time
      teeTimeId = existingTeeTimes[0].id
      console.log(`Using existing tee time with ID: ${teeTimeId}`)
    } else {
      // Create a new tee time
      teeTimeId = uuidv4()
      const { error: teeTimeError } = await supabaseAdmin.from("tee_times").insert({
        id: teeTimeId,
        date: teeTimeDate,
        time: teeTime,
        max_slots: 4,
      })

      if (teeTimeError) {
        console.error("Error creating test tee time:", teeTimeError)
        return { success: false, error: "Could not create test tee time" }
      }
      console.log(`Created new tee time with ID: ${teeTimeId}`)
    }

    // Create a reservation with 4 players
    const playerNames = ["John Doe", "Jane Smith", "Bob Johnson"]
    const playForMoney = [true, false, true] // Main player + 3 additional players

    const { error: reservationError } = await supabaseAdmin.from("reservations").insert({
      id: uuidv4(),
      user_id: userId,
      tee_time_id: teeTimeId,
      slots: 4,
      player_names: playerNames,
      play_for_money: playForMoney,
    })

    if (reservationError) {
      console.error("Error creating test reservation:", reservationError)
      return { success: false, error: "Could not create test reservation" }
    }

    console.log("Test reservation created successfully")

    return {
      success: true,
      playerCount: playerNames.length + 1, // +1 for the main player
      message: "Test reservation created successfully",
    }
  } catch (error: any) {
    console.error("Error in createTestReservation:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
