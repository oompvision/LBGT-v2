"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"

// Updated course data with correct par values
const courseData = {
  holes: Array.from({ length: 18 }, (_, i) => i + 1),
  pars: [4, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  frontNinePar: 36,
  backNinePar: 36,
  totalPar: 72,
}

export function LeagueStats({ rounds }) {
  const [sortBy, setSortBy] = useState("netAverage")

  // Process all scores from all rounds
  const playerStats = {}

  // Process all rounds and scores
  rounds.forEach((round) => {
    if (!Array.isArray(round.scores)) return

    round.scores.forEach((score) => {
      const userId = score.user_id
      const playerName = score.users?.name || "Unknown Player"

      if (!playerStats[userId]) {
        playerStats[userId] = {
          name: playerName,
          rounds: 0,
          totalScore: 0,
          bestScore: Number.POSITIVE_INFINITY,
          worstScore: 0,
          netTotalScore: 0,
          netBestScore: Number.POSITIVE_INFINITY,
          netWorstScore: 0,
          strokesGiven: score.strokes_given || 0,
        }
      }

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
      const netScore = score.net_total_score || score.total_score - (score.strokes_given || 0)
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
    const toPar = averageScore - courseData.totalPar
    const netToPar = netAverageScore - courseData.totalPar

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
      strokesGiven: stats.strokesGiven,
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
        <CardTitle>League Leaderboard</CardTitle>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Rank</th>
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Player</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium hidden sm:table-cell">Rounds</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Net Avg</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">To Par</th>
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
                          <td className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm">{player.name}</td>
                          <td className="px-2 sm:px-4 py-2 text-center hidden sm:table-cell">{player.rounds}</td>
                          <td className="px-2 sm:px-4 py-2 text-center">{player.netAverageScore}</td>
                          <td className="px-2 sm:px-4 py-2 text-center">
                            {Number.parseFloat(player.netToPar) > 0 ? `+${player.netToPar}` : player.netToPar}
                          </td>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Rank</th>
                      <th className="px-2 sm:px-4 py-2 text-left font-medium">Player</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium hidden sm:table-cell">Rounds</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">Avg Score</th>
                      <th className="px-2 sm:px-4 py-2 text-center font-medium">To Par</th>
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
                        <td className="px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm">{player.name}</td>
                        <td className="px-2 sm:px-4 py-2 text-center hidden sm:table-cell">{player.rounds}</td>
                        <td className="px-2 sm:px-4 py-2 text-center">{player.averageScore}</td>
                        <td className="px-2 sm:px-4 py-2 text-center">
                          {Number.parseFloat(player.toPar) > 0 ? `+${player.toPar}` : player.toPar}
                        </td>
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
