"use client"

import { useState, useEffect } from "react"
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
import { DEFAULT_MAX_PLAYERS_PER_TEE_TIME } from "@/lib/constants"
import {
  addReservation,
  deleteReservation,
  deleteRound,
  editPlayerScore,
  getAllReservationsWithDetails,
  getAllRoundsWithDetails,
} from "@/app/actions/admin-management"
import { Loader2, Pencil, Trash2, User, Users } from "lucide-react"
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

// Constants for date validation
const FIRST_VALID_DATE = new Date(2025, 4, 23) // May 23, 2025

interface AdminDashboardTabsProps {
  rounds: RoundWithScores[]
  reservations: ReservationWithDetails[]
  teeTimes: TeeTime[]
  users: User[]
}

export function AdminDashboardTabs({
  rounds: initialRounds,
  reservations: initialReservations,
  teeTimes: initialTeeTimes,
  users: initialUsers,
}: AdminDashboardTabsProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>(initialTeeTimes)
  const [rounds, setRounds] = useState<RoundWithScores[]>(initialRounds)
  const [reservations, setReservations] = useState<ReservationWithDetails[]>(initialReservations)
  const [loading, setLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [selectedUser, setSelectedUser] = useState("")
  const [selectedUserName, setSelectedUserName] = useState("")
  const [selectedTeeTime, setSelectedTeeTime] = useState("")
  const [slots, setSlots] = useState(1)
  const [playerNames, setPlayerNames] = useState<string[]>([])
  const [playForMoney, setPlayForMoney] = useState<boolean[]>([false])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: "round" | "reservation" } | null>(null)
  const [editScoreDialogOpen, setEditScoreDialogOpen] = useState(false)
  const [selectedScore, setSelectedScore] = useState<(Score & { users: Pick<User, "id" | "name"> | null }) | null>(null)

  // Update state when props change
  useEffect(() => {
    setUsers(initialUsers)
    setTeeTimes(initialTeeTimes)
    setRounds(initialRounds)
    setReservations(initialReservations)
  }, [initialUsers, initialTeeTimes, initialRounds, initialReservations])

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

  const handleUserChange = (userId: string) => {
    setSelectedUser(userId)
    // Find the user's name
    const user = users.find((u) => u.id === userId)
    setSelectedUserName(user?.name || "")
  }

  const handleSlotsChange = (value: number) => {
    const newValue = Math.max(1, Math.min(DEFAULT_MAX_PLAYERS_PER_TEE_TIME, value))
    setSlots(newValue)

    // Update player names array - only for additional players (slots 2-4)
    const newPlayerNames = [...playerNames]
    // Resize the array to have (newValue - 1) elements (for additional players)
    while (newPlayerNames.length < newValue - 1) {
      newPlayerNames.push("")
    }
    setPlayerNames(newPlayerNames.slice(0, Math.max(0, newValue - 1)))

    // Update play for money array - for all players including the main player
    const newPlayForMoney = [...playForMoney]
    while (newPlayForMoney.length < newValue) {
      newPlayForMoney.push(false)
    }
    setPlayForMoney(newPlayForMoney.slice(0, newValue))
  }

  const handlePlayerNameChange = (index: number, value: string) => {
    const newPlayerNames = [...playerNames]
    newPlayerNames[index] = value
    setPlayerNames(newPlayerNames)
  }

  const handlePlayForMoneyChange = (index: number, checked: boolean) => {
    const newPlayForMoney = [...playForMoney]
    newPlayForMoney[index] = checked
    setPlayForMoney(newPlayForMoney)
  }

  const handleAddReservation = async () => {
    if (!selectedUser || !selectedTeeTime) {
      toast({
        title: "Error",
        description: "Please select a user and tee time.",
        variant: "destructive",
      })
      return
    }

    // Validate additional player names if slots > 1
    if (slots > 1) {
      const validPlayerNames = playerNames.filter((name) => name.trim() !== "")
      if (validPlayerNames.length < slots - 1) {
        toast({
          title: "Error",
          description: "Please enter names for all additional players.",
          variant: "destructive",
        })
        return
      }
    }

    setLoadingAction(true)
    try {
      const result = await addReservation({
        userId: selectedUser,
        teeTimeId: selectedTeeTime,
        slots,
        playerNames,
        playForMoney,
      })

      if (result.success) {
        toast({
          title: "Success",
          description: "Reservation added successfully.",
        })

        // Refresh reservations
        const reservationsResponse = await getAllReservationsWithDetails()
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

        // Reset form
        setSelectedUser("")
        setSelectedUserName("")
        setSelectedTeeTime("")
        setSlots(1)
        setPlayerNames([])
        setPlayForMoney([false])
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add reservation.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding reservation:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction(false)
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
          const roundsResponse = await getAllRoundsWithDetails()
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
          const reservationsResponse = await getAllReservationsWithDetails()
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
        const roundsResponse = await getAllRoundsWithDetails()
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
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
        </TabsList>

        <TabsContent value="reservations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Reservation</CardTitle>
              <CardDescription>Create a new reservation for a user.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user">Main Player (User)</Label>
                  <Select value={selectedUser} onValueChange={handleUserChange}>
                    <SelectTrigger id="user">
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teeTime">Tee Time</Label>
                  <Select value={selectedTeeTime} onValueChange={setSelectedTeeTime}>
                    <SelectTrigger id="teeTime">
                      <SelectValue placeholder="Select tee time" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px] overflow-y-auto">
                      {teeTimes.map((teeTime) => (
                        <SelectItem key={teeTime.id} value={teeTime.id}>
                          {formatDateSafely(teeTime.date)} at {formatTimeSafely(teeTime.time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slots">Number of Players</Label>
                <Input
                  id="slots"
                  type="number"
                  min={1}
                  max={DEFAULT_MAX_PLAYERS_PER_TEE_TIME}
                  value={slots}
                  onChange={(e) => handleSlotsChange(Number.parseInt(e.target.value) || 1)}
                />
              </div>

              {selectedUser && (
                <div className="rounded-md border p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">Main Player</Label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{selectedUserName}</span>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="play-for-money-main"
                        checked={playForMoney[0] || false}
                        onCheckedChange={(checked) => handlePlayForMoneyChange(0, checked === true)}
                      />
                      <Label htmlFor="play-for-money-main" className="text-sm">
                        Play for $
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {slots > 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Label>Additional Players</Label>
                  </div>
                  {Array.from({ length: slots - 1 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <Input
                        placeholder={`Player ${index + 2} name`}
                        value={playerNames[index] || ""}
                        onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`play-for-money-${index + 1}`}
                          checked={playForMoney[index + 1] || false}
                          onCheckedChange={(checked) => handlePlayForMoneyChange(index + 1, checked === true)}
                        />
                        <Label htmlFor={`play-for-money-${index + 1}`} className="text-sm">
                          Play for $
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={handleAddReservation} disabled={loadingAction || !selectedUser || !selectedTeeTime}>
                {loadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Reservation
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reservations</CardTitle>
              <CardDescription>View and manage recent reservations.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {reservations.length === 0 ? (
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
                                <li className="flex items-center gap-1">
                                  {reservation.users?.name || "Unknown User"}
                                  {reservation.play_for_money?.[0] && (
                                    <span className="text-green-600 text-xs">(Playing for $)</span>
                                  )}
                                </li>
                                {reservation.player_names?.map((name: string, index: number) => (
                                  <li key={index} className="flex items-center gap-1">
                                    {name}
                                    {reservation.play_for_money?.[index + 1] && (
                                      <span className="text-green-600 text-xs">(Playing for $)</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => confirmDelete(reservation.id, "reservation")}
                          >
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

        <TabsContent value="rounds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Rounds</CardTitle>
              <CardDescription>View and manage recent rounds.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {rounds.length === 0 ? (
                    <p className="text-center text-muted-foreground">No rounds found.</p>
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
      </Tabs>
    </div>
  )
}
