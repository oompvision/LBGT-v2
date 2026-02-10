"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Function to submit scores for a round
export async function submitScores(
  date: string,
  playerScores: {
    userId: string
    scores: number[]
    netScores?: number[]
    strokesGiven?: number
  }[],
) {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to submit scores" }
    }

    // Validate input data
    if (!date) {
      return { success: false, error: "Date is required" }
    }

    if (!playerScores || playerScores.length === 0) {
      return { success: false, error: "No player scores provided" }
    }

    // Validate each player's scores
    for (const player of playerScores) {
      if (!player.userId) {
        return { success: false, error: "Player ID is required for all players" }
      }

      if (!player.scores || player.scores.length !== 18) {
        return { success: false, error: `Invalid scores for player: ${player.userId}. Expected 18 scores.` }
      }

      // Ensure all scores are valid numbers
      for (let i = 0; i < player.scores.length; i++) {
        const score = player.scores[i]
        if (score !== 0 && !score) {
          player.scores[i] = 0 // Set to 0 if undefined or null
        }
      }

      // Do the same for net scores if they exist
      if (player.netScores) {
        for (let i = 0; i < player.netScores.length; i++) {
          const netScore = player.netScores[i]
          if (netScore !== 0 && !netScore) {
            player.netScores[i] = 0 // Set to 0 if undefined or null
          }
        }
      }
    }

    const { data: activeSeason } = await supabase.from("seasons").select("year").eq("is_active", true).single()

    const currentSeason = activeSeason?.year || 2025

    console.log("Creating new round with date:", date, "and season:", currentSeason)

    // Create a new round
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .insert({
        date,
        submitted_by: session.user.id,
        season: currentSeason,
      })
      .select()
      .single()

    if (roundError) {
      console.error("Error creating round:", roundError)
      return { success: false, error: roundError.message }
    }

    console.log("Round created successfully:", round.id)

    // Insert scores for each player
    for (const player of playerScores) {
      // Skip players with no user ID (empty selections)
      if (!player.userId) continue

      // Skip players with no scores
      if (!player.scores.some((score) => score > 0)) continue

      try {
        // Calculate total score
        const totalScore = player.scores.reduce((sum, score) => sum + (score || 0), 0)

        // Calculate net total score if netScores are provided
        const netTotalScore = player.netScores
          ? player.netScores.reduce((sum, score) => sum + (score || 0), 0)
          : totalScore - (player.strokesGiven || 0)

        console.log(`Inserting scores for player ${player.userId} with total score ${totalScore}`)

        const scoreData = {
          round_id: round.id,
          user_id: player.userId,
          hole_1: player.scores[0] || 0,
          hole_2: player.scores[1] || 0,
          hole_3: player.scores[2] || 0,
          hole_4: player.scores[3] || 0,
          hole_5: player.scores[4] || 0,
          hole_6: player.scores[5] || 0,
          hole_7: player.scores[6] || 0,
          hole_8: player.scores[7] || 0,
          hole_9: player.scores[8] || 0,
          hole_10: player.scores[9] || 0,
          hole_11: player.scores[10] || 0,
          hole_12: player.scores[11] || 0,
          hole_13: player.scores[12] || 0,
          hole_14: player.scores[13] || 0,
          hole_15: player.scores[14] || 0,
          hole_16: player.scores[15] || 0,
          hole_17: player.scores[16] || 0,
          hole_18: player.scores[17] || 0,
          total_score: totalScore,
          strokes_given: player.strokesGiven || 0,
        }

        // Add net scores if provided
        if (player.netScores) {
          Object.assign(scoreData, {
            net_hole_1: player.netScores[0] || 0,
            net_hole_2: player.netScores[1] || 0,
            net_hole_3: player.netScores[2] || 0,
            net_hole_4: player.netScores[3] || 0,
            net_hole_5: player.netScores[4] || 0,
            net_hole_6: player.netScores[5] || 0,
            net_hole_7: player.netScores[6] || 0,
            net_hole_8: player.netScores[7] || 0,
            net_hole_9: player.netScores[8] || 0,
            net_hole_10: player.netScores[9] || 0,
            net_hole_11: player.netScores[10] || 0,
            net_hole_12: player.netScores[11] || 0,
            net_hole_13: player.netScores[12] || 0,
            net_hole_14: player.netScores[13] || 0,
            net_hole_15: player.netScores[14] || 0,
            net_hole_16: player.netScores[15] || 0,
            net_hole_17: player.netScores[16] || 0,
            net_hole_18: player.netScores[17] || 0,
            net_total_score: netTotalScore,
          })
        }

        const { error: scoreError } = await supabase.from("scores").insert(scoreData)

        if (scoreError) {
          console.error(`Error inserting score for player ${player.userId}:`, scoreError)
          // Continue with other players instead of failing the entire operation
        } else {
          console.log(`Scores inserted successfully for player ${player.userId}`)
        }
      } catch (playerError) {
        console.error(`Error processing player ${player.userId}:`, playerError)
        // Continue with other players instead of failing the entire operation
      }
    }

    // Revalidate relevant paths
    revalidatePath("/scores/my-rounds")
    revalidatePath("/scores/league-rounds")

    return { success: true, roundId: round.id }
  } catch (error: any) {
    console.error("Error in submitScores:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

// Function to get rounds for the current user
export async function getMyRounds() {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be logged in to view your rounds", rounds: [] }
    }

    const { data: activeSeason } = await supabase.from("seasons").select("year").eq("is_active", true).single()

    const currentSeason = activeSeason?.year || 2025

    // Get all scores for the current user with round details
    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select(
        `
        id,
        total_score,
        net_total_score,
        strokes_given,
        round_id,
        rounds!inner (
          id,
          date,
          submitted_by,
          season,
          users (
            name
          )
        )
      `,
      )
      .eq("user_id", session.user.id)
      .eq("rounds.season", currentSeason)
      .order("rounds(date)", { ascending: false })

    if (scoresError) {
      console.error("Error fetching user rounds:", scoresError)
      return { success: false, error: scoresError.message, rounds: [] }
    }

    // If no scores found, return empty array
    if (!scores || scores.length === 0) {
      return { success: true, rounds: [] }
    }

    // Process the scores into a format expected by the UI
    const rounds = scores.map((score) => ({
      id: score.id,
      total_score: score.total_score,
      net_total_score: score.net_total_score || score.total_score - (score.strokes_given || 0),
      strokes_given: score.strokes_given || 0,
      rounds: score.rounds,
    }))

    return { success: true, rounds }
  } catch (error: any) {
    console.error("Error in getMyRounds:", error)
    return { success: false, error: error.message || "An unexpected error occurred", rounds: [] }
  }
}

