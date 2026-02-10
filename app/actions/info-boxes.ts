"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getActiveInfoBoxes() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("info_boxes")
      .select("*")
      .eq("is_active", true)
      .order("display_order")

    if (error) {
      console.error("Error fetching info boxes:", error)
      return { success: false, error: error.message, infoBoxes: [] }
    }

    return { success: true, infoBoxes: data || [] }
  } catch (error) {
    console.error("Error in getActiveInfoBoxes:", error)
    return { success: false, error: "Failed to fetch info boxes", infoBoxes: [] }
  }
}

export async function getAllInfoBoxes() {
  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from("info_boxes")
      .select("*")
      .order("display_order")

    if (error) {
      console.error("Error fetching all info boxes:", error)
      return { success: false, error: error.message, infoBoxes: [] }
    }

    return { success: true, infoBoxes: data || [] }
  } catch (error) {
    console.error("Error in getAllInfoBoxes:", error)
    return { success: false, error: "Failed to fetch info boxes", infoBoxes: [] }
  }
}

export async function createInfoBox(data: { title: string; content: string; display_order: number }) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from("info_boxes").insert({
      title: data.title,
      content: data.content,
      display_order: data.display_order,
      is_active: true,
    })

    if (error) {
      console.error("Error creating info box:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/info-boxes")
    return { success: true }
  } catch (error) {
    console.error("Error in createInfoBox:", error)
    return { success: false, error: "Failed to create info box" }
  }
}

export async function updateInfoBox(
  id: string,
  data: { title?: string; content?: string; display_order?: number; is_active?: boolean }
) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from("info_boxes")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      console.error("Error updating info box:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/info-boxes")
    return { success: true }
  } catch (error) {
    console.error("Error in updateInfoBox:", error)
    return { success: false, error: "Failed to update info box" }
  }
}

export async function deleteInfoBox(id: string) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from("info_boxes").delete().eq("id", id)

    if (error) {
      console.error("Error deleting info box:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/info-boxes")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteInfoBox:", error)
    return { success: false, error: "Failed to delete info box" }
  }
}
