export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getMyRounds } from "@/app/actions/scores"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, ClipboardList, Eye } from "lucide-react"
import { format } from "date-fns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default async function MyRoundsPage() {
  const supabase = createClient()

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/signin")
  }

  // Get user's rounds
  const { rounds = [], success, error } = (await getMyRounds()) || { rounds: [], success: false, error: null }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Rounds</h1>
              <p className="text-muted-foreground">View all your golf rounds and scores</p>
            </div>
            <Link href="/scores/submit">
              <Button>
                <ClipboardList className="mr-2 h-4 w-4" />
                Submit New Scores
              </Button>
            </Link>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {rounds && rounds.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rounds.map((round) => {
                // Skip rendering this card if round data is incomplete
                if (!round || !round.rounds) {
                  return null
                }

                // Safely access date with fallback
                const roundDate = round.rounds.date ? new Date(round.rounds.date) : null

                return (
                  <Card key={round.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">
                          {roundDate ? format(roundDate, "MMMM d, yyyy") : "Date unavailable"}
                        </CardTitle>
                      </div>
                      <CardDescription>Submitted by {round.rounds.users?.name || "Unknown"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <div className="text-2xl font-bold">{round.total_score || "N/A"}</div>
                          <p className="text-sm text-muted-foreground">Gross Score</p>
                        </div>
                        {round.net_total_score !== undefined && (
                          <div>
                            <div className="text-xl font-medium text-green-600">{round.net_total_score}</div>
                            <p className="text-sm text-muted-foreground">
                              Net Score (with {round.strokes_given} strokes)
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      {round.rounds?.id && (
                        <Link href={`/scores/rounds/${round.rounds.id}`} className="w-full">
                          <Button variant="outline" className="w-full">
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                        </Link>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Rounds Found</CardTitle>
                <CardDescription>
                  You haven&apos;t played any rounds yet or no scores have been submitted for you.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/scores/submit">
                  <Button>Submit Your First Round</Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
