"use server"

import { createClient } from "@/lib/supabase/server"

// Create a Supabase admin client
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function resetMattPassword() {
  try {
    // Send password recovery email to Matt
    const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail("mattgervasi@gmail.com", {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    })

    if (error) {
      console.error("Error sending password reset:", error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      message: "Password reset email sent to mattgervasi@gmail.com",
    }
  } catch (error: any) {
    console.error("Error in resetMattPassword:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function checkMattAccount() {
  try {
    // Get user data from both tables
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", "mattgervasi@gmail.com")
      .single()

    if (userError) {
      return {
        success: false,
        error: `Error fetching user data: ${userError.message}`,
        authUser: null,
        dbUser: null,
      }
    }

    // Get auth user data
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userData.id)

    if (authError) {
      return {
        success: false,
        error: `Error fetching auth data: ${authError.message}`,
        authUser: null,
        dbUser: userData,
      }
    }

    return {
      success: true,
      dbUser: userData,
      authUser: authData.user,
      message: "Account information retrieved successfully",
    }
  } catch (error: any) {
    console.error("Error in checkMattAccount:", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
      authUser: null,
      dbUser: null,
    }
  }
}
