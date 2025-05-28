"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase/client"
import { updateTeeTimeAvailability } from "@/app/actions/update-tee-time"

// Define the league date range
const LEAGUE_START_DATE = new Date(2025, 4, 23) // May 23, 2025
const LEAGUE_END_DATE = new Date(2025, 7, 29) // August 29, 2025

interface TeeTime {
  id: string
  date: string
  time: string
  max_slots: number
  is_available: boolean
  reserved_slots: number
  available_slots: number
}

export function UltraSimpleManager() {
  const [date, setDate] = useState<Date | undefined>(LEAGUE_START_DATE)
  const [isLoading, setIsLoading] = useState(true)
  const [teeTimes, setTeeTimes] = useState<TeeTime[]>([])
  const [updatingTeeTimeId, setUpdatingTeeTimeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  // Load tee times when date changes
  useEffect(() => {
    if (date) {
      loadTeeTimes()
    }
  }, [date])

  // Function to load tee times
  const loadTeeTimes = async () => {
    if (!date) return

    setIsLoading(true)
    setError(null)

    try {
      const formattedDate = format(date, "yyyy-MM-dd")
      console.log(`Loading tee times for ${formattedDate}`)

      // Direct query to the available_tee_times view
      const { data, error } = await supabase
        .from("available_tee_times")
        .select("*")
        .eq("date", formattedDate)
        .order("time")

      if (error) {
        console.error("Error loading tee times:", error)
        setTeeTimes([])
        setError(error.message)
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      console.log("Tee times loaded:", data)

      if (Array.isArray(data)) {
        setTeeTimes(data)
      } else {
        console.error("Data is not an array:", data)
        setTeeTimes([])
        setError("Received invalid data format from server")
        toast({
          title: "Error",
          description: "Received invalid data format from server",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Exception in loadTeeTimes:", error)
      setTeeTimes([])
      setError(error.message || "An unexpected error occurred")
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Function to update tee time availability
  const handleUpdateAvailability = async (teeTimeId: string, isAvailable: boolean) => {
    setUpdatingTeeTimeId(teeTimeId)
    try {
      console.log(`Updating tee time ${teeTimeId} availability to ${isAvailable}`)

      // Use the server action to update availability
      const result = await updateTeeTimeAvailability(teeTimeId, isAvailable)

      if (!result.success) {
        console.error("Error updating tee time availability:", result.error)
        toast({
          title: "Error",
          description: result.error || "Failed to update tee time availability",
          variant: "destructive",
        })
        return
      }

      // Update the local state
      setTeeTimes((prev) => prev.map((tt) => (tt.id === teeTimeId ? { ...tt, is_available: isAvailable } : tt)))

      toast({
        title: "Success",
        description: `Tee time ${isAvailable ? "enabled" : "disabled"} successfully`,
      })
    } catch (error: any) {
      console.error("Exception in handleUpdateAvailability:", error)
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setUpdatingTeeTimeId(null)
    }
  }

  // Filter dates to only show Fridays within the league date range
  const isDateInLeague = (date: Date) => {
    return (
      date >= LEAGUE_START_DATE && date <= LEAGUE_END_DATE && date.getDay() === 5 // 5 = Friday
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Tee Time Management</h1>
        <p className="text-muted-foreground">Manage which tee times are available for booking</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
          <CardDescription>Choose a Friday between May 23 and August 29, 2025</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMMM d, yyyy") : <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => !isDateInLeague(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={loadTeeTimes} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Refresh Tee Times"
            )}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {teeTimes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tee Time Availability</CardTitle>
            <CardDescription>Toggle which tee times are available for booking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teeTimes.map((teeTime) => (
                <div key={teeTime.id} className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div>
                    <p className="font-medium">{teeTime.time}</p>
                    <p className="text-sm text-muted-foreground">
                      {teeTime.reserved_slots} of {teeTime.max_slots} slots reserved
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`tee-time-${teeTime.id}`}
                      checked={teeTime.is_available}
                      onCheckedChange={(checked) => handleUpdateAvailability(teeTime.id, checked)}
                      disabled={updatingTeeTimeId === teeTime.id}
                    />
                    <Label htmlFor={`tee-time-${teeTime.id}`}>
                      {updatingTeeTimeId === teeTime.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : teeTime.is_available ? (
                        "Available"
                      ) : (
                        "Hidden"
                      )}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !isLoading && !error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <p className="text-muted-foreground">No tee times found for this date.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  // TODO: Implement functionality to create tee times
                  toast({
                    title: "Not Implemented",
                    description: "Creating tee times is not yet implemented.",
                  })
                }}
              >
                Create Tee Times
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
