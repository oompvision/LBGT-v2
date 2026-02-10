export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getRoundDetails } from "@/app/actions/scores"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CalendarIcon, User } from "lucide-react"
import { format } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RoundScore {
  id: string
  user_id: string
  users: { name: string }
  rounds: { date: string; users: { name: string } }
  strokes_given: number
  total_score: number
  net_total_score: number | null
  hole_1: number; hole_2: number; hole_3: number; hole_4: number; hole_5: number; hole_6: number
  hole_7: number; hole_8: number; hole_9: number; hole_10: number; hole_11: number; hole_12: number
  hole_13: number; hole_14: number; hole_15: number; hole_16: number; hole_17: number; hole_18: number
  net_hole_1: number | null; net_hole_2: number | null; net_hole_3: number | null
  net_hole_4: number | null; net_hole_5: number | null; net_hole_6: number | null
  net_hole_7: number | null; net_hole_8: number | null; net_hole_9: number | null
  net_hole_10: number | null; net_hole_11: number | null; net_hole_12: number | null
  net_hole_13: number | null; net_hole_14: number | null; net_hole_15: number | null
  net_hole_16: number | null; net_hole_17: number | null; net_hole_18: number | null
  line_17: number
}

// Update the courseData object with the correct par values
const courseData = {
  holes: Array.from({ length: 18 }, (_, i) => i + 1),
  pars: [4, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  whiteHdcp: [13, 9, 15, 5, 1, 17, 3, 11, 7, 12, 16, 2, 10, 8, 14, 18, 6, 4], // White Handicap values
  frontNinePar: 36,
  backNinePar: 36,
  totalPar: 72,
}

// Golf score indicator components
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
        <span className="text-black">{score}</span>
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
        <span className="text-black">{score}</span>
      </div>
    )
  }

  // Par (no indicator)
  if (diff === 0) {
    return <span className="text-black">{score}</span>
  }

  // Bogey (single square)
  if (diff === 1) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" className="absolute">
          <rect x="2" y="2" width="20" height="20" fill="none" stroke="red" strokeWidth="1" />
        </svg>
        <span className="text-black">{score}</span>
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
        <span className="text-black">{score}</span>
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
        <span className="text-black">{score}</span>
      </div>
    )
  }

  // Fallback
  return <span className="text-black">{score}</span>
}

