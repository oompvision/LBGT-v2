import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarIcon, User } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import Image from "next/image"

// Course data
const courseData = {
  holes: Array.from({ length: 18 }, (_, i) => i + 1),
  pars: [4, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  whiteHdcp: [11, 5, 17, 1, 9, 15, 7, 3, 13, 18, 8, 2, 12, 6, 10, 16, 4, 14],
  frontNinePar: 36,
  backNinePar: 36,
  totalPar: 72,
}

// Score indicator component
const ScoreIndicator = ({ score, par }) => {
  if (score === null || score === undefined) return "-"

  // Calculate the difference from par
  const diff = score - par

  // Eagle or better (double circle)
  if (diff <= -2) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" className="absolute">
          <circle cx="14" cy="14" r="12" fill="none" stroke="green" strokeWidth="1" />
          <circle cx="14" cy="14" r="9" fill="none" stroke="green" strokeWidth="1" />
        </svg>
        <span>{score}</span>
      </div>
    )
  }

  // Birdie (single circle)
  if (diff === -1) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" className="absolute">
          <circle cx="12" cy="12" r="10" fill="none" stroke="green" strokeWidth="1" />
        </svg>
        <span>{score}</span>
      </div>
    )
  }

  // Par (no indicator)
  if (diff === 0) {
    return <span>{score}</span>
  }

  // Bogey (single square)
  if (diff === 1) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" className="absolute">
          <rect x="2" y="2" width="20" height="20" fill="none" stroke="red" strokeWidth="1" />
        </svg>
        <span>{score}</span>
      </div>
    )
  }

  // Double bogey (double square)
  if (diff === 2) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" className="absolute">
          <rect x="4" y="4" width="20" height="20" fill="none" stroke="red" strokeWidth="1" />
          <rect x="7" y="7" width="14" height="14" fill="none" stroke="red" strokeWidth="1" />
        </svg>
        <span>{score}</span>
      </div>
    )
  }

  // Triple bogey or worse (double square with single diagonal line)
  if (diff >= 3) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" className="absolute">
          <rect x="4" y="4" width="20" height="20" fill="none" stroke="red" strokeWidth="1" />
          <rect x="7" y="7" width="14" height="14" fill="none" stroke="red" strokeWidth="1" />
          <line x1="4" y1="4" x2="24" y2="24" stroke="red" strokeWidth="1" />
        </svg>
        <span>{score}</span>
      </div>
    )
  }

  // Fallback
  return <span>{score}</span>
}

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function PlayerStatsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const playerId = params.id

  // Get player info including profile picture
  const { data: player, error: playerError } = await supabase
    .from("users")
    .select("id, name, strokes_given, profile_picture_url")
    .eq("id", playerId)
    .single()

  if (playerError || !player) {
    return notFound()
  }

  // Get all rounds with this player's scores
  const { data: playerScores, error: scoresError } = await supabase
    .from("scores")
    .select(
      `
      id,
      round_id,
      total_score,
      net_total_score,
      strokes_given,
      hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9,
      hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18,
      net_hole_1, net_hole_2, net_hole_3, net_hole_4, net_hole_5, net_hole_6, net_hole_7, net_hole_8, net_hole_9,
      net_hole_10, net_hole_11, net_hole_12, net_hole_13, net_hole_14, net_hole_15, net_hole_16, net_hole_17, net_hole_18,
      rounds (
        id,
        date,
        submitted_by,
        users (
          name
        )
      )
    `,
    )
    .eq("user_id", playerId)
    .order("rounds(date)", { ascending: false })

  if (scoresError) {
    console.error("Error fetching player scores:", scoresError)
  }

  // Get all rounds for leaderboard data
  const { data: allRounds, error: roundsError } = await supabase
    .from("rounds")
    .select(
      `
      id,
      date,
      scores (
        id,
        user_id,
        total_score,
        net_total_score,
        hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9,
        hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18,
        net_hole_1, net_hole_2, net_hole_3, net_hole_4, net_hole_5, net_hole_6, net_hole_7, net_hole_8, net_hole_9,
        net_hole_10, net_hole_11, net_hole_12, net_hole_13, net_hole_14, net_hole_15, net_hole_16, net_hole_17, net_hole_18,
        users (
          id,
          name,
          strokes_given
        )
      )
    `,
    )
    .order("date", { ascending: false })

  if (roundsError) {
    console.error("Error fetching rounds:", roundsError)
  }

  // Calculate player's rank and stats
  let playerRank = 0
  let totalPlayers = 0
  const playerStats = {
    rounds: 0,
    totalScore: 0,
    netTotalScore: 0,
    bestScore: Number.POSITIVE_INFINITY,
    netBestScore: Number.POSITIVE_INFINITY,
    averageScore: 0,
    netAverageScore: 0,
    strokesGiven: player.strokes_given || 0,
  }

  // Calculate ringer scorecard
  const ringerScorecard = {
    holes: Array(18).fill(null),
    netHoles: Array(18).fill(null),
    holesPlayed: 0,
    netHolesPlayed: 0,
    totalScore: 0,
    netTotalScore: 0,
  }

  // Process all rounds for leaderboard ranking and ringer scorecard
  if (allRounds) {
    // Build player stats for ranking
    const playerStatsMap = new Map()

    allRounds.forEach((round) => {
      if (!Array.isArray(round.scores)) return

      round.scores.forEach((score) => {
        const userId = score.user_id
        if (!userId) return

        if (!playerStatsMap.has(userId)) {
          playerStatsMap.set(userId, {
            rounds: 0,
            totalScore: 0,
            netTotalScore: 0,
            strokesGiven: score.users?.strokes_given || 0,
          })
        }

        const stats = playerStatsMap.get(userId)
        stats.rounds += 1
        stats.totalScore += score.total_score || 0

        // Calculate net score
        const netScore = score.net_total_score || score.total_score - (score.users?.strokes_given || 0)
        stats.netTotalScore += netScore

        // Update player's own stats
        if (userId === playerId) {
          playerStats.rounds += 1
          playerStats.totalScore += score.total_score || 0
          playerStats.netTotalScore += netScore

          if ((score.total_score || 0) < playerStats.bestScore) {
            playerStats.bestScore = score.total_score || 0
          }

          if (netScore < playerStats.netBestScore) {
            playerStats.netBestScore = netScore
          }

          // Update ringer scorecard
          const holeScores = [
            score.hole_1,
            score.hole_2,
            score.hole_3,
            score.hole_4,
            score.hole_5,
            score.hole_6,
            score.hole_7,
            score.hole_8,
            score.hole_9,
            score.hole_10,
            score.hole_11,
            score.hole_12,
            score.hole_13,
            score.hole_14,
            score.hole_15,
            score.hole_16,
            score.hole_17,
            score.hole_18,
          ]

          const netHoleScores = [
            score.net_hole_1 !== null ? score.net_hole_1 : score.hole_1,
            score.net_hole_2 !== null ? score.net_hole_2 : score.hole_2,
            score.net_hole_3 !== null ? score.net_hole_3 : score.hole_3,
            score.net_hole_4 !== null ? score.net_hole_4 : score.hole_4,
            score.net_hole_5 !== null ? score.net_hole_5 : score.hole_5,
            score.net_hole_6 !== null ? score.net_hole_6 : score.hole_6,
            score.net_hole_7 !== null ? score.net_hole_7 : score.hole_7,
            score.net_hole_8 !== null ? score.net_hole_8 : score.hole_8,
            score.net_hole_9 !== null ? score.net_hole_9 : score.hole_9,
            score.net_hole_10 !== null ? score.net_hole_10 : score.hole_10,
            score.net_hole_11 !== null ? score.net_hole_11 : score.hole_11,
            score.net_hole_12 !== null ? score.net_hole_12 : score.hole_12,
            score.net_hole_13 !== null ? score.net_hole_13 : score.hole_13,
            score.net_hole_14 !== null ? score.net_hole_14 : score.hole_14,
            score.net_hole_15 !== null ? score.net_hole_15 : score.hole_15,
            score.net_hole_16 !== null ? score.net_hole_16 : score.hole_16,
            score.net_hole_17 !== null ? score.net_hole_17 : score.hole_17,
            score.net_hole_18 !== null ? score.net_hole_18 : score.hole_18,
          ]

          // Update ringer scorecard with best scores for each hole
          holeScores.forEach((holeScore, index) => {
            if (holeScore === null || holeScore === 0) return

            if (ringerScorecard.holes[index] === null || holeScore < ringerScorecard.holes[index]) {
              ringerScorecard.holes[index] = holeScore
            }
          })

          netHoleScores.forEach((netHoleScore, index) => {
            if (netHoleScore === null || netHoleScore === 0) return

            if (ringerScorecard.netHoles[index] === null || netHoleScore < ringerScorecard.netHoles[index]) {
              ringerScorecard.netHoles[index] = netHoleScore
            }
          })
        }
      })
    })

    // Calculate averages for all players
    const playerAverages = []
    playerStatsMap.forEach((stats, userId) => {
      if (stats.rounds > 0) {
        const netAverage = stats.netTotalScore / stats.rounds
        playerAverages.push({ userId, netAverage })
      }
    })

    // Sort by net average to determine rank
    playerAverages.sort((a, b) => a.netAverage - b.netAverage)

    // Find player's rank
    playerRank = playerAverages.findIndex((p) => p.userId === playerId) + 1
    totalPlayers = playerAverages.length

    // Calculate player's average scores
    if (playerStats.rounds > 0) {
      playerStats.averageScore = playerStats.totalScore / playerStats.rounds
      playerStats.netAverageScore = playerStats.netTotalScore / playerStats.rounds
    }

    // Calculate ringer scorecard totals
    ringerScorecard.holesPlayed = ringerScorecard.holes.filter((h) => h !== null).length
    ringerScorecard.netHolesPlayed = ringerScorecard.netHoles.filter((h) => h !== null).length
    ringerScorecard.totalScore = ringerScorecard.holes.reduce((sum, h) => sum + (h || 0), 0)
    ringerScorecard.netTotalScore = ringerScorecard.netHoles.reduce((sum, h) => sum + (h || 0), 0)
  }

  // Calculate scoring statistics
  const scoringStats = {
    holeInOne: 0,
    albatross: 0,
    eagle: 0,
    birdie: 0,
    par: 0,
    bogey: 0,
    doubleBogey: 0,
    tripleBogey: 0,
    quadrupleBogey: 0,
    totalHoles: 0,
  }

  // Process all rounds for scoring statistics
  if (playerScores) {
    playerScores.forEach((score) => {
      const holeScores = [
        score.hole_1,
        score.hole_2,
        score.hole_3,
        score.hole_4,
        score.hole_5,
        score.hole_6,
        score.hole_7,
        score.hole_8,
        score.hole_9,
        score.hole_10,
        score.hole_11,
        score.hole_12,
        score.hole_13,
        score.hole_14,
        score.hole_15,
        score.hole_16,
        score.hole_17,
        score.hole_18,
      ]

      holeScores.forEach((holeScore, index) => {
        if (holeScore === null || holeScore === 0) return

        const par = courseData.pars[index]
        const scoreToPar = holeScore - par
        scoringStats.totalHoles += 1

        if (holeScore === 1) {
          scoringStats.holeInOne += 1
        } else if (scoreToPar === -3) {
          scoringStats.albatross += 1
        } else if (scoreToPar === -2) {
          scoringStats.eagle += 1
        } else if (scoreToPar === -1) {
          scoringStats.birdie += 1
        } else if (scoreToPar === 0) {
          scoringStats.par += 1
        } else if (scoreToPar === 1) {
          scoringStats.bogey += 1
        } else if (scoreToPar === 2) {
          scoringStats.doubleBogey += 1
        } else if (scoreToPar === 3) {
          scoringStats.tripleBogey += 1
        } else if (scoreToPar >= 4) {
          scoringStats.quadrupleBogey += 1
        }
      })
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {player.profile_picture_url ? (
                <Image
                  src={player.profile_picture_url || "/placeholder.svg"}
                  alt={`${player.name}'s profile picture`}
                  width={80}
                  height={80}
                  className="rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{player.name}'s Stats</h1>
                <p className="text-muted-foreground">Player statistics and round history</p>
              </div>
            </div>
          </div>

          {/* Player Rank Card */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Player Ranking</CardTitle>
                <CardDescription>Current standing on the Tour Leaderboard</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                    <span className="text-2xl font-bold">{playerRank > 0 ? playerRank : "-"}</span>
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {playerRank > 0 ? `Ranked ${playerRank} of ${totalPlayers}` : "Not ranked yet"}
                    </p>
                    <p className="text-sm text-muted-foreground">Based on Net Average Score</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Rounds Played</p>
                    <p className="text-xl font-medium">{playerStats.rounds}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Strokes Given</p>
                    <p className="text-xl font-medium">{playerStats.strokesGiven}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Average</p>
                    <p className="text-xl font-medium">
                      {playerStats.rounds > 0 ? playerStats.netAverageScore.toFixed(1) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best Net Score</p>
                    <p className="text-xl font-medium">
                      {playerStats.netBestScore < Number.POSITIVE_INFINITY ? playerStats.netBestScore : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ringer Scorecard Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Ringer Pool Scorecard</CardTitle>
                <CardDescription>Best scores on each hole across all rounds</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Holes Completed</p>
                    <p className="text-xl font-medium">{ringerScorecard.netHolesPlayed}/18</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Ringer Score</p>
                    <p className="text-xl font-medium">{ringerScorecard.netTotalScore}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="px-1 py-2 text-left">Hole</th>
                        {courseData.holes.map((hole) => (
                          <th key={hole} className="px-1 py-2 text-center">
                            {hole}
                          </th>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <th className="px-1 py-2 text-left">Par</th>
                        {courseData.pars.map((par, i) => (
                          <td key={i} className="px-1 py-2 text-center text-muted-foreground">
                            {par}
                          </td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <th className="px-1 py-2 text-left">Net</th>
                        {ringerScorecard.netHoles.map((score, i) => {
                          const par = courseData.pars[i]
                          return (
                            <td key={i} className="px-1 py-2 text-center h-8">
                              {score !== null ? <ScoreIndicator score={score} par={par} /> : "-"}
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scoring Statistics */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Scoring Statistics</CardTitle>
              <CardDescription>Breakdown of scoring performance by hole (gross scores)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Hole in One</p>
                  <p className="text-lg font-medium">{scoringStats.holeInOne}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.holeInOne / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Albatross (-3)</p>
                  <p className="text-lg font-medium">{scoringStats.albatross}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.albatross / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Eagle (-2)</p>
                  <p className="text-lg font-medium">{scoringStats.eagle}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.eagle / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Birdie (-1)</p>
                  <p className="text-lg font-medium">{scoringStats.birdie}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.birdie / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Par (Even)</p>
                  <p className="text-lg font-medium">{scoringStats.par}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.par / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Bogey (+1)</p>
                  <p className="text-lg font-medium">{scoringStats.bogey}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.bogey / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Double Bogey (+2)</p>
                  <p className="text-lg font-medium">{scoringStats.doubleBogey}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.doubleBogey / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Triple Bogey (+3)</p>
                  <p className="text-lg font-medium">{scoringStats.tripleBogey}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.tripleBogey / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>

                <div className="text-center p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Quadruple+ Bogey (+4 or more)</p>
                  <p className="text-lg font-medium">{scoringStats.quadrupleBogey}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringStats.totalHoles > 0
                      ? ((scoringStats.quadrupleBogey / scoringStats.totalHoles) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Holes Played</p>
                  <p className="text-2xl font-bold">{scoringStats.totalHoles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Round History */}
          <Card>
            <CardHeader>
              <CardTitle>Round History</CardTitle>
              <CardDescription>All rounds played by {player.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="net" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="net">Net Scores</TabsTrigger>
                  <TabsTrigger value="gross">Gross Scores</TabsTrigger>
                </TabsList>

                <TabsContent value="net">
                  {playerScores && playerScores.length > 0 ? (
                    <div className="space-y-6">
                      {playerScores.map((score) => {
                        if (!score.rounds) return null

                        const roundDate = new Date(score.rounds.date)
                        const netScore = score.net_total_score || score.total_score - (score.strokes_given || 0)

                        return (
                          <Card key={score.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 py-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                  <CardTitle className="text-lg">{format(roundDate, "MMMM d, yyyy")}</CardTitle>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="h-4 w-4" />
                                  <span>Submitted by {score.rounds.users?.name || "Unknown"}</span>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Net Score</p>
                                  <p className="text-xl font-medium">{netScore}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Gross Score</p>
                                  <p className="text-xl font-medium">{score.total_score}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Strokes Given</p>
                                  <p className="text-xl font-medium">{score.strokes_given || 0}</p>
                                </div>
                                <div className="flex items-end">
                                  <Link
                                    href={`/scores/rounds/${score.round_id}?from=player&playerId=${playerId}&playerName=${encodeURIComponent(player.name)}`}
                                    className="text-primary hover:underline"
                                  >
                                    View Full Scorecard
                                  </Link>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No rounds found for this player.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="gross">
                  {playerScores && playerScores.length > 0 ? (
                    <div className="space-y-6">
                      {playerScores.map((score) => {
                        if (!score.rounds) return null

                        const roundDate = new Date(score.rounds.date)

                        return (
                          <Card key={score.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 py-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                  <CardTitle className="text-lg">{format(roundDate, "MMMM d, yyyy")}</CardTitle>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="h-4 w-4" />
                                  <span>Submitted by {score.rounds.users?.name || "Unknown"}</span>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Gross Score</p>
                                  <p className="text-xl font-medium">{score.total_score}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">To Par</p>
                                  <p className="text-xl font-medium">{score.total_score - courseData.totalPar}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Strokes Given</p>
                                  <p className="text-xl font-medium">{score.strokes_given || 0}</p>
                                </div>
                                <div className="flex items-end">
                                  <Link
                                    href={`/scores/rounds/${score.round_id}?from=player&playerId=${playerId}&playerName=${encodeURIComponent(player.name)}`}
                                    className="text-primary hover:underline"
                                  >
                                    View Full Scorecard
                                  </Link>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No rounds found for this player.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
