"use client"

import type React from "react"

import { useEffect, useState } from "react"
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
import { PlayerPicker } from "@/components/player-picker"
import { useToast } from "@/components/ui/use-toast"
import { UserPlus, UserRound, UserRoundPlus, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import {
  checkPlayersForDateConflict,
  getMyReservationForDate,
  type LeagueUserSummary,
  type MyReservationForDate,
} from "@/app/actions/reservation-players"
import { getCashGameForDate } from "@/app/actions/cash-games"
import { sendBookingConfirmationEmails } from "@/app/actions/booking-emails"
import { createReservation } from "@/app/actions/reservation-edits"
import type { CashGame } from "@/types/supabase"
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal"
import {
  computePlayerOwed,
  isBookingWindowOpen,
  type BookingPlayerSummary,
} from "@/lib/booking-summary"
import { formatPhone, stripPhone, isValidPhone } from "@/lib/phone"

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
  | { type: "guest"; name: string; phone: string; playForMoney: boolean }

export default function BookTeeTimePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [userData, setUserData] = useState<any>(null)
  const [allTeeTimes, setAllTeeTimes] = useState<any[]>([])
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [upcomingFriday, setUpcomingFriday] = useState<string>("")
  const [cashGame, setCashGame] = useState<CashGame | null>(null)
  const [existingReservation, setExistingReservation] = useState<MyReservationForDate | null>(null)
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

      // Existing reservation for that date (booker or invited league player).
      // If present, the booking form is hidden and the user is pointed at /my-reservations.
      try {
        const existingRes = await getMyReservationForDate(fridayDateString)
        if (existingRes.success) {
          setExistingReservation(existingRes.reservation)
        } else {
          setExistingReservation(null)
        }
      } catch (err) {
        console.error("Existing reservation lookup failed:", err)
        setExistingReservation(null)
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

  // Filter out tee times with no available slots OR a closed booking window.
  // Server-side enforcement still applies in createReservation, but hiding
  // closed slots here keeps the UI honest so users can't even pick them.
  const availableTeeTimes = teeTimesWithAvailability.filter(
    (tt) => tt.availableSlots > 0 && isBookingWindowOpen(tt.booking_closes_at),
  )

  const selectedTeeTimeData = teeTimesWithAvailability.find((t) => t.id === selectedTeeTime)
  const totalSlots = additionalPlayers.length + 1
  const maxSlotsForSelection = selectedTeeTimeData
    ? Math.min(selectedTeeTimeData.availableSlots, selectedTeeTimeData.max_slots)
    : 4
  const atCapacity = totalSlots >= maxSlotsForSelection

  const addGuestPlayer = () => {
    if (atCapacity) return
    setAdditionalPlayers((prev) => [
      ...prev,
      { type: "guest", name: "", phone: "", playForMoney: false },
    ])
  }

  const addLeaguePlayers = (users: LeagueUserSummary[]) => {
    if (users.length === 0) return
    setAdditionalPlayers((prev) => {
      const remaining = Math.max(0, maxSlotsForSelection - (prev.length + 1))
      const toAdd = users.slice(0, remaining).map((u) => ({
        type: "user" as const,
        userId: u.id,
        name: u.name,
        email: u.email,
        playForMoney: false,
      }))
      return [...prev, ...toAdd]
    })
  }

  const removeAdditionalPlayer = (index: number) => {
    setAdditionalPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  const updateGuestName = (index: number, name: string) => {
    setAdditionalPlayers((prev) =>
      prev.map((p, i) => (i === index && p.type === "guest" ? { ...p, name } : p)),
    )
  }

  const updateGuestPhone = (index: number, value: string) => {
    const digits = stripPhone(value).slice(0, 10)
    setAdditionalPlayers((prev) =>
      prev.map((p, i) => (i === index && p.type === "guest" ? { ...p, phone: digits } : p)),
    )
  }

  const toggleAdditionalPFM = (index: number, value: boolean) => {
    setAdditionalPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, playForMoney: value } : p)),
    )
  }

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

    // Validate guest names + phones are filled in.
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
      if (p.type === "guest" && !isValidPhone(p.phone)) {
        toast({
          title: "Guest phone required",
          description: `Please enter a valid 10-digit phone number for guest in seat ${i + 2}.`,
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

    // Booking is now created via a server action so booking_closes_at,
    // capacity, and guest-phone validation are all enforced server-side
    // (the previous direct supabase.insert from the client let users book
    // past the deadline). The action also bypasses the deadline for admins.
    try {
      const result = await createReservation({
        teeTimeId: selectedTeeTime,
        bookerPlayForMoney,
        additionalPlayers: additionalPlayers.map((p) =>
          p.type === "user"
            ? { type: "user" as const, userId: p.userId, name: p.name }
            : { type: "guest" as const, name: p.name.trim(), phone: p.phone },
        ),
        additionalPlayForMoney: additionalPlayers.map((p) => p.playForMoney),
      })

      if (!result.success || !result.reservationId) {
        toast({
          title: "Booking Failed",
          description: result.error || "Failed to book tee time",
          variant: "destructive",
        })
        return
      }
      const reservationId = result.reservationId

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
          guestPhone: null,
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
          guestPhone: p.type === "guest" ? p.phone : null,
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
      sendBookingConfirmationEmails(reservationId).catch((err) => {
        console.error("Confirmation email send failed:", err)
      })
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

  // Block inactive members from booking, even though they are confirmed.
  if (userData && userData.is_confirmed && !userData.is_active) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container max-w-lg">
            <Card>
              <CardHeader>
                <CardTitle>Account Inactive</CardTitle>
                <CardDescription>
                  Your account is currently inactive. Contact a league admin to be reactivated before booking tee times.
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
          <div className="space-y-6">
            {existingReservation ? (
              <Card>
                <CardHeader>
                  <CardTitle>You already have a tee time booked</CardTitle>
                  <CardDescription>
                    {formatDateDisplay(existingReservation.date)} at{" "}
                    {formatTimeString(existingReservation.time)} EST
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild className="text-white">
                    <Link href="/my-reservations">View my reservations</Link>
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <>

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
                            {totalSlots} of {maxSlotsForSelection} slot{maxSlotsForSelection === 1 ? "" : "s"} taken
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
                                    aria-label={`Phone number for guest ${i + 2}`}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Guest · phone is shared only with you and league admins
                                  </p>
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
                          <Button
                            type="button"
                            variant="outline"
                            disabled={atCapacity}
                            onClick={() => setPickerOpen(true)}
                          >
                            <UserRoundPlus className="h-4 w-4 mr-2" />
                            Add Player(s)
                          </Button>
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
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <PlayerPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeUserIds={[
          ...(user?.id ? [user.id] : []),
          ...additionalPlayers
            .filter((p): p is Extract<AdditionalPlayer, { type: "user" }> => p.type === "user")
            .map((p) => p.userId),
        ]}
        maxSelectable={Math.max(0, maxSlotsForSelection - (additionalPlayers.length + 1))}
        onConfirm={(users) => addLeaguePlayers(users)}
      />
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
