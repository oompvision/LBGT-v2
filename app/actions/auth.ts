"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Function to create a user in the database
export async function createUserInDatabase(userId: string, email: string, name: string) {
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

// Function to upload profile picture
export async function uploadProfilePicture(formData: FormData) {
  try {
    const supabase = createClient()
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
    const supabase = createClient()
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