// Function to get all league rounds - OPTIMIZED VERSION
export async function getAllLeagueRounds(season?: number) {
  try {
    const supabase = await createClient()

    let selectedSeason = season
    if (!selectedSeason) {
      const { data: activeSeason } = await supabase.from("seasons").select("year").eq("is_active", true).single()
      selectedSeason = activeSeason?.year || 2025
    }

    // Get all rounds with submitter info in a single query
    const { data: rounds, error: roundsError } = await supabase
      .from("rounds")
      .select(
        `
        id,
        date,
        submitted_by,
        season,
        users (
          name
        )
      `,
      )
      .eq("season", selectedSeason)
      .order("date", { ascending: false })

    if (roundsError) {
      console.error("Error fetching league rounds:", roundsError)
      return { success: false, error: roundsError.message, roundsWithScores: [] }
    }

    // If there are no rounds, return early
    if (!rounds || rounds.length === 0) {
      return { success: true, roundsWithScores: [] }
    }

    // Extract round IDs for the next query
    const roundIds = rounds.map((round) => round.id)

    // Get all scores for all rounds in a single query
    const { data: allScores, error: scoresError } = await supabase
      .from("scores")
      .select(
        `
        id,
        round_id,
        user_id,
        total_score,
        net_total_score,
        strokes_given,
        users (
          id,
          name
        )
      `,
      )
      .in("round_id", roundIds)

    if (scoresError) {
      console.error("Error fetching scores for rounds:", scoresError)
      return { success: false, error: scoresError.message, roundsWithScores: [] }
    }

    // Group scores by round_id
    const scoresByRoundId = {}
    allScores?.forEach((score) => {
      if (!scoresByRoundId[score.round_id]) {
        scoresByRoundId[score.round_id] = []
      }
      scoresByRoundId[score.round_id].push(score)
    })

    // Combine rounds with their scores
    const roundsWithScores = rounds.map((round) => {
      const roundScores = scoresByRoundId[round.id] || []
      // Sort scores by total_score (ascending)
      roundScores.sort((a, b) => a.total_score - b.total_score)

      return {
        id: round.id,
        date: round.date,
        submittedBy: round.submitted_by,
        users: round.users,
        scores: roundScores,
      }
    })

    return { success: true, roundsWithScores }
  } catch (error: any) {
    console.error("Error in getAllLeagueRounds:", error)
    return { success: false, error: error.message || "An unexpected error occurred", roundsWithScores: [] }
  }
}

// Function to get details for a specific round
export async function getRoundDetails(roundId: string) {
  try {
    const supabase = await createClient()

    // Get the round
    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select(
        `
        id,
        date,
        submitted_by,
        users (
          name
        )
      `,
      )
      .eq("id", roundId)
      .single()

    if (roundError) {
      console.error("Error fetching round:", roundError)
      return { success: false, error: roundError.message, round: null, scores: [] }
    }

    // Get the scores for this round
    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select(
        `
        id,
        user_id,
        hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9,
        hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18,
        total_score,
        net_hole_1, net_hole_2, net_hole_3, net_hole_4, net_hole_5, net_hole_6, net_hole_7, net_hole_8, net_hole_9,
        net_hole_10, net_hole_11, net_hole_12, net_hole_13, net_hole_14, net_hole_15, net_hole_16, net_hole_17, net_hole_18,
        net_total_score,
        strokes_given,
        users (
          id,
          name
        ),
        rounds (
          id,
          date,
          users (
            name
          )
        )
      `,
      )
      .eq("round_id", roundId)
      .order("total_score", { ascending: true })

    if (scoresError) {
      console.error("Error fetching scores:", scoresError)
      return { success: false, error: scoresError.message, round, scores: [] }
    }

    return { success: true, round, scores: scores || [] }
  } catch (error: any) {
    console.error("Error in getRoundDetails:", error)
    return { success: false, error: error.message || "An unexpected error occurred", round: null, scores: [] }
  }
}

export async function getAllUsers() {
  try {
    const supabase = await createClient()

    const { data: users, error } = await supabase.from("users").select("id, name").order("name")

    if (error) {
      console.error("Error fetching users:", error)
      return { success: false, error: error.message, users: [] }
    }

    return { success: true, users: users || [] }
  } catch (error: any) {
    console.error("Error in getAllUsers:", error)
    return { success: false, error: error.message || "An unexpected error occurred", users: [] }
  }
}
