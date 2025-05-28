"use server"

import { createClient } from "@supabase/supabase-js"

export async function createAdminUser() {
  // Create a Supabase client with service role key to bypass RLS
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", "anthony@sidelineswap.com")
      .maybeSingle()

    let userId

    if (!existingUser) {
      // Create user in Auth
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: "anthony@sidelineswap.com",
        password: "GolfAdmin123!",
        email_confirm: true,
        user_metadata: {
          name: "Anthony Admin",
        },
      })

      if (createError) {
        console.error("Error creating admin user:", createError)
        return { success: false, error: createError.message }
      }

      userId = newUser.user.id
    } else {
      userId = existingUser.id
    }

    // Update or insert user in users table with admin privileges
    const { error: updateError } = await supabase.from("users").upsert({
      id: userId,
      email: "anthony@sidelineswap.com",
      name: "Anthony Admin",
      is_admin: true,
    })

    if (updateError) {
      console.error("Error updating user:", updateError)
      return { success: false, error: updateError.message }
    }

    return {
      success: true,
      message: "Admin user created successfully",
      credentials: {
        email: "anthony@sidelineswap.com",
        password: "GolfAdmin123!",
      },
    }
  } catch (error: any) {
    console.error("Error in createAdminUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function resetAdminUser() {
  // Create a Supabase client with service role key to bypass RLS
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    console.log("Starting admin user reset process")

    // 1. Find existing users with this email
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers()

    if (searchError) {
      console.error("Error searching for users:", searchError)
      return { success: false, error: searchError.message }
    }

    // Find the user with our target email
    const adminUser = existingUsers.users.find((user) => user.email?.toLowerCase() === "anthony@sidelineswap.com")

    console.log("Found existing user:", adminUser ? "Yes" : "No")

    // 2. If user exists, delete them
    if (adminUser?.id) {
      console.log("Deleting user with ID:", adminUser.id)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(adminUser.id)

      if (deleteError) {
        console.error("Error deleting user:", deleteError)
        return { success: false, error: deleteError.message }
      }

      // Also delete from our users table
      await supabase.from("users").delete().eq("id", adminUser.id)

      // Wait a moment to ensure deletion is processed
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // 3. Create a new admin user
    console.log("Creating new admin user")
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: "anthony@sidelineswap.com",
      password: "GolfAdmin123!",
      email_confirm: true,
      user_metadata: {
        name: "Anthony Admin",
      },
    })

    if (createError) {
      console.error("Error creating admin user:", createError)
      return { success: false, error: createError.message }
    }

    console.log("New user created with ID:", newUser.user.id)

    // 4. Insert into users table with admin privileges
    const { error: insertError } = await supabase.from("users").insert({
      id: newUser.user.id,
      email: "anthony@sidelineswap.com",
      name: "Anthony Admin",
      is_admin: true,
    })

    if (insertError) {
      console.error("Error inserting user:", insertError)
      return { success: false, error: insertError.message }
    }

    return {
      success: true,
      message: "Admin user reset successfully",
      credentials: {
        email: "anthony@sidelineswap.com",
        password: "GolfAdmin123!",
      },
    }
  } catch (error: any) {
    console.error("Error in resetAdminUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
