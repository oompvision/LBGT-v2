"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { Loader2, History, Settings2, CircleDot } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getPaymentGrid,
  upsertPaymentStatuses,
  type PaymentGridDate,
  type PaymentGridTeeTime,
} from "@/app/actions/cash-games"
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard"

const PAGE_SIZE = 4

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "EEEE, MMMM d, yyyy")
  } catch {
    return dateStr
  }
}

function formatTime(timeString: string): string {
  if (!timeString) return ""
  try {
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours, 10)
    const minute = Number.parseInt(minutes, 10)
    if (isNaN(hour) || isNaN(minute)) return timeString
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
  } catch {
    return timeString
  }
}

type SlotKey = string // `${reservationId}:${playerIndex}`

type SlotState = {
  reservationId: string
  playerIndex: number
  greenFeePaid: boolean
  cashGamePaid: boolean
}

function slotKey(reservationId: string, playerIndex: number): SlotKey {
  return `${reservationId}:${playerIndex}`
}

export function CashGamesManager() {
  const [items, setItems] = useState<PaymentGridDate[]>([])
  const [totalDates, setTotalDates] = useState(0)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)

  const [slotState, setSlotState] = useState<Map<SlotKey, SlotState>>(new Map())
  const [dirtyByTeeTime, setDirtyByTeeTime] = useState<Map<string, Set<SlotKey>>>(
    new Map()
  )
  const [savingTeeTime, setSavingTeeTime] = useState<string | null>(null)

  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null)

  const totalDirty = useMemo(() => {
    let n = 0
    dirtyByTeeTime.forEach((s) => (n += s.size))
    return n
  }, [dirtyByTeeTime])

  const isDirty = totalDirty > 0

  const load = async (limit: number) => {
    setLoading(true)
    const res = await getPaymentGrid(limit)
    if (res.success) {
      setItems(res.items)
      setTotalDates(res.totalDates)
      const initial = new Map<SlotKey, SlotState>()
      for (const d of res.items) {
        for (const tt of d.teeTimes) {
          for (const r of tt.reservations) {
            for (const p of r.players) {
              initial.set(slotKey(r.reservationId, p.playerIndex), {
                reservationId: r.reservationId,
                playerIndex: p.playerIndex,
                greenFeePaid: p.greenFeePaid,
                cashGamePaid: p.cashGamePaid,
              })
            }
          }
        }
      }
      setSlotState(initial)
      setDirtyByTeeTime(new Map())
    } else {
      toast({
        title: "Error",
        description: res.error || "Failed to load.",
        variant: "destructive",
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    load(visibleCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount])

  useUnsavedChangesGuard(isDirty, (proceed) => setPendingNav(() => proceed))

  const toggleSlot = (
    teeTimeId: string,
    key: SlotKey,
    field: "greenFeePaid" | "cashGamePaid",
    nextValue: boolean
  ) => {
    setSlotState((prev) => {
      const next = new Map(prev)
      const cur = next.get(key)
      if (!cur) return prev
      next.set(key, { ...cur, [field]: nextValue })
      return next
    })
    setDirtyByTeeTime((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(teeTimeId) || [])
      set.add(key)
      next.set(teeTimeId, set)
      return next
    })
  }

  const saveTeeTime = async (tt: PaymentGridTeeTime) => {
    const dirtyKeys = dirtyByTeeTime.get(tt.teeTimeId)
    if (!dirtyKeys || dirtyKeys.size === 0) return
    const entries: Array<{
      reservation_id: string
      player_index: number
      green_fee_paid: boolean
      cash_game_paid: boolean
    }> = []
    dirtyKeys.forEach((k) => {
      const s = slotState.get(k)
      if (!s) return
      entries.push({
        reservation_id: s.reservationId,
        player_index: s.playerIndex,
        green_fee_paid: s.greenFeePaid,
        cash_game_paid: s.cashGamePaid,
      })
    })

    setSavingTeeTime(tt.teeTimeId)
    const res = await upsertPaymentStatuses(entries)
    setSavingTeeTime(null)

    if (res.success) {
      toast({
        title: "Saved",
        description: `Updated ${entries.length} player${entries.length === 1 ? "" : "s"} for ${formatTime(tt.time)}.`,
      })
      setDirtyByTeeTime((prev) => {
        const next = new Map(prev)
        next.delete(tt.teeTimeId)
        return next
      })
    } else {
      toast({
        title: "Error",
        description: res.error || "Failed to save.",
        variant: "destructive",
      })
    }
  }

  const canShowMore = items.length < totalDates

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {totalDates} upcoming round
          {totalDates === 1 ? "" : "s"}.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/cash-games/past">
            <History className="h-4 w-4 mr-2" />
            Past cash contests
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No upcoming tee times scheduled. Generate a schedule under Tee Times first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {items.map((dateItem) => (
            <div key={dateItem.date} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold">{formatDate(dateItem.date)}</h2>
                  {dateItem.cashGame ? (
                    <p className="text-sm text-muted-foreground">
                      {dateItem.cashGame.title} · ${dateItem.cashGame.entry_amount} entry
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No cash game configured for this date.
                    </p>
                  )}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/cash-games/configure/${dateItem.date}`}>
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                    Configure cash game
                  </Link>
                </Button>
              </div>

              {dateItem.teeTimes.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No tee times scheduled for this date.
                  </CardContent>
                </Card>
              ) : (
                dateItem.teeTimes.map((tt) => {
                  const dirtyCount = dirtyByTeeTime.get(tt.teeTimeId)?.size || 0
                  const isSaving = savingTeeTime === tt.teeTimeId

                  // Build display rows: all slots up to maxSlots, in reservation
                  // order followed by remaining empty slots.
                  const bookedSlots = tt.reservations.reduce(
                    (sum, r) => sum + r.slots,
                    0
                  )
                  const emptySlotCount = Math.max(0, tt.maxSlots - bookedSlots)

                  return (
                    <Card key={tt.teeTimeId}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">
                              {formatTime(tt.time)}
                            </CardTitle>
                            <CardDescription>
                              {bookedSlots} of {tt.maxSlots} slots booked
                            </CardDescription>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => saveTeeTime(tt)}
                            disabled={dirtyCount === 0 || isSaving}
                          >
                            {isSaving && (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            )}
                            {dirtyCount > 0
                              ? `Save changes (${dirtyCount})`
                              : "Save changes"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="text-left py-2 pr-3 font-medium">Player</th>
                                <th className="text-center py-2 px-3 font-medium w-32">
                                  Green Fee
                                </th>
                                <th className="text-center py-2 pl-3 font-medium w-32">
                                  Cash Game
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {tt.reservations.flatMap((r) =>
                                r.players.map((p) => {
                                  const key = slotKey(r.reservationId, p.playerIndex)
                                  const cur = slotState.get(key)
                                  const greenFeePaid = cur?.greenFeePaid ?? p.greenFeePaid
                                  const cashGamePaid = cur?.cashGamePaid ?? p.cashGamePaid
                                  const displayName =
                                    p.name && p.name.length > 0
                                      ? p.name
                                      : `Player ${p.playerIndex + 1}`
                                  return (
                                    <tr key={key} className="border-b last:border-b-0">
                                      <td className="py-2 pr-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-medium">
                                            {displayName}
                                          </span>
                                          {p.isBooker && (
                                            <Badge variant="outline" className="text-[10px]">
                                              Booker
                                            </Badge>
                                          )}
                                          {!p.isBooker && (
                                            <span className="text-xs text-muted-foreground">
                                              (booked by {r.bookerName})
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="text-center py-2 px-3">
                                        <Checkbox
                                          checked={greenFeePaid}
                                          onCheckedChange={(v) =>
                                            toggleSlot(
                                              tt.teeTimeId,
                                              key,
                                              "greenFeePaid",
                                              v === true
                                            )
                                          }
                                          aria-label={`Green fee paid for ${displayName}`}
                                        />
                                      </td>
                                      <td className="text-center py-2 pl-3">
                                        <div className="inline-flex items-center gap-1.5">
                                          <Checkbox
                                            checked={cashGamePaid}
                                            disabled={!p.isOptedIn}
                                            onCheckedChange={(v) =>
                                              toggleSlot(
                                                tt.teeTimeId,
                                                key,
                                                "cashGamePaid",
                                                v === true
                                              )
                                            }
                                            aria-label={`Cash game paid for ${displayName}`}
                                          />
                                          <span
                                            className="w-3 text-sm font-semibold text-primary"
                                            aria-label={
                                              p.isOptedIn ? "Opted into cash game" : undefined
                                            }
                                          >
                                            {p.isOptedIn ? "$" : ""}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                              {Array.from({ length: emptySlotCount }).map((_, i) => (
                                <tr
                                  key={`empty-${tt.teeTimeId}-${i}`}
                                  className="border-b last:border-b-0 text-muted-foreground"
                                >
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-2">
                                      <CircleDot className="h-3.5 w-3.5" />
                                      <span>
                                        Slot {bookedSlots + i + 1} — (open)
                                      </span>
                                    </div>
                                  </td>
                                  <td className="text-center py-2 px-3">
                                    <Checkbox checked={false} disabled />
                                  </td>
                                  <td className="text-center py-2 pl-3">
                                    <Checkbox checked={false} disabled />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          ))}
        </div>
      )}

      {canShowMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            View {Math.min(PAGE_SIZE, totalDates - items.length)} more
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!pendingNav}
        onOpenChange={(open) => !open && setPendingNav(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved payment-status changes. Leave without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNav(null)}>
              Stay on page
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const nav = pendingNav
                setPendingNav(null)
                setDirtyByTeeTime(new Map())
                if (nav) nav()
              }}
            >
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
