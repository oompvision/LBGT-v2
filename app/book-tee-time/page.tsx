"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getUpcomingFridayForSeason } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Plus, Loader2, UserPlus, UserRound, UserRoundPlus, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import {
  searchLeagueUsers,
  checkPlayersForDateConflict,
  type LeagueUserSummary,
} from "@/app/actions/reservation-players"
import { getCashGameForDate } from "@/app/actions/cash-games"
import { sendBookingConfirmationEmails } from "@/app/actions/booking-emails"
import type { CashGame } from "@/types/supabase"
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal"
import { computePlayerOwed, type BookingPlayerSummary } from "@/lib/booking-summary"

interface TeeTime {
  id: string
  date: string
  time: string
  max_slots: number
}

// Helper function to format time strings like "14:30" to "2:30 PM"
const formatTimeString = (timeString: string) => {
  try {
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours, 10)
    const minute = Number.parseInt(minutes, 10)

    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

    return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
  } catch (error) {
    return timeString // Return original if parsing fails
  }
}

type AdditionalPlayer =
  | { type: "user"; userId: string; name: string; email: string; playForMoney: boolean }
  | { type: "guest"; name: string; playForMoney: boolean }

export default function BookTeeTimePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [userData, setUserData] = useState<any>(null)
  const [allTeeTimes, setAllTeeTimes] = useState<any[]>([])
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [upcomingFriday, setUpcomingFriday] = useState<string>("")
  const [cashGame, setCashGame] = useState<CashGame | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Booking form state
  const [selectedTeeTime, setSelectedTeeTime] = useState<string>("")
  const [bookerPlayForMoney, setBookerPlayForMoney] = useState(false)
  const [additionalPlayers, setAdditionalPlayers] = useState<AdditionalPlayer[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    date: string
    time: string
    cashGameTitle: string | null
    players: BookingPlayerSummary[]
  } | null>(null)

  // Player picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [pickerResults, setPickerResults] = useState<LeagueUserSummary[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const pickerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const loadPageData = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      if (!supabase) {
        setError("Unable to connect to database")
        setIsLoading(false)
        return
      }

      // Get user data with better error handling
      const { data: userDataResult, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (userError) {
        console.error("Error fetching user data:", userError)
        // If user doesn't exist in database, create them
        if (userError.code === "PGRST116") {
          const { error: createError } = await supabase.from("users").insert({
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
          })

          if (createError) {
            setError("Error creating user profile")
            setIsLoading(false)
            return
          }

          // Retry fetching user data
          const { data: newUserData } = await supabase.from("users").select("*").eq("id", user.id).single()
          setUserData(newUserData)
        } else {
          setError("Error loading user data")
          setIsLoading(false)
          return
        }
      } else {
        setUserData(userDataResult)
      }

      // Get the upcoming Friday date using the updated logic (now returns a string)
      const fridayDateString = getUpcomingFridayForSeason()
      setUpcomingFriday(fridayDateString)

      // Cash game for the upcoming Friday (if configured).
      try {
        const cashGameRes = await getCashGameForDate(fridayDateString)
        if (cashGameRes.success) {
          setCashGame(cashGameRes.cashGame)
        } else {
          setCashGame(null)
        }
      } catch (err) {
        console.error("Cash game fetch error:", err)
        setCashGame(null)
      }

      // Get tee times for the upcoming Friday with error handling
      try {
        const { data: allTeeTimesResult, error: teeTimesError } = await supabase
          .from("tee_times")
          .select("*")
          .eq("date", fridayDateString)
          .order("time")

        if (teeTimesError) {
          console.error("Error fetching tee times:", teeTimesError)
          setAllTeeTimes([])
        } else {
          setAllTeeTimes(allTeeTimesResult || [])
        }
      } catch (err) {
        console.error("Tee times fetch error:", err)
        setAllTeeTimes([])
      }

      // Get all reservations for calculating available slots
      try {
        const { data: allReservationsResult, error: allReservationsError } = await supabase
          .from("reservations")
          .select("tee_time_id, slots")

        if (allReservationsError) {
          console.error("Error fetching all reservations:", allReservationsError)
          setAllReservations([])
        } else {
          setAllReservations(allReservationsResult || [])
        }
      } catch (err) {
        console.error("All reservations fetch error:", err)
        setAllReservations([])
      }

      setIsLoading(false)
    } catch (error: any) {
      console.error("Unexpected error loading page:", error)

      // Handle specific error types
      if (error.message?.includes("Too Many")) {
        setError("Server is busy. Please try again in a moment.")
      } else if (error.message?.includes("JWT") || error.message?.includes("Invalid")) {
        setError("Authentication error. Please sign in again.")
      } else {
        setError("Unable to load page. Please refresh the page.")
      }

      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      loadPageData()
    }
  }, [user, authLoading])

  // Calculate available slots for each tee time
  const teeTimesWithAvailability = allTeeTimes.map((teeTime) => {
    const reservationsForTeeTime = allReservations.filter((r) => r.tee_time_id === teeTime.id)
    const reservedSlots = reservationsForTeeTime.reduce((sum, r) => sum + r.slots, 0)
    const availableSlots = teeTime.max_slots - reservedSlots

    return {
      ...teeTime,
      availableSlots,
    }
  })

  // Filter out tee times with no available slots
  const availableTeeTimes = teeTimesWithAvailability.filter((tt) => tt.availableSlots > 0)

  const selectedTeeTimeData = teeTimesWithAvailability.find((t) => t.id === selectedTeeTime)
  const totalSlots = additionalPlayers.length + 1
  const maxSlotsForSelection = selectedTeeTimeData
    ? Math.min(selectedTeeTimeData.availableSlots, selectedTeeTimeData.max_slots)
    : 4
  const atCapacity = totalSlots >= maxSlotsForSelection

  const addGuestPlayer = () => {
    if (atCapacity) return
    setAdditionalPlayers((prev) => [...prev, { type: "guest", name: "", playForMoney: false }])
  }

  const addLeaguePlayer = (u: LeagueUserSummary) => {
    if (atCapacity) return
    setAdditionalPlayers((prev) => [
      ...prev,
      { type: "user", userId: u.id, name: u.name, email: u.email, playForMoney: false },
    ])
    setPickerOpen(false)
    setPickerQuery("")
    setPickerResults([])
  }

  const removeAdditionalPlayer = (index: number) => {
    setAdditionalPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  const updateGuestName = (index: number, name: string) => {
    setAdditionalPlayers((prev) =>
      prev.map((p, i) => (i === index && p.type === "guest" ? { ...p, name } : p)),
    )
  }

  const toggleAdditionalPFM = (index: number, value: boolean) => {
    setAdditionalPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, playForMoney: value } : p)),
    )
  }

  // Debounced player search.
  useEffect(() => {
    if (!pickerOpen) return
    if (pickerDebounceRef.current) clearTimeout(pickerDebounceRef.current)
    pickerDebounceRef.current = setTimeout(async () => {
      setPickerLoading(true)
      const excludeIds = [user?.id, ...additionalPlayers
        .filter((p): p is Extract<AdditionalPlayer, { type: "user" }> => p.type === "user")
        .map((p) => p.userId)]
        .filter((x): x is string => !!x)
      const result = await searchLeagueUsers(pickerQuery, excludeIds)
      setPickerLoading(false)
      if (result.success && result.users) {
        setPickerResults(result.users)
      } else {
        setPickerResults([])
      }
    }, 200)
    return () => {
      if (pickerDebounceRef.current) clearTimeout(pickerDebounceRef.current)
    }
  }, [pickerOpen, pickerQuery, additionalPlayers, user?.id])

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTeeTime) {
      toast({
        title: "Error",
        description: "Please select a tee time",
        variant: "destructive",
      })
      return
    }

    // Validate guest names are filled in.
    for (let i = 0; i < additionalPlayers.length; i++) {
      const p = additionalPlayers[i]
      if (p.type === "guest" && !p.name.trim()) {
        toast({
          title: "Guest name required",
          description: `Please enter a name for guest in seat ${i + 2}.`,
          variant: "destructive",
        })
        return
      }
    }

    if (!selectedTeeTimeData) {
      toast({
        title: "Tee time no longer available",
        description: "Please select a tee time again.",
        variant: "destructive",
      })
      return
    }

    if (totalSlots > selectedTeeTimeData.availableSlots) {
      toast({
        title: "Not enough available slots",
        description: `Only ${selectedTeeTimeData.availableSlots} slot(s) left at this tee time.`,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    // Build the aligned arrays.
    const player_names = additionalPlayers.map((p) => p.name.trim())
    const player_user_ids: (string | null)[] = additionalPlayers.map((p) =>
      p.type === "user" ? p.userId : null,
    )
    const play_for_money = [bookerPlayForMoney, ...additionalPlayers.map((p) => p.playForMoney)]

    // Pre-submit conflict check for all league players in the group.
    const leagueIdsToCheck = [user.id, ...player_user_ids.filter((id): id is string => !!id)]
    try {
      const conflictResult = await checkPlayersForDateConflict(
        selectedTeeTimeData.date,
        leagueIdsToCheck,
      )
      if (conflictResult.success && conflictResult.conflicts && conflictResult.conflicts.length > 0) {
        const names = conflictResult.conflicts.map((c) => c.name).join(", ")
        toast({
          title: "Scheduling conflict",
          description: `${names} already has a reservation on ${formatDateDisplay(selectedTeeTimeData.date)}. Each player can only book one tee time per day.`,
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }
    } catch (err) {
      // If the check itself fails, fall through and let the server enforce it.
      console.error("Conflict pre-check failed:", err)
    }

    try {
      const { data: insertedRows, error } = await supabase
        .from("reservations")
        .insert([
          {
            tee_time_id: selectedTeeTime,
            user_id: user.id,
            slots: totalSlots,
            player_names,
            play_for_money,
            player_user_ids,
            season: selectedTeeTimeData?.season,
          },
        ])
        .select("id")

      if (error) {
        toast({
          title: "Booking Failed",
          description: error.message || "Failed to book tee time",
          variant: "destructive",
        })
        return
      }

      // Build the modal summary from local state. This avoids a server round-trip
      // and matches the data the user just entered.
      const cashGameEntry = cashGame?.entry_amount ?? 0
      const summaryPlayers: BookingPlayerSummary[] = [
        {
          index: 0,
          name: userData?.name || "You",
          isBooker: true,
          optedIn: bookerPlayForMoney,
          entryAmount: bookerPlayForMoney ? cashGameEntry : 0,
          owe: computePlayerOwed(bookerPlayForMoney, cashGameEntry),
          email: userData?.email || null,
          userId: user.id,
        },
        ...additionalPlayers.map((p, i) => ({
          index: i + 1,
          name: p.name.trim() || `Player ${i + 2}`,
          isBooker: false,
          optedIn: p.playForMoney,
          entryAmount: p.playForMoney ? cashGameEntry : 0,
          owe: computePlayerOwed(p.playForMoney, cashGameEntry),
          email: p.type === "user" ? p.email : null,
          userId: p.type === "user" ? p.userId : null,
        })),
      ]

      setConfirmation({
        date: selectedTeeTimeData.date,
        time: selectedTeeTimeData.time,
        cashGameTitle: cashGame?.title ?? null,
        players: summaryPlayers,
      })

      setSelectedTeeTime("")
      setBookerPlayForMoney(false)
      setAdditionalPlayers([])

      // Refresh reservation counts so the tee time list updates
      const { data: freshReservations } = await supabase.from("reservations").select("tee_time_id, slots")
      setAllReservations(freshReservations || [])

      // Fire confirmation emails in the background. Booking is already saved;
      // failures here are logged server-side and don't block the user.
      const reservationId = insertedRows?.[0]?.id
      if (reservationId) {
        sendBookingConfirmationEmails(reservationId).catch((err) => {
          console.error("Confirmation email send failed:", err)
        })
      }
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book tee time",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDateDisplay = (dateString: string) => {
    try {
      const date = parseISO(dateString)
      return format(date, "MMMM d, yyyy")
    } catch (error) {
      return dateString
    }
  }

  const getDisplayDate = () => {
    if (allTeeTimes.length > 0) {
      return formatDateDisplay(allTeeTimes[0].date)
    }
    if (upcomingFriday) {
      return formatDateDisplay(upcomingFriday)
    }
    // Fallback to calculated upcoming Friday
    const calculatedFriday = getUpcomingFridayForSeason()
    return formatDateDisplay(calculatedFriday.toISOString().split("T")[0])
  }

  const getDayOfWeek = () => {
    try {
      if (allTeeTimes.length > 0) {
        const date = parseISO(allTeeTimes[0].date)
        return format(date, "EEEE")
      }
      if (upcomingFriday) {
        const date = parseISO(upcomingFriday)
        return format(date, "EEEE")
      }
      // Fallback to calculated upcoming Friday
      const calculatedFriday = getUpcomingFridayForSeason()
      return format(calculatedFriday, "EEEE")
    } catch (error) {
      return "Friday"
    }
  }

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show sign in prompt if not authenticated
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">Authentication Required</h1>
            <p className="text-muted-foreground">You need to sign in to book a tee time.</p>
            <Button asChild>
              <Link href="/signin">Sign In</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show loading while page data is loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show pending approval message if member is not confirmed
  if (userData && !userData.is_confirmed) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container max-w-lg">
            <Card>
              <CardHeader>
                <CardTitle>Account Pending Approval</CardTitle>
                <CardDescription>
                  Your account is awaiting confirmation from a league admin. Once confirmed, you'll be able to book tee times.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild variant="outline">
                  <Link href="/">Back to Home</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show error if there was a problem loading data
  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold text-red-600">Error</h1>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const displayDate = getDisplayDate()
  const dayOfWeek = getDayOfWeek()

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Book Tee Time</h1>
              <p className="text-muted-foreground">Reserve your spot for the upcoming round</p>
            </div>
            <Link href="/my-reservations">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                View My Reservations
              </Button>
            </Link>
          </div>

          <div className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Booking Information</AlertTitle>
              <AlertDescription>
                Each player can book one tee time per week for up to 4 players.
              </AlertDescription>
            </Alert>

            {availableTeeTimes.length > 0 ? (
              <form onSubmit={handleBooking} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Select Tee Time</CardTitle>
                    <CardDescription>
                      Book a tee time for {dayOfWeek}, {displayDate}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tee-time">Tee Time</Label>
                      <Select value={selectedTeeTime} onValueChange={setSelectedTeeTime} required>
                        <SelectTrigger id="tee-time">
                          <SelectValue placeholder="Select a tee time" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTeeTimes.map((teeTime) => (
                            <SelectItem key={teeTime.id} value={teeTime.id}>
                              {formatTimeString(teeTime.time)} - {teeTime.availableSlots} slots available
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedTeeTime && (
                      <div className="space-y-4 pt-2 border-t">
                        {cashGame && (
                          <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="text-base font-semibold">{cashGame.title}</span>
                              <span className="text-sm text-muted-foreground">
                                ${cashGame.entry_amount} entry
                              </span>
                            </div>
                            {cashGame.description && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {cashGame.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Opt in below for each player or guest who wants to play.
                            </p>
                          </div>
                        )}

                        <div>
                          <Label>Players</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {totalSlots} of {maxSlotsForSelection} seat{maxSlotsForSelection === 1 ? "" : "s"} taken.
                          </p>
                        </div>

                        {/* Booker row */}
                        <div className="flex items-start gap-3 p-3 border rounded-md bg-muted/30">
                          <UserRound className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{userData?.name || "You"}</span>
                              <span className="text-xs text-muted-foreground">(you)</span>
                            </div>
                            {cashGame && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="play-for-money-main"
                                  checked={bookerPlayForMoney}
                                  onCheckedChange={(checked) => setBookerPlayForMoney(checked === true)}
                                />
                                <Label htmlFor="play-for-money-main" className="text-sm">
                                  Opt in to {cashGame.title}
                                </Label>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Additional player rows */}
                        {additionalPlayers.map((p, i) => (
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
                                <div className="space-y-1">
                                  <Input
                                    placeholder="Guest name"
                                    value={p.name}
                                    onChange={(e) => updateGuestName(i, e.target.value)}
                                  />
                                  <p className="text-xs text-muted-foreground">Guest</p>
                                </div>
                              )}
                              {cashGame && (
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`play-for-money-${i + 1}`}
                                    checked={p.playForMoney}
                                    onCheckedChange={(checked) => toggleAdditionalPFM(i, checked === true)}
                                  />
                                  <Label htmlFor={`play-for-money-${i + 1}`} className="text-sm">
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
                              onClick={() => removeAdditionalPlayer(i)}
                              aria-label={`Remove player ${i + 2}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}

                        {/* Add buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" disabled={atCapacity}>
                                <UserRoundPlus className="h-4 w-4 mr-2" />
                                Add Player
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="start">
                              <div className="p-3 border-b">
                                <Input
                                  placeholder="Search league members..."
                                  value={pickerQuery}
                                  onChange={(e) => setPickerQuery(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-64 overflow-y-auto">
                                {pickerLoading ? (
                                  <div className="p-4 flex justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  </div>
                                ) : pickerResults.length === 0 ? (
                                  <p className="p-4 text-sm text-muted-foreground text-center">
                                    {pickerQuery ? "No matching members" : "Start typing to search"}
                                  </p>
                                ) : (
                                  pickerResults.map((u) => (
                                    <button
                                      key={u.id}
                                      type="button"
                                      className="w-full text-left p-3 hover:bg-accent transition-colors border-b last:border-b-0"
                                      onClick={() => addLeaguePlayer(u)}
                                    >
                                      <div className="font-medium text-sm">{u.name}</div>
                                      <div className="text-xs text-muted-foreground">{u.email}</div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button type="button" variant="outline" onClick={addGuestPlayer} disabled={atCapacity}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Guest
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isSubmitting || !selectedTeeTime} className="text-white">
                      {isSubmitting ? "Booking..." : "Book Tee Time"}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Tee Times Available</CardTitle>
                  <CardDescription>
                    There are no available tee times to book for {dayOfWeek}, {displayDate}. Please check back later or
                    contact the administrator.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button onClick={() => router.refresh()} className="text-white">
                    Refresh
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
      {confirmation && (
        <BookingConfirmationModal
          open={!!confirmation}
          date={confirmation.date}
          time={confirmation.time}
          cashGameTitle={confirmation.cashGameTitle}
          players={confirmation.players}
          onDismiss={() => {
            setConfirmation(null)
            router.push("/my-reservations")
          }}
        />
      )}
    </div>
  )
}
