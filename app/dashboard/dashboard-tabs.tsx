"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatTime, getUpcomingFridayForSeason } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CalendarIcon, Clock, Trash2, Info } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { useMobile } from "@/hooks/use-mobile"

interface TeeTime {
  id: string
  date: string
  time: string
  max_slots: number
}

interface Reservation {
  id: string
  tee_time_id: string
  slots: number
  player_names: string[]
  play_for_money: boolean[]
  tee_times: {
    id: string
    date: string
    time: string
  }
}

interface DashboardTabsProps {
  user: any
  userReservations: Reservation[]
  teeTimes: TeeTime[]
  allReservations: { tee_time_id: string; slots: number }[]
  upcomingFriday: string
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

export function DashboardTabs({
  user,
  userReservations,
  teeTimes,
  allReservations,
  upcomingFriday,
}: DashboardTabsProps) {
  const [selectedTeeTime, setSelectedTeeTime] = useState<string>("")
  const [slots, setSlots] = useState<number>(1)
  const [playerNames, setPlayerNames] = useState<string[]>([])
  const [playForMoney, setPlayForMoney] = useState<boolean[]>([false])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [userDailyReservations, setUserDailyReservations] = useState<Record<string, number>>({})
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState(tabFromUrl === "book" ? "book" : "reservations")

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const isMobile = useMobile()

  // Calculate available slots for each tee time
  const teeTimesWithAvailability = teeTimes.map((teeTime) => {
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

  // Calculate how many reservations the user has for each date
  useEffect(() => {
    const dailyReservations: Record<string, number> = {}

    userReservations.forEach((reservation) => {
      const date = reservation.tee_times.date
      if (!dailyReservations[date]) {
        dailyReservations[date] = 0
      }
      dailyReservations[date] += 1
    })

    setUserDailyReservations(dailyReservations)
  }, [userReservations])

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
        throw error
      }

      toast({
        title: "Success!",
        description: "Your tee time has been booked",
      })

      setSelectedTeeTime("")
      setSlots(1)
      setPlayerNames([])
      setPlayForMoney([false])
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to book tee time",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelReservation = async (reservationId: string) => {
    setIsDeleting(reservationId)

    try {
      const { error } = await supabase.from("reservations").delete().eq("id", reservationId)

      if (error) {
        throw error
      }

      toast({
        title: "Reservation cancelled",
        description: "Your tee time reservation has been cancelled",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel reservation",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
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
    if (teeTimes.length > 0) {
      return formatDateDisplay(teeTimes[0].date)
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
      if (teeTimes.length > 0) {
        const date = parseISO(teeTimes[0].date)
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

  const displayDate = getDisplayDate()
  const dayOfWeek = getDayOfWeek()

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className={`grid w-full ${isMobile ? "max-w-none" : "max-w-md"} grid-cols-2`}>
        <TabsTrigger value="reservations">My Reservations</TabsTrigger>
        <TabsTrigger value="book">Book Tee Time</TabsTrigger>
      </TabsList>

      <TabsContent value="reservations" className="mt-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Your Reservations</h2>

          {userReservations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {userReservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{formatDateDisplay(reservation.tee_times.date)}</CardTitle>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(reservation.tee_times.time)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div>
                      <p className="font-medium">
                        {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                      </p>

                      <div className="mt-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name || "You"}</span>
                          {reservation.play_for_money && reservation.play_for_money[0] && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                              Playing for money
                            </span>
                          )}
                        </div>
                      </div>

                      {reservation.player_names && reservation.player_names.length > 0 && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <p>Additional players:</p>
                          <ul className="list-inside list-disc">
                            {reservation.player_names.map((name, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span>{name}</span>
                                {reservation.play_for_money && reservation.play_for_money[i + 1] && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                    Playing for money
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancelReservation(reservation.id)}
                      disabled={isDeleting === reservation.id}
                      className="text-white"
                    >
                      {isDeleting === reservation.id ? (
                        "Cancelling..."
                      ) : (
                        <>
                          <Trash2 className="mr-1 h-4 w-4" />
                          Cancel Reservation
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Reservations</CardTitle>
                <CardDescription>You haven&apos;t made any tee time reservations yet.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" onClick={() => setActiveTab("book")}>
                  Book a Tee Time
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="book" className="mt-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Book a Tee Time</h2>

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
      </TabsContent>
    </Tabs>
  )
}
