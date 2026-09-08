"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { PlayoffBracket, PlayoffMatch } from "@/types/supabase"

export type Flight = "A" | "B"

export interface BracketWithMatches extends PlayoffBracket {
  matches: PlayoffMatch[]
}

// Distinct years that have been configured, newest first.
export async function getPlayoffBracketYears() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("playoff_brackets")
      .select("year")
      .order("year", { ascending: false })

    if (error) {
      console.error("Error fetching playoff bracket years:", error)
      return { success: false, error: error.message, years: [] as number[] }
    }

    const years = Array.from(new Set((data || []).map((r) => r.year)))
    return { success: true, years }
  } catch (error) {
    console.error("Error in getPlayoffBracketYears:", error)
    return { success: false, error: "Failed to fetch years", years: [] as number[] }
  }
}

// Both flights for a year (created together), each with its matches.
export async function getPlayoffBracketsForYear(year: number) {
  try {
    const supabase = await createClient()
    const { data: brackets, error: bracketsError } = await supabase
      .from("playoff_brackets")
      .select("*")
      .eq("year", year)
      .order("flight", { ascending: true })

    if (bracketsError) {
      console.error("Error fetching playoff brackets:", bracketsError)
      return { success: false, error: bracketsError.message, brackets: [] as BracketWithMatches[] }
    }

    if (!brackets || brackets.length === 0) {
      return { success: true, brackets: [] as BracketWithMatches[] }
    }

    const { data: matches, error: matchesError } = await supabase
      .from("playoff_matches")
      .select("*")
      .in("bracket_id", brackets.map((b) => b.id))
      .order("round_number", { ascending: true })
      .order("sort_order", { ascending: true })

    if (matchesError) {
      console.error("Error fetching playoff matches:", matchesError)
      return { success: false, error: matchesError.message, brackets: [] as BracketWithMatches[] }
    }

    const withMatches: BracketWithMatches[] = brackets.map((b) => ({
      ...b,
      matches: (matches || []).filter((m) => m.bracket_id === b.id),
    }))

    return { success: true, brackets: withMatches }
  } catch (error) {
    console.error("Error in getPlayoffBracketsForYear:", error)
    return { success: false, error: "Failed to fetch brackets", brackets: [] as BracketWithMatches[] }
  }
}

// Creates both A and B flight brackets for a year, if they don't already exist.
export async function createPlayoffYear(year: number) {
  try {
    const supabaseAdmin = createAdminClient()

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("playoff_brackets")
      .select("flight")
      .eq("year", year)

    if (existingError) {
      console.error("Error checking existing playoff year:", existingError)
      return { success: false, error: existingError.message }
    }

    const existingFlights = new Set((existing || []).map((r) => r.flight))
    const toInsert: { year: number; flight: Flight }[] = (["A", "B"] as Flight[])
      .filter((f) => !existingFlights.has(f))
      .map((flight) => ({ year, flight }))

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from("playoff_brackets").insert(toInsert)
      if (error) {
        console.error("Error creating playoff year:", error)
        return { success: false, error: error.message }
      }
    }

    revalidatePath("/admin/playoff-brackets")
    return { success: true }
  } catch (error) {
    console.error("Error in createPlayoffYear:", error)
    return { success: false, error: "Failed to create playoff year" }
  }
}

export async function togglePlayoffBracketPublished(bracketId: string, isPublished: boolean) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from("playoff_brackets")
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq("id", bracketId)

    if (error) {
      console.error("Error updating playoff bracket:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/playoff-brackets")
    revalidatePath("/playoffs")
    return { success: true }
  } catch (error) {
    console.error("Error in togglePlayoffBracketPublished:", error)
    return { success: false, error: "Failed to update bracket" }
  }
}

export async function addPlayoffMatch(data: {
  bracketId: string
  roundNumber: number
  roundLabel: string
  sortOrder: number
  player1Id: string
  player1Name: string
  player2Id?: string | null
  player2Name?: string | null
}) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from("playoff_matches").insert({
      bracket_id: data.bracketId,
      round_number: data.roundNumber,
      round_label: data.roundLabel,
      sort_order: data.sortOrder,
      player1_id: data.player1Id,
      player1_name: data.player1Name,
      player2_id: data.player2Id || null,
      player2_name: data.player2Name || null,
    })

    if (error) {
      console.error("Error adding playoff match:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/playoff-brackets")
    revalidatePath("/playoffs")
    return { success: true }
  } catch (error) {
    console.error("Error in addPlayoffMatch:", error)
    return { success: false, error: "Failed to add match" }
  }
}

export async function deletePlayoffMatch(matchId: string) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from("playoff_matches").delete().eq("id", matchId)

    if (error) {
      console.error("Error deleting playoff match:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/playoff-brackets")
    revalidatePath("/playoffs")
    return { success: true }
  } catch (error) {
    console.error("Error in deletePlayoffMatch:", error)
    return { success: false, error: "Failed to delete match" }
  }
}

// Sets or clears (winnerPlayerNum: null) the result of a match. Editable at any time.
export async function setPlayoffMatchResult(
  matchId: string,
  winnerPlayerNum: 1 | 2 | null,
  score: string | null,
) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from("playoff_matches")
      .update({
        winner_player_num: winnerPlayerNum,
        score: winnerPlayerNum ? score : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId)

    if (error) {
      console.error("Error setting playoff match result:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/playoff-brackets")
    revalidatePath("/playoffs")
    return { success: true }
  } catch (error) {
    console.error("Error in setPlayoffMatchResult:", error)
    return { success: false, error: "Failed to set match result" }
  }
}

// Public: most recent year with at least one published flight, and its
// published brackets/matches. Only published brackets are ever returned here
// (RLS enforces this too, since this uses the anon-key client).
export async function getPublishedPlayoffBrackets(year?: number) {
  try {
    const supabase = await createClient()

    let targetYear = year
    if (!targetYear) {
      const { data: latest } = await supabase
        .from("playoff_brackets")
        .select("year")
        .eq("is_published", true)
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle()
      targetYear = latest?.year
    }

    if (!targetYear) {
      return { success: true, year: null as number | null, brackets: [] as BracketWithMatches[], years: [] as number[] }
    }

    const { data: years } = await supabase
      .from("playoff_brackets")
      .select("year")
      .eq("is_published", true)
      .order("year", { ascending: false })

    const { data: brackets, error } = await supabase
      .from("playoff_brackets")
      .select("*")
      .eq("year", targetYear)
      .eq("is_published", true)
      .order("flight", { ascending: true })

    if (error) {
      console.error("Error fetching published playoff brackets:", error)
      return { success: false, error: error.message, year: targetYear, brackets: [] as BracketWithMatches[], years: [] as number[] }
    }

    let withMatches: BracketWithMatches[] = []
    if (brackets && brackets.length > 0) {
      const { data: matches } = await supabase
        .from("playoff_matches")
        .select("*")
        .in("bracket_id", brackets.map((b) => b.id))
        .order("round_number", { ascending: true })
        .order("sort_order", { ascending: true })

      withMatches = brackets.map((b) => ({
        ...b,
        matches: (matches || []).filter((m) => m.bracket_id === b.id),
      }))
    }

    return {
      success: true,
      year: targetYear,
      brackets: withMatches,
      years: Array.from(new Set((years || []).map((r) => r.year))),
    }
  } catch (error) {
    console.error("Error in getPublishedPlayoffBrackets:", error)
    return { success: false, error: "Failed to fetch playoffs", year: null as number | null, brackets: [] as BracketWithMatches[], years: [] as number[] }
  }
}
