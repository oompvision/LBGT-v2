"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPlayoffResults } from "@/app/actions/playoff-results"
import type { PlayoffResult } from "@/types/supabase"
import { Trophy } from "lucide-react"

export function PlayoffResultsSection() {
  const [results, setResults] = useState<PlayoffResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      const result = await getPlayoffResults()
      if (result.success) {
        setResults(result.results)
      }
      setLoading(false)
    }
    fetchResults()
  }, [])

  if (loading || results.length === 0) return null

  const [latest, ...pastResults] = results

  return (
    <section className="py-16">
      <div className="container max-w-5xl">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-12">LBGT Playoff Results</h2>

        {/* Featured latest year - trophy case style */}
        <Card className="mb-8 border-2 border-green-200 bg-gradient-to-b from-green-50/50 to-transparent">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <Trophy className="h-12 w-12 text-yellow-500" />
              <p className="text-4xl font-bold">{latest.year}</p>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wider text-muted-foreground">Champion</p>
                <p className="text-2xl font-bold text-green-600">{latest.champion_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-wider text-muted-foreground">Runner Up</p>
                <p className="text-lg">{latest.runner_up_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Past results in a compact grid */}
        {pastResults.length > 0 && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pastResults.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-center text-xl">{r.year}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <div>
                    <p className="font-semibold text-green-600 text-sm">Champion</p>
                    <p className="text-sm">{r.champion_name}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground text-sm">Runner Up</p>
                    <p className="text-sm">{r.runner_up_name}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
