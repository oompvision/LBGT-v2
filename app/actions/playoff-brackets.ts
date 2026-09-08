"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { PlayoffBracket, PlayoffMatch, PlayoffSeed } from "@/types/supabase"

export type Flight = "A" | "B"

export interface BracketWithMatches extends PlayoffBracket {
  matches: PlayoffMatch[]
  seeds: PlayoffSeed[]
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

    const bracketIds = brackets.map((b) => b.id)

    const { data: matches, error: matchesError } = await supabase
      .from("playoff_matches")
      .select("*")
      .in("bracket_id", bracketIds)
      .order("round_number", { ascending: true })
      .order("sort_order", { ascending: true })

    if (matchesError) {
      console.error("Error fetching playoff matches:", matchesError)
      return { success: false, error: matchesError.message, brackets: [] as BracketWithMatches[] }
    }

    const { data: seeds, error: seedsError } = await supabase
      .from("playoff_seeds")
      .select("*")
      .in("bracket_id", bracketIds)
      .order("seed_number", { ascending: true })

    if (seedsError) {
      console.error("Error fetching playoff seeds:", seedsError)
      return { success: false, error: seedsError.message, brackets: [] as BracketWithMatches[] }
    }

    const withMatches: BracketWithMatches[] = brackets.map((b) => ({
      ...b,
      matches: (matches || []).filter((m) => m.bracket_id === b.id),
      seeds: (seeds || []).filter((s) => s.bracket_id === b.id),
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

// Pushes (or clears) one slot of a downstream match. If that match already had
// its own result recorded, changing one of its players invalidates that
// result too, so it's cleared and the invalidation cascades forward again.
async function propagateSlot(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  matchId: string,
  slot: 1 | 2,
  playerId: string | null,
  playerName: string | null,
) {
  const { data: nextMatch } = await supabaseAdmin.from("playoff_matches").select("*").eq("id", matchId).single()
  if (!nextMatch) return

  const idField = slot === 1 ? "player1_id" : "player2_id"
  const nameField = slot === 1 ? "player1_name" : "player2_name"
  if ((nextMatch as any)[idField] === playerId) return // no change, stop the cascade

  const updates: Record<string, any> = {
    [idField]: playerId,
    [nameField]: playerName,
    updated_at: new Date().toISOString(),
  }

  let cascade = false
  if (nextMatch.winner_player_num) {
    updates.winner_player_num = null
    updates.score = null
    cascade = true
  }

  await supabaseAdmin.from("playoff_matches").update(updates).eq("id", matchId)

  if (cascade && nextMatch.next_match_id && nextMatch.next_match_slot) {
    await propagateSlot(supabaseAdmin, nextMatch.next_match_id, nextMatch.next_match_slot as 1 | 2, null, null)
  }
}

// Sets or clears (winnerPlayerNum: null) the result of a match. Editable at
// any time — the winner automatically advances into the next match it feeds
// (for auto-generated brackets), cascading forward if that invalidates an
// already-recorded later result.
export async function setPlayoffMatchResult(
  matchId: string,
  winnerPlayerNum: 1 | 2 | null,
  score: string | null,
) {
  try {
    const supabaseAdmin = createAdminClient()

    const { data: match, error: fetchError } = await supabaseAdmin
      .from("playoff_matches")
      .select("*")
      .eq("id", matchId)
      .single()

    if (fetchError || !match) {
      return { success: false, error: fetchError?.message || "Match not found" }
    }

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

    if (match.next_match_id && match.next_match_slot) {
      const winnerId = winnerPlayerNum === 1 ? match.player1_id : winnerPlayerNum === 2 ? match.player2_id : null
      const winnerName = winnerPlayerNum === 1 ? match.player1_name : winnerPlayerNum === 2 ? match.player2_name : null
      await propagateSlot(supabaseAdmin, match.next_match_id, match.next_match_slot as 1 | 2, winnerId, winnerName)
    }

    revalidatePath("/admin/playoff-brackets")
    revalidatePath("/playoffs")
    return { success: true }
  } catch (error) {
    console.error("Error in setPlayoffMatchResult:", error)
    return { success: false, error: "Failed to set match result" }
  }
}

// --- Standard-seeding bracket generation ---

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

// Classic recursive tournament seeding order, e.g. seedOrder(8) = [1,8,4,5,2,7,3,6].
// Pairing consecutive elements gives round-1 matchups that keep top seeds apart
// for as long as possible in every later round.
function seedOrder(size: number): number[] {
  if (size === 1) return [1]
  const half = seedOrder(size / 2)
  const result: number[] = []
  for (const s of half) {
    result.push(s)
    result.push(size + 1 - s)
  }
  return result
}

function computeRoundLabel(roundNumber: number, totalRounds: number): string {
  const remaining = totalRounds - roundNumber
  if (remaining === 0) return "Final"
  if (remaining === 1) return "Semifinal"
  if (remaining === 2) return "Quarterfinal"
  return `Round ${roundNumber}`
}

export interface SeedInput {
  seedNumber: number
  playerId: string
  playerName: string
}

// Replaces the bracket's seed list and (re)generates its full match tree.
// Blocked if any match already has a recorded result, to avoid silently
// discarding real progress — delete those matches manually first.
export async function generatePlayoffBracketFromSeeds(bracketId: string, seeds: SeedInput[]) {
  try {
    if (seeds.length < 2) {
      return { success: false, error: "Enter at least 2 seeded players." }
    }

    const supabaseAdmin = createAdminClient()

    const { data: existingMatches, error: existingError } = await supabaseAdmin
      .from("playoff_matches")
      .select("id, winner_player_num")
      .eq("bracket_id", bracketId)

    if (existingError) {
      return { success: false, error: existingError.message }
    }

    if ((existingMatches || []).some((m) => m.winner_player_num)) {
      return {
        success: false,
        error: "Results have already been recorded for this bracket. Delete those matches manually before re-generating from seeds.",
      }
    }

    if (existingMatches && existingMatches.length > 0) {
      const { error: deleteError } = await supabaseAdmin.from("playoff_matches").delete().eq("bracket_id", bracketId)
      if (deleteError) return { success: false, error: deleteError.message }
    }

    const { error: deleteSeedsError } = await supabaseAdmin.from("playoff_seeds").delete().eq("bracket_id", bracketId)
    if (deleteSeedsError) return { success: false, error: deleteSeedsError.message }

    const { error: insertSeedsError } = await supabaseAdmin.from("playoff_seeds").insert(
      seeds.map((s) => ({
        bracket_id: bracketId,
        seed_number: s.seedNumber,
        player_id: s.playerId,
        player_name: s.playerName,
      })),
    )
    if (insertSeedsError) return { success: false, error: insertSeedsError.message }

    const numSeeds = seeds.length
    const bracketSize = nextPowerOf2(numSeeds)
    const totalRounds = Math.log2(bracketSize)
    const order = seedOrder(bracketSize)
    const seedByNumber = new Map(seeds.map((s) => [s.seedNumber, s]))

    // Build the tree from the final backwards, so each earlier round's rows
    // can reference the already-created next-round row they feed into.
    let nextRoundIds: string[] = []
    let round1Ids: string[] = []

    for (let r = totalRounds; r >= 1; r--) {
      const matchCount = bracketSize / Math.pow(2, r)
      const label = computeRoundLabel(r, totalRounds)
      const rows = []
      for (let i = 0; i < matchCount; i++) {
        rows.push({
          bracket_id: bracketId,
          round_number: r,
          round_label: label,
          sort_order: i,
          player1_id: null,
          player1_name: null,
          player2_id: null,
          player2_name: null,
          next_match_id: r === totalRounds ? null : nextRoundIds[Math.floor(i / 2)],
          next_match_slot: r === totalRounds ? null : (i % 2 === 0 ? 1 : 2),
        })
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("playoff_matches")
        .insert(rows)
        .select("id, sort_order")

      if (insertError || !inserted) {
        return { success: false, error: insertError?.message || "Failed to create bracket" }
      }

      const orderedIds = [...inserted].sort((a, b) => a.sort_order - b.sort_order).map((row) => row.id)
      nextRoundIds = orderedIds
      if (r === 1) round1Ids = orderedIds
    }

    // Fill in round 1's real pairings (and byes) from the seed list.
    for (let i = 0; i < round1Ids.length; i++) {
      const a = order[i * 2]
      const b = order[i * 2 + 1]
      const seedA = seedByNumber.get(a)
      const seedB = seedByNumber.get(b)
      const matchId = round1Ids[i]

      if (seedA && seedB) {
        await supabaseAdmin
          .from("playoff_matches")
          .update({
            player1_id: seedA.playerId,
            player1_name: seedA.playerName,
            player2_id: seedB.playerId,
            player2_name: seedB.playerName,
          })
          .eq("id", matchId)
        continue
      }

      const bye = seedA || seedB
      if (!bye) continue // shouldn't happen: bracketSize is the minimal power of 2 >= numSeeds

      const { data: r1match } = await supabaseAdmin
        .from("playoff_matches")
        .update({
          player1_id: bye.playerId,
          player1_name: bye.playerName,
          player2_id: null,
          player2_name: null,
          winner_player_num: 1,
        })
        .eq("id", matchId)
        .select("next_match_id, next_match_slot")
        .single()

      if (r1match?.next_match_id && r1match?.next_match_slot) {
        await propagateSlot(supabaseAdmin, r1match.next_match_id, r1match.next_match_slot as 1 | 2, bye.playerId, bye.playerName)
      }
    }

    revalidatePath("/admin/playoff-brackets")
    revalidatePath("/playoffs")
    return { success: true }
  } catch (error) {
    console.error("Error in generatePlayoffBracketFromSeeds:", error)
    return { success: false, error: "Failed to generate bracket" }
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
