"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Create a new site message
export async function createMessage(content: string) {
  const supabase = createClient()

  try {
    // Check if user is authenticated and is an admin
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { success: false, error: "Authentication required" }
    }

    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", session.user.id)
      .single()

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Admin privileges required" }
    }

    // If there's an active message, deactivate it first
    await supabase.from("site_messages").update({ is_active: false }).eq("is_active", true)

    // Create the new message (active by default)
    const { error } = await supabase.from("site_messages").insert({
      content,
      is_active: true,
    })

    if (error) {
      console.error("Error creating message:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/messages")

    return { success: true }
  } catch (error: any) {
    console.error("Error in createMessage:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Update a site message
export async function updateMessage(id: string, data: { content?: string; is_active?: boolean }) {
  const supabase = createClient()

  try {
    // Check if user is authenticated and is an admin
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { success: false, error: "Authentication required" }
    }

    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", session.user.id)
      .single()

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Admin privileges required" }
    }

    // If we're activating this message, deactivate all others first
    if (data.is_active) {
      await supabase.from("site_messages").update({ is_active: false }).eq("is_active", true)
    }

    // Update the message
    const { error } = await supabase.from("site_messages").update(data).eq("id", id)

    if (error) {
      console.error("Error updating message:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/messages")

    return { success: true }
  } catch (error: any) {
    console.error("Error in updateMessage:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Delete a site message
export async function deleteMessage(id: string) {
  const supabase = createClient()

  try {
    // Check if user is authenticated and is an admin
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { success: false, error: "Authentication required" }
    }

    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", session.user.id)
      .single()

    if (userError || !userData?.is_admin) {
      return { success: false, error: "Admin privileges required" }
    }

    // Delete the message
    const { error } = await supabase.from("site_messages").delete().eq("id", id)

    if (error) {
      console.error("Error deleting message:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/messages")

    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteMessage:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
