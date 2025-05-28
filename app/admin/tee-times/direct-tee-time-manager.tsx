"use client"

import { useState, useEffect } from "react"
import { format, addDays, isFriday } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { forceUpdateTeeTimeAvailability, verifyTeeTimeAvailability } from "@/app/actions/debug-utils"

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

// Function to fetch tee times directly from the database
async function fetchTeeTimes(date: string) {
  try {
    const response = await fetch(`/api/admin/tee-times?date=${date}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch tee times: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching tee times:", error)
    throw error
  }
}

// Function to update a tee time's availability
async function updateTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  try {
    const response = await fetch(`/api/admin/tee-times/${teeTimeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_available: isAvailable }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update tee time: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error updating tee time:", error)
    throw error
  }
}

export function DirectTeeTimeManager() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(LEAGUE_FRIDAYS[0])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [teeTimeAvailability, setTeeTimeAvailability] = useState<any[]>([])
  const [originalAvailability, setOriginalAvailability] = useState<any[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<Record<string, { success: boolean; message: string }>>({})
  const { toast } = useToast()

  // Load tee time availability for the selected date
  useEffect(() => {
    const loadTeeTimeAvailability = async () => {
      if (!selectedDate) return

      setIsLoading(true)
      setUpdateStatus({})

      try {
        const formattedDate = format(selectedDate, "yyyy-MM-dd")
        const result = await fetchTeeTimes(formattedDate)

        if (result.success) {
          setTeeTimeAvailability(result.teeTimes || [])
          setOriginalAvailability(JSON.parse(JSON.stringify(result.teeTimes || [])))
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

  // Handle saving a single tee time's availability
  const handleSaveSingleTeeTime = async (teeTimeId: string, isAvailable: boolean) => {
    setUpdateStatus((prev) => ({
      ...prev,
      [teeTimeId]: { success: false, message: "Saving..." },
    }))

    try {
      // First, try to update using the API
      await updateTeeTimeAvailability(teeTimeId, isAvailable)

      // Then, verify the update was successful
      const verifyResult = await verifyTeeTimeAvailability(teeTimeId, isAvailable)

      if (verifyResult.success && verifyResult.matches) {
        setUpdateStatus((prev) => ({
          ...prev,
          [teeTimeId]: { success: true, message: "Saved successfully" },
        }))
      } else {
        // If verification fails, try to force the update
        const forceResult = await forceUpdateTeeTimeAvailability(teeTimeId, isAvailable)

        if (forceResult.success) {
          setUpdateStatus((prev) => ({
            ...prev,
            [teeTimeId]: { success: true, message: "Saved successfully (forced)" },
          }))
        } else {
          setUpdateStatus((prev) => ({
            ...prev,
            [teeTimeId]: { success: false, message: forceResult.error || "Failed to save" },
          }))
        }
      }
    } catch (error) {
      console.error(`Error saving tee time ${teeTimeId}:`, error)
      setUpdateStatus((prev) => ({
        ...prev,
        [teeTimeId]: { success: false, message: "Failed to save" },
      }))
    }
  }

  // Handle saving all changes
  const handleSaveChanges = async () => {
    setIsSaving(true)

    try {
      // Find all tee times that have changed
      const changedTeeTimes = teeTimeAvailability.filter((teeTime, index) => {
        return teeTime.is_available !== originalAvailability[index]?.is_available
      })

      // Save each changed tee time individually
      for (const teeTime of changedTeeTimes) {
        await handleSaveSingleTeeTime(teeTime.id, teeTime.is_available)
      }

      // Update the original availability to match the current state
      setOriginalAvailability(JSON.parse(JSON.stringify(teeTimeAvailability)))
      setHasChanges(false)

      toast({
        title: "Success",
        description: "Tee time availability updated successfully",
      })
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
    setUpdateStatus({})

    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd")
      const result = await fetchTeeTimes(formattedDate)

      if (result.success) {
        setTeeTimeAvailability(result.teeTimes || [])
        setOriginalAvailability(JSON.parse(JSON.stringify(result.teeTimes || [])))
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
            Save All Changes
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
                      const status = updateStatus[teeTime.id]
                      return (
                        <div
                          key={teeTime.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            isChanged ? "bg-yellow-50 border-yellow-200" : "bg-card"
                          }`}
                        >
                          <div>
                            <p className="font-medium">{teeTime.time}</p>
                            <p className="text-sm text-muted-foreground">
                              {teeTime.reserved_slots} of {teeTime.max_slots} slots reserved
                            </p>
                            {status && (
                              <div
                                className={`text-xs mt-1 flex items-center ${
                                  status.success ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {status.success ? (
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                )}
                                {status.message}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm mr-2">{teeTime.is_available ? "Available" : "Hidden"}</span>
                              <Switch
                                checked={teeTime.is_available}
                                onCheckedChange={() => handleToggleAvailability(index)}
                                aria-label={`Toggle availability for ${teeTime.time}`}
                              />
                            </div>
                            {isChanged && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveSingleTeeTime(teeTime.id, teeTime.is_available)}
                                disabled={!!status && status.message === "Saving..."}
                              >
                                {status && status.message === "Saving..." ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                Save
                              </Button>
                            )}
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
                Save All Changes
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
