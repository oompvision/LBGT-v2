"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { format, parseISO } from "date-fns"
import { getPastCashGameSummaries, type CashGameDateSummary } from "@/app/actions/cash-games"

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "EEEE, MMMM d, yyyy")
  } catch {
    return dateStr
  }
}

export function PastCashGames() {
  const [items, setItems] = useState<CashGameDateSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await getPastCashGameSummaries()
      if (cancelled) return
      if (res.success) {
        setItems(res.items)
      } else {
        toast({ title: "Error", description: res.error || "Failed to load.", variant: "destructive" })
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No past cash games yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((summary) => {
        const cg = summary.cashGame
        if (!cg) return null
        return (
          <Card key={cg.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{formatDate(summary.date)}</CardTitle>
              <CardDescription>
                {summary.reservationCount} reservation{summary.reservationCount === 1 ? "" : "s"} ·{" "}
                {summary.optedInPlayers.length} opted in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-base font-semibold">{cg.title}</span>
                <span className="text-sm text-muted-foreground">${cg.entry_amount} entry</span>
              </div>
              {cg.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cg.description}</p>
              )}
              {summary.optedInPlayers.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Opted in</p>
                  <ul className="space-y-1">
                    {summary.optedInPlayers.map((p, idx) => (
                      <li key={`${summary.date}-${idx}`} className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span>{p.name}</span>
                        {!p.isBooker && (
                          <span className="text-xs text-muted-foreground">
                            (booked by {p.bookerName})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
