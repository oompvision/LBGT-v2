"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, isFriday } from "date-fns"
import { CalendarIcon, Loader2, Save, CheckCircle, XCircle, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  getLeagueTeeTimesByDate,
  generateTeeTimesForDate,
  bulkUpdateTeeTimeAvailability,
} from "@/app/actions/league-tee-times"

// Define the league date range
const LEAGUE_START_DATE = new Date(2025, 4, 23) // May 23, 2025
const LEAGUE_END_DATE = new Date(2025, 7, 29) // August 29, 2025

// Define the time range
const START_TIME = "15:00" // 3:00 PM
const END_TIME = "17:00" // 5:00 PM

export function LeagueTeeTimeManager() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(LEAGUE_START_DATE)
  const [leagueDates, setLeagueDates] = useState<Date[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [teeTimes, setTeeTimes] = useState<any[]>([])
  const [originalTeeTimes, setOriginalTeeTimes] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("upcoming")
  const [hasChanges, setHasChanges] = useState(false)

  const router = useRouter()
  const { toast } = useToast()

  // Load all league dates
  useEffect(() => {
    const loadLeagueDates = async () => {
      try {
        // Get all Fridays between May 23, 2025 and August 29, 2025
        const dates: Date[] = []
        const currentDate = new Date(LEAGUE_START_DATE)

        while (currentDate <= LEAGUE_END_DATE) {
          if (isFriday(currentDate)) {
            dates.push(new Date(currentDate))
          }
          currentDate.setDate(currentDate.getDate() + 1)
        }

        setLeagueDates(dates)
      } catch (error) {
        console.error("Error loading league dates:", error)
      }
    }

    loadLeagueDates()
  }, [])

  // Load tee times for the selected date
  useEffect(() => {
    const loadTeeTimes = async () => {
      if (!selectedDate) return

      setIsLoading(true)

      try {
        // Format date for API
        const formattedDate = format(selectedDate, "yyyy-MM-dd")

        const result = await getLeagueTeeTimesByDate(formattedDate)

        if (result.success) {
          setTeeTimes(result.teeTimes || [])
          setOriginalTeeTimes(JSON.parse(JSON.stringify(result.teeTimes || [])))
          setHasChanges(false)
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to load tee times",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error loading tee times:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred while loading tee times",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadTeeTimes()
  }, [selectedDate, toast])

  // Check for changes
  useEffect(() => {
    if (teeTimes.length !== originalTeeTimes.length) {
      setHasChanges(true)
      return
    }

    const hasChanges = teeTimes.some((teeTime, index) => {
      return teeTime.is_available !== originalTeeTimes[index]?.is_available
    })

    setHasChanges(hasChanges)
  }, [teeTimes, originalTeeTimes])

  // Toggle tee time availability
  const handleToggleAvailability = async (teeTimeId: string, isAvailable: boolean) => {
    // Update local state first for immediate feedback
    setTeeTimes((prevTeeTimes) =>
      prevTeeTimes.map((teeTime) => (teeTime.id === teeTimeId ? { ...teeTime, is_available: isAvailable } : teeTime)),
    )
  }

  // Save all changes at once
  const handleSaveAll = async () => {
    if (!hasChanges) {
      toast({
        title: "No Changes",
        description: "No changes to save",
      })
      return
    }

    setIsSaving(true)

    try {
      // Prepare data for bulk update
      const updates = teeTimes.map((teeTime) => ({
        id: teeTime.id,
        is_available: teeTime.is_available,
      }))

      // Use bulk update instead of individual updates
      const result = await bulkUpdateTeeTimeAvailability(updates)

      if (result.success) {
        toast({
          title: "Success",
          description: "All tee time availability settings saved successfully",
        })

        // Update original state to match current state
        setOriginalTeeTimes(JSON.parse(JSON.stringify(teeTimes)))
        setHasChanges(false)

        // Force a hard refresh to ensure all pages get the latest data
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save changes",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving tee time availability:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving changes",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Generate tee times for the selected date
  const handleGenerateTimes = async () => {
    if (!selectedDate) return

    setIsGenerating(true)

    try {
      // Format date for API
      const formattedDate = format(selectedDate, "yyyy-MM-dd")

      const result = await generateTeeTimesForDate(formattedDate)

      if (result.success) {
        toast({
          title: "Success",
          description: "Tee times generated successfully",
        })

        // Reload tee times
        const updatedResult = await getLeagueTeeTimesByDate(formattedDate)
        if (updatedResult.success) {
          setTeeTimes(updatedResult.teeTimes || [])
          setOriginalTeeTimes(JSON.parse(JSON.stringify(updatedResult.teeTimes || [])))
          setHasChanges(false)
        }

        // Force a hard refresh to ensure all pages get the latest data
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to generate tee times",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error generating tee times:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while generating tee times",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Filter dates to only show Fridays within the league date range
  const isDateInLeague = (date: Date) => {
    return (
      date >= LEAGUE_START_DATE && date <= LEAGUE_END_DATE && date.getDay() === 5 // 5 = Friday
    )
  }

  // Format time for display
  const formatTimeDisplay = (time: string) => {
    try {
      const [hours, minutes] = time.split(":")
      const date = new Date()
      date.setHours(Number.parseInt(hours, 10))
      date.setMinutes(Number.parseInt(minutes, 10))
      return format(date, "h:mm a")
    } catch (error) {
      return time
    }
  }

  // Get upcoming and past dates
  const now = new Date()
  const upcomingDates = leagueDates.filter((date) => date >= now)
  const pastDates = leagueDates.filter((date) => date < now)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">League Tee Time Manager</h2>
          <p className="text-muted-foreground">Manage tee time availability for the 2025 season (May 23 - August 29)</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Important Information</AlertTitle>
        <AlertDescription>
          This page allows you to manage tee times for the 2025 season. You can only select Fridays between May 23, 2025
          and August 29, 2025. Time slots are restricted to 3:00 PM - 5:00 PM in 10-minute intervals.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming Fridays</TabsTrigger>
          <TabsTrigger value="past">Past Fridays</TabsTrigger>
          <TabsTrigger value="all">All Fridays</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingDates.map((date) => (
              <Button
                key={date.toISOString()}
                variant={
                  selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
                    ? "default"
                    : "outline"
                }
                className="h-auto py-4 justify-start"
                onClick={() => setSelectedDate(date)}
              >
                <div className="flex flex-col items-start">
                  <span className="text-lg font-medium">{format(date, "MMMM d, yyyy")}</span>
                  <span className="text-sm text-muted-foreground">Friday</span>
                </div>
              </Button>
            ))}
          </div>

          {upcomingDates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No upcoming Fridays available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastDates.map((date) => (
              <Button
                key={date.toISOString()}
                variant={
                  selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
                    ? "default"
                    : "outline"
                }
                className="h-auto py-4 justify-start"
                onClick={() => setSelectedDate(date)}
              >
                <div className="flex flex-col items-start">
                  <span className="text-lg font-medium">{format(date, "MMMM d, yyyy")}</span>
                  <span className="text-sm text-muted-foreground">Friday</span>
                </div>
              </Button>
            ))}
          </div>

          {pastDates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No past Fridays available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => !isDateInLeague(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leagueDates.map((date) => (
              <Button
                key={date.toISOString()}
                variant={
                  selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
                    ? "default"
                    : "outline"
                }
                className="h-auto py-4 justify-start"
                onClick={() => setSelectedDate(date)}
              >
                <div className="flex flex-col items-start">
                  <span className="text-lg font-medium">{format(date, "MMMM d, yyyy")}</span>
                  <span className="text-sm text-muted-foreground">Friday</span>
                </div>
              </Button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {selectedDate && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Tee Times for {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
              <CardDescription>
                Manage availability for each time slot. Unavailable times won't be shown to members.
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleGenerateTimes} disabled={isGenerating || isLoading}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Times"
                )}
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={isSaving || isLoading || !hasChanges}
                variant={hasChanges ? "default" : "outline"}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save All
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : teeTimes.length > 0 ? (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Time</th>
                      <th className="px-4 py-2 text-center font-medium">Slots</th>
                      <th className="px-4 py-2 text-center font-medium">Reservations</th>
                      <th className="px-4 py-2 text-center font-medium">Available</th>
                      <th className="px-4 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teeTimes
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((teeTime) => {
                        const reservedSlots = teeTime.reserved_slots || 0
                        const availableSlots = teeTime.max_slots - reservedSlots
                        const isFull = availableSlots <= 0
                        const originalTeeTime = originalTeeTimes.find((t) => t.id === teeTime.id)
                        const hasChanged = originalTeeTime && originalTeeTime.is_available !== teeTime.is_available

                        return (
                          <tr key={teeTime.id} className={`border-b ${hasChanged ? "bg-yellow-50" : ""}`}>
                            <td className="px-4 py-2 font-medium">{formatTimeDisplay(teeTime.time)}</td>
                            <td className="px-4 py-2 text-center">{teeTime.max_slots}</td>
                            <td className="px-4 py-2 text-center">
                              {reservedSlots} / {teeTime.max_slots}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex justify-center">
                                      <Switch
                                        checked={teeTime.is_available !== false}
                                        onCheckedChange={(checked) => handleToggleAvailability(teeTime.id, checked)}
                                        disabled={isFull}
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isFull
                                      ? "This time slot is fully booked"
                                      : teeTime.is_available !== false
                                        ? "Click to make unavailable"
                                        : "Click to make available"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                            <td className="px-4 py-2 text-center">
                              {isFull ? (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Full
                                </Badge>
                              ) : teeTime.is_available !== false ? (
                                <Badge variant="success" className="gap-1 bg-green-500">
                                  <CheckCircle className="h-3 w-3" />
                                  Available
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1">
                                  <Info className="h-3 w-3" />
                                  Hidden
                                </Badge>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No Tee Times Available</h3>
                <p className="text-muted-foreground mb-4">
                  There are no tee times set up for this date yet. Click the button below to generate tee times.
                </p>
                <Button onClick={handleGenerateTimes} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Tee Times"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/50 px-6 py-4">
            <div className="flex items-center text-sm text-muted-foreground">
              <Info className="h-4 w-4 mr-2" />
              Only times between 3:00 PM and 5:00 PM are available for the league.
              {hasChanges && (
                <span className="ml-4 text-yellow-600 font-medium">
                  You have unsaved changes. Click "Save All" to apply them.
                </span>
              )}
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
