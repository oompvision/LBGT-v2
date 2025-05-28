"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { parseISO } from "date-fns"

// Create a Supabase client with admin privileges
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Helper function to ensure dates are correct (May 23, 2025 and later)
function ensureCorrectDate(dateString: string): string {
  try {
    const date = parseISO(dateString)
    const firstValidDate = new Date(2025, 4, 23) // May 23, 2025

    // If the date is before May 23, 2025, return May 23, 2025
    if (date < firstValidDate) {
      console.warn(`Correcting invalid date: ${dateString} to 2025-05-23`)
      return "2025-05-23"
    }

    return dateString
  } catch (error) {
    console.error("Error processing date:", error)
    return "2025-05-23" // Default to May 23, 2025 if there's an error
  }
}

export async function getAllUsersWithDetails() {
  try {
    // Use the admin client to bypass RLS policies
    const { data: users, error } = await supabaseAdmin.from("users").select("*").order("name")

    if (error) {
      console.error("Error fetching users:", error)
      return { success: false, error: error.message, users: [] }
    }

    return { success: true, users: users || [] }
  } catch (error: any) {
    console.error("Error in getAllUsersWithDetails:", error)
    return { success: false, error: error.message || "An unexpected error occurred", users: [] }
  }
}

// Helper function to delay execution (for rate limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Process a single round to get its scores
async function processRound(round: any) {
  const supabase = createClient()

  try {
    // Use a direct approach with error handling for "Too Many Requests"
    try {
      const { data: scores, error: scoresError } = await supabase
        .from("scores")
        .select(
          `
          id,
          user_id,
          total_score,
          users (
            id,
            name,
            email
          )
        `,
        )
        .eq("round_id", round.id)
        .order("total_score", { ascending: true })

      if (scoresError) {
        console.error(`Error fetching scores for round ${round.id}:`, scoresError)
        return {
          ...round,
          scores: [],
          error: `Failed to load scores: ${scoresError.message}`,
        }
      }

      // Ensure the round date is correct
      if (round.date) {
        round.date = ensureCorrectDate(round.date)
      }

      return {
        ...round,
        scores: scores || [],
      }
    } catch (error: any) {
      // Check if it's a "Too Many Requests" error
      if (error.message && (error.message.includes("Too Many") || error.message.includes("rate limit"))) {
        console.log(`Rate limit hit for round ${round.id}, returning without scores`)
        return {
          ...round,
          scores: [],
          error: "Rate limit exceeded. Please try again later.",
        }
      }
      throw error // Re-throw other errors
    }
  } catch (error: any) {
    console.error(`Exception fetching scores for round ${round.id}:`, error)
    return {
      ...round,
      scores: [],
      error: `Failed to load scores: ${error.message || "Unknown error"}`,
    }
  }
}

export async function getAllRoundsWithDetails() {
  const supabase = createClient()

  try {
    // First, get a very limited number of the most recent rounds to reduce load
    const { data: rounds, error } = await supabase
      .from("rounds")
      .select(
        `
        id,
        date,
        submitted_by,
        users (
          name,
          email
        )
      `,
      )
      .order("date", { ascending: false })
      .limit(5) // Limit to 5 most recent rounds to reduce load even further

    if (error) {
      console.error("Error fetching rounds:", error)
      return { success: false, error: error.message, rounds: [] }
    }

    if (!rounds || rounds.length === 0) {
      return { success: true, rounds: [] }
    }

    // Process rounds sequentially to avoid rate limiting
    const roundsWithScores = []
    for (const round of rounds) {
      try {
        // Add a delay between each round
        if (rounds.indexOf(round) > 0) {
          await delay(1500) // 1.5 second delay between rounds
        }

        const processedRound = await processRound(round)
        roundsWithScores.push(processedRound)
      } catch (error: any) {
        console.error(`Error processing round ${round.id}:`, error)
        roundsWithScores.push({
          ...round,
          scores: [],
          error: `Failed to load scores: ${error.message || "Unknown error"}`,
        })
      }
    }

    return { success: true, rounds: roundsWithScores }
  } catch (error: any) {
    console.error("Error in getAllRoundsWithDetails:", error)
    return { success: false, error: error.message || "An unexpected error occurred", rounds: [] }
  }
}

