"use server"

import { createClient } from "@/lib/supabase/server"

export async function fixDevinAccount() {
  const supabase = await createClient()

  try {
    // First, check if Devin exists in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error("Error listing users:", authError)
      return { success: false, error: authError.message }
    }

    // Find Devin's account
    const devinUser = authData.users.find((user) => user.email === "devin.weinshank@gmail.com")

    if (!devinUser) {
      return { success: false, error: "Devin's account not found in auth" }
    }

    // Check if Devin exists in public.users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", "devin.weinshank@gmail.com")
      .single()

    if (userError && userError.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      console.error("Error checking user:", userError)
      return { success: false, error: userError.message }
    }

    // If Devin doesn't exist in public.users, create the record
    if (!userData) {
      const { error: insertError } = await supabase.from("users").insert({
        id: devinUser.id,
        name: devinUser.user_metadata.name || "Devin Weinshank",
        email: "devin.weinshank@gmail.com",
        is_admin: false,
        strokes_given: 0,
        created_at: new Date().toISOString(),
      })

      if (insertError) {
        console.error("Error inserting user:", insertError)
        return { success: false, error: insertError.message }
      }

      return { success: true, message: "Created Devin's account in public.users" }
    }

    // If Devin exists but IDs don't match, update the ID
    if (userData.id !== devinUser.id) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ id: devinUser.id })
        .eq("email", "devin.weinshank@gmail.com")

      if (updateError) {
        console.error("Error updating user ID:", updateError)
        return { success: false, error: updateError.message }
      }

      return { success: true, message: "Updated Devin's ID in public.users" }
    }

    // Reset Devin's password if needed
    try {
      const { error: resetError } = await supabase.auth.admin.updateUserById(
        devinUser.id,
        { password: "tempPassword123!" }, // Temporary password
      )

      if (resetError) {
        console.error("Error resetting password:", resetError)
        return { success: false, error: resetError.message }
      }

      // Send password reset email
      const { error: emailError } = await supabase.auth.resetPasswordForEmail("devin.weinshank@gmail.com")

      if (emailError) {
        console.error("Error sending reset email:", emailError)
      }

      return {
        success: true,
        message: "Reset Devin's password. Temporary password: tempPassword123!",
      }
    } catch (resetErr) {
      console.error("Error in password reset:", resetErr)
      return { success: false, error: String(resetErr) }
    }
  } catch (error) {
    console.error("Unexpected error:", error)
    return { success: false, error: String(error) }
  }
}
