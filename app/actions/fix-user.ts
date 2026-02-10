"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function addMikeSkudin() {
  try {
    const supabase = await createClient()

    // First check if Mike Skudin already exists in the auth system
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error("Error listing auth users:", authError)
      return { success: false, error: authError.message }
    }

    // Find Mike Skudin in auth users
    const mikeUser = authUsers.users.find(
      (user) =>
        user.user_metadata?.name?.toLowerCase().includes("mike skudin") ||
        user.email?.toLowerCase().includes("mike") ||
        user.email?.toLowerCase().includes("skudin"),
    )

    if (!mikeUser) {
      return {
        success: false,
        error: "Mike Skudin not found in auth system. Please check if the user has completed signup.",
      }
    }

    // Check if Mike already exists in the users table
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("id", mikeUser.id)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking for existing user:", checkError)
      return { success: false, error: checkError.message }
    }

    if (existingUser) {
      // User exists but might not be showing up correctly
      // Let's update the user to ensure data is correct
      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: "Mike Skudin",
          email: mikeUser.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mikeUser.id)

      if (updateError) {
        console.error("Error updating user:", updateError)
        return { success: false, error: updateError.message }
      }

      revalidatePath("/admin/users")
      return { success: true, message: "User Mike Skudin updated successfully" }
    }

    // User doesn't exist in the users table, let's create them
    const { error: insertError } = await supabase.from("users").insert({
      id: mikeUser.id,
      name: "Mike Skudin",
      email: mikeUser.email,
      is_admin: false,
      strokes_given: 0,
    })

    if (insertError) {
      console.error("Error creating user:", insertError)
      return { success: false, error: insertError.message }
    }

    revalidatePath("/admin/users")
    return { success: true, message: "User Mike Skudin added successfully" }
  } catch (error: any) {
    console.error("Error in addMikeSkudin:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to manually add a user to the database
export async function addUserManually(userData: { name: string; email: string; userId?: string }) {
  try {
    const supabase = await createClient()

    let userId = userData.userId

    // If no userId provided, try to find the user in auth system
    if (!userId) {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

      if (authError) {
        console.error("Error listing auth users:", authError)
        return { success: false, error: authError.message }
      }

      // Find user by email
      const authUser = authUsers.users.find((user) => user.email === userData.email)

      if (authUser) {
        userId = authUser.id
      } else {
        return {
          success: false,
          error: "User not found in auth system. Please ensure the user has signed up first.",
        }
      }
    }

    // Check if user already exists in the users table
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking for existing user:", checkError)
      return { success: false, error: checkError.message }
    }

    if (existingUser) {
      // User exists, update their information
      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: userData.name,
          email: userData.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)

      if (updateError) {
        console.error("Error updating user:", updateError)
        return { success: false, error: updateError.message }
      }

      revalidatePath("/admin/users")
      return { success: true, message: `User ${userData.name} updated successfully` }
    }

    // User doesn't exist in the users table, create them
    const { error: insertError } = await supabase.from("users").insert({
      id: userId,
      name: userData.name,
      email: userData.email,
      is_admin: false,
      strokes_given: 0,
    })

    if (insertError) {
      console.error("Error creating user:", insertError)
      return { success: false, error: insertError.message }
    }

    revalidatePath("/admin/users")
    return { success: true, message: `User ${userData.name} added successfully` }
  } catch (error: any) {
    console.error("Error in addUserManually:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
