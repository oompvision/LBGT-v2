"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createAdminUser() {
  try {
    const supabaseAdmin = createAdminClient()

    // Create the admin user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: "anthony@sidelineswap.com",
      password: "GolfAdmin123",
      email_confirm: true,
    })

    if (authError) {
      console.error("Error creating admin user in auth:", authError)
      return { success: false, error: authError.message }
    }

    // Create the user in the database
    const { error: dbError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email: "anthony@sidelineswap.com",
      name: "Anthony Admin",
      is_admin: true,
    })

    if (dbError) {
      console.error("Error creating admin user in database:", dbError)
      return { success: false, error: dbError.message }
    }

    return { success: true, message: "Admin user created successfully" }
  } catch (error: any) {
    console.error("Error in createAdminUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function resetAdminUser() {
  try {
    const supabaseAdmin = createAdminClient()

    // First, try to get the existing user
    const { data: existingUsers, error: getUserError } = await supabaseAdmin.auth.admin.listUsers()

    if (getUserError) {
      console.error("Error listing users:", getUserError)
      return { success: false, error: getUserError.message }
    }

    const existingUser = existingUsers.users.find((user) => user.email === "anthony@sidelineswap.com")

    if (existingUser) {
      // Update the existing user's password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: "GolfAdmin123",
      })

      if (updateError) {
        console.error("Error updating admin password:", updateError)
        return { success: false, error: updateError.message }
      }

      // Ensure user exists in database with admin privileges
      const { error: upsertError } = await supabaseAdmin
        .from("users")
        .upsert({
          id: existingUser.id,
          email: "anthony@sidelineswap.com",
          name: "Anthony Admin",
          is_admin: true,
        })
        .select()

      if (upsertError) {
        console.error("Error upserting admin user in database:", upsertError)
        return { success: false, error: upsertError.message }
      }

      return { success: true, message: "Admin user password reset successfully" }
    } else {
      // Create new admin user if doesn't exist
      return await createAdminUser()
    }
  } catch (error: any) {
    console.error("Error in resetAdminUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function makeUserAdmin(userId: string) {
  try {
    const supabaseAdmin = createAdminClient()

    const { error } = await supabaseAdmin.from("users").update({ is_admin: true }).eq("id", userId)

    if (error) {
      console.error("Error making user admin:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin")
    return { success: true, message: "User granted admin privileges" }
  } catch (error: any) {
    console.error("Error in makeUserAdmin:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function removeUserAdmin(userId: string) {
  try {
    const supabaseAdmin = createAdminClient()

    const { error } = await supabaseAdmin.from("users").update({ is_admin: false }).eq("id", userId)

    if (error) {
      console.error("Error removing user admin:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin")
    return { success: true, message: "Admin privileges removed from user" }
  } catch (error: any) {
    console.error("Error in removeUserAdmin:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
