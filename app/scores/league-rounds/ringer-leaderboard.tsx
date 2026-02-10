"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"

interface LeagueScore {
  user_id: string
  users?: { name: string }
  total_score: number
  net_total_score: number | null
  net_hole_1: number | null; net_hole_2: number | null; net_hole_3: number | null
  net_hole_4: number | null; net_hole_5: number | null; net_hole_6: number | null
  net_hole_7: number | null; net_hole_8: number | null; net_hole_9: number | null
  net_hole_10: number | null; net_hole_11: number | null; net_hole_12: number | null
  net_hole_13: number | null; net_hole_14: number | null; net_hole_15: number | null
  net_hole_16: number | null; net_hole_17: number | null; net_hole_18: number | null
}

interface LeagueRound {
  id: string
  date: string
  scores: LeagueScore[]
}

interface PlayerRingerData {
  name: string
  userId: string
  holes: (number | null)[]
  roundsPlayed: number
  strokesGiven: number
}

import { COURSE_DATA } from "@/lib/constants"

// Score indicator component for the ringer leaderboard
const ScoreIndicator = ({ score, par }: { score: number; par: number }) => {
  if (score === null || score === undefined) return <>{"-"}</>

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

// Format player name as First Initial. Last Name (strokes)
const formatPlayerName = (fullName: string, strokes: number) => {
  if (!fullName) return "Unknown Player"

  const nameParts = fullName.trim().split(" ")
  if (nameParts.length === 1) return `${nameParts[0]} (${strokes})`

  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  const firstInitial = firstName.charAt(0)

  return `${firstInitial}. ${lastName} (${strokes})`
}

export function RingerLeaderboard({ rounds }: { rounds: LeagueRound[] }) {
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
  const playerRingerScores: Record<string, PlayerRingerData> = {}

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
          netHoleScore < playerRingerScores[userId].holes[index]!
        ) {
          playerRingerScores[userId].holes[index] = netHoleScore
        }
      })
    })
  })

  // Calculate total ringer scores and to par
  const ringerLeaderboard = Object.entries(playerRingerScores).map(([userId, data]) => {
    // Calculate total of best net scores, ignoring null values
    const validScores = data.holes.filter((score): score is number => score !== null)
    const totalRingerScore = validScores.reduce((sum, score) => sum + score, 0)

    // Calculate how many holes have been played
    const holesPlayed = validScores.length

    // Calculate to par based on holes played
    const parForHolesPlayed = data.holes
      .map((score, index) => (score !== null ? COURSE_DATA.pars[index] : 0))
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
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-20" />
              <col className="w-40" />
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-20" />
              {Array.from({ length: 18 }, (_, i) => (
                <col key={i} className="w-12" />
              ))}
            </colgroup>
            <thead>
              {/* First row - Logo and hole numbers */}
              <tr className="border-b bg-white text-black h-16">
                <td rowSpan={2} colSpan={4} className="px-4 py-2 text-center bg-transparent relative">
                  <div className="flex items-center justify-center h-full bg-transparent">
                    <Image
                      src="/images/osprey-logo.png"
                      alt="LBGT Logo"
                      width={100}
                      height={100}
                      className="object-contain bg-transparent"
                    />
                  </div>
                </td>
                <th className="px-4 py-2 text-center font-medium border-l border-gray-300">Hole</th>
                {COURSE_DATA.holes.map((hole, index) => (
                  <th
                    key={hole}
                    className={`px-2 py-2 text-center font-medium ${index < 17 ? "border-r border-gray-300" : ""}`}
                  >
                    {hole}
                  </th>
                ))}
              </tr>

              {/* Second row - Par values */}
              <tr className="border-b h-16">
                <td
                  className="px-4 py-2 text-center font-medium border-l border-gray-300 text-white"
                  style={{ backgroundColor: "#2d4a2d" }}
                >
                  Par
                </td>
                {COURSE_DATA.pars.map((par, index) => (
                  <td
                    key={index}
                    className={`px-2 py-2 text-center text-white ${index < 17 ? "border-r border-gray-300" : ""}`}
                    style={{ backgroundColor: "#2d4a2d" }}
                  >
                    {par}
                  </td>
                ))}
              </tr>

              {/* Third row - Column headers and handicap */}
              <tr className="border-b bg-white text-black h-16">
                <th className="px-4 py-2 text-left font-medium border-r border-gray-300">Rank</th>
                <th className="px-4 py-2 text-left font-medium border-r border-gray-300">Player</th>
                <th className="px-4 py-2 text-center font-medium border-r border-gray-300">Score</th>
                <th className="px-4 py-2 text-center font-medium border-r border-gray-300">Rounds</th>
                <th className="px-4 py-2 text-center font-medium border-r border-gray-300">Hdcp</th>
                {COURSE_DATA.whiteHdcp.map((hdcp, index) => (
                  <td key={index} className={`px-2 py-2 text-center ${index < 17 ? "border-r border-gray-300" : ""}`}>
                    {hdcp}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRingerLeaderboard.map((player, index) => (
                <tr
                  key={player.userId}
                  className={`border-b h-16 ${index % 2 === 0 ? "bg-gray-100" : "bg-white"} text-black`}
                >
                  <td className="px-4 py-2 border-r border-gray-300">
                    {index === 0 ? (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600">
                        <Trophy className="mr-1 h-3 w-3" />
                        {index + 1}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-black">
                        {index + 1}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium border-r border-gray-300 overflow-hidden">
                    <div className="truncate">
                      <Link href={`/players/${player.userId}/stats`} className="hover:underline text-black">
                        {formatPlayerName(player.name, player.strokesGiven)}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center border-r border-gray-300">{player.totalRingerScore}</td>
                  <td className="px-4 py-2 text-center border-r border-gray-300">{player.roundsPlayed}</td>
                  <td className="px-4 py-2 text-center border-r border-gray-300"></td>
                  {player.holes.map((score, holeIndex) => {
                    const par = COURSE_DATA.pars[holeIndex]
                    return (
                      <td
                        key={holeIndex}
                        className={`px-2 py-2 text-center ${holeIndex < 17 ? "border-r border-gray-300" : ""}`}
                      >
                        {score !== null ? <ScoreIndicator score={score} par={par} /> : "-"}
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