// Net score indicator component
const NetScoreIndicator = ({ netScore, par }: { netScore: number; par: number }) => {
  if (netScore === null || netScore === undefined) return <>{"-"}</>

  // Calculate the difference from par
  const diff = netScore - par

  // Eagle or better (double circle)
  if (diff <= -2) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" className="absolute">
          <circle cx="14" cy="14" r="12" fill="none" stroke="green" strokeWidth="1" />
          <circle cx="14" cy="14" r="9" fill="none" stroke="green" strokeWidth="1" />
        </svg>
        <span className="text-black">{netScore}</span>
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
        <span className="text-black">{netScore}</span>
      </div>
    )
  }

  // Par (no indicator)
  if (diff === 0) {
    return <span className="text-black">{netScore}</span>
  }

  // Bogey (single square)
  if (diff === 1) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" className="absolute">
          <rect x="2" y="2" width="20" height="20" fill="none" stroke="red" strokeWidth="1" />
        </svg>
        <span className="text-black">{netScore}</span>
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
        <span className="text-black">{netScore}</span>
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
        <span className="text-black">{netScore}</span>
      </div>
    )
  }

  // Fallback
  return <span className="text-black">{netScore}</span>
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RoundDetailsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return notFound()
  }

  // Get round details
  const { scores } = (await getRoundDetails(resolvedParams.id)) as { scores: RoundScore[] }

  if (!scores || scores.length === 0) {
    return notFound()
  }

  // Get round date and submitter from the first score
  const roundDate = scores[0].rounds.date
  const submittedBy = scores[0].rounds.users.name

  // Check if we came from a player stats page
  const fromPlayer = resolvedSearchParams?.from === "player"
  const playerId = resolvedSearchParams?.playerId as string
  const playerName = resolvedSearchParams?.playerName as string

  // Determine back link and text
  const backHref = fromPlayer && playerId ? `/players/${playerId}/stats` : "/scores/my-rounds"
  const backText = fromPlayer && playerName ? `Back to ${decodeURIComponent(playerName)}'s Stats` : "Back to My Rounds"

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-4">
            <Link href={backHref}>
              <Button variant="ghost" className="pl-0">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backText}
              </Button>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Round Details</h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(new Date(roundDate), "MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Submitted by {submittedBy}</span>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Scorecard</CardTitle>
              <CardDescription>Scores for all players in this round</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="gross" className="w-full">
                <div className="px-4 pt-2">
                  <TabsList className="grid w-[200px] grid-cols-2">
                    <TabsTrigger value="gross">Gross Scores</TabsTrigger>
                    <TabsTrigger value="net">Net Scores</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="gross" className="mt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-white text-black">
                          <th className="px-4 py-2 text-left font-medium border-r border-gray-300 w-40">Hole</th>
                          {courseData.holes.map((hole) => (
                            <th key={hole} className="px-2 py-2 text-center font-medium border-r border-gray-300 w-12">
                              {hole}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center font-medium border-r border-gray-300 w-16">Out</th>
                          <th className="px-2 py-2 text-center font-medium border-r border-gray-300 w-16">In</th>
                          <th className="px-2 py-2 text-center font-medium w-16">Total</th>
                        </tr>
                        <tr className="border-b text-white">
                          <th
                            className="px-4 py-2 text-left font-medium border-r border-gray-300"
                            style={{ backgroundColor: "#2d4a2d" }}
                          >
                            Par
                          </th>
                          {courseData.pars.map((par, index) => (
                            <td
                              key={index}
                              className="px-2 py-2 text-center border-r border-gray-300 w-12"
                              style={{ backgroundColor: "#2d4a2d" }}
                            >
                              {par}
                            </td>
                          ))}
                          <td
                            className="px-2 py-2 text-center font-medium border-r border-gray-300"
                            style={{ backgroundColor: "#2d4a2d" }}
                          >
                            {courseData.frontNinePar}
                          </td>
                          <td
                            className="px-2 py-2 text-center font-medium border-r border-gray-300"
                            style={{ backgroundColor: "#2d4a2d" }}
                          >
                            {courseData.backNinePar}
                          </td>
                          <td className="px-2 py-2 text-center font-medium" style={{ backgroundColor: "#2d4a2d" }}>
                            {courseData.totalPar}
                          </td>
                        </tr>
                        <tr className="border-b bg-white text-black">
                          <th className="px-4 py-2 text-left font-medium border-r border-gray-300">Hdcp</th>
                          {courseData.whiteHdcp.map((hdcp, index) => (
                            <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12">
                              {hdcp}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300">-</td>
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300">-</td>
                          <td className="px-2 py-2 text-center font-medium">-</td>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((score, idx) => {
                          const playerScores = [
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

                          const frontNine = playerScores.slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)
                          const backNine = playerScores.slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)

                          // Alternate background colors for player rows
                          const bgColor = idx % 2 === 0 ? "bg-gray-100" : "bg-white"

                          return (
                            <tr key={score.id} className={`border-b ${bgColor} text-black h-12`}>
                              <td className="px-4 py-2 font-medium border-r border-gray-300">
                                {score.users.name}
                                {score.strokes_given > 0 && (
                                  <span className="ml-1 text-xs text-gray-600">({score.strokes_given})</span>
                                )}
                              </td>
                              {playerScores.map((holeScore, index) => {
                                const par = courseData.pars[index]
                                return (
                                  <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12">
                                    {holeScore !== null ? <ScoreIndicator score={holeScore} par={par} /> : "-"}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">
                                {frontNine}
                              </td>
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">
                                {backNine}
                              </td>
                              <td className="px-2 py-2 text-center font-medium text-black">{score.total_score}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="net" className="mt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-white text-black">
                          <th className="px-4 py-2 text-left font-medium border-r border-gray-300 w-40">Hole</th>
                          {courseData.holes.map((hole) => (
                            <th key={hole} className="px-2 py-2 text-center font-medium border-r border-gray-300 w-12">
                              {hole}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center font-medium border-r border-gray-300 w-16">Out</th>
                          <th className="px-2 py-2 text-center font-medium border-r border-gray-300 w-16">In</th>
                          <th className="px-2 py-2 text-center font-medium w-16">Total</th>
                        </tr>
                        <tr className="border-b text-white">
                          <th
                            className="px-4 py-2 text-left font-medium border-r border-gray-300"
                            style={{ backgroundColor: "#2d4a2d" }}
                          >
                            Par
                          </th>
                          {courseData.pars.map((par, index) => (
                            <td
                              key={index}
                              className="px-2 py-2 text-center border-r border-gray-300 w-12"
                              style={{ backgroundColor: "#2d4a2d" }}
                            >
                              {par}
                            </td>
                          ))}
                          <td
                            className="px-2 py-2 text-center font-medium border-r border-gray-300"
                            style={{ backgroundColor: "#2d4a2d" }}
                          >
                            {courseData.frontNinePar}
                          </td>
                          <td
                            className="px-2 py-2 text-center font-medium border-r border-gray-300"
                            style={{ backgroundColor: "#2d4a2d" }}
                          >
                            {courseData.backNinePar}
                          </td>
                          <td className="px-2 py-2 text-center font-medium" style={{ backgroundColor: "#2d4a2d" }}>
                            {courseData.totalPar}
                          </td>
                        </tr>
                        <tr className="border-b bg-white text-black">
                          <th className="px-4 py-2 text-left font-medium border-r border-gray-300">Hdcp</th>
                          {courseData.whiteHdcp.map((hdcp, index) => (
                            <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12">
                              {hdcp}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300">-</td>
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300">-</td>
                          <td className="px-2 py-2 text-center font-medium">-</td>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((score, idx) => {
                          // Only show net scores if strokes_given > 0
                          if (score.strokes_given <= 0) {
                            return null
                          }

                          const netScores = [
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
                            score.net_hole_17 !== null ? score.net_hole_17 : score.line_17,
                            score.net_hole_18 !== null ? score.net_hole_18 : score.hole_18,
                          ]

                          const frontNine = netScores.slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)
                          const backNine = netScores.slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)
                          const totalNet = score.net_total_score || frontNine + backNine

                          // Alternate background colors for player rows
                          const bgColor = idx % 2 === 0 ? "bg-gray-100" : "bg-white"

                          return (
                            <tr key={`net-${score.id}`} className={`border-b ${bgColor} text-black h-12`}>
                              <td className="px-4 py-2 font-medium border-r border-gray-300">
                                {score.users.name}
                                <span className="ml-1 text-xs text-gray-600">({score.strokes_given})</span>
                              </td>
                              {netScores.map((netScore, index) => {
                                const par = courseData.pars[index]
                                return (
                                  <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12">
                                    {netScore !== null ? <NetScoreIndicator netScore={netScore} par={par} /> : "-"}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">
                                {frontNine}
                              </td>
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">
                                {backNine}
                              </td>
                              <td className="px-2 py-2 text-center font-medium text-black">{totalNet}</td>
                            </tr>
                          )
                        })}
                        {scores.filter((score) => score.strokes_given > 0).length === 0 && (
                          <tr>
                            <td colSpan={22} className="px-4 py-4 text-center text-gray-600">
                              No players with handicap strokes in this round
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
