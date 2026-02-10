"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Clock, Lock } from "lucide-react"
import { getAvailableTeeTimesForDate } from "@/app/actions/available-tee-times"
import { getUpcomingTeeTimeDates } from "@/app/actions/tee-time-templates"
import { formatTime } from "@/lib/utils"
import { DEFAULT_MAX_PLAYERS_PER_TEE_TIME } from "@/lib/constants"

export function AvailableTeeTimesDisplay() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [isLoadingDates, setIsLoadingDates] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [teeTimes, setTeeTimes] = useState<any[]>([])
  const router = useRouter()

  // Load upcoming dates dynamically from the database
  useEffect(() => {
    const loadDates = async () => {
      setIsLoadingDates(true)
      const result = await getUpcomingTeeTimeDates()
      if (result.success && result.dates && result.dates.length > 0) {
        setAvailableDates(result.dates)
        setSelectedDate(result.dates[0])
      }
      setIsLoadingDates(false)
    }
    loadDates()
  }, [])

  // Load tee times for the selected date
  useEffect(() => {
    const loadTeeTimes = async () => {
      if (!selectedDate) return

      setIsLoading(true)
      try {
        const result = await getAvailableTeeTimesForDate(selectedDate)
        if (result.success) {
          setTeeTimes(result.teeTimes || [])
        } else {
          setTeeTimes([])
        }
      } catch (error) {
        console.error("Error loading tee times:", error)
        setTeeTimes([])
      } finally {
        setIsLoading(false)
      }
    }

    loadTeeTimes()
  }, [selectedDate])

  const handleBookTeeTime = (teeTimeId: string) => {
    router.push(`/reservations?teeTimeId=${teeTimeId}`)
  }

  if (isLoadingDates) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (availableDates.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Available Tee Times</h2>
          <p className="text-muted-foreground">Select a date to view available tee times</p>
        </div>
        <div className="text-center py-8 border rounded-lg">
          <p className="text-muted-foreground">No upcoming tee times available at this time.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Available Tee Times</h2>
          <p className="text-muted-foreground">Select a date to view available tee times</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Date Selector */}
        <Card className="md:w-[280px]">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
            <CardDescription>Choose an upcoming date</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto">
              {availableDates.map((date) => (
                <button
                  key={date}
                  className={`w-full text-left px-4 py-3 border-b transition-colors ${
                    selectedDate === date
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedDate(date)}
                >
                  {formatDateDisplay(date)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tee Times */}
        <div className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                {selectedDate ? formatDateDisplay(selectedDate) : "Select a date"}
              </CardTitle>
              <CardDescription>Available tee times for this date</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : teeTimes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teeTimes.map((teeTime) => {
                    const isBookable = teeTime.booking_open !== false
                    return (
                      <Card key={teeTime.id} className="overflow-hidden">
                        <CardHeader className="bg-muted/50 p-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                              {formatTime(teeTime.time_slot || teeTime.time)}
                            </CardTitle>
                            {!isBookable && (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground mb-2">
                            Available Slots: {teeTime.available_slots} of {teeTime.max_slots || DEFAULT_MAX_PLAYERS_PER_TEE_TIME}
                          </p>
                          {!isBookable && teeTime.booking_status === "not_yet_open" && teeTime.booking_opens_at && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Opens {formatBookingTime(teeTime.booking_opens_at)}</span>
                            </div>
                          )}
                          {!isBookable && teeTime.booking_status === "closed" && (
                            <Badge variant="secondary" className="text-xs">Booking closed</Badge>
                          )}
                        </CardContent>
                        <CardFooter className="p-4 pt-0">
                          {isBookable ? (
                            <Button className="w-full" onClick={() => handleBookTeeTime(teeTime.id)}>
                              Book Tee Time
                            </Button>
                          ) : (
                            <Button className="w-full" disabled variant="secondary">
                              {teeTime.booking_status === "not_yet_open" ? "Not Yet Open" : "Booking Closed"}
                            </Button>
                          )}
                        </CardFooter>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">No available tee times for this date</p>
                  <p className="text-sm">
                    {selectedDate ? `Selected: ${formatDateDisplay(selectedDate)}` : "Please select a date"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatBookingTime(isoStr: string): string {
  const date = new Date(isoStr)
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
