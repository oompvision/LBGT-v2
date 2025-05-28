"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getAvailableTeeTimesForDate } from "@/app/actions/available-tee-times"
import { formatTime } from "@/lib/utils"

export function AvailableTeeTimesDisplay() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [teeTimes, setTeeTimes] = useState<any[]>([])
  const router = useRouter()

  // Initialize with May 30th, 2025 (the date you created tee times for)
  useEffect(() => {
    const may30th = new Date("2025-05-30")
    setSelectedDate(may30th)
  }, [])

  // Load tee times for the selected date
  useEffect(() => {
    const loadTeeTimes = async () => {
      if (!selectedDate) return

      setIsLoading(true)

      try {
        // Format date for API
        const formattedDate = format(selectedDate, "yyyy-MM-dd")
        console.log(`Loading tee times for date: ${formattedDate}`)

        const result = await getAvailableTeeTimesForDate(formattedDate)

        if (result.success) {
          console.log(`Found ${result.teeTimes?.length || 0} tee times for ${formattedDate}`)
          setTeeTimes(result.teeTimes || [])
        } else {
          console.error("Error loading tee times:", result.error)
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

  // Get available dates (you can customize this to show specific dates)
  const availableDates = [
    new Date("2025-05-23"),
    new Date("2025-05-30"),
    new Date("2025-06-06"),
    new Date("2025-06-13"),
    new Date("2025-06-20"),
  ]

  // Filter dates to only show available dates
  const isDateAvailable = (date: Date) => {
    return availableDates.some(
      (availableDate) =>
        availableDate.getFullYear() === date.getFullYear() &&
        availableDate.getMonth() === date.getMonth() &&
        availableDate.getDate() === date.getDate(),
    )
  }

  // Handle booking a tee time
  const handleBookTeeTime = (teeTimeId: string) => {
    router.push(`/reservations?teeTimeId=${teeTimeId}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Available Tee Times</h2>
          <p className="text-muted-foreground">Select a Friday to view available tee times</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="md:w-auto">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
            <CardDescription>Choose a Friday with available tee times</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => !isDateAvailable(date)}
              initialFocus
            />
          </CardContent>
        </Card>

        <div className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}</CardTitle>
              <CardDescription>Available tee times for this date</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : teeTimes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teeTimes.map((teeTime) => (
                    <Card key={teeTime.id} className="overflow-hidden">
                      <CardHeader className="bg-muted/50 p-4">
                        <CardTitle className="text-lg">{formatTime(teeTime.time_slot || teeTime.time)}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-2">
                          Available Slots: {teeTime.available_slots || teeTime.availableSlots} of{" "}
                          {teeTime.max_slots || 4}
                        </p>
                      </CardContent>
                      <CardFooter className="p-4 pt-0">
                        <Button className="w-full" onClick={() => handleBookTeeTime(teeTime.id)}>
                          Book Tee Time
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">No available tee times for this date</p>
                  <p className="text-sm">
                    {selectedDate ? `Selected: ${format(selectedDate, "MMMM d, yyyy")}` : "Please select a date"}
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
