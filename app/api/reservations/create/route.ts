import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to make a reservation." }, { status: 401 })
    }

    // Get the request body
    const body = await request.json()
    const { teeTimeId, userId, slots, playerNames, playForMoney } = body

    // Validate the request
    if (!teeTimeId || !userId || !slots || slots < 1) {
      return NextResponse.json({ error: "Invalid request. Missing required fields." }, { status: 400 })
    }

    // Ensure the user is making a reservation for themselves
    if (userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized. You can only make reservations for yourself." }, { status: 403 })
    }

    // Get tee time details and check availability using the same logic as dashboard
    const { data: teeTimeData, error: teeTimeError } = await supabase
      .from("tee_times")
      .select("id, date, time, max_slots")
      .eq("id", teeTimeId)
      .single()

    if (teeTimeError || !teeTimeData) {
      console.error("Error fetching tee time details:", teeTimeError)
      return NextResponse.json({ error: "Tee time not found." }, { status: 404 })
    }

    // Get existing reservations for this tee time
    const { data: existingReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("slots")
      .eq("tee_time_id", teeTimeId)

    if (reservationsError) {
      console.error("Error fetching existing reservations:", reservationsError)
      return NextResponse.json({ error: "Error checking availability." }, { status: 500 })
    }

    // Calculate available slots using the same logic as dashboard
    const reservedSlots = existingReservations?.reduce((sum, r) => sum + r.slots, 0) || 0
    const availableSlots = teeTimeData.max_slots - reservedSlots

    if (availableSlots < slots) {
      return NextResponse.json(
        {
          error: `Not enough available slots. Only ${availableSlots} slots available, but ${slots} requested.`,
        },
        { status: 400 },
      )
    }

    // Create the reservation directly using Supabase insert
    const { data: newReservation, error: insertError } = await supabase
      .from("reservations")
      .insert({
        tee_time_id: teeTimeId,
        user_id: userId,
        slots,
        player_names: playerNames || [],
        play_for_money: playForMoney || [],
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating reservation:", insertError)
      return NextResponse.json({ error: insertError.message || "Failed to create reservation" }, { status: 500 })
    }

    // Format time for confirmation message
    const formatTimeString = (timeString: string) => {
      try {
        const [hours, minutes] = timeString.split(":")
        const hour = Number.parseInt(hours, 10)
        const minute = Number.parseInt(minutes, 10)
        const period = hour >= 12 ? "PM" : "AM"
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
      } catch (error) {
        return timeString
      }
    }

    // Format date for confirmation message
    const formatDateDisplay = (dateString: string) => {
      try {
        const date = new Date(dateString)
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      } catch (error) {
        return dateString
      }
    }

    // Create confirmation message with booking details
    const formattedDate = formatDateDisplay(teeTimeData.date)
    const formattedTime = formatTimeString(teeTimeData.time)
    const confirmationMessage = `Your tee time has been confirmed for ${formattedDate} at ${formattedTime} with ${slots} ${slots === 1 ? "player" : "players"}.`

    // Return success with detailed confirmation message
    return NextResponse.json({
      success: true,
      message: "🎉 Tee Time Booked Successfully!",
      confirmationMessage,
      details: {
        id: newReservation.id,
        date: teeTimeData.date,
        time: teeTimeData.time,
        slots,
      },
    })
  } catch (error: any) {
    console.error("Unexpected error creating reservation:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
