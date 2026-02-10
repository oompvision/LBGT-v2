"use server"

import { createClient } from "@/lib/supabase/server"

export async function sendPasswordResetEmail(email: string) {
  try {
    const supabase = await createClient()

    // Check if user exists first
    const { data: user } = await supabase.from("users").select("email").eq("email", email).single()

    if (!user) {
      return { success: false, error: "User not found" }
    }

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    })

    if (error) {
      console.error("Error sending password reset email:", error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      message: `Password reset email sent to ${email}`,
    }
  } catch (error: any) {
    console.error("Error in sendPasswordResetEmail:", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    }
  }
}

export async function checkUserExists(email: string) {
  try {
    const supabase = await createClient()

    // Check if user exists in our users table
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, name, created_at")
      .eq("email", email)
      .single()

    if (userError && userError.code !== "PGRST116") {
      console.error("Error checking user:", userError)
      return { success: false, error: userError.message }
    }

    // For auth system, we'll just check if we can get the user's session
    // This is a simpler approach that doesn't require admin privileges
    const { data: authData } = await supabase
      .from("auth.users")
      .select("email, created_at, last_sign_in_at")
      .eq("email", email)
      .single()

    return {
      success: true,
      user,
      authUser: authData,
      exists: !!user,
    }
  } catch (error: any) {
    console.error("Error in checkUserExists:", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    }
  }
}
