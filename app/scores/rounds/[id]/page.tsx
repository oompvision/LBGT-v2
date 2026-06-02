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

import { COURSE_DATA } from "@/lib/constants"

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

// Format player name as initials for mobile columns
const toInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 5)
  const first = parts[0][0].toUpperCase() + "."
  const last = parts[parts.length - 1].slice(0, 3) + "."
  return `${first} ${last}`
}

// Mobile vertical scorecard component
function MobileScorecard({ scores, type }: { scores: RoundScore[]; type: "gross" | "net" }) {
  const filteredScores = type === "net" ? scores.filter((s) => s.strokes_given > 0) : scores

  if (filteredScores.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-gray-600">
        No players with handicap strokes in this round
      </p>
    )
  }

  const getScores = (score: RoundScore): number[] => {
    if (type === "gross") {
      return [
        score.hole_1, score.hole_2, score.hole_3, score.hole_4, score.hole_5, score.hole_6,
        score.hole_7, score.hole_8, score.hole_9, score.hole_10, score.hole_11, score.hole_12,
        score.hole_13, score.hole_14, score.hole_15, score.hole_16, score.hole_17, score.hole_18,
      ]
    }
    return [
      score.net_hole_1 ?? score.hole_1, score.net_hole_2 ?? score.hole_2, score.net_hole_3 ?? score.hole_3,
      score.net_hole_4 ?? score.hole_4, score.net_hole_5 ?? score.hole_5, score.net_hole_6 ?? score.hole_6,
      score.net_hole_7 ?? score.hole_7, score.net_hole_8 ?? score.hole_8, score.net_hole_9 ?? score.hole_9,
      score.net_hole_10 ?? score.hole_10, score.net_hole_11 ?? score.hole_11, score.net_hole_12 ?? score.hole_12,
      score.net_hole_13 ?? score.hole_13, score.net_hole_14 ?? score.hole_14, score.net_hole_15 ?? score.hole_15,
      score.net_hole_16 ?? score.hole_16, score.net_hole_17 ?? score.line_17, score.net_hole_18 ?? score.hole_18,
    ]
  }

  const sum = (arr: number[], start: number, end: number) =>
    arr.slice(start, end).reduce((s, v) => s + (v || 0), 0)

  const renderScore = (val: number | null, par: number) => {
    if (val == null) return <>-</>
    if (type === "gross") return <ScoreIndicator score={val} par={par} />
    return <NetScoreIndicator netScore={val} par={par} />
  }

  return (
    <table className="w-full text-xs border-collapse">
      {/* Sticky header: Hole / Par / Player initials */}
      <thead className="sticky top-0 z-10">
        <tr className="border-b bg-white text-black">
          <th className="px-2 py-1.5 text-center font-medium w-10 border-r border-gray-300 text-white" style={{ backgroundColor: "#2d4a2d" }}>Hole</th>
          <th className="px-1 py-1.5 text-center font-medium w-8 border-r border-gray-300" style={{ backgroundColor: "#2d4a2d", color: "white" }}>Par</th>
          {filteredScores.map((s) => (
            <th key={s.id} className="px-1 py-1.5 text-center font-medium text-[10px] border-r border-gray-300 last:border-r-0">
              {toInitials(s.users.name)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* Front 9 */}
        {COURSE_DATA.holes.slice(0, 9).map((hole, holeIdx) => (
          <tr key={holeIdx} className={`border-b ${holeIdx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
            <td className="px-2 py-1.5 text-center font-medium text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{hole}</td>
            <td className="px-1 py-1.5 text-center text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.pars[holeIdx]}</td>
            {filteredScores.map((s) => (
              <td key={s.id} className="px-1 py-1 text-center border-r border-gray-300 last:border-r-0">
                {renderScore(getScores(s)[holeIdx], COURSE_DATA.pars[holeIdx])}
              </td>
            ))}
          </tr>
        ))}

        {/* Out subtotal */}
        <tr className="border-b-2 border-t bg-gray-200 font-semibold text-black">
          <td className="px-2 py-2 text-center text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>Out</td>
          <td className="px-1 py-2 text-center text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.frontNinePar}</td>
          {filteredScores.map((s) => (
            <td key={s.id} className="px-1 py-2 text-center border-r border-gray-300 last:border-r-0">
              {sum(getScores(s), 0, 9)}
            </td>
          ))}
        </tr>

        {/* Spacer */}
        <tr className="h-2" />

        {/* Back 9 */}
        {COURSE_DATA.holes.slice(9, 18).map((hole, i) => {
          const holeIdx = i + 9
          return (
            <tr key={holeIdx} className={`border-b ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
              <td className="px-2 py-1.5 text-center font-medium text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{hole}</td>
              <td className="px-1 py-1.5 text-center text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.pars[holeIdx]}</td>
              {filteredScores.map((s) => (
                <td key={s.id} className="px-1 py-1 text-center border-r border-gray-300 last:border-r-0">
                  {renderScore(getScores(s)[holeIdx], COURSE_DATA.pars[holeIdx])}
                </td>
              ))}
            </tr>
          )
        })}

        {/* In subtotal */}
        <tr className="border-b-2 border-t bg-gray-200 font-semibold text-black">
          <td className="px-2 py-2 text-center text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>In</td>
          <td className="px-1 py-2 text-center text-white border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.backNinePar}</td>
          {filteredScores.map((s) => (
            <td key={s.id} className="px-1 py-2 text-center border-r border-gray-300 last:border-r-0">
              {sum(getScores(s), 9, 18)}
            </td>
          ))}
        </tr>

        {/* Total */}
        <tr className="bg-gray-300 font-bold text-black">
          <td className="px-2 py-2.5 text-center text-white border-r border-gray-400" style={{ backgroundColor: "#2d4a2d" }}>Total</td>
          <td className="px-1 py-2.5 text-center text-white border-r border-gray-400" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.totalPar}</td>
          {filteredScores.map((s) => {
            const all = getScores(s)
            const total = type === "gross" ? s.total_score : (s.net_total_score || sum(all, 0, 18))
            return (
              <td key={s.id} className="px-1 py-2.5 text-center text-sm border-r border-gray-400 last:border-r-0">
                {total}
              </td>
            )
          })}
        </tr>
      </tbody>
    </table>
  )
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
  const { scores, round } = (await getRoundDetails(resolvedParams.id)) as {
    scores: RoundScore[]
    round: { scorecard_image_url?: string | null } | null
  }

  if (!scores || scores.length === 0) {
    return notFound()
  }

  // Get round date and submitter from the first score
  const roundDate = scores[0].rounds.date
  const submittedBy = scores[0].rounds.users.name
  const scorecardImageUrl = round?.scorecard_image_url ?? null

  // Check if we came from a player stats page
  const fromPlayer = resolvedSearchParams?.from === "player"
  const playerId = resolvedSearchParams?.playerId as string
  const playerName = resolvedSearchParams?.playerName as string

  // If the viewer didn't play in this round, "My Rounds" is the wrong
  // destination — send them back to the leaderboard they likely came from.
  const viewerInRound = scores.some((s) => s.user_id === session.user.id)

  // Determine back link and text
  const backHref = fromPlayer && playerId
    ? `/players/${playerId}/stats`
    : viewerInRound
      ? "/scores/my-rounds"
      : "/scores/league-rounds"
  const backText = fromPlayer && playerName
    ? `Back to ${decodeURIComponent(playerName)}'s Stats`
    : viewerInRound
      ? "Back to My Rounds"
      : "Back to Tour Leaderboard"

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

          {scorecardImageUrl && (
            // The photo the round was submitted with — useful for settling
            // disputes or verifying unusual scores.
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Original Scorecard Photo</CardTitle>
                <CardDescription>Tap to view full size</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={scorecardImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-md border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scorecardImageUrl}
                    alt="Original scorecard photo"
                    className="w-full max-h-[480px] object-contain bg-muted"
                  />
                </a>
              </CardContent>
            </Card>
          )}

          {/* Mobile vertical scorecard */}
          <Card className="block md:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Scorecard</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Tabs defaultValue="gross" className="w-full">
                <div className="px-3 pb-3">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="gross" className="text-xs">Gross</TabsTrigger>
                    <TabsTrigger value="net" className="text-xs">Net</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="gross" className="mt-0">
                  <MobileScorecard scores={scores} type="gross" />
                </TabsContent>
                <TabsContent value="net" className="mt-0">
                  <MobileScorecard scores={scores} type="net" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Desktop horizontal scorecard (unchanged) */}
          <Card className="hidden md:block">
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
                          {COURSE_DATA.holes.map((hole) => (
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
                          {COURSE_DATA.pars.map((par, index) => (
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
                            {COURSE_DATA.frontNinePar}
                          </td>
                          <td
                            className="px-2 py-2 text-center font-medium border-r border-gray-300"
                            style={{ backgroundColor: "#2d4a2d" }}
                          >
                            {COURSE_DATA.backNinePar}
                          </td>
                          <td className="px-2 py-2 text-center font-medium" style={{ backgroundColor: "#2d4a2d" }}>
                            {COURSE_DATA.totalPar}
                          </td>
                        </tr>
                        <tr className="border-b bg-white text-black">
                          <th className="px-4 py-2 text-left font-medium border-r border-gray-300">Hdcp</th>
                          {COURSE_DATA.whiteHdcp.map((hdcp, index) => (
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
                            score.hole_1, score.hole_2, score.hole_3, score.hole_4, score.hole_5, score.hole_6,
                            score.hole_7, score.hole_8, score.hole_9, score.hole_10, score.hole_11, score.hole_12,
                            score.hole_13, score.hole_14, score.hole_15, score.hole_16, score.hole_17, score.hole_18,
                          ]
                          const frontNine = playerScores.slice(0, 9).reduce((sum, s) => sum + (s || 0), 0)
                          const backNine = playerScores.slice(9, 18).reduce((sum, s) => sum + (s || 0), 0)
                          const bgColor = idx % 2 === 0 ? "bg-gray-100" : "bg-white"

                          return (
                            <tr key={score.id} className={`border-b ${bgColor} text-black h-12`}>
                              <td className="px-4 py-2 font-medium border-r border-gray-300">
                                {score.users.name}
                                {score.strokes_given > 0 && (
                                  <span className="ml-1 text-xs text-gray-600">({score.strokes_given})</span>
                                )}
                              </td>
                              {playerScores.map((holeScore, index) => (
                                <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12">
                                  {holeScore !== null ? <ScoreIndicator score={holeScore} par={COURSE_DATA.pars[index]} /> : "-"}
                                </td>
                              ))}
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">{frontNine}</td>
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">{backNine}</td>
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
                          {COURSE_DATA.holes.map((hole) => (
                            <th key={hole} className="px-2 py-2 text-center font-medium border-r border-gray-300 w-12">{hole}</th>
                          ))}
                          <th className="px-2 py-2 text-center font-medium border-r border-gray-300 w-16">Out</th>
                          <th className="px-2 py-2 text-center font-medium border-r border-gray-300 w-16">In</th>
                          <th className="px-2 py-2 text-center font-medium w-16">Total</th>
                        </tr>
                        <tr className="border-b text-white">
                          <th className="px-4 py-2 text-left font-medium border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>Par</th>
                          {COURSE_DATA.pars.map((par, index) => (
                            <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12" style={{ backgroundColor: "#2d4a2d" }}>{par}</td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.frontNinePar}</td>
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.backNinePar}</td>
                          <td className="px-2 py-2 text-center font-medium" style={{ backgroundColor: "#2d4a2d" }}>{COURSE_DATA.totalPar}</td>
                        </tr>
                        <tr className="border-b bg-white text-black">
                          <th className="px-4 py-2 text-left font-medium border-r border-gray-300">Hdcp</th>
                          {COURSE_DATA.whiteHdcp.map((hdcp, index) => (
                            <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12">{hdcp}</td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300">-</td>
                          <td className="px-2 py-2 text-center font-medium border-r border-gray-300">-</td>
                          <td className="px-2 py-2 text-center font-medium">-</td>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((score, idx) => {
                          if (score.strokes_given <= 0) return null
                          const netScores = [
                            score.net_hole_1 ?? score.hole_1, score.net_hole_2 ?? score.hole_2, score.net_hole_3 ?? score.hole_3,
                            score.net_hole_4 ?? score.hole_4, score.net_hole_5 ?? score.hole_5, score.net_hole_6 ?? score.hole_6,
                            score.net_hole_7 ?? score.hole_7, score.net_hole_8 ?? score.hole_8, score.net_hole_9 ?? score.hole_9,
                            score.net_hole_10 ?? score.hole_10, score.net_hole_11 ?? score.hole_11, score.net_hole_12 ?? score.hole_12,
                            score.net_hole_13 ?? score.hole_13, score.net_hole_14 ?? score.hole_14, score.net_hole_15 ?? score.hole_15,
                            score.net_hole_16 ?? score.hole_16, score.net_hole_17 ?? score.line_17, score.net_hole_18 ?? score.hole_18,
                          ]
                          const frontNine = netScores.slice(0, 9).reduce((sum, s) => sum + (s || 0), 0)
                          const backNine = netScores.slice(9, 18).reduce((sum, s) => sum + (s || 0), 0)
                          const totalNet = score.net_total_score || frontNine + backNine
                          const bgColor = idx % 2 === 0 ? "bg-gray-100" : "bg-white"

                          return (
                            <tr key={`net-${score.id}`} className={`border-b ${bgColor} text-black h-12`}>
                              <td className="px-4 py-2 font-medium border-r border-gray-300">
                                {score.users.name}
                                <span className="ml-1 text-xs text-gray-600">({score.strokes_given})</span>
                              </td>
                              {netScores.map((netScore, index) => (
                                <td key={index} className="px-2 py-2 text-center border-r border-gray-300 w-12">
                                  {netScore !== null ? <NetScoreIndicator netScore={netScore} par={COURSE_DATA.pars[index]} /> : "-"}
                                </td>
                              ))}
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">{frontNine}</td>
                              <td className="px-2 py-2 text-center font-medium text-black border-r border-gray-300">{backNine}</td>
                              <td className="px-2 py-2 text-center font-medium text-black">{totalNet}</td>
                            </tr>
                          )
                        })}
                        {scores.filter((s) => s.strokes_given > 0).length === 0 && (
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
