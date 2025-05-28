"use client"

import { useState, useEffect } from "react"
import { format, addDays, isFriday } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save, RefreshCw } from "lucide-react"
import { getTeeTimeAvailability, bulkUpdateTeeTimeAvailability } from "@/app/actions/tee-time-management"

// Define the league date range
const LEAGUE_START_DATE = new Date(2025, 4, 23) // May 23, 2025
const LEAGUE_END_DATE = new Date(2025, 7, 29) // August 29, 2025

// Get all Fridays in the league date range
const getLeagueFridays = () => {
  const fridays = []
  let currentDate = new Date(LEAGUE_START_DATE)

  while (currentDate <= LEAGUE_END_DATE) {
    if (isFriday(currentDate)) {
      fridays.push(new Date(currentDate))
    }
    currentDate = addDays(currentDate, 1)
  }

  return fridays
}

const LEAGUE_FRIDAYS = getLeagueFridays()

export function TeeTimeManagerV2() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(LEAGUE_FRIDAYS[0])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [teeTimeAvailability, setTeeTimeAvailability] = useState<any[]>([])
  const [originalAvailability, setOriginalAvailability] = useState<any[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const { toast } = useToast()

  // Load tee time availability for the selected date
  useEffect(() => {
    const loadTeeTimeAvailability = async () => {
      if (!selectedDate) return

      setIsLoading(true)

      try {
        const formattedDate = format(selectedDate, "yyyy-MM-dd")
        const result = await getTeeTimeAvailability(formattedDate)

        if (result.success) {
          setTeeTimeAvailability(result.teeTimeAvailability || [])
          setOriginalAvailability(JSON.parse(JSON.stringify(result.teeTimeAvailability || [])))
          setHasChanges(false)
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to load tee time availability",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error loading tee time availability:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadTeeTimeAvailability()
  }, [selectedDate, toast])

  // Check if there are unsaved changes
  useEffect(() => {
    if (teeTimeAvailability.length === 0 || originalAvailability.length === 0) {
      setHasChanges(false)
      return
    }

    const hasChanges = teeTimeAvailability.some((teeTime, index) => {
      return teeTime.is_available !== originalAvailability[index]?.is_available
    })

    setHasChanges(hasChanges)
  }, [teeTimeAvailability, originalAvailability])

  // Handle toggling tee time availability
  const handleToggleAvailability = (index: number) => {
    const updatedTeeTimeAvailability = [...teeTimeAvailability]
    updatedTeeTimeAvailability[index].is_available = !updatedTeeTimeAvailability[index].is_available
    setTeeTimeAvailability(updatedTeeTimeAvailability)
  }

  // Handle saving changes
  const handleSaveChanges = async () => {
    setIsSaving(true)

    try {
      // Create an array of updates
      const updates = teeTimeAvailability.map((teeTime) => ({
        id: teeTime.id,
        is_available: teeTime.is_available,
      }))

      // Call the bulk update function
      const result = await bulkUpdateTeeTimeAvailability(updates)

      if (result.success) {
        toast({
          title: "Success",
          description: "Tee time availability updated successfully",
        })

        // Update the original availability to match the current state
        setOriginalAvailability(JSON.parse(JSON.stringify(teeTimeAvailability)))
        setHasChanges(false)
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update tee time availability",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving changes:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle refreshing the data
  const handleRefresh = async () => {
    if (!selectedDate) return

    setIsLoading(true)

    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd")
      const result = await getTeeTimeAvailability(formattedDate)

      if (result.success) {
        setTeeTimeAvailability(result.teeTimeAvailability || [])
        setOriginalAvailability(JSON.parse(JSON.stringify(result.teeTimeAvailability || [])))
        setHasChanges(false)

        toast({
          title: "Success",
          description: "Tee time availability refreshed",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to refresh tee time availability",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error refreshing tee time availability:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Filter dates to only show Fridays within the league date range
  const isDateInLeague = (date: Date) => {
    return LEAGUE_FRIDAYS.some(
      (friday) =>
        friday.getFullYear() === date.getFullYear() &&
        friday.getMonth() === date.getMonth() &&
        friday.getDate() === date.getDate(),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tee Time Availability</h2>
          <p className="text-muted-foreground">Manage which tee times are available for booking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button onClick={handleSaveChanges} disabled={!hasChanges || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="md:w-auto">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
            <CardDescription>Choose a Friday between May 23 and August 29, 2025</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => !isDateInLeague(date)}
              initialFocus
            />
          </CardContent>
        </Card>

        <div className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}</CardTitle>
              <CardDescription>Toggle which tee times are available for booking</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : teeTimeAvailability.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {teeTimeAvailability.map((teeTime, index) => {
                      const isChanged = teeTime.is_available !== originalAvailability[index]?.is_available
                      return (
                        <div
                          key={teeTime.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            isChanged ? "bg-yellow-50 border-yellow-200" : "bg-card"
                          }`}
                        >
                          <div>
                            <p className="font-medium">{teeTime.time_slot}</p>
                            <p className="text-sm text-muted-foreground">
                              {teeTime.reserved_slots} of {teeTime.max_slots} slots reserved
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm mr-2">{teeTime.is_available ? "Available" : "Hidden"}</span>
                            <Switch
                              checked={teeTime.is_available}
                              onCheckedChange={() => handleToggleAvailability(index)}
                              aria-label={`Toggle availability for ${teeTime.time_slot}`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">No tee times found for this date</p>
                  <p className="text-sm">Please select another date or generate tee times for this date</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <p className="text-sm text-muted-foreground">
                {hasChanges ? "You have unsaved changes" : "No changes to save"}
              </p>
              <Button onClick={handleSaveChanges} disabled={!hasChanges || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
