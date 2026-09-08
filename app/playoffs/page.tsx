import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPublishedPlayoffBrackets } from "@/app/actions/playoff-brackets"
import { PlayoffBracketTree } from "@/components/playoff-bracket-tree"

export const dynamic = "force-dynamic"

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
        <div className="container space-y-8">
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
            <div className="mx-auto max-w-6xl space-y-8">
              {brackets
                .slice()
                .sort((a, b) => a.flight.localeCompare(b.flight))
                .map((bracket) => (
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
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
