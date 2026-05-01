"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { Loader2, UserPlus, UserRound, UserRoundPlus, X } from "lucide-react"
import { PlayerPicker } from "@/components/player-picker"
import { adminCreateReservation } from "@/app/actions/reservation-edits"
import { getCashGameForDate } from "@/app/actions/cash-games"
import { getUpcomingFridayForSeason } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { formatPhone, stripPhone, isValidPhone } from "@/lib/phone"
import type { CashGame } from "@/types/supabase"
import type { LeagueUserSummary } from "@/app/actions/reservation-players"

type AdminPlayer =
  | {
      type: "user"
      userId: string
      name: string
      email: string
      optedIn: boolean
    }
  | {
      type: "guest"
      name: string
      phone: string
      optedIn: boolean
    }

type TeeTimeRow = {
  id: string
  date: string
  time: string
  max_slots: number
}

function formatTimeOfDay(timeString: string): string {
  try {
    const [h, m] = timeString.split(":")
    const hour = Number.parseInt(h, 10)
    const minute = Number.parseInt(m ?? "0", 10)
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`
  } catch {
    return timeString
  }
}

type Props = {
  // Notify parent so it can refresh the reservation list after a successful
  // create. Shape matches what the existing tab already does on add.
  onCreated?: () => void
}

export function AdminAddReservation({ onCreated }: Props) {
  const supabase = createClient()
  const upcomingFriday = getUpcomingFridayForSeason()

  const [teeTimes, setTeeTimes] = useState<TeeTimeRow[]>([])
  const [reservedSlotsByTeeTime, setReservedSlotsByTeeTime] = useState<Record<string, number>>({})
  const [cashGame, setCashGame] = useState<CashGame | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)

  const [selectedTeeTimeId, setSelectedTeeTimeId] = useState<string>("")
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [teeTimesRes, cashGameRes] = await Promise.all([
          supabase
            .from("tee_times")
            .select("id, date, time, max_slots")
            .eq("date", upcomingFriday)
            .order("time"),
          getCashGameForDate(upcomingFriday),
        ])

        if (cancelled) return

        const tts = (teeTimesRes.data || []) as TeeTimeRow[]
        setTeeTimes(tts)

        // Sum reservations for THIS Friday's tee times only.
        const teeTimeIds = tts.map((t) => t.id)
        const counts: Record<string, number> = {}
        if (teeTimeIds.length > 0) {
          const { data: reservationsData } = await supabase
            .from("reservations")
            .select("tee_time_id, slots")
            .in("tee_time_id", teeTimeIds)
          for (const r of (reservationsData as { tee_time_id: string; slots: number }[]) || []) {
            counts[r.tee_time_id] = (counts[r.tee_time_id] ?? 0) + (r.slots ?? 0)
          }
        }
        setReservedSlotsByTeeTime(counts)

        if (cashGameRes.success && cashGameRes.cashGame) {
          setCashGame(cashGameRes.cashGame as CashGame)
        }
      } catch (err) {
        console.error("AdminAddReservation load error:", err)
      } finally {
        if (!cancelled) setLoadingPage(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase, upcomingFriday])

  const selectedTeeTime = teeTimes.find((t) => t.id === selectedTeeTimeId) || null
  const availableSlots = selectedTeeTime
    ? selectedTeeTime.max_slots - (reservedSlotsByTeeTime[selectedTeeTime.id] ?? 0)
    : 0
  const remainingCapacity = Math.max(0, availableSlots - players.length)
  const atCapacity = remainingCapacity <= 0

  const excludeUserIds = players
    .filter((p): p is Extract<AdminPlayer, { type: "user" }> => p.type === "user")
    .map((p) => p.userId)

  const addLeaguePlayers = (users: LeagueUserSummary[]) => {
    if (users.length === 0) return
    setPlayers((prev) => {
      const remaining = Math.max(0, availableSlots - prev.length)
      return [
        ...prev,
        ...users.slice(0, remaining).map((u) => ({
          type: "user" as const,
          userId: u.id,
          name: u.name,
          email: u.email,
          optedIn: false,
        })),
      ]
    })
  }

  const addGuestRow = () => {
    if (atCapacity) return
    setPlayers((prev) => [
      ...prev,
      { type: "guest", name: "", phone: "", optedIn: false },
    ])
  }

  const updateGuestName = (idx: number, name: string) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === idx && p.type === "guest" ? { ...p, name } : p)),
    )
  }

  const updateGuestPhone = (idx: number, value: string) => {
    const digits = stripPhone(value).slice(0, 10)
    setPlayers((prev) =>
      prev.map((p, i) => (i === idx && p.type === "guest" ? { ...p, phone: digits } : p)),
    )
  }

  const togglePlayerOptIn = (idx: number, value: boolean) => {
    setPlayers((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, optedIn: value } : p)),
    )
  }

  const removePlayer = (idx: number) => {
    setPlayers((prev) => prev.filter((_, i) => i !== idx))
  }

  const resetForm = () => {
    setSelectedTeeTimeId("")
    setPlayers([])
  }

  const handleSubmit = async () => {
    if (!selectedTeeTime) {
      toast({
        title: "Error",
        description: "Pick a tee time.",
        variant: "destructive",
      })
      return
    }
    if (players.length === 0) {
      toast({
        title: "Error",
        description: "Add at least one player.",
        variant: "destructive",
      })
      return
    }
    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      if (p.type === "guest") {
        if (!p.name.trim()) {
          toast({
            title: "Guest name required",
            description: `Enter a name for guest in seat ${i + 1}.`,
            variant: "destructive",
          })
          return
        }
        if (!isValidPhone(p.phone)) {
          toast({
            title: "Guest phone required",
            description: `Enter a valid 10-digit phone for guest in seat ${i + 1}.`,
            variant: "destructive",
          })
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const result = await adminCreateReservation({
        teeTimeId: selectedTeeTime.id,
        players: players.map((p) =>
          p.type === "user"
            ? {
                type: "user" as const,
                userId: p.userId,
                name: p.name,
                optedIn: p.optedIn,
              }
            : {
                type: "guest" as const,
                name: p.name.trim(),
                phone: p.phone,
                optedIn: p.optedIn,
              },
        ),
      })

      if (!result.success) {
        toast({
          title: "Couldn't create reservation",
          description: result.error || "Try again.",
          variant: "destructive",
        })
        return
      }

      const leagueCount = players.filter((p) => p.type === "user").length
      toast({
        title: "Reservation created",
        description:
          leagueCount > 0
            ? `Confirmation email sent to ${leagueCount} league ${leagueCount === 1 ? "member" : "members"}.`
            : "No league members on the booking, so no emails sent.",
      })
      resetForm()
      // Refresh local availability so the next reservation reflects it.
      const teeTimeIds = teeTimes.map((t) => t.id)
      if (teeTimeIds.length > 0) {
        const { data: fresh } = await supabase
          .from("reservations")
          .select("tee_time_id, slots")
          .in("tee_time_id", teeTimeIds)
        const counts: Record<string, number> = {}
        for (const r of (fresh as { tee_time_id: string; slots: number }[]) || []) {
          counts[r.tee_time_id] = (counts[r.tee_time_id] ?? 0) + (r.slots ?? 0)
        }
        setReservedSlotsByTeeTime(counts)
      }
      onCreated?.()
    } finally {
      setSubmitting(false)
    }
  }

  const fridayLabel = (() => {
    try {
      return format(parseISO(upcomingFriday), "EEEE, MMMM d, yyyy")
    } catch {
      return upcomingFriday
    }
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Reservation</CardTitle>
        <CardDescription>
          Create a reservation for {fridayLabel}. The booking-window cutoff doesn&apos;t
          apply here — capacity (max {selectedTeeTime?.max_slots ?? 4}) still does.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingPage ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : teeTimes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tee times scheduled for {fridayLabel}. Create them in the Tee Times admin first.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="admin-tee-time">Tee Time</Label>
              <Select value={selectedTeeTimeId} onValueChange={setSelectedTeeTimeId}>
                <SelectTrigger id="admin-tee-time">
                  <SelectValue placeholder="Select tee time" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                  {teeTimes.map((tt) => {
                    const reserved = reservedSlotsByTeeTime[tt.id] ?? 0
                    const slotsLeft = tt.max_slots - reserved
                    return (
                      <SelectItem
                        key={tt.id}
                        value={tt.id}
                        disabled={slotsLeft <= 0}
                      >
                        {formatTimeOfDay(tt.time)} — {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {cashGame && selectedTeeTime && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <p className="text-sm font-medium">Cash game: {cashGame.title}</p>
                {cashGame.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {cashGame.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  ${cashGame.entry_amount} entry. Toggle opt-in per player below.
                </p>
              </div>
            )}

            {selectedTeeTime && (
              <>
                <div>
                  <Label>Players</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {players.length} of {availableSlots} slot
                    {availableSlots === 1 ? "" : "s"} taken
                  </p>
                </div>

                {players.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border rounded-md">
                    {p.type === "user" ? (
                      <UserRound className="h-4 w-4 mt-1 text-muted-foreground" />
                    ) : (
                      <UserPlus className="h-4 w-4 mt-1 text-muted-foreground" />
                    )}
                    <div className="flex-1 space-y-2">
                      {p.type === "user" ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">(league player)</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            placeholder="Guest name"
                            value={p.name}
                            onChange={(e) => updateGuestName(i, e.target.value)}
                          />
                          <Input
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            placeholder="Phone (required)"
                            value={formatPhone(p.phone)}
                            onChange={(e) => updateGuestPhone(i, e.target.value)}
                            aria-label={`Phone number for guest ${i + 1}`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Guest · phone is shared only with admins and the booker
                          </p>
                        </div>
                      )}
                      {cashGame && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`admin-pfm-${i}`}
                            checked={p.optedIn}
                            onCheckedChange={(checked) =>
                              togglePlayerOptIn(i, checked === true)
                            }
                          />
                          <Label htmlFor={`admin-pfm-${i}`} className="text-sm">
                            Opt in to {cashGame.title}
                          </Label>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removePlayer(i)}
                      aria-label={`Remove player ${i + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={atCapacity}
                    onClick={() => setPickerOpen(true)}
                  >
                    <UserRoundPlus className="h-4 w-4 mr-2" />
                    Add Player(s)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addGuestRow}
                    disabled={atCapacity}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Guest
                  </Button>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || players.length === 0}
                  className="text-white"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Reservation
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>

      <PlayerPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeUserIds={excludeUserIds}
        maxSelectable={remainingCapacity}
        onConfirm={addLeaguePlayers}
      />
    </Card>
  )
}
