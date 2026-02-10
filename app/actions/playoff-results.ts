"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getPlayoffResults() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("playoff_results")
      .select("*")
      .order("year", { ascending: false })

    if (error) {
      console.error("Error fetching playoff results:", error)
      return { success: false, error: error.message, results: [] }
    }

    return { success: true, results: data || [] }
  } catch (error) {
    console.error("Error in getPlayoffResults:", error)
    return { success: false, error: "Failed to fetch playoff results", results: [] }
  }
}

export async function createPlayoffResult(data: {
  year: number
  champion_name: string
  runner_up_name: string
}) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from("playoff_results").insert({
      year: data.year,
      champion_name: data.champion_name,
      runner_up_name: data.runner_up_name,
    })

    if (error) {
      console.error("Error creating playoff result:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/playoff-results")
    return { success: true }
  } catch (error) {
    console.error("Error in createPlayoffResult:", error)
    return { success: false, error: "Failed to create playoff result" }
  }
}

export async function updatePlayoffResult(
  id: string,
  data: { year?: number; champion_name?: string; runner_up_name?: string }
) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from("playoff_results")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      console.error("Error updating playoff result:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/playoff-results")
    return { success: true }
  } catch (error) {
    console.error("Error in updatePlayoffResult:", error)
    return { success: false, error: "Failed to update playoff result" }
  }
}

export async function deletePlayoffResult(id: string) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from("playoff_results").delete().eq("id", id)

    if (error) {
      console.error("Error deleting playoff result:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/")
    revalidatePath("/admin/playoff-results")
    return { success: true }
  } catch (error) {
    console.error("Error in deletePlayoffResult:", error)
    return { success: false, error: "Failed to delete playoff result" }
  }
}
