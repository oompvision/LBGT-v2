"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface LeagueScore {
  user_id: string
  users?: { name: string }
  total_score: number
  net_total_score: number | null
}

interface LeagueRound {
  id: string
  date: string
  scores: LeagueScore[]
}

interface PlayerStatData {
  name: string
  userId: string
  rounds: number
  totalScore: number
  bestScore: number
  worstScore: number
  netTotalScore: number
  netBestScore: number
  netWorstScore: number
  strokesGiven: number
}

import { COURSE_DATA } from "@/lib/constants"

export function LeagueStats({ rounds }: { rounds: LeagueRound[] }) {
  const [sortBy, setSortBy] = useState("netAverage")
  const [usersWithHandicap, setUsersWithHandicap] = useState<Record<string, number>>({})
  const supabase = createClient()

  // Fetch user handicaps directly from users table
  useEffect(() => {
    const fetchUserHandicaps = async () => {
      try {
        // Get all unique user IDs from the rounds data
        const userIds = new Set()
        rounds.forEach((round) => {
          if (Array.isArray(round.scores)) {
            round.scores.forEach((score) => {
              if (score.user_id) {
                userIds.add(score.user_id)
              }
            })
          }
        })

        if (userIds.size === 0) return

        const { data, error } = await supabase.from("users").select("id, strokes_given").in("id", Array.from(userIds))

        if (error) {
          console.error("Error fetching user handicaps:", error)
          return
        }

        const handicaps: Record<string, number> = {}
        data.forEach((user) => {
          handicaps[user.id] = user.strokes_given || 0
        })

        setUsersWithHandicap(handicaps)
      } catch (err) {
        console.error("Error in fetchUserHandicaps:", err)
      }
    }

    if (rounds && rounds.length > 0) {
      fetchUserHandicaps()
    }
  }, [supabase, rounds])

  // Process all scores from all rounds
  const playerStats: Record<string, PlayerStatData> = {}

  // Process all rounds and scores
  rounds.forEach((round) => {
    if (!Array.isArray(round.scores)) return

    round.scores.forEach((score) => {
      const userId = score.user_id
      const playerName = score.users?.name || "Unknown Player"

      if (!playerStats[userId]) {
        playerStats[userId] = {
          name: playerName,
          userId: userId, // Store userId for linking to player stats
          rounds: 0,
          totalScore: 0,
          bestScore: Number.POSITIVE_INFINITY,
          worstScore: 0,
          netTotalScore: 0,
          netBestScore: Number.POSITIVE_INFINITY,
          netWorstScore: 0,
          strokesGiven: usersWithHandicap[userId] || 0,
        }
      }

      // Update strokes given from our fetched data
      playerStats[userId].strokesGiven = usersWithHandicap[userId] || 0

      // Update gross score stats
      playerStats[userId].rounds += 1
      playerStats[userId].totalScore += score.total_score || 0

      if ((score.total_score || 0) < playerStats[userId].bestScore) {
        playerStats[userId].bestScore = score.total_score || 0
      }

      if ((score.total_score || 0) > playerStats[userId].worstScore) {
        playerStats[userId].worstScore = score.total_score || 0
      }

      // Update net score stats if available
      const netScore = score.net_total_score || score.total_score - (usersWithHandicap[userId] || 0)
      playerStats[userId].netTotalScore += netScore

      if (netScore < playerStats[userId].netBestScore) {
        playerStats[userId].netBestScore = netScore
      }

      if (netScore > playerStats[userId].netWorstScore) {
        playerStats[userId].netWorstScore = netScore
      }
    })
  })

  // Convert to array and calculate averages
  const playerStatsArray = Object.entries(playerStats).map(([userId, stats]) => {
    const averageScore = stats.rounds > 0 ? stats.totalScore / stats.rounds : 0
    const netAverageScore = stats.rounds > 0 ? stats.netTotalScore / stats.rounds : 0

    // Calculate to par values
    const toPar = averageScore - COURSE_DATA.totalPar
    const netToPar = netAverageScore - COURSE_DATA.totalPar

    return {
      userId,
      name: stats.name,
      rounds: stats.rounds,
      averageScore: averageScore.toFixed(1),
      bestScore: stats.bestScore === Number.POSITIVE_INFINITY ? 0 : stats.bestScore,
      worstScore: stats.worstScore,
      toPar: toPar.toFixed(1),
      netAverageScore: netAverageScore.toFixed(1),
      netBestScore: stats.netBestScore === Number.POSITIVE_INFINITY ? 0 : stats.netBestScore,
      netWorstScore: stats.netWorstScore,
      netToPar: netToPar.toFixed(1),
      strokesGiven: usersWithHandicap[userId] || 0,
    }
  })

  // Sort players based on selected criteria
  const sortedPlayers = [...playerStatsArray].sort((a, b) => {
    switch (sortBy) {
      case "average":
        return Number.parseFloat(a.averageScore) - Number.parseFloat(b.averageScore)
      case "best":
        return a.bestScore - b.bestScore
      case "netAverage":
        return Number.parseFloat(a.netAverageScore) - Number.parseFloat(b.netAverageScore)
      case "netBest":
        return a.netBestScore - b.netBestScore
      default:
        return Number.parseFloat(a.netAverageScore) - Number.parseFloat(b.netAverageScore)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tour Leaderboard</CardTitle>
        <CardDescription>Player statistics across all rounds</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="net" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="net">Net Scores</TabsTrigger>
            <TabsTrigger value="gross">Gross Scores</TabsTrigger>
          </TabsList>

          <TabsContent value="net">
            <div className="flex justify-end mb-2">
              <Tabs
                value={sortBy === "netAverage" || sortBy === "netBest" ? sortBy : "netAverage"}
                onValueChange={(value) => setSortBy(value)}
              >
                <TabsList>
                  <TabsTrigger value="netAverage">Sort by Net Average</TabsTrigger>
                  <TabsTrigger value="netBest">Sort by Net Best</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="overflow-x-auto">
              <div className="rounded-md border min-w-full">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Rank</th>
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Player</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium hidden sm:table-cell">Rounds</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Net Avg</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Strokes</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Best</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium hidden sm:table-cell">Worst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers
                      .filter((player) => player.rounds > 0) // Only show players with rounds
                      .map((player, index) => (
                        <tr key={player.userId} className="border-b">
                          <td className="px-2 sm:px-4 py-2">
                            {index === 0 ? (
                              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
                                <Trophy className="mr-1 h-3 w-3" />
                                {index + 1}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {index + 1}
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm">
                            <Link href={`/players/${player.userId}/stats`} className="hover:underline text-primary">
                              {player.name}
                            </Link>
                          </td>
                          <td className="px-2 sm:px-4 py-2 text-center hidden sm:table-cell">{player.rounds}</td>
                          <td className="px-2 sm:px-4 py-2 text-center">{player.netAverageScore}</td>
                          <td className="px-2 sm:px-4 py-2 text-center">{player.strokesGiven}</td>
                          <td className="px-2 sm:px-4 py-2 text-center">{player.netBestScore}</td>
                          <td className="px-2 sm:px-4 py-2 text-center hidden sm:table-cell">{player.netWorstScore}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gross">
            <div className="flex justify-end mb-2">
              <Tabs
                value={sortBy === "average" || sortBy === "best" ? sortBy : "average"}
                onValueChange={(value) => setSortBy(value)}
              >
                <TabsList>
                  <TabsTrigger value="average">Sort by Average</TabsTrigger>
                  <TabsTrigger value="best">Sort by Best Round</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="overflow-x-auto">
              <div className="rounded-md border min-w-full">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Rank</th>
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Player</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium hidden sm:table-cell">Rounds</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Avg Score</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Strokes</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Best</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium hidden sm:table-cell">Worst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((player, index) => (
                      <tr key={player.userId} className="border-b">
                        <td className="px-2 sm:px-4 py-2">
                          {index === 0 ? (
                            <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
                              <Trophy className="mr-1 h-3 w-3" />
                              {index + 1}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {index + 1}
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm">
                          <Link href={`/players/${player.userId}/stats`} className="hover:underline text-primary">
                            {player.name}
                          </Link>
                        </td>
                        <td className="px-2 sm:px-4 py-2 text-center hidden sm:table-cell">{player.rounds}</td>
                        <td className="px-2 sm:px-4 py-2 text-center">{player.averageScore}</td>
                        <td className="px-2 sm:px-4 py-2 text-center">{player.strokesGiven}</td>
                        <td className="px-2 sm:px-4 py-2 text-center">{player.bestScore}</td>
                        <td className="px-2 sm:px-4 py-2 text-center hidden sm:table-cell">{player.worstScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
