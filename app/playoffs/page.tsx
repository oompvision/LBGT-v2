import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPublishedPlayoffBrackets } from "@/app/actions/playoff-brackets"
import type { PlayoffMatch } from "@/types/supabase"

export const dynamic = "force-dynamic"

function matchLine(m: PlayoffMatch): string {
  if (!m.player2_id) return `${m.player1_name} — Bye`
  if (m.winner_player_num === 1) return `${m.player1_name} def. ${m.player2_name}${m.score ? ` ${m.score}` : ""}`
  if (m.winner_player_num === 2) return `${m.player2_name} def. ${m.player1_name}${m.score ? ` ${m.score}` : ""}`
  return `${m.player1_name} vs ${m.player2_name}`
}

function groupByRound(matches: PlayoffMatch[]) {
  const rounds = new Map<number, PlayoffMatch[]>()
  for (const m of matches) {
    const list = rounds.get(m.round_number) || []
    list.push(m)
    rounds.set(m.round_number, list)
  }
  return Array.from(rounds.entries()).sort((a, b) => a[0] - b[0])
}

export default async function PlayoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  const requestedYear = params.year ? parseInt(params.year, 10) : undefined
  const { year, brackets, years } = await getPublishedPlayoffBrackets(requestedYear)

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-4xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">LBGT Playoffs</h1>
            {year && <p className="text-muted-foreground">{year} Playoff Brackets</p>}
          </div>

          {years.length > 1 && (
            <div className="flex justify-center gap-2">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/playoffs?year=${y}`}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    y === year ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}

          {brackets.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Playoff brackets haven&apos;t been published yet.</p>
          ) : (
            brackets
              .slice()
              .sort((a, b) => a.flight.localeCompare(b.flight))
              .map((bracket) => (
                <Card key={bracket.id}>
                  <CardHeader>
                    <CardTitle>{bracket.flight} Flight</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {bracket.matches.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Matchups coming soon.</p>
                    ) : (
                      groupByRound(bracket.matches).map(([roundNumber, matches]) => (
                        <div key={roundNumber} className="space-y-2">
                          <h3 className="font-semibold">{matches[0].round_label}</h3>
                          <ul className="space-y-1.5">
                            {matches.map((m) => (
                              <li key={m.id} className="rounded-md border px-3 py-2 text-sm">
                                {matchLine(m)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
