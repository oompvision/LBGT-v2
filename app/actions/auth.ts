"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Function to create a user in the database
export async function createUserInDatabase(userId: string, email: string, name: string) {
  try {
    // Use the admin client to bypass RLS
    const supabaseAdmin = createAdminClient();

    // Check if user already exists
    const { data: existingUser, error: selectError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single()

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is expected for new users
      console.error("Error checking existing user:", selectError)
      return { success: false, error: selectError.message }
    }

    if (existingUser) {
      // User already exists, no need to create
      return { success: true }
    }

    // Create the user
    const { error } = await supabaseAdmin.from("users").insert({
      id: userId,
      email,
      name,
    })

    if (error) {
      console.error("Error creating user in database:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error in createUserInDatabase:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to update user profile
export async function updateUserProfile(data: { name: string }) {
  try {
    const supabase = createClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to update your profile" }
    }

    // Update the user in the database
    const { error } = await supabase
      .from("users")
      .update({
        name: data.name,
      })
      .eq("id", session.user.id)

    if (error) {
      console.error("Error updating user profile:", error)
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath("/profile")

    return { success: true }
  } catch (error: any) {
    console.error("Error in updateUserProfile:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
