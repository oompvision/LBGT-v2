"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2, UserPlus, UserRoundPlus, X, LogOut } from "lucide-react"
import { PlayerPicker } from "@/components/player-picker"
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
  addPlayerToReservation,
  removePlayerByIndex,
  updateOptIns,
} from "@/app/actions/reservation-edits"
import { removePlayerFromReservation } from "@/app/actions/reservation-players"
import { isBookingWindowOpen, isBeforeCutoff } from "@/lib/booking-summary"
import type { LeagueUserSummary } from "@/app/actions/reservation-players"
import { formatPhone, stripPhone, isValidPhone } from "@/lib/phone"

const OPT_IN_BUFFER_MINUTES = 60

export type EditReservationData = {
  id: string
  slots: number
  maxSlots: number
  teeTimeDate: string
  teeTimeTime: string
  bookingClosesAt: string | null
  bookerName: string
  bookerUserId: string
  additionalPlayers: { name: string; userId: string | null; phone: string | null }[]
  playForMoney: boolean[]
  // Admin-created bookings have user_id = admin (audit owner only) instead
  // of one of the actual players. The dialog skips the synthetic booker
  // entry when this is true so the admin doesn't appear as a player on
  // the tee time they aren't on.
  adminCreated: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: "booker" | "invited"
  viewerUserId: string
  reservation: EditReservationData
  cashGameTitle: string | null
}

type EditPlayer = {
  key: string
  name: string
  userId: string | null
  isBooker: boolean
  isLeague: boolean
  optedIn: boolean
  originalIdx: number | null // index in original player_names; null for newly added
  // Only meaningful for newly-added guest rows. Stored as digits only; we
  // don't try to backfill phones for guests that pre-date this column.
  phone: string
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isMobile
}

function buildInitialPlayers(reservation: EditReservationData): EditPlayer[] {
  const players: EditPlayer[] = []
  // Skip the synthetic "booker player" row for admin-created reservations.
  // Storage keeps a phantom `false` at play_for_money[0] for the admin, so
  // the additional-player indexing (pfm[i+1]) is unchanged.
  if (!reservation.adminCreated) {
    players.push({
      key: `booker-${reservation.bookerUserId}`,
      name: reservation.bookerName,
      userId: reservation.bookerUserId,
      isBooker: true,
      isLeague: true,
      optedIn: !!reservation.playForMoney[0],
      originalIdx: null,
      phone: "",
    })
  }
  reservation.additionalPlayers.forEach((p, i) => {
    players.push({
      key: `orig-${i}`,
      name: p.name,
      userId: p.userId,
      isBooker: false,
      isLeague: !!p.userId,
      optedIn: !!reservation.playForMoney[i + 1],
      originalIdx: i,
      phone: p.phone ?? "",
    })
  })
  return players
}

