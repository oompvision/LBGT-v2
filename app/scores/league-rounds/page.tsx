import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, ClipboardList, Eye, Trophy, User } from "lucide-react"
import { format } from "date-fns"
import { LeagueStats } from "./stats"
import { RingerLeaderboard } from "./ringer-leaderboard"
import { ErrorDisplay } from "./error-display"
import { CommentsSection } from "./comments-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Add this export to prevent static rendering
export const dynamic = "force-dynamic"

export default async function TourLeaderboardPage() {
  const supabase = createClient()

  let roundsWithScores = []
  let success = false
  let errorMessage = ""

  try {
    // Get all rounds
    const { data: rounds, error: roundsError } = await supabase
      .from("rounds")
      .select(`
      id,
      date,
      submitted_by,
      users:submitted_by (
        name
      )
    `)
      .order("date", { ascending: false })

    if (roundsError) {
      throw new Error(`Error fetching rounds: ${roundsError.message}`)
    }

    if (!rounds || rounds.length === 0) {
      // No rounds found, but not an error
      success = true
      roundsWithScores = []
      // Continue rendering the page instead of returning an object
    }

    // Get all scores for all rounds in a single query
    const roundIds = rounds?.map((round) => round.id) || []

    if (roundIds.length > 0) {
      const { data: allScores, error: scoresError } = await supabase
        .from("scores")
        .select(`
        id,
        round_id,
        user_id,
        total_score,
        net_total_score,
        hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9,
        hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18,
        net_hole_1, net_hole_2, net_hole_3, net_hole_4, net_hole_5, net_hole_6, net_hole_7, net_hole_8, net_hole_9,
        net_hole_10, net_hole_11, net_hole_12, net_hole_13, net_hole_14, net_hole_15, net_hole_16, net_hole_17, net_hole_18,
        users (
          id,
          name
        )
      `)
        .in("round_id", roundIds)
        .order("total_score", { ascending: true })

      if (scoresError) {
        throw new Error(`Error fetching scores: ${scoresError.message}`)
      }

      // Group scores by round
      const scoresByRound = {}
      allScores?.forEach((score) => {
        if (!scoresByRound[score.round_id]) {
          scoresByRound[score.round_id] = []
        }
        scoresByRound[score.round_id].push(score)
      })

      // Combine rounds with their scores
      roundsWithScores = rounds.map((round) => ({
        ...round,
        scores: scoresByRound[round.id] || [],
      }))
    }

    success = true
  } catch (error) {
    console.error("Error in getAllLeagueRounds:", error)
    errorMessage = error.message || "An unknown error occurred"
    success = false
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Tour Leaderboard</h1>
              <p className="text-muted-foreground">
                View player rankings and all golf rounds submitted by tour members
              </p>
            </div>
            <Link href="/scores/submit">
              <Button>
                <ClipboardList className="mr-2 h-4 w-4" />
                Submit New Scores
              </Button>
            </Link>
          </div>

          {/* Error message */}
          {!success && errorMessage && <ErrorDisplay error={errorMessage} />}

          {/* Leaderboards */}
          {success && roundsWithScores.length > 0 && (
            <Tabs defaultValue="standard" className="mb-8">
              <TabsList className="mb-4">
                <TabsTrigger value="standard">Standard Leaderboard</TabsTrigger>
                <TabsTrigger value="ringer">Ringer Pool Leaderboard</TabsTrigger>
              </TabsList>

              <TabsContent value="standard">
                <LeagueStats rounds={roundsWithScores} />
              </TabsContent>

              <TabsContent value="ringer">
                <RingerLeaderboard rounds={roundsWithScores} />
              </TabsContent>
            </Tabs>
          )}

          <h2 className="text-xl font-bold mt-8 mb-4">Recent Rounds</h2>

          {success && roundsWithScores.length > 0 ? (
            <div className="space-y-8">
              {roundsWithScores.map((round) => (
                <Card key={round.id}>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>{format(new Date(round.date), "MMMM d, yyyy")}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>
                          Submitted by{" "}
                          {typeof round.users === "object" && round.users?.name ? round.users.name : "Unknown"}
                        </span>
                      </div>
                    </div>
                    <CardDescription>
                      {round.scores?.length || 0} {(round.scores?.length || 0) === 1 ? "player" : "players"} in this
                      round
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-2 text-left font-medium">Rank</th>
                              <th className="px-4 py-2 text-left font-medium">Player</th>
                              <th className="px-4 py-2 text-right font-medium">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(round.scores || []).map((score, index) => (
                              <tr key={score.id} className="border-b">
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
                                <td className="px-4 py-2 font-medium">{score.users?.name || "Unknown Player"}</td>
                                <td className="px-4 py-2 text-right">{score.total_score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/scores/rounds/${round.id}`} className="w-full">
                      <Button variant="outline" className="w-full">
                        <Eye className="mr-2 h-4 w-4" />
                        View Full Scorecard
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Rounds Found</CardTitle>
                <CardDescription>
                  {success ? "No golf rounds have been submitted yet." : "Unable to load rounds at this time."}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/scores/submit">
                  <Button>Submit First Round</Button>
                </Link>
              </CardFooter>
            </Card>
          )}

          {/* Comments Section */}
          <CommentsSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}