export async function getAllReservationsWithDetails() {
  const supabase = createClient()

  try {
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select(
        `
        id,
        tee_time_id,
        user_id,
        slots,
        player_names,
        play_for_money,
        users (
          name,
          email
        ),
        tee_times (
          date,
          time
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(10) // Limit to 10 most recent reservations

    if (error) {
      console.error("Error fetching reservations:", error)
      return { success: false, error: error.message, reservations: [] }
    }

    // Ensure all dates are correct in the reservations
    const correctedReservations =
      reservations?.map((reservation) => {
        if (reservation.tee_times && reservation.tee_times.date) {
          return {
            ...reservation,
            tee_times: {
              ...reservation.tee_times,
              date: ensureCorrectDate(reservation.tee_times.date),
            },
          }
        }
        return reservation
      }) || []

    return { success: true, reservations: correctedReservations }
  } catch (error: any) {
    console.error("Error in getAllReservationsWithDetails:", error)
    return { success: false, error: error.message || "An unexpected error occurred", reservations: [] }
  }
}

export async function getAllTeeTimes() {
  const supabase = createClient()

  try {
    const { data: teeTimes, error } = await supabase.from("tee_times").select("*").order("date").order("time").limit(20) // Limit to 20 tee times

    if (error) {
      console.error("Error fetching tee times:", error)
      return { success: false, error: error.message, teeTimes: [] }
    }

    // Ensure all dates are correct in the tee times
    const correctedTeeTimes =
      teeTimes?.map((teeTime) => {
        if (teeTime.date) {
          return {
            ...teeTime,
            date: ensureCorrectDate(teeTime.date),
          }
        }
        return teeTime
      }) || []

    return { success: true, teeTimes: correctedTeeTimes }
  } catch (error: any) {
    console.error("Error in getAllTeeTimes:", error)
    return { success: false, error: error.message || "An unexpected error occurred", teeTimes: [] }
  }
}

export async function getAllUsersForAdmin() {
  try {
    // Use the admin client to bypass RLS policies
    const { data: users, error } = await supabaseAdmin.from("users").select("*").order("name")

    if (error) {
      console.error("Error fetching users:", error)
      return { success: false, error: error.message, users: [] }
    }

    return { success: true, users: users || [] }
  } catch (error: any) {
    console.error("Error in getAllUsersForAdmin:", error)
    return { success: false, error: error.message || "An unexpected error occurred", users: [] }
  }
}

// Function to add a reservation for a user using our SQL function
export async function addReservation(data: {
  userId: string
  teeTimeId: string
  slots: number
  playerNames: string[]
  playForMoney?: boolean[]
}) {
  try {
    console.log("Adding reservation with data:", data)

    // Ensure playForMoney is an array of the correct length
    const playForMoney = data.playForMoney || Array(Math.max(1, data.slots)).fill(false)

    // Make sure playerNames is an array - these are only the ADDITIONAL players
    const playerNames = Array.isArray(data.playerNames) ? data.playerNames : []

    // Call our SQL function to create the reservation
    const { data: result, error } = await supabaseAdmin.rpc("admin_create_reservation", {
      p_tee_time_id: data.teeTimeId,
      p_user_id: data.userId,
      p_slots: data.slots,
      p_player_names: playerNames,
      p_play_for_money: playForMoney,
    })

    if (error) {
      console.error("Error calling admin_create_reservation:", error)
      return { success: false, error: error.message }
    }

    console.log("SQL function result:", result)

    // The function returns a table with success, message, and id columns
    if (!result || result.length === 0) {
      return { success: false, error: "No result returned from reservation function" }
    }

    const firstResult = result[0]
    if (!firstResult.success) {
      return { success: false, error: firstResult.message || "Reservation creation failed" }
    }

    console.log("Successfully created reservation:", firstResult)

    // Revalidate relevant paths
    revalidatePath("/reservations")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/admin/dashboard")

    return {
      success: true,
      message: firstResult.message || "Reservation added successfully",
      reservation: { id: firstResult.id },
    }
  } catch (error: any) {
    console.error("Error in addReservation:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to delete a reservation
export async function deleteReservation(reservationId: string) {
  try {
    console.log(`Attempting to delete reservation ${reservationId} using SQL function`)

    if (!reservationId || typeof reservationId !== "string" || reservationId.trim() === "") {
      return { success: false, error: "Invalid reservation ID provided" }
    }

    // Call the SQL function we just created
    const { data, error } = await supabaseAdmin.rpc("delete_reservation_completely", {
      p_reservation_id: reservationId,
    })

    if (error) {
      console.error("Error calling delete_reservation_completely:", error)
      return { success: false, error: error.message }
    }

    // The function returns a boolean indicating success
    if (data === false) {
      console.error("Reservation deletion failed - reservation may not exist")
      return { success: false, error: "Reservation deletion failed - reservation may not exist" }
    }

    console.log(`Successfully deleted reservation ${reservationId}`)

    // Revalidate relevant paths
    revalidatePath("/reservations")
    revalidatePath("/schedule")
    revalidatePath("/dashboard")
    revalidatePath("/admin/dashboard")

    return { success: true, message: "Reservation deleted successfully" }
  } catch (error: any) {
    console.error("Error in deleteReservation:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to edit a player's score in a round
export async function editPlayerScore(
  scoreId: string,
  scoreData: {
    hole_1?: number
    hole_2?: number
    hole_3?: number
    hole_4?: number
    hole_5?: number
    hole_6?: number
    hole_7?: number
    hole_8?: number
    hole_9?: number
    hole_10?: number
    hole_11?: number
    hole_12?: number
    hole_13?: number
    hole_14?: number
    hole_15?: number
    hole_16?: number
    hole_17?: number
    hole_18?: number
  },
) {
  const supabase = createClient()

  try {
    // Calculate the total score
    const totalScore = Object.values(scoreData).reduce((sum, score) => sum + (score || 0), 0)

    // Update the score
    const { error } = await supabase
      .from("scores")
      .update({
        ...scoreData,
        total_score: totalScore,
      })
      .eq("id", scoreId)

    if (error) {
      console.error("Error updating score:", error)
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath("/scores/rounds/[id]")
    revalidatePath("/scores/my-rounds")
    revalidatePath("/scores/league-rounds")
    revalidatePath("/admin/dashboard")

    return { success: true, message: "Score updated successfully" }
  } catch (error: any) {
    console.error("Error in editPlayerScore:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to delete a round and all associated scores using our SQL function
export async function deleteRound(roundId: string) {
  try {
    console.log(`Attempting to delete round ${roundId} using SQL function`)

    if (!roundId || typeof roundId !== "string" || roundId.trim() === "") {
      return { success: false, error: "Invalid round ID provided" }
    }

    // Call the SQL function we just created
    const { data, error } = await supabaseAdmin.rpc("delete_round_completely", {
      p_round_id: roundId,
    })

    if (error) {
      console.error("Error calling delete_round_completely:", error)
      return { success: false, error: error.message }
    }

    // The function returns a boolean indicating success
    if (data === false) {
      console.error("Round deletion failed - round may not exist")
      return { success: false, error: "Round deletion failed - round may not exist" }
    }

    console.log(`Successfully deleted round ${roundId} and all associated scores`)

    // Revalidate relevant paths
    revalidatePath("/scores/my-rounds")
    revalidatePath("/scores/league-rounds")
    revalidatePath("/admin/dashboard")

    return { success: true, message: "Round and associated scores deleted successfully" }
  } catch (error: any) {
    console.error("Error in deleteRound:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to update a user
export async function updateUser(userId: string, userData: { name?: string; email?: string; strokes_given?: number }) {
  const supabase = createClient()

  try {
    // Ensure strokes_given is properly converted to a number if it exists
    const dataToUpdate: any = { ...userData }

    if (userData.strokes_given !== undefined) {
      // Force conversion to number and ensure it's not NaN
      const strokesGiven = Number(userData.strokes_given)
      dataToUpdate.strokes_given = isNaN(strokesGiven) ? 0 : strokesGiven

      console.log(
        `Updating user ${userId} with strokes_given:`,
        dataToUpdate.strokes_given,
        "Type:",
        typeof dataToUpdate.strokes_given,
      )
    }

    // Perform the update with explicit data
    const { data, error } = await supabase.from("users").update(dataToUpdate).eq("id", userId).select()

    if (error) {
      console.error("Error updating user:", error)
      return { success: false, error: error.message }
    }

    console.log("Update result:", data)

    // Revalidate relevant paths
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/users")
    revalidatePath("/profile")

    return { success: true, message: "User updated successfully", data }
  } catch (error: any) {
    console.error("Error in updateUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function specifically for updating strokes given
export async function updateUserStrokesGiven(userId: string, strokesGiven: number) {
  const supabase = createClient()

  try {
    // Convert to number and validate
    const strokesValue = Number(strokesGiven)
    if (isNaN(strokesValue)) {
      return { success: false, error: "Invalid strokes value" }
    }

    console.log(`Updating user ${userId} strokes_given to ${strokesValue}`)

    // Direct update with only the strokes_given field
    const { data, error } = await supabase
      .from("users")
      .update({ strokes_given: strokesValue })
      .eq("id", userId)
      .select()

    if (error) {
      console.error("Error updating strokes given:", error)
      return { success: false, error: error.message }
    }

    console.log("Strokes update result:", data)

    // Revalidate relevant paths
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/users")
    revalidatePath("/profile")

    return { success: true, message: "Strokes given updated successfully", data }
  } catch (error: any) {
    console.error("Error in updateUserStrokesGiven:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// New function to update strokes given using direct SQL
export async function updateStrokesGivenDirectly(userId: string, strokesGiven: number) {
  try {
    // Validate the input
    const strokesValue = Number(strokesGiven)
    if (isNaN(strokesValue)) {
      return { success: false, error: "Invalid strokes value" }
    }

    console.log(`Attempting to update user ${userId} strokes_given to ${strokesValue} using direct SQL`)

    // Use the admin client to ensure we have full permissions
    const { data, error } = await supabaseAdmin.rpc("update_user_strokes", {
      user_id: userId,
      strokes: strokesValue,
    })

    if (error) {
      console.error("Error in direct SQL update:", error)
      return { success: false, error: error.message }
    }

    console.log("Direct SQL update result:", data)

    // Revalidate all relevant paths
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/users")
    revalidatePath("/profile")

    return { success: true, message: "Strokes given updated successfully via direct SQL" }
  } catch (error: any) {
    console.error("Error in updateStrokesGivenDirectly:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to delete a user using our updated SQL function
export async function deleteUser(userId: string) {
  try {
    console.log(`Attempting to delete user ${userId} using SQL function`)

    // First check if user is an admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("Error checking user:", userError)
      return { success: false, error: userError.message }
    }

    if (userData.is_admin) {
      return { success: false, error: "Cannot delete admin users" }
    }

    // Call the SQL function with the updated parameter name (p_id)
    const { data, error } = await supabaseAdmin.rpc("delete_user_completely", {
      p_id: userId,
    })

    if (error) {
      console.error("Error calling delete_user_completely:", error)
      return { success: false, error: error.message }
    }

    // The function now returns a boolean directly
    if (data === false) {
      console.error("User deletion failed - user may not exist")
      return { success: false, error: "User deletion failed - user may not exist" }
    }

    console.log(`Successfully deleted user ${userId} and all associated data`)

    // Revalidate relevant paths
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/users")

    return { success: true, message: "User deleted successfully" }
  } catch (error: any) {
    console.error("Error in deleteUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