export function EditReservationDialog({
  open,
  onOpenChange,
  role,
  viewerUserId,
  reservation,
  cashGameTitle,
}: Props) {
  const isMobile = useIsMobile()
  const router = useRouter()

  const bookingOpen = isBookingWindowOpen(reservation.bookingClosesAt)
  const optInOpen = isBeforeCutoff(
    reservation.teeTimeDate,
    reservation.teeTimeTime,
    OPT_IN_BUFFER_MINUTES,
  )

  const [players, setPlayers] = useState<EditPlayer[]>(() => buildInitialPlayers(reservation))
  const [saving, setSaving] = useState(false)
  const [removingSelf, setRemovingSelf] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmRemoveSelf, setConfirmRemoveSelf] = useState(false)

  // Reset working state whenever the dialog re-opens or the underlying reservation changes.
  useEffect(() => {
    if (open) setPlayers(buildInitialPlayers(reservation))
  }, [open, reservation])

  const remainingCapacity = reservation.maxSlots - players.length

  const togglePlayerOptIn = (key: string, value: boolean) => {
    setPlayers((prev) => prev.map((p) => (p.key === key ? { ...p, optedIn: value } : p)))
  }

  const removeRow = (key: string) => {
    setPlayers((prev) => prev.filter((p) => p.key !== key))
  }

  const addLeaguePlayers = (users: LeagueUserSummary[]) => {
    if (users.length === 0) return
    setPlayers((prev) => {
      const remaining = Math.max(0, reservation.maxSlots - prev.length)
      const slice = users.slice(0, remaining)
      return [
        ...prev,
        ...slice.map((u) => ({
          key: `new-user-${u.id}`,
          name: u.name,
          userId: u.id,
          isBooker: false,
          isLeague: true,
          optedIn: false,
          originalIdx: null as number | null,
          phone: "",
        })),
      ]
    })
  }

  const addGuestRow = () => {
    if (remainingCapacity <= 0) return
    setPlayers((prev) => [
      ...prev,
      {
        key: `new-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: "",
        userId: null,
        isBooker: false,
        isLeague: false,
        optedIn: false,
        originalIdx: null,
        phone: "",
      },
    ])
  }

  const updateGuestName = (key: string, name: string) => {
    setPlayers((prev) => prev.map((p) => (p.key === key ? { ...p, name } : p)))
  }

  const updateGuestPhone = (key: string, value: string) => {
    const digits = stripPhone(value).slice(0, 10)
    setPlayers((prev) => prev.map((p) => (p.key === key ? { ...p, phone: digits } : p)))
  }

  const initial = useMemo(() => buildInitialPlayers(reservation), [reservation])

  const handleSaveBooker = async () => {
    // Validate every guest has a name. For newly-added guests (no original
    // index), also require a 10-digit phone — pre-existing guests are
    // grandfathered since the phone column shipped after they were booked.
    for (const p of players) {
      if (!p.isBooker && !p.userId && !p.name.trim()) {
        toast({ title: "Guest name required", description: "Fill in every guest's name.", variant: "destructive" })
        return
      }
      if (!p.isBooker && !p.userId && p.originalIdx === null && !isValidPhone(p.phone)) {
        toast({
          title: "Guest phone required",
          description: `Please enter a valid 10-digit phone number for ${p.name.trim() || "the new guest"}.`,
          variant: "destructive",
        })
        return
      }
    }

    // Removed players = those in initial (with originalIdx) but not in current state by originalIdx
    const currentOriginalIdxs = new Set(
      players.filter((p) => p.originalIdx !== null).map((p) => p.originalIdx as number),
    )
    const removedIndices = initial
      .filter((p) => p.originalIdx !== null && !currentOriginalIdxs.has(p.originalIdx as number))
      .map((p) => p.originalIdx as number)

    // Added players: any non-booker without originalIdx
    const additions = players.filter((p) => !p.isBooker && p.originalIdx === null)

    setSaving(true)
    try {
      // 1. Remove players (descending order to preserve indices)
      for (const idx of removedIndices.slice().sort((a, b) => b - a)) {
        const res = await removePlayerByIndex(reservation.id, idx)
        if (!res.success) {
          toast({ title: "Error", description: res.error || "Failed to remove player.", variant: "destructive" })
          return
        }
      }

      // 2. Add players
      for (const a of additions) {
        const payload = a.userId
          ? ({ type: "user", userId: a.userId } as const)
          : ({ type: "guest", name: a.name.trim(), phone: a.phone } as const)
        const res = await addPlayerToReservation(reservation.id, payload)
        if (!res.success) {
          toast({ title: "Error", description: res.error || "Failed to add player.", variant: "destructive" })
          return
        }
      }

      // 3. Update opt-ins (final state matches the new player order: booker first, then current additional players)
      if (optInOpen) {
        const finalOptIns = players.map((p) => p.optedIn)
        const res = await updateOptIns(reservation.id, finalOptIns)
        if (!res.success) {
          toast({ title: "Error", description: res.error || "Failed to save opt-ins.", variant: "destructive" })
          return
        }
      }

      toast({ title: "Saved", description: "Reservation updated." })
      onOpenChange(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveInvited = async () => {
    // Invited player only changes their own opt-in.
    setSaving(true)
    try {
      if (optInOpen) {
        const finalOptIns = players.map((p) => p.optedIn)
        const res = await updateOptIns(reservation.id, finalOptIns)
        if (!res.success) {
          toast({ title: "Error", description: res.error || "Failed to update.", variant: "destructive" })
          return
        }
      }
      toast({ title: "Saved", description: "Your changes are saved." })
      onOpenChange(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveSelf = async () => {
    setRemovingSelf(true)
    try {
      const res = await removePlayerFromReservation(reservation.id)
      if (!res.success) {
        toast({ title: "Error", description: res.error || "Failed to remove yourself.", variant: "destructive" })
        return
      }
      toast({
        title: "Removed",
        description: "Your seat has been released.",
      })
      onOpenChange(false)
      router.refresh()
    } finally {
      setRemovingSelf(false)
      setConfirmRemoveSelf(false)
    }
  }

  const excludeUserIds = useMemo(
    () =>
      players
        .map((p) => p.userId)
        .filter((id): id is string => !!id),
    [players],
  )

  const closedNotice =
    !bookingOpen && !optInOpen
      ? "Editing is locked — the round starts in less than an hour."
      : !bookingOpen
        ? "Booking has closed. Only opt-in changes are allowed."
        : null

  const body = (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="shrink-0 space-y-1">
        {role === "booker" ? (
          <p className="text-sm text-muted-foreground">
            Add or remove players, or change opt-ins for the cash game.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Update your opt-in for the cash game or remove yourself from the booking.
          </p>
        )}
        {closedNotice && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            {closedNotice}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
        {players.map((p) => {
          const isViewer = p.userId === viewerUserId
          const editableOptIn = optInOpen && (role === "booker" || isViewer)
          const canRemove = role === "booker" && !p.isBooker && bookingOpen
          const isGuestRow = !p.userId && !p.isBooker

          return (
            <div key={p.key} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 space-y-2 flex-1">
                  {isGuestRow && p.originalIdx === null ? (
                    <>
                      <Input
                        placeholder="Guest name"
                        value={p.name}
                        onChange={(e) => updateGuestName(p.key, e.target.value)}
                      />
                      <Input
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="Phone (required)"
                        value={formatPhone(p.phone)}
                        onChange={(e) => updateGuestPhone(p.key, e.target.value)}
                        aria-label={`Phone number for ${p.name || "new guest"}`}
                      />
                    </>
                  ) : (
                    <>
                      <p className={"truncate " + (isViewer ? "font-semibold" : "font-medium")}>
                        {p.name}
                      </p>
                      {role === "booker" && isGuestRow && p.phone && (
                        <p className="text-xs text-muted-foreground">{formatPhone(p.phone)}</p>
                      )}
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {p.isLeague ? "Tour Member" : "Guest"}
                    {p.isBooker && " · Booker"}
                  </p>
                </div>
                {canRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeRow(p.key)}
                    aria-label={`Remove ${p.name || "player"}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {cashGameTitle && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`opt-${p.key}`}
                    checked={p.optedIn}
                    disabled={!editableOptIn}
                    onCheckedChange={(checked) => togglePlayerOptIn(p.key, checked === true)}
                  />
                  <Label
                    htmlFor={`opt-${p.key}`}
                    className={"text-sm " + (!editableOptIn ? "text-muted-foreground" : "")}
                  >
                    Opt in to {cashGameTitle}
                  </Label>
                </div>
              )}
            </div>
          )
        })}

        {role === "booker" && bookingOpen && remainingCapacity > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
            >
              <UserRoundPlus className="h-4 w-4 mr-2" />
              Add Player(s)
            </Button>
            <Button type="button" variant="outline" onClick={addGuestRow}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Guest
            </Button>
          </div>
        )}

        {role === "invited" && bookingOpen && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setConfirmRemoveSelf(true)}
            disabled={removingSelf}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Remove myself from this booking
          </Button>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t">
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || removingSelf}>
          Cancel
        </Button>
        <Button
          onClick={role === "booker" ? handleSaveBooker : handleSaveInvited}
          disabled={saving || removingSelf}
          className="text-white"
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  )

  const preventAutoFocus = (e: Event) => e.preventDefault()

  const titleText = role === "booker" ? "Edit reservation" : "Edit my reservation"

  const wrapper = isMobile ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90dvh] flex flex-col p-4"
        onOpenAutoFocus={preventAutoFocus}
      >
        <SheetTitle className="text-base">{titleText}</SheetTitle>
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg p-4 max-h-[85vh] flex flex-col"
        onOpenAutoFocus={preventAutoFocus}
      >
        <DialogTitle className="text-base">{titleText}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      {wrapper}
      <PlayerPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeUserIds={excludeUserIds}
        maxSelectable={Math.max(0, reservation.maxSlots - players.length)}
        onConfirm={addLeaguePlayers}
      />
      <AlertDialog open={confirmRemoveSelf} onOpenChange={setConfirmRemoveSelf}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove yourself from this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The seat will be released back to the tee time. The booker keeps the reservation for the rest of the
              group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingSelf}>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRemoveSelf()
              }}
              disabled={removingSelf}
            >
              {removingSelf && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove me
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
