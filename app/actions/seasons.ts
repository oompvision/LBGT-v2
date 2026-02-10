"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Season {
  id: string
  year: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Get all seasons
export async function getSeasons() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("seasons").select("*").order("year", { ascending: false })

    if (error) {
      console.error("Error fetching seasons:", error)
      return { success: false, error: error.message, seasons: [] }
    }

    return { success: true, seasons: data || [] }
  } catch (error) {
    console.error("Error in getSeasons:", error)
    return { success: false, error: "Failed to fetch seasons", seasons: [] }
  }
}

// Get active season
export async function getActiveSeason() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("seasons").select("*").eq("is_active", true).single()

    if (error) {
      console.error("Error fetching active season:", error)
      return { success: false, error: error.message, season: null }
    }

    return { success: true, season: data }
  } catch (error) {
    console.error("Error in getActiveSeason:", error)
    return { success: false, error: "Failed to fetch active season", season: null }
  }
}

// Create a new season
export async function createSeason(year: number, name: string, startDate: string, endDate: string) {
  try {
    const supabase = await createClient()

    const { data: existing } = await supabase.from("seasons").select("id").eq("year", year).maybeSingle()

    if (existing) {
      return { success: false, error: `Season ${year} already exists` }
    }

    const { data, error } = await supabase
      .from("seasons")
      .insert({ year, name, start_date: startDate, end_date: endDate, is_active: false })
      .select()
      .single()

    if (error) {
      console.error("Error creating season:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/seasons")
    return { success: true, season: data }
  } catch (error) {
    console.error("Error in createSeason:", error)
    return { success: false, error: "Failed to create season" }
  }
}

// Set active season
export async function setActiveSeason(seasonId: string) {
  try {
    const supabase = await createClient()

    // The trigger will handle deactivating other seasons
    const { error } = await supabase
      .from("seasons")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", seasonId)

    if (error) {
      console.error("Error setting active season:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/seasons")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Error in setActiveSeason:", error)
    return { success: false, error: "Failed to set active season" }
  }
}

// Update a season's dates
export async function updateSeasonDates(seasonId: string, startDate: string, endDate: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("seasons")
      .update({ start_date: startDate, end_date: endDate, updated_at: new Date().toISOString() })
      .eq("id", seasonId)
      .select()
      .single()

    if (error) {
      console.error("Error updating season dates:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/seasons")
    return { success: true, season: data }
  } catch (error) {
    console.error("Error in updateSeasonDates:", error)
    return { success: false, error: "Failed to update season dates" }
  }
}

// Delete a season (only if not active and has no data)
export async function deleteSeason(seasonId: string) {
  try {
    const supabase = await createClient()

    // Check if season is active
    const { data: season } = await supabase.from("seasons").select("is_active, year").eq("id", seasonId).single()

    if (season?.is_active) {
      return { success: false, error: "Cannot delete the active season" }
    }

    // Check if season has any data
    const { count: roundsCount } = await supabase
      .from("rounds")
      .select("*", { count: "exact", head: true })
      .eq("season", season?.year)

    const { count: teeTimesCount } = await supabase
      .from("tee_times")
      .select("*", { count: "exact", head: true })
      .eq("season", season?.year)

    const { count: reservationsCount } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("season", season?.year)

    if ((roundsCount || 0) > 0 || (teeTimesCount || 0) > 0 || (reservationsCount || 0) > 0) {
      return { success: false, error: "Cannot delete season with existing data" }
    }

    const { error } = await supabase.from("seasons").delete().eq("id", seasonId)

    if (error) {
      console.error("Error deleting season:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/seasons")
    return { success: true }
  } catch (error) {
    console.error("Error in deleteSeason:", error)
    return { success: false, error: "Failed to delete season" }
  }
}
