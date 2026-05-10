"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { format, parseISO, isValid } from "date-fns"
import type { User, TeeTime, RoundWithScores, ReservationWithDetails, Score, HoleScores } from "@/types/supabase"
import type { Season } from "@/app/actions/seasons"
import {
  deleteReservation,
  deleteRound,
  editPlayerScore,
  getAllReservationsWithDetails,
  getAllRoundsWithDetails,
} from "@/app/actions/admin-management"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { formatPhone } from "@/lib/phone"
import { isAdminCreatedReservation } from "@/lib/booking-summary"
import { AdminAddReservation } from "@/components/admin-add-reservation"
import {
  EditReservationDialog,
  type EditReservationData,
} from "@/components/edit-reservation-dialog"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScoreEditor } from "./score-editor"
import { getCashGameForDate } from "@/app/actions/cash-games"

// Constants for date validation
const FIRST_VALID_DATE = new Date(2025, 4, 23) // May 23, 2025

interface AdminDashboardTabsProps {
  rounds: RoundWithScores[]
  reservations: ReservationWithDetails[]
  teeTimes: TeeTime[]
  users: User[]
  seasons: Season[]
  initialSeason: number | null
}

export function AdminDashboardTabs({
  rounds: initialRounds,
  reservations: initialReservations,
  teeTimes: initialTeeTimes,
  users: initialUsers,
  seasons,
  initialSeason,
}: AdminDashboardTabsProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>(initialTeeTimes)
  const [rounds, setRounds] = useState<RoundWithScores[]>(initialRounds)
  const [reservations, setReservations] = useState<ReservationWithDetails[]>(initialReservations)
  const [loading, setLoading] = useState(false)
  const [selectedScoresSeason, setSelectedScoresSeason] = useState<string>(initialSeason?.toString() || "all")
  const [selectedReservationsSeason, setSelectedReservationsSeason] = useState<string>(initialSeason?.toString() || "all")
  const [loadingScores, setLoadingScores] = useState(false)
  const [loadingReservations, setLoadingReservations] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: "round" | "reservation" } | null>(null)
  const [editScoreDialogOpen, setEditScoreDialogOpen] = useState(false)
  const [selectedScore, setSelectedScore] = useState<(Score & { users: Pick<User, "id" | "name"> | null }) | null>(null)
  const [editReservationData, setEditReservationData] = useState<EditReservationData | null>(null)
  const [editCashGameTitle, setEditCashGameTitle] = useState<string | null>(null)
  const { user: authUser } = useAuth()

  // Update state when props change
  useEffect(() => {
    setUsers(initialUsers)
    setTeeTimes(initialTeeTimes)
    setRounds(initialRounds)
    setReservations(initialReservations)
  }, [initialUsers, initialTeeTimes, initialRounds, initialReservations])

  const handleScoresSeasonChange = async (value: string) => {
    setSelectedScoresSeason(value)
    setLoadingScores(true)
    try {
      const season = value === "all" ? undefined : Number(value)
      const result = await getAllRoundsWithDetails(season)
      if (result.success) {
        setRounds(result.rounds || [])
      }
    } catch (error) {
      console.error("Error fetching scores for season:", error)
    } finally {
      setLoadingScores(false)
    }
  }

  const handleReservationsSeasonChange = async (value: string) => {
    setSelectedReservationsSeason(value)
    setLoadingReservations(true)
    try {
      const season = value === "all" ? undefined : Number(value)
      const result = await getAllReservationsWithDetails(season)
      if (result.success) {
        setReservations(result.reservations || [])
      }
    } catch (error) {
      console.error("Error fetching reservations for season:", error)
    } finally {
      setLoadingReservations(false)
    }
  }

  // Helper function to ensure a date is valid and at least May 23, 2025
  const ensureValidDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString)
      if (!isValid(date) || date < FIRST_VALID_DATE) {
        return "2025-05-23"
      }
      return dateString
    } catch (error) {
      console.error("Error validating date:", error)
      return "2025-05-23"
    }
  }

  // Helper function to safely format dates
  const formatDateSafely = (dateString: string) => {
    try {
      // First, ensure we have a valid date string
      if (!dateString) return "May 23, 2025" // Default to May 23, 2025 if no date

      // Ensure the date is valid and at least May 23, 2025
      const validDateString = ensureValidDate(dateString)

      // Parse the ISO date string
      const date = parseISO(validDateString)

      // Format the date
      return format(date, "MMM d, yyyy")
    } catch (error) {
      console.error("Error formatting date:", error, "Date string:", dateString)
      return "May 23, 2025" // Default to May 23, 2025 if there's an error
    }
  }

  // Helper function to safely format times
  const formatTimeSafely = (timeString: string) => {
    try {
      // If the time string is empty or invalid, return a default message
      if (!timeString) return "3:30 PM" // Default time

      // Create a full date-time string for parsing
      const dateTimeString = `2000-01-01T${timeString}`

      // Parse and format the time
      return format(new Date(dateTimeString), "h:mm a")
    } catch (error) {
      console.error("Error formatting time:", error, "Time string:", timeString)
      return "3:30 PM" // Default to 3:30 PM if there's an error
    }
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete) return

    setLoadingAction(true)
    try {
      let result

      if (itemToDelete.type === "round") {
        result = await deleteRound(itemToDelete.id)
      } else {
        result = await deleteReservation(itemToDelete.id)
      }

      if (result.success) {
        toast({
          title: "Success",
          description: `${itemToDelete.type === "round" ? "Round" : "Reservation"} deleted successfully.`,
        })

        // Refresh data
        if (itemToDelete.type === "round") {
          const scoreSeason = selectedScoresSeason === "all" ? undefined : Number(selectedScoresSeason)
          const roundsResponse = await getAllRoundsWithDetails(scoreSeason)
          if (roundsResponse.success) {
            // Validate dates in the new rounds
            const validatedRounds = roundsResponse.rounds.map((round: RoundWithScores) => {
              if (round.date) {
                return { ...round, date: ensureValidDate(round.date) }
              }
              return round
            })

            setRounds(validatedRounds)
          }
        } else {
          const resSeason = selectedReservationsSeason === "all" ? undefined : Number(selectedReservationsSeason)
          const reservationsResponse = await getAllReservationsWithDetails(resSeason)
          if (reservationsResponse.success) {
            // Validate dates in the new reservations
            const validatedReservations = reservationsResponse.reservations.map((reservation: ReservationWithDetails) => {
              if (reservation.tee_times && reservation.tee_times.date) {
                return {
                  ...reservation,
                  tee_times: {
                    ...reservation.tee_times,
                    date: ensureValidDate(reservation.tee_times.date),
                  },
                }
              }
              return reservation
            })

            setReservations(validatedReservations)
          }
        }
      } else {
        toast({
          title: "Error",
          description: result.error || `Failed to delete ${itemToDelete.type}.`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(`Error deleting ${itemToDelete.type}:`, error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction(false)
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const confirmDelete = (id: string, type: "round" | "reservation") => {
    setItemToDelete({ id, type })
    setDeleteDialogOpen(true)
  }

  const openEditReservation = (reservation: ReservationWithDetails) => {
    const adminCreated = isAdminCreatedReservation({
      slots: reservation.slots,
      player_names: (reservation.player_names ?? null) as string[] | null,
    })
    const playerNames = reservation.player_names ?? []
    const playerUserIds = (reservation.player_user_ids ?? []) as (string | null)[]
    const guestPhones = (reservation.guest_phones ?? []) as (string | null)[]
    const playForMoney = reservation.play_for_money ?? []

    setEditReservationData({
      id: reservation.id,
      slots: reservation.slots,
      maxSlots: (reservation.tee_times as any)?.max_slots ?? 4,
      teeTimeDate: (reservation.tee_times as any)?.date ?? "",
      teeTimeTime: (reservation.tee_times as any)?.time ?? "",
      bookingClosesAt: (reservation.tee_times as any)?.booking_closes_at ?? null,
      bookerName: reservation.users?.name || "Booker",
      bookerUserId: reservation.user_id,
      additionalPlayers: playerNames.map((name, i) => ({
        name,
        userId: playerUserIds[i] ?? null,
        phone: guestPhones[i] ?? null,
      })),
      // Mirror /my-reservations: admin-created stores pfm at length slots+1
      // (phantom at [0]), regular stores at length slots.
      playForMoney: Array.from(
        { length: adminCreated ? reservation.slots + 1 : reservation.slots },
        (_, i) => !!(playForMoney as boolean[])[i],
      ),
      adminCreated,
    })

    // Look up the cash game for this date so the dialog can show the opt-in
    // checkbox. Fall back to a generic label so the admin can still toggle
    // opt-ins for dates that don't have a cash game configured yet.
    const date = (reservation.tee_times as any)?.date as string | undefined
    setEditCashGameTitle("cash game")
    if (date) {
      getCashGameForDate(date)
        .then((res) => {
          if (res.success && res.cashGame?.title) {
            setEditCashGameTitle(res.cashGame.title)
          }
        })
        .catch(() => {})
    }
  }

  const handleEditScore = (score: Score & { users: Pick<User, "id" | "name" | "email"> | null }) => {
    setSelectedScore(score)
    setEditScoreDialogOpen(true)
  }

  const handleSaveScore = async (scoreData: HoleScores) => {
    if (!selectedScore) return

    setLoadingAction(true)
    try {
      const result = await editPlayerScore(selectedScore.id, scoreData)

      if (result.success) {
        toast({
          title: "Success",
          description: "Score updated successfully.",
        })

        // Refresh rounds data
        const scoreSeason = selectedScoresSeason === "all" ? undefined : Number(selectedScoresSeason)
        const roundsResponse = await getAllRoundsWithDetails(scoreSeason)
        if (roundsResponse.success) {
          const validatedRounds = roundsResponse.rounds.map((round: RoundWithScores) => {
            if (round.date) {
              return { ...round, date: ensureValidDate(round.date) }
            }
            return round
          })

          setRounds(validatedRounds)
        }

        // Close the dialog
        setEditScoreDialogOpen(false)
        setSelectedScore(null)
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update score.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating score:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="bg-muted/50 p-4 rounded-lg">
      <Tabs defaultValue="reservations" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
        </TabsList>

        <TabsContent value="reservations" className="space-y-4">
          <AdminAddReservation
            onCreated={async () => {
              const resSeason =
                selectedReservationsSeason === "all" ? undefined : Number(selectedReservationsSeason)
              const reservationsResponse = await getAllReservationsWithDetails(resSeason)
              if (reservationsResponse.success) {
                const validatedReservations = reservationsResponse.reservations.map(
                  (reservation: ReservationWithDetails) => {
                    if (reservation.tee_times && reservation.tee_times.date) {
                      return {
                        ...reservation,
                        tee_times: {
                          ...reservation.tee_times,
                          date: ensureValidDate(reservation.tee_times.date),
                        },
                      }
                    }
                    return reservation
                  },
                )
                setReservations(validatedReservations)
              }
            }}
          />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Reservations</CardTitle>
                  <CardDescription>View and manage reservations by season.</CardDescription>
                </div>
                <Select value={selectedReservationsSeason} onValueChange={handleReservationsSeasonChange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Seasons</SelectItem>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.year.toString()}>
                        {s.name || s.year}{s.is_active ? " (Active)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {loadingReservations ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : reservations.length === 0 ? (
                    <p className="text-center text-muted-foreground">No reservations found.</p>
                  ) : (
                    reservations.map((reservation) => (
                      <Card key={reservation.id} className="p-4">
                        <div className="flex justify-between">
                          <div>
                            <h3 className="font-medium">{reservation.users?.name || "Unknown User"}</h3>
                            <p className="text-sm text-muted-foreground">
                              {reservation.tee_times?.date
                                ? formatDateSafely(reservation.tee_times.date)
                                : "May 23, 2025"}{" "}
                              at{" "}
                              {reservation.tee_times?.time ? formatTimeSafely(reservation.tee_times.time) : "3:30 PM"}
                            </p>
                            <p className="text-sm">Players: {reservation.slots}</p>
                            <div className="mt-2">
                              <p className="text-xs font-medium">Player Names:</p>
                              <ul className="text-xs">
                                {/* For admin-created reservations the booker is the
                                    admin and isn't a player on the tee time, so
                                    skip the synthetic booker row. */}
                                {!isAdminCreatedReservation({
                                  slots: reservation.slots,
                                  player_names: reservation.player_names ?? null,
                                }) && (
                                  <li className="flex items-center gap-1">
                                    {reservation.users?.name || "Unknown User"}
                                    {reservation.play_for_money?.[0] && (
                                      <span className="text-green-600 text-xs">(Playing for $)</span>
                                    )}
                                  </li>
                                )}
                                {reservation.player_names?.map((name: string, index: number) => {
                                  const isGuest = !reservation.player_user_ids?.[index]
                                  const phone = reservation.guest_phones?.[index]
                                  return (
                                    <li key={index} className="flex flex-wrap items-center gap-1">
                                      {name}
                                      {isGuest && (
                                        <span className="text-muted-foreground text-xs">
                                          (Guest{phone ? ` · ${formatPhone(phone)}` : ""})
                                        </span>
                                      )}
                                      {reservation.play_for_money?.[index + 1] && (
                                        <span className="text-green-600 text-xs">(Playing for $)</span>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditReservation(reservation)}
                              aria-label="Edit reservation"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => confirmDelete(reservation.id, "reservation")}
                              aria-label="Delete reservation"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scores</CardTitle>
                  <CardDescription>View and manage scores by season.</CardDescription>
                </div>
                <Select value={selectedScoresSeason} onValueChange={handleScoresSeasonChange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Seasons</SelectItem>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.year.toString()}>
                        {s.name || s.year}{s.is_active ? " (Active)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {loadingScores ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : rounds.length === 0 ? (
                    <p className="text-center text-muted-foreground">No scores found.</p>
                  ) : (
                    rounds.map((round) => (
                      <Card key={round.id} className="p-4">
                        <div className="flex justify-between">
                          <div>
                            <h3 className="font-medium">Round on {formatDateSafely(round.date)}</h3>
                            <p className="text-sm text-muted-foreground">
                              Submitted by: {round.users?.name || "Unknown"}
                            </p>
                            {round.error ? (
                              <p className="text-sm text-red-500">{round.error}</p>
                            ) : (
                              <div className="mt-2">
                                <p className="text-xs font-medium">Scores:</p>
                                <ul className="text-xs space-y-2">
                                  {round.scores?.map((score) => (
                                    <li key={score.id} className="flex items-center justify-between">
                                      <span>
                                        {score.users?.name || "Unknown"}: {score.total_score}
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => handleEditScore(score)}
                                      >
                                        <Pencil className="h-3.5 w-3.5 mr-1" />
                                        Edit
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <Button variant="destructive" size="icon" onClick={() => confirmDelete(round.id, "round")}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the{" "}
                {itemToDelete?.type === "round" ? "round and all associated scores" : "reservation"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteItem} disabled={loadingAction}>
                {loadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={editScoreDialogOpen} onOpenChange={setEditScoreDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Score</DialogTitle>
            </DialogHeader>
            {selectedScore && (
              <ScoreEditor score={selectedScore} onSave={handleSaveScore} isSubmitting={loadingAction} />
            )}
          </DialogContent>
        </Dialog>

        {editReservationData && authUser?.id && (
          <EditReservationDialog
            open={!!editReservationData}
            onOpenChange={(open) => {
              if (!open) {
                setEditReservationData(null)
                setEditCashGameTitle(null)
                // Refresh the reservation list so Players: count and player
                // names reflect any add/remove the admin just made.
                const resSeason =
                  selectedReservationsSeason === "all"
                    ? undefined
                    : Number(selectedReservationsSeason)
                getAllReservationsWithDetails(resSeason).then((r) => {
                  if (r.success) {
                    const validated = r.reservations.map((reservation: ReservationWithDetails) => {
                      if (reservation.tee_times && reservation.tee_times.date) {
                        return {
                          ...reservation,
                          tee_times: {
                            ...reservation.tee_times,
                            date: ensureValidDate(reservation.tee_times.date),
                          },
                        }
                      }
                      return reservation
                    })
                    setReservations(validated)
                  }
                })
              }
            }}
            // Treat admin as the booker for permissions; the existing admin
            // bypass in the server actions handles the booking-window /
            // opt-in cutoff for them.
            role="booker"
            viewerUserId={authUser.id}
            reservation={editReservationData}
            cashGameTitle={editCashGameTitle}
          />
        )}
      </Tabs>
    </div>
  )
}
