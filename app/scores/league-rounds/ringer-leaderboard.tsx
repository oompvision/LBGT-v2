"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

// Updated course data with correct par values
const courseData = {
  holes: Array.from({ length: 18 }, (_, i) => i + 1),
  pars: [4, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  frontNinePar: 36,
  backNinePar: 36,
  totalPar: 72,
}

export function RingerLeaderboard({ rounds }) {
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

  // Process all scores from all rounds to create ringer scores
  const playerRingerScores = {}

  // Process all rounds and scores
  rounds.forEach((round) => {
    if (!Array.isArray(round.scores)) return

    round.scores.forEach((score) => {
      const userId = score.user_id
      const playerName = score.users?.name || "Unknown Player"

      if (!playerRingerScores[userId]) {
        playerRingerScores[userId] = {
          name: playerName,
          userId: userId, // Store userId for linking to player stats
          holes: Array(18).fill(null), // Best net score for each hole
          roundsPlayed: 0,
          strokesGiven: usersWithHandicap[userId] || 0,
        }
      }

      // Update strokes given from our fetched data
      playerRingerScores[userId].strokesGiven = usersWithHandicap[userId] || 0

      // Update rounds played
      playerRingerScores[userId].roundsPlayed += 1

      // Update best NET scores for each hole
      const netHoleScores = [
        score.net_hole_1,
        score.net_hole_2,
        score.net_hole_3,
        score.net_hole_4,
        score.net_hole_5,
        score.net_hole_6,
        score.net_hole_7,
        score.net_hole_8,
        score.net_hole_9,
        score.net_hole_10,
        score.net_hole_11,
        score.net_hole_12,
        score.net_hole_13,
        score.net_hole_14,
        score.net_hole_15,
        score.net_hole_16,
        score.net_hole_17,
        score.net_hole_18,
      ]

      netHoleScores.forEach((netHoleScore, index) => {
        // Skip if no net score for this hole
        if (!netHoleScore) return

        // Update if this is the first score or better than previous best
        if (
          playerRingerScores[userId].holes[index] === null ||
          netHoleScore < playerRingerScores[userId].holes[index]
        ) {
          playerRingerScores[userId].holes[index] = netHoleScore
        }
      })
    })
  })

  // Calculate total ringer scores and to par
  const ringerLeaderboard = Object.entries(playerRingerScores).map(([userId, data]) => {
    // Calculate total of best net scores, ignoring null values
    const validScores = data.holes.filter((score) => score !== null)
    const totalRingerScore = validScores.reduce((sum, score) => sum + score, 0)

    // Calculate how many holes have been played
    const holesPlayed = validScores.length

    // Calculate to par based on holes played
    const parForHolesPlayed = data.holes
      .map((score, index) => (score !== null ? courseData.pars[index] : 0))
      .reduce((sum, par) => sum + par, 0)

    const toPar = totalRingerScore - parForHolesPlayed

    return {
      userId,
      name: data.name,
      holes: data.holes,
      totalRingerScore,
      holesPlayed,
      toPar,
      roundsPlayed: data.roundsPlayed,
      strokesGiven: data.strokesGiven,
    }
  })

  // Sort by total ringer score (ascending)
  const sortedRingerLeaderboard = [...ringerLeaderboard]
    .filter((player) => player.holesPlayed > 0) // Only include players who have played at least one hole
    .sort((a, b) => {
      // First sort by holes played (descending)
      if (b.holesPlayed !== a.holesPlayed) {
        return b.holesPlayed - a.holesPlayed
      }
      // Then sort by to par (ascending)
      return a.toPar - b.toPar
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ringer Pool Leaderboard</CardTitle>
        <CardDescription>Best net score on each hole across all rounds played</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Rank</th>
                <th className="px-4 py-2 text-left font-medium">Player</th>
                <th className="px-4 py-2 text-center font-medium">Rounds</th>
                <th className="px-4 py-2 text-center font-medium">Holes</th>
                <th className="px-4 py-2 text-center font-medium">Net Score</th>
                <th className="px-4 py-2 text-center font-medium">Strokes</th>
                {courseData.holes.map((hole) => (
                  <th key={hole} className="px-2 py-2 text-center font-medium">
                    {hole}
                  </th>
                ))}
              </tr>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium" colSpan={6}></th>
                {courseData.pars.map((par, index) => (
                  <td key={index} className="px-2 py-2 text-center text-xs text-muted-foreground">
                    {par}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRingerLeaderboard.map((player, index) => (
                <tr key={player.userId} className="border-b">
                  <td className="px-4 py-2">
                    {index === 0 ? (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600">
                        <Trophy className="mr-1 h-3 w-3" />
                        {index + 1}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{index + 1}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/players/${player.userId}/stats`} className="hover:underline text-primary">
                      {player.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-center">{player.roundsPlayed}</td>
                  <td className="px-4 py-2 text-center">{player.holesPlayed}/18</td>
                  <td className="px-4 py-2 text-center">{player.totalRingerScore}</td>
                  <td className="px-4 py-2 text-center">{player.strokesGiven}</td>
                  {player.holes.map((score, holeIndex) => {
                    // Calculate if the score is under, over, or at par
                    const par = courseData.pars[holeIndex]
                    let scoreClass = ""

                    if (score !== null) {
                      if (score < par) scoreClass = "text-green-600 font-medium"
                      else if (score > par) scoreClass = "text-red-600 font-medium"
                    }

                    return (
                      <td key={holeIndex} className={`px-2 py-2 text-center ${scoreClass}`}>
                        {score !== null ? score : "-"}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
