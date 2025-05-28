"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns"
import { CalendarIcon, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { getAllTeeTimesByWeek, updateTeeTimeAvailability, createTeeTime, deleteTeeTime } from "@/app/actions/tee-times"

export function TeeTimeAvailability() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [teeTimes, setTeeTimes] = useState<any[]>([])
  const [newTeeTime, setNewTeeTime] = useState({
    date: "",
    time: "",
    maxSlots: 4,
  })
  const [isAddingTeeTime, setIsAddingTeeTime] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const router = useRouter()
  const { toast } = useToast()

  // Load tee times for the selected week
  useEffect(() => {
    const loadTeeTimes = async () => {
      setIsLoading(true)

      // Calculate start and end of week
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 }) // Start on Monday
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 }) // End on Sunday

      // Generate array of dates for the week
      const dates = []
      for (let i = 0; i < 7; i++) {
        dates.push(addDays(start, i))
      }
      setWeekDates(dates)

      try {
        // Format dates for API
        const startDate = format(start, "yyyy-MM-dd")
        const endDate = format(end, "yyyy-MM-dd")

        const result = await getAllTeeTimesByWeek(startDate, endDate)

        if (result.success) {
          setTeeTimes(result.teeTimes || [])
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

  // Toggle tee time availability
  const handleToggleAvailability = async (teeTimeId: string, isAvailable: boolean) => {
    // Update local state first for immediate feedback
    setTeeTimes((prevTeeTimes) =>
      prevTeeTimes.map((teeTime) => (teeTime.id === teeTimeId ? { ...teeTime, is_available: isAvailable } : teeTime)),
    )

    try {
      const result = await updateTeeTimeAvailability(teeTimeId, isAvailable)

      if (!result.success) {
        // Revert local state if update failed
        setTeeTimes((prevTeeTimes) =>
          prevTeeTimes.map((teeTime) =>
            teeTime.id === teeTimeId ? { ...teeTime, is_available: !isAvailable } : teeTime,
          ),
        )

        toast({
          title: "Error",
          description: result.error || "Failed to update tee time availability",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating tee time availability:", error)

      // Revert local state
      setTeeTimes((prevTeeTimes) =>
        prevTeeTimes.map((teeTime) =>
          teeTime.id === teeTimeId ? { ...teeTime, is_available: !isAvailable } : teeTime,
        ),
      )

      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  // Save all changes at once
  const handleSaveAll = async () => {
    setIsSaving(true)

    try {
      // Create an array of promises for all updates
      const updatePromises = teeTimes.map((teeTime) => updateTeeTimeAvailability(teeTime.id, teeTime.is_available))

      // Wait for all updates to complete
      const results = await Promise.all(updatePromises)

      // Check if any updates failed
      const failures = results.filter((result) => !result.success)

      if (failures.length > 0) {
        toast({
          title: "Warning",
          description: `${failures.length} updates failed. Please try again.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Success",
          description: "All tee time availability settings saved successfully",
        })

        // Refresh the page to get the latest data
        router.refresh()
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

  // Add a new tee time
  const handleAddTeeTime = async () => {
    if (!newTeeTime.date || !newTeeTime.time) {
      toast({
        title: "Validation Error",
        description: "Please select both date and time",
        variant: "destructive",
      })
      return
    }

    setIsAddingTeeTime(true)

    try {
      const result = await createTeeTime({
        date: newTeeTime.date,
        time: newTeeTime.time,
        maxSlots: newTeeTime.maxSlots,
      })

      if (result.success) {
        toast({
          title: "Success",
          description: "Tee time added successfully",
        })

        // Reset form
        setNewTeeTime({
          date: "",
          time: "",
          maxSlots: 4,
        })

        // Refresh data
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add tee time",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding tee time:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding tee time",
        variant: "destructive",
      })
    } finally {
      setIsAddingTeeTime(false)
    }
  }

  // Delete a tee time
  const handleDeleteTeeTime = async (teeTimeId: string) => {
    if (!confirm("Are you sure you want to delete this tee time? This action cannot be undone.")) {
      return
    }

    setIsDeleting(teeTimeId)

    try {
      const result = await deleteTeeTime(teeTimeId)

      if (result.success) {
        toast({
          title: "Success",
          description: "Tee time deleted successfully",
        })

        // Update local state
        setTeeTimes((prevTeeTimes) => prevTeeTimes.filter((teeTime) => teeTime.id !== teeTimeId))
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete tee time",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting tee time:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting tee time",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  // Group tee times by date
  const teeTimesByDate = teeTimes.reduce(
    (acc, teeTime) => {
      const date = teeTime.date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(teeTime)
      return acc
    },
    {} as Record<string, any[]>,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tee Time Availability</h2>
          <p className="text-muted-foreground">Manage which tee times are available for booking</p>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "MMMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button onClick={handleSaveAll} disabled={isSaving || isLoading}>
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Week of {format(weekDates[0], "MMMM d, yyyy")}</CardTitle>
              <CardDescription>
                Toggle availability for each tee time. Unavailable times won't be shown to members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {weekDates.map((date) => {
                  const dateStr = format(date, "yyyy-MM-dd")
                  const dayTeeTimes = teeTimesByDate[dateStr] || []

                  return (
                    <div key={dateStr} className="space-y-2">
                      <h3 className="font-medium">{format(date, "EEEE, MMMM d")}</h3>

                      {dayTeeTimes.length > 0 ? (
                        <div className="rounded-md border">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-4 py-2 text-left font-medium">Time</th>
                                <th className="px-4 py-2 text-center font-medium">Slots</th>
                                <th className="px-4 py-2 text-center font-medium">Available</th>
                                <th className="px-4 py-2 text-right font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dayTeeTimes
                                .sort((a, b) => a.time.localeCompare(b.time))
                                .map((teeTime) => (
                                  <tr key={teeTime.id} className="border-b">
                                    <td className="px-4 py-2">
                                      {format(parseISO(`2000-01-01T${teeTime.time}`), "h:mm a")}
                                    </td>
                                    <td className="px-4 py-2 text-center">{teeTime.max_slots}</td>
                                    <td className="px-4 py-2 text-center">
                                      <Switch
                                        checked={teeTime.is_available !== false}
                                        onCheckedChange={(checked) => handleToggleAvailability(teeTime.id, checked)}
                                      />
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDeleteTeeTime(teeTime.id)}
                                        disabled={isDeleting === teeTime.id}
                                      >
                                        {isDeleting === teeTime.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed p-6 text-center">
                          <p className="text-muted-foreground">No tee times available for this day</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add New Tee Time</CardTitle>
              <CardDescription>Create a new tee time slot for members to book</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newTeeTime.date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTeeTime.date ? format(parseISO(newTeeTime.date), "MMMM d, yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newTeeTime.date ? parseISO(newTeeTime.date) : undefined}
                        onSelect={(date) =>
                          setNewTeeTime({
                            ...newTeeTime,
                            date: date ? format(date, "yyyy-MM-dd") : "",
                          })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Select
                    value={newTeeTime.time}
                    onValueChange={(value) => setNewTeeTime({ ...newTeeTime, time: value })}
                  >
                    <SelectTrigger id="time">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only show the specific times we want */}
                      <SelectItem value="15:30:00">3:30 PM</SelectItem>
                      <SelectItem value="15:40:00">3:40 PM</SelectItem>
                      <SelectItem value="15:50:00">3:50 PM</SelectItem>
                      <SelectItem value="16:00:00">4:00 PM</SelectItem>
                      <SelectItem value="16:10:00">4:10 PM</SelectItem>
                      <SelectItem value="16:20:00">4:20 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-slots">Max Slots</Label>
                  <Select
                    value={newTeeTime.maxSlots.toString()}
                    onValueChange={(value) =>
                      setNewTeeTime({
                        ...newTeeTime,
                        maxSlots: Number.parseInt(value, 10),
                      })
                    }
                  >
                    <SelectTrigger id="max-slots">
                      <SelectValue placeholder="Select max slots" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 slot</SelectItem>
                      <SelectItem value="2">2 slots</SelectItem>
                      <SelectItem value="3">3 slots</SelectItem>
                      <SelectItem value="4">4 slots</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleAddTeeTime} disabled={isAddingTeeTime || !newTeeTime.date || !newTeeTime.time}>
                {isAddingTeeTime ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Tee Time
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
