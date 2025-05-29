"use client"

import { useState, useEffect } from "react"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Trash2, Calendar, Clock, Users, AlertCircle, CheckCircle, Info } from "lucide-react"
import {
  createManualTeeTimes,
  getAllManualTeeTimes,
  deleteManualTeeTime,
  toggleTeeTimeAvailability,
  checkExistingTeeTimes,
} from "@/app/actions/manual-tee-times"
import { useToast } from "@/hooks/use-toast"

export default function ManualTeeTimesPage() {
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [newTime, setNewTime] = useState("")
  const [existingTeeTimes, setExistingTeeTimes] = useState<any[]>([])
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const { toast } = useToast()

  // Set default date to today
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    setSelectedDate(today)
  }, [])

  // Load existing tee times
  useEffect(() => {
    loadTeeTimes()
  }, [])

  // Check for duplicates when date or times change
  useEffect(() => {
    if (selectedDate && selectedTimes.length > 0) {
      checkForDuplicates()
    } else {
      setDuplicateWarning([])
    }
  }, [selectedDate, selectedTimes])

  const checkForDuplicates = async () => {
    if (!selectedDate || selectedTimes.length === 0) return

    setIsCheckingDuplicates(true)
    try {
      const result = await checkExistingTeeTimes(selectedDate, selectedTimes)
      if (result.success) {
        setDuplicateWarning(result.existingTimes)
      }
    } catch (error) {
      console.error("Error checking duplicates:", error)
    } finally {
      setIsCheckingDuplicates(false)
    }
  }

  const loadTeeTimes = async () => {
    setIsLoading(true)
    try {
      const result = await getAllManualTeeTimes()
      if (result.success) {
        setExistingTeeTimes(result.teeTimes)
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading tee times:", error)
      toast({
        title: "Error",
        description: "Failed to load tee times",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addTime = () => {
    if (newTime && !selectedTimes.includes(newTime)) {
      setSelectedTimes([...selectedTimes, newTime].sort())
      setNewTime("")
    }
  }

  const removeTime = (timeToRemove: string) => {
    setSelectedTimes(selectedTimes.filter((time) => time !== timeToRemove))
  }

  const handleSave = async () => {
    if (!selectedDate || selectedTimes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a date and at least one time",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await createManualTeeTimes(selectedDate, selectedTimes)

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })

        // Clear the selected times but keep the date
        setSelectedTimes([])
        setDuplicateWarning([])

        // Reload tee times
        await loadTeeTimes()
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving tee times:", error)
      toast({
        title: "Error",
        description: "Failed to save tee times",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (teeTimeId: string) => {
    if (!confirm("Are you sure you want to delete this tee time?")) {
      return
    }

    try {
      const result = await deleteManualTeeTime(teeTimeId)

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        await loadTeeTimes()
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting tee time:", error)
      toast({
        title: "Error",
        description: "Failed to delete tee time",
        variant: "destructive",
      })
    }
  }

  const handleToggleAvailability = async (teeTimeId: string, isAvailable: boolean) => {
    try {
      const result = await toggleTeeTimeAvailability(teeTimeId, isAvailable)

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        await loadTeeTimes()
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error toggling availability:", error)
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      })
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minutes} ${period}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const newTimesCount = selectedTimes.filter((time) => !duplicateWarning.includes(time)).length

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 py-8">
        <div className="container max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Manual Tee Time Management</h1>
            <p className="text-muted-foreground">Set available tee times for members to book</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Date and Time Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Create New Tee Times
                </CardTitle>
                <CardDescription>Choose the date and available tee times</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Add Time</Label>
                  <div className="flex gap-2">
                    <Input
                      id="time"
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      placeholder="15:40"
                    />
                    <Button onClick={addTime} size="icon" disabled={!newTime}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quick Add Common Times</Label>
                  <div className="flex flex-wrap gap-2">
                    {["15:40", "15:50", "16:00", "16:10", "16:20", "16:30", "16:40"].map((time) => (
                      <Button
                        key={time}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!selectedTimes.includes(time)) {
                            setSelectedTimes([...selectedTimes, time].sort())
                          }
                        }}
                      >
                        {formatTime(time)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Duplicate Warning */}
                {duplicateWarning.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {duplicateWarning.length} time(s) already exist for {selectedDate}:{" "}
                      {duplicateWarning.map((time) => formatTime(time)).join(", ")}. These will be skipped.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Selected Times Preview */}
                {selectedTimes.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Times</Label>
                    <div className="space-y-2">
                      {selectedTimes.map((time) => (
                        <div key={time} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant={duplicateWarning.includes(time) ? "secondary" : "default"}>
                              {formatTime(time)}
                            </Badge>
                            {duplicateWarning.includes(time) && (
                              <span className="text-xs text-muted-foreground">(exists)</span>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeTime(time)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={!selectedDate || selectedTimes.length === 0 || isSaving || newTimesCount === 0}
                  className="w-full"
                >
                  {isSaving
                    ? "Saving..."
                    : newTimesCount === 0
                      ? "No new times to save"
                      : `Save ${newTimesCount} New Tee Time${newTimesCount === 1 ? "" : "s"}`}
                </Button>
              </CardContent>
            </Card>

            {/* Current Tee Times */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Current Available Tee Times
                </CardTitle>
                <CardDescription>All currently available tee times for booking</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : existingTeeTimes.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {existingTeeTimes.map((teeTime) => (
                      <div key={teeTime.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{formatDate(teeTime.date)}</h4>
                            <p className="text-sm text-muted-foreground">{formatTime(teeTime.time)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={teeTime.is_available && (teeTime.max_slots || 0) > 0}
                              onCheckedChange={(checked) => handleToggleAvailability(teeTime.id, checked)}
                            />
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(teeTime.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {teeTime.availableSlots} of {teeTime.max_slots || 4} available
                            </span>
                          </div>

                          {teeTime.reservedSlots > 0 && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>{teeTime.reservedSlots} reserved</span>
                            </div>
                          )}

                          {(teeTime.max_slots || 0) > 0 ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span>Available</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>Disabled</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No tee times created yet. Use the form to create your first tee times.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
