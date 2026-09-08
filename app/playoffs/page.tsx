import Link from "next/link"
import localFont from "next/font/local"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPublishedPlayoffBrackets } from "@/app/actions/playoff-brackets"
import { PlayoffBracketTree } from "@/components/playoff-bracket-tree"
import type { PlayoffMatch } from "@/types/supabase"

export const dynamic = "force-dynamic"

const oldEnglish = localFont({ src: "../fonts/CloisterBlackLight.ttf", weight: "400" })

function matchLine(m: PlayoffMatch): string {
  const isBye = m.round_number === 1 && !!m.player1_id && !m.player2_id
  if (isBye) return `${m.player1_name} — Bye`
  const p1 = m.player1_name || "TBD"
  const p2 = m.player2_name || "TBD"
  if (m.winner_player_num === 1) return `${p1} def. ${p2}${m.score ? ` ${m.score}` : ""}`
  if (m.winner_player_num === 2) return `${p2} def. ${p1}${m.score ? ` ${m.score}` : ""}`
  return `${p1} vs ${p2}`
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

  const sortedBrackets = brackets.slice().sort((a, b) => a.flight.localeCompare(b.flight))

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className={`flex-1 py-12 ${oldEnglish.className}`}>
        <div className="container space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-[49px] font-bold tracking-tight">LBGT Playoffs</h1>
            {year && <p className="text-muted-foreground">{year} Playoff Brackets</p>}
          </div>

          {years.length > 1 && (
            <div className="flex justify-center gap-2">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/playoffs?year=${y}`}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    y === year ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}

          {brackets.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Playoff brackets haven&apos;t been published yet.</p>
          )}
        </div>

        {brackets.length > 0 && (
          <>
            {/* Mobile: stacked round-by-round list, within the normal container width */}
            <div className="container space-y-8 md:hidden">
              {sortedBrackets.map((bracket) => (
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
              ))}
            </div>

            {/* Desktop: full-page-width bracket tree, scrolling only if it doesn't fit */}
            <div className="hidden md:block space-y-8 px-4">
              {sortedBrackets.map((bracket) => (
                <Card key={bracket.id}>
                  <CardHeader>
                    <CardTitle>{bracket.flight} Flight</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bracket.matches.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Matchups coming soon.</p>
                    ) : (
                      <PlayoffBracketTree matches={bracket.matches} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
