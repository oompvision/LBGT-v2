"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Loader2 } from "lucide-react"
import { cn, formatTime } from "@/lib/utils"
import { getTeeTimeAvailabilityByDate } from "@/app/actions/tee-time-availability"
import { useToast } from "@/components/ui/use-toast"

// Define the league date range
const LEAGUE_START_DATE = new Date(2025, 4, 23) // May 23, 2025
const LEAGUE_END_DATE = new Date(2025, 7, 29) // August 29, 2025

interface TeeTimeAvailability {
  id: string
  tee_time_id: string
  time_slot: string
  is_available: boolean
  max_slots: number
  reserved_slots: number
}

export function SimpleTeeTimeManager() {
  const [date, setDate] = useState<Date | undefined>(LEAGUE_START_DATE)
  const [isLoading, setIsLoading] = useState(true)
  const [teeTimeAvailability, setTeeTimeAvailability] = useState<TeeTimeAvailability[]>([])
  const [updatingTeeTimeId, setUpdatingTeeTimeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Load tee time availability when date changes
  useEffect(() => {
    if (date) {
      loadTeeTimeAvailability()
    }
  }, [date])

  // Function to load tee time availability
  const loadTeeTimeAvailability = async () => {
    if (!date) return

    setIsLoading(true)
    setError(null)

    try {
      const formattedDate = format(date, "yyyy-MM-dd")
      console.log(`Loading tee time availability for ${formattedDate}`)

      const result = await getTeeTimeAvailabilityByDate(formattedDate)

      console.log("Result from getTeeTimeAvailabilityByDate:", result)

      if (result.success) {
        // Ensure teeTimeAvailability is an array
        if (Array.isArray(result.teeTimeAvailability)) {
          console.log(`Setting teeTimeAvailability to array with ${result.teeTimeAvailability.length} items`)
          setTeeTimeAvailability(result.teeTimeAvailability)
        } else {
          console.error("teeTimeAvailability is not an array:", result.teeTimeAvailability)
          setTeeTimeAvailability([])
          setError("Received invalid data format from server")
          toast({
            title: "Error",
            description: "Received invalid data format from server",
            variant: "destructive",
          })
        }
      } else {
        console.error("Error from getTeeTimeAvailabilityByDate:", result.error)
        setTeeTimeAvailability([])
        setError(result.error || "Failed to load tee time availability")
        toast({
          title: "Error",
          description: result.error || "Failed to load tee time availability",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Exception in loadTeeTimeAvailability:", error)
      setTeeTimeAvailability([])
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
  const updateTeeTimeAvailability = async (teeTimeId: string, isAvailable: boolean) => {
    setUpdatingTeeTimeId(teeTimeId)
    try {
      const result = await setTeeTimeAvailability(teeTimeId, isAvailable)

      if (result.success) {
        // Update the local state
        setTeeTimeAvailability((prev) => {
          if (!Array.isArray(prev)) {
            console.error("prev is not an array in updateTeeTimeAvailability:", prev)
            return []
          }
          return prev.map((tt) => (tt.tee_time_id === teeTimeId ? { ...tt, is_available: isAvailable } : tt))
        })

        toast({
          title: "Success",
          description: `Tee time ${isAvailable ? "enabled" : "disabled"} successfully`,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update tee time availability",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error updating tee time availability:", error)
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

  // Render tee time list
  const renderTeeTimeList = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">{error}</p>
          <Button onClick={loadTeeTimeAvailability} variant="outline">
            Try Again
          </Button>
        </div>
      )
    }

    if (!Array.isArray(teeTimeAvailability)) {
      console.error("teeTimeAvailability is not an array in renderTeeTimeList:", teeTimeAvailability)
      return (
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">Invalid data format</p>
          <Button onClick={loadTeeTimeAvailability} variant="outline">
            Try Again
          </Button>
        </div>
      )
    }

    if (teeTimeAvailability.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-2">No tee times found for this date</p>
          <p className="text-sm">Please select another date or create tee times for this date</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {teeTimeAvailability.map((teeTime) => (
          <div
            key={teeTime.tee_time_id}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg",
              teeTime.is_available ? "bg-green-50" : "bg-gray-100",
            )}
          >
            <div className="space-y-1">
              <p className="font-medium">{formatTime(teeTime.time_slot)}</p>
              <p className="text-sm text-muted-foreground">
                {teeTime.reserved_slots} of {teeTime.max_slots} slots reserved
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id={`tee-time-${teeTime.tee_time_id}`}
                checked={teeTime.is_available}
                onCheckedChange={(checked) => updateTeeTimeAvailability(teeTime.tee_time_id, checked)}
                disabled={updatingTeeTimeId === teeTime.tee_time_id}
              />
              <Label htmlFor={`tee-time-${teeTime.tee_time_id}`}>
                {updatingTeeTimeId === teeTime.tee_time_id ? (
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
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Tee Time Management</h1>
        <p className="text-muted-foreground">Manage which tee times are available for booking</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="md:w-auto">
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
            <Button variant="outline" className="w-full" onClick={loadTeeTimeAvailability} disabled={isLoading}>
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

        <div className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{date ? format(date, "MMMM d, yyyy") : "Select a date"}</CardTitle>
              <CardDescription>Toggle which tee times are available for booking</CardDescription>
            </CardHeader>
            <CardContent>{renderTeeTimeList()}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
