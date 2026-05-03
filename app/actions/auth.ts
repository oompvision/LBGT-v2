"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Sign up a new user via the admin API so the email is auto-confirmed
export async function signUpUser(email: string, password: string, name: string, phoneNumber?: string) {
  try {
    const supabaseAdmin = createAdminClient()

    // Create the auth user with email pre-confirmed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError) {
      // Handle duplicate email
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        return { success: false, error: "An account with this email already exists. Please sign in instead." }
      }
      console.error("Error creating auth user:", authError)
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: "Failed to create user" }
    }

    // Create the user profile in the database
    const dbResult = await createUserInDatabase(authData.user.id, email, name, phoneNumber)
    if (!dbResult.success) {
      console.error("Auth user created but DB insert failed:", dbResult.error)
      // Don't fail the whole signup — user can still sign in, DB row will be created on sign-in
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error in signUpUser:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to create a user in the database
export async function createUserInDatabase(userId: string, email: string, name: string, phoneNumber?: string) {
  try {
    // Use the admin client to bypass RLS
    const supabaseAdmin = createAdminClient()

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
      ...(phoneNumber ? { phone_number: phoneNumber } : {}),
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
export async function updateUserProfile(data: {
  name?: string
  phone_number?: string | null
  handicap?: number | null
}) {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to update your profile" }
    }

    // Build update payload — only include fields that were provided
    const updateData: { name?: string; phone_number?: string | null; handicap?: number | null } = {}
    if (data.name !== undefined && data.name !== "") {
      updateData.name = data.name
    }
    if (data.phone_number !== undefined) {
      updateData.phone_number = data.phone_number || null
    }
    if (data.handicap !== undefined) {
      if (data.handicap !== null && (data.handicap < -10 || data.handicap > 54)) {
        return { success: false, error: "Handicap must be between -10 and 54" }
      }
      updateData.handicap = data.handicap
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true }
    }

    // Update the user in the database
    const { error } = await supabase
      .from("users")
      .update(updateData)
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

// Function to upload profile picture
export async function uploadProfilePicture(formData: FormData) {
  try {
    const supabase = await createClient()
    // Use admin client to bypass RLS
    const supabaseAdmin = createAdminClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to upload a profile picture" }
    }

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

    // Create unique filename - simplified to avoid RLS issues
    const fileExt = file.name.split(".").pop()
    const fileName = `profile-${session.user.id}.${fileExt}`

    // Upload to Supabase Storage using admin client to bypass RLS
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("profile-pictures")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true, // Use upsert to overwrite existing files
      })

    if (uploadError) {
      console.error("Error uploading file:", uploadError)
      return { success: false, error: uploadError.message || "Failed to upload image" }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from("profile-pictures").getPublicUrl(fileName)

    // Update user profile with new picture URL
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        profile_picture_url: urlData.publicUrl,
      })
      .eq("id", session.user.id)

    if (updateError) {
      console.error("Error updating user profile:", updateError)
      return { success: false, error: "Failed to update profile" }
    }

    // Revalidate relevant paths
    revalidatePath("/profile")
    revalidatePath(`/players/${session.user.id}/stats`)
    revalidatePath("/scores/league-rounds")

    return { success: true, url: urlData.publicUrl }
  } catch (error: any) {
    console.error("Error in uploadProfilePicture:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to remove profile picture
export async function removeProfilePicture() {
  try {
    const supabase = await createClient()
    // Use admin client to bypass RLS
    const supabaseAdmin = createAdminClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to remove your profile picture" }
    }

    // Get current user data to find existing picture
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("profile_picture_url")
      .eq("id", session.user.id)
      .single()

    if (userError) {
      console.error("Error fetching user data:", userError)
      return { success: false, error: "Failed to fetch user data" }
    }

    // Remove from storage if exists
    if (userData.profile_picture_url) {
      const fileName = userData.profile_picture_url.split("/").pop()
      if (fileName) {
        // Use admin client to bypass RLS
        await supabaseAdmin.storage.from("profile-pictures").remove([fileName])
      }
    }

    // Update user profile to remove picture URL
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        profile_picture_url: null,
      })
      .eq("id", session.user.id)

    if (updateError) {
      console.error("Error updating user profile:", updateError)
      return { success: false, error: "Failed to update profile" }
    }

    // Revalidate relevant paths
    revalidatePath("/profile")
    revalidatePath(`/players/${session.user.id}/stats`)
    revalidatePath("/scores/league-rounds")

    return { success: true }
  } catch (error: any) {
    console.error("Error in removeProfilePicture:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
