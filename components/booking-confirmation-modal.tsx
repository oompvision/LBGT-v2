"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, UserRound } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ZELLE_PAYMENT_EMAIL, BASE_TEE_TIME_COST } from "@/lib/constants"
import { formatTimeOfDay, type BookingPlayerSummary } from "@/lib/booking-summary"

type Props = {
  open: boolean
  date: string
  time: string
  cashGameTitle: string | null
  players: BookingPlayerSummary[]
  onDismiss: () => void
}

function formatLongDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "EEEE, MMMM d, yyyy")
  } catch {
    return dateStr
  }
}

export function BookingConfirmationModal({
  open,
  date,
  time,
  cashGameTitle,
  players,
  onDismiss,
}: Props) {
  const booker = players.find((p) => p.isBooker)
  const bookerOwe = booker?.owe ?? BASE_TEE_TIME_COST

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Tee time booked
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold">{formatLongDate(date)}</p>
            <p className="text-sm text-muted-foreground">{formatTimeOfDay(time)} EST</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Cost per player</p>
            <ul className="space-y-2">
              {players.map((p) => {
                const breakdown = p.optedIn && cashGameTitle && p.entryAmount > 0
                  ? `$${BASE_TEE_TIME_COST} green fee + $${p.entryAmount} ${cashGameTitle} entry`
                  : `$${BASE_TEE_TIME_COST} green fee`
                const rowClass = p.isBooker
                  ? "border rounded-md p-3 bg-amber-50 border-amber-300 text-amber-950"
                  : "border rounded-md p-3"
                const iconClass = p.isBooker ? "h-4 w-4 text-amber-800 shrink-0" : "h-4 w-4 text-muted-foreground shrink-0"
                const tagClass = p.isBooker ? "ml-1 text-xs text-amber-800" : "ml-1 text-xs text-muted-foreground"
                const breakdownClass = p.isBooker ? "text-xs text-amber-900" : "text-xs text-muted-foreground"
                return (
                  <li key={p.index} className={rowClass}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserRound className={iconClass} />
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {p.name}
                            {p.isBooker && <span className={tagClass}>(you)</span>}
                          </p>
                          <p className={breakdownClass}>{breakdown}</p>
                        </div>
                      </div>
                      <span className="font-semibold whitespace-nowrap">${p.owe}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            Please Zelle{" "}
            <a href={`mailto:${ZELLE_PAYMENT_EMAIL}`} className="underline font-medium text-amber-900">
              {ZELLE_PAYMENT_EMAIL}
            </a>{" "}
            <span className="font-semibold">${bookerOwe}</span>, and text your playing partners to Zelle for their tee
            time.
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onDismiss} className="text-white">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
