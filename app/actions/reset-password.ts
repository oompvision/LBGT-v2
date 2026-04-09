"use server"

import { createAdminClient } from "@/lib/supabase/server"

export async function sendPasswordResetEmail(email: string) {
  try {
    const supabaseAdmin = createAdminClient()

    // Send password reset email directly via admin client
    // Don't check user existence first — always show a generic success message
    // to prevent email enumeration attacks
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    })

    if (error) {
      console.error("Error sending password reset email:", error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      message: "If an account exists with that email, a password reset link has been sent.",
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
    const supabaseAdmin = createAdminClient()

    // Check if user exists in our users table using admin client to bypass RLS
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, name, created_at")
      .eq("email", email)
      .single()

    if (userError && userError.code !== "PGRST116") {
      console.error("Error checking user:", userError)
      return { success: false, error: userError.message }
    }

    return {
      success: true,
      user,
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
