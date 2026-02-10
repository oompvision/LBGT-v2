"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Create a Supabase client with admin privileges
const supabaseAdmin = createAdminClient()

export async function getAllUsersForAdmin() {
  try {
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

export async function getAllRoundsWithDetails(season?: number) {
  const supabase = await createClient()

  try {
    let query = supabase
      .from("rounds")
      .select(
        `
        id,
        date,
        submitted_by,
        season,
        users (
          name,
          email
        ),
        scores (
          *,
          users (
            id,
            name,
            email
          )
        )
      `,
      )
      .order("date", { ascending: false })

    if (season) {
      query = query.eq("season", season)
    }

    const { data: rounds, error } = await query

    if (error) {
      console.error("Error fetching rounds:", error)
      return { success: false, error: error.message, rounds: [] }
    }

    return { success: true, rounds: rounds || [] }
  } catch (error: any) {
    console.error("Error in getAllRoundsWithDetails:", error)
    return { success: false, error: error.message || "An unexpected error occurred", rounds: [] }
  }
}

export async function getAllReservationsWithDetails(season?: number) {
  const supabase = await createClient()

  try {
    let query = supabase
      .from("reservations")
      .select(
        `
        id,
        tee_time_id,
        user_id,
        slots,
        player_names,
        play_for_money,
        season,
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

    if (season) {
      query = query.eq("season", season)
    }

    const { data: reservations, error } = await query

    if (error) {
      console.error("Error fetching reservations:", error)
      return { success: false, error: error.message, reservations: [] }
    }

    return { success: true, reservations: reservations || [] }
  } catch (error: any) {
    console.error("Error in getAllReservationsWithDetails:", error)
    return { success: false, error: error.message || "An unexpected error occurred", reservations: [] }
  }
}

export async function getAllTeeTimes() {
  const supabase = await createClient()

  try {
    const { data: teeTimes, error } = await supabase.from("tee_times").select("*").order("date").order("time").limit(20)

    if (error) {
      console.error("Error fetching tee times:", error)
      return { success: false, error: error.message, teeTimes: [] }
    }

    return { success: true, teeTimes: teeTimes || [] }
  } catch (error: any) {
    console.error("Error in getAllTeeTimes:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
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

    // The function returns a table with success, message, and id columns
    if (!result || result.length === 0) {
      return { success: false, error: "No result returned from reservation function" }
    }

    const firstResult = result[0]
    if (!firstResult.success) {
      return { success: false, error: firstResult.message || "Reservation creation failed" }
    }

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
  const supabase = await createClient()

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
  const supabase = await createClient()

  try {
    // Ensure strokes_given is properly converted to a number if it exists
    const dataToUpdate: { name?: string; email?: string; strokes_given?: number } = { ...userData }

    if (userData.strokes_given !== undefined) {
      // Force conversion to number and ensure it's not NaN
      const strokesGiven = Number(userData.strokes_given)
      dataToUpdate.strokes_given = isNaN(strokesGiven) ? 0 : strokesGiven
    }

    // Perform the update with explicit data
    const { data, error } = await supabase.from("users").update(dataToUpdate).eq("id", userId).select()

    if (error) {
      console.error("Error updating user:", error)
      return { success: false, error: error.message }
    }

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

// Update strokes given using SQL function (bypasses RLS)
export async function updateStrokesGivenDirectly(userId: string, strokesGiven: number) {
  try {
    // Validate the input
    const strokesValue = Number(strokesGiven)
    if (isNaN(strokesValue)) {
      return { success: false, error: "Invalid strokes value" }
    }

    // Use the admin client to ensure we have full permissions
    const { data, error } = await supabaseAdmin.rpc("update_user_strokes", {
      user_id: userId,
      strokes: strokesValue,
    })

    if (error) {
      console.error("Error in direct SQL update:", error)
      return { success: false, error: error.message }
    }

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

// Function to upload profile picture for any user (admin only)
export async function adminUploadProfilePicture(userId: string, formData: FormData) {
  try {
    const file = formData.get("profilePicture") as File
    if (!file || file.size === 0) {
      return { success: false, error: "Please select a file to upload" }
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Please upload an image file" }
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "File size must be less than 5MB" }
    }

    // Create unique filename with timestamp to avoid conflicts
    const fileExt = file.name.split(".").pop()
    const timestamp = Date.now()
    const fileName = `profile-${userId}-${timestamp}.${fileExt}`

    // Upload to Supabase Storage using admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("profile-pictures")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      console.error("Error uploading file:", uploadError)
      return { success: false, error: uploadError.message || "Failed to upload image" }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from("profile-pictures").getPublicUrl(fileName)

    // Remove old profile picture if it exists
    try {
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("profile_picture_url")
        .eq("id", userId)
        .single()

      if (userData?.profile_picture_url) {
        const oldFileName = userData.profile_picture_url.split("/").pop()
        if (oldFileName && oldFileName !== fileName) {
          await supabaseAdmin.storage.from("profile-pictures").remove([oldFileName])
        }
      }
    } catch (error) {
      console.error("Error removing old profile picture:", error)
      // Continue even if old picture removal fails
    }

    // Update user profile with new picture URL using admin client
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        profile_picture_url: urlData.publicUrl,
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Error updating user profile:", updateError)
      return { success: false, error: "Failed to update profile" }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/users")
    revalidatePath(`/players/${userId}/stats`)
    revalidatePath("/scores/league-rounds")
    revalidatePath("/profile")

    return { success: true, url: urlData.publicUrl }
  } catch (error: any) {
    console.error("Error in adminUploadProfilePicture:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to remove profile picture for any user (admin only)
export async function adminRemoveProfilePicture(userId: string) {
  try {
    // Use admin client to bypass RLS
    const supabaseAdmin = createAdminClient()

    // Get current user data to find existing picture
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("profile_picture_url")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("Error fetching user data:", userError)
      return { success: false, error: "Failed to fetch user data" }
    }

    // Remove from storage if exists
    if (userData.profile_picture_url) {
      const fileName = userData.profile_picture_url.split("/").pop()
      if (fileName) {
        await supabaseAdmin.storage.from("profile-pictures").remove([fileName])
      }
    }

    // Update user profile to remove picture URL
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        profile_picture_url: null,
      })
      .eq("id", userId)

    if (updateError) {
      console.error("Error updating user profile:", updateError)
      return { success: false, error: "Failed to update profile" }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/users")
    revalidatePath(`/players/${userId}/stats`)
    revalidatePath("/scores/league-rounds")

    return { success: true }
  } catch (error: any) {
    console.error("Error in adminRemoveProfilePicture:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to delete a user using our updated SQL function
export async function deleteUser(userId: string) {
  try {
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

    // Revalidate relevant paths
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/users")

    return { success: true, message: "User deleted successfully" }
  } catch (error: any) {
    console.error("Error in deleteUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
