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

// Update the courseData object with the correct par values
const courseData = {
  holes: Array.from({ length: 18 }, (_, i) => i + 1),
  pars: [4, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  whiteHdcp: [13, 9, 15, 5, 1, 17, 3, 11, 7, 12, 16, 2, 10, 8, 14, 18, 6, 4], // White Handicap values
  frontNinePar: 36,
  backNinePar: 36,
  totalPar: 72,
}

export default async function RoundDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return notFound()
  }

  // Get round details
  const { scores } = await getRoundDetails(params.id)

  if (!scores || scores.length === 0) {
    return notFound()
  }

  // Get round date and submitter from the first score
  const roundDate = scores[0].rounds.date
  const submittedBy = scores[0].rounds.users.name

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-4">
            <Link href="/scores/my-rounds">
              <Button variant="ghost" className="pl-0">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Rounds
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
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium">Player</th>
                          {courseData.holes.map((hole) => (
                            <th key={hole} className="px-2 py-2 text-center font-medium">
                              {hole}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center font-medium">Out</th>
                          <th className="px-2 py-2 text-center font-medium">In</th>
                          <th className="px-2 py-2 text-center font-medium">Total</th>
                        </tr>
                        <tr className="border-b bg-muted/30">
                          <th className="px-4 py-2 text-left font-medium">Par</th>
                          {courseData.pars.map((par, index) => (
                            <td key={index} className="px-2 py-2 text-center">
                              {par}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium">{courseData.frontNinePar}</td>
                          <td className="px-2 py-2 text-center font-medium">{courseData.backNinePar}</td>
                          <td className="px-2 py-2 text-center font-medium">{courseData.totalPar}</td>
                        </tr>
                        <tr className="border-b bg-muted/20">
                          <th className="px-4 py-2 text-left font-medium">White Hdcp</th>
                          {courseData.whiteHdcp.map((hdcp, index) => (
                            <td key={index} className="px-2 py-2 text-center">
                              {hdcp}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium">-</td>
                          <td className="px-2 py-2 text-center font-medium">-</td>
                          <td className="px-2 py-2 text-center font-medium">-</td>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((score) => {
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

                          return (
                            <tr key={score.id} className="border-b">
                              <td className="px-4 py-2 font-medium">
                                {score.users.name}
                                {score.strokes_given > 0 && (
                                  <span className="ml-1 text-xs text-muted-foreground">({score.strokes_given})</span>
                                )}
                              </td>
                              {playerScores.map((holeScore, index) => {
                                // Calculate if the score is under, over, or at par
                                const par = courseData.pars[index]
                                let scoreClass = ""

                                if (holeScore !== null) {
                                  if (holeScore < par) scoreClass = "text-green-600 font-medium"
                                  else if (holeScore > par) scoreClass = "text-red-600 font-medium"
                                }

                                return (
                                  <td key={index} className={`px-2 py-2 text-center ${scoreClass}`}>
                                    {holeScore || "-"}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-2 text-center font-medium">{frontNine}</td>
                              <td className="px-2 py-2 text-center font-medium">{backNine}</td>
                              <td className="px-2 py-2 text-center font-medium">{score.total_score}</td>
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
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium">Player</th>
                          {courseData.holes.map((hole) => (
                            <th key={hole} className="px-2 py-2 text-center font-medium">
                              {hole}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-center font-medium">Out</th>
                          <th className="px-2 py-2 text-center font-medium">In</th>
                          <th className="px-2 py-2 text-center font-medium">Total</th>
                        </tr>
                        <tr className="border-b bg-muted/30">
                          <th className="px-4 py-2 text-left font-medium">Par</th>
                          {courseData.pars.map((par, index) => (
                            <td key={index} className="px-2 py-2 text-center">
                              {par}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium">{courseData.frontNinePar}</td>
                          <td className="px-2 py-2 text-center font-medium">{courseData.backNinePar}</td>
                          <td className="px-2 py-2 text-center font-medium">{courseData.totalPar}</td>
                        </tr>
                        <tr className="border-b bg-muted/20">
                          <th className="px-4 py-2 text-left font-medium">White Hdcp</th>
                          {courseData.whiteHdcp.map((hdcp, index) => (
                            <td key={index} className="px-2 py-2 text-center">
                              {hdcp}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium">-</td>
                          <td className="px-2 py-2 text-center font-medium">-</td>
                          <td className="px-2 py-2 text-center font-medium">-</td>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((score) => {
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
                            score.net_hole_17 !== null ? score.net_hole_17 : score.hole_17,
                            score.net_hole_18 !== null ? score.net_hole_18 : score.hole_18,
                          ]

                          const frontNine = netScores.slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)
                          const backNine = netScores.slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)
                          const totalNet = score.net_total_score || frontNine + backNine

                          return (
                            <tr key={`net-${score.id}`} className="border-b">
                              <td className="px-4 py-2 font-medium">
                                {score.users.name}
                                <span className="ml-1 text-xs text-muted-foreground">({score.strokes_given})</span>
                              </td>
                              {netScores.map((netScore, index) => {
                                // Calculate if the score is under, over, or at par
                                const par = courseData.pars[index]
                                let scoreClass = ""

                                if (netScore !== null) {
                                  if (netScore < par) scoreClass = "text-green-600 font-medium"
                                  else if (netScore > par) scoreClass = "text-red-600 font-medium"
                                }

                                return (
                                  <td key={index} className={`px-2 py-2 text-center ${scoreClass}`}>
                                    {netScore || "-"}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-2 text-center font-medium">{frontNine}</td>
                              <td className="px-2 py-2 text-center font-medium">{backNine}</td>
                              <td className="px-2 py-2 text-center font-medium">{totalNet}</td>
                            </tr>
                          )
                        })}
                        {scores.filter((score) => score.strokes_given > 0).length === 0 && (
                          <tr>
                            <td colSpan={22} className="px-4 py-4 text-center text-muted-foreground">
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
