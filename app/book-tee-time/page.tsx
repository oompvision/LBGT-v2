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
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, CheckCircle, Plus } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"

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

export default function BookTeeTimePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [userData, setUserData] = useState<any>(null)
  const [allTeeTimes, setAllTeeTimes] = useState<any[]>([])
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [upcomingFriday, setUpcomingFriday] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Booking form state
  const [selectedTeeTime, setSelectedTeeTime] = useState<string>("")
  const [slots, setSlots] = useState<number>(1)
  const [playerNames, setPlayerNames] = useState<string[]>([])
  const [playForMoney, setPlayForMoney] = useState<boolean[]>([false])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null)

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

  // Clear success message after 8 seconds
  useEffect(() => {
    if (bookingSuccess) {
      const timer = setTimeout(() => {
        setBookingSuccess(null)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [bookingSuccess])

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

  const handleSlotsChange = (value: string) => {
    const slotsCount = Number.parseInt(value, 10)
    setSlots(slotsCount)
    setPlayerNames(Array(Math.max(0, slotsCount - 1)).fill(""))
    setPlayForMoney(Array(Math.max(1, slotsCount)).fill(false))
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

    setIsSubmitting(true)
    setBookingSuccess(null) // Clear any previous success message

    // Get booking details for confirmation
    const selectedTeeTimeData = allTeeTimes.find((t) => t.id === selectedTeeTime)
    const confirmationMessage = selectedTeeTimeData
      ? `Booking confirmed for ${formatDateDisplay(selectedTeeTimeData.date)} at ${formatTimeString(selectedTeeTimeData.time)} with ${slots} ${slots === 1 ? "player" : "players"}.`
      : `Booking confirmed with ${slots} ${slots === 1 ? "player" : "players"}.`

    try {
      const { error } = await supabase.from("reservations").insert([
        {
          tee_time_id: selectedTeeTime,
          user_id: user.id,
          slots,
          player_names: playerNames.filter((name) => name.trim() !== ""),
          play_for_money: playForMoney,
        },
      ])

      if (error) {
        toast({
          title: "Booking Failed",
          description: error.message || "Failed to book tee time",
          variant: "destructive",
        })
        return
      }

      // Show success message
      setBookingSuccess(confirmationMessage)

      // Also try the toast as backup
      toast({
        title: "🎉 Tee Time Booked Successfully!",
        description: confirmationMessage,
        duration: 5000,
      })

      setSelectedTeeTime("")
      setSlots(1)
      setPlayerNames([])
      setPlayForMoney([false])
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
            {/* Success Alert - Always visible when booking succeeds */}
            {bookingSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">🎉 Tee Time Booked Successfully!</AlertTitle>
                <AlertDescription className="text-green-700">{bookingSuccess}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Booking Information</AlertTitle>
              <AlertDescription>
                You can book tee times for {dayOfWeek}, {displayDate}. Each player can book up to 4 tee times per day.
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
                      <div className="space-y-2">
                        <Label htmlFor="slots">Number of Players</Label>
                        <Select value={slots.toString()} onValueChange={handleSlotsChange}>
                          <SelectTrigger id="slots">
                            <SelectValue placeholder="Select number of players" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(
                              {
                                length: Math.min(
                                  4,
                                  teeTimesWithAvailability.find((t) => t.id === selectedTeeTime)?.availableSlots || 0,
                                ),
                              },
                              (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  {i + 1} {i === 0 ? "player" : "players"}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedTeeTime && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="play-for-money-main"
                            checked={playForMoney[0]}
                            onCheckedChange={(checked) => handlePlayForMoneyChange(0, checked === true)}
                          />
                          <Label htmlFor="play-for-money-main" className="font-medium">
                            I want to play for money
                          </Label>
                        </div>
                      </div>
                    )}

                    {slots > 1 && (
                      <div className="space-y-3 pt-2 border-t">
                        <Label>Additional Player Names & Options</Label>
                        {Array.from({ length: slots - 1 }, (_, i) => (
                          <div key={i} className="space-y-2">
                            <Input
                              placeholder={`Player ${i + 2} name`}
                              value={playerNames[i] || ""}
                              onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                            />
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`play-for-money-${i + 1}`}
                                checked={playForMoney[i + 1] || false}
                                onCheckedChange={(checked) => handlePlayForMoneyChange(i + 1, checked === true)}
                              />
                              <Label htmlFor={`play-for-money-${i + 1}`} className="text-sm text-muted-foreground">
                                This player wants to play for money
                              </Label>
                            </div>
                          </div>
                        ))}
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
    </div>
  )
}
