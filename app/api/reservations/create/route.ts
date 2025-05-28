import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

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

    // Use the database function to create the reservation with availability check
    const { data, error } = await supabase.rpc("create_reservation_with_check", {
      p_tee_time_id: teeTimeId,
      p_user_id: userId,
      p_slots: slots,
      p_player_names: playerNames || [],
      p_play_for_money: playForMoney || [],
    })

    if (error) {
      console.error("Error creating reservation:", error)
      return NextResponse.json({ error: error.message || "Failed to create reservation" }, { status: 500 })
    }

    // Check if the reservation was created successfully
    const result = data[0]
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: "Reservation created successfully",
      id: result.id,
    })
  } catch (error: any) {
    console.error("Unexpected error creating reservation:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
