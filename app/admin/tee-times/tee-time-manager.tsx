"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2, Plus, Trash2, Clock, Calendar, Settings, CheckCircle, AlertCircle, Users } from "lucide-react"
import {
  saveTemplate,
  generateTeeTimesFromTemplate,
  getTeeTimesForDate,
  toggleTeeTime,
  getUpcomingTeeTimeDates,
  type TeeTimeTemplate,
} from "@/app/actions/tee-time-templates"
import { useToast } from "@/hooks/use-toast"

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface TeeTimeManagerProps {
  season: {
    id: string
    year: number
    name: string
    start_date: string
    end_date: string
  }
  initialTemplate: TeeTimeTemplate | null
}

export function TeeTimeManager({ season, initialTemplate }: TeeTimeManagerProps) {
  const [activeTab, setActiveTab] = useState<"template" | "schedule">("template")

  return (
    <div className="space-y-6">
      {/* Season Info */}
      <div className="p-4 bg-primary/10 border border-primary rounded-lg">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="font-semibold">Active Season: {season.name}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDisplayDate(season.start_date)} — {formatDisplayDate(season.end_date)}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "template"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("template")}
        >
          <Settings className="inline h-4 w-4 mr-2" />
          Weekly Template
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "schedule"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("schedule")}
        >
          <Clock className="inline h-4 w-4 mr-2" />
          Weekly Schedule
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "template" ? (
        <TemplateTab season={season} initialTemplate={initialTemplate} />
      ) : (
        <ScheduleTab season={season} />
      )}
    </div>
  )
}

// ─── TEMPLATE TAB ────────────────────────────────────────────────────────────

function TemplateTab({
  season,
  initialTemplate,
}: {
  season: TeeTimeManagerProps["season"]
  initialTemplate: TeeTimeTemplate | null
}) {
  const { toast } = useToast()

  // Template state
  const [dayOfWeek, setDayOfWeek] = useState(initialTemplate?.day_of_week ?? 5)
  const [timeSlots, setTimeSlots] = useState<string[]>(
    initialTemplate?.time_slots ?? ["15:30", "15:40", "15:50", "16:00", "16:10", "16:20"]
  )
  const [maxSlots, setMaxSlots] = useState(initialTemplate?.max_slots ?? 4)
  const [opensDaysBefore, setOpensDaysBefore] = useState(initialTemplate?.booking_opens_days_before ?? 7)
  const [opensTime, setOpensTime] = useState(initialTemplate?.booking_opens_time?.slice(0, 5) ?? "21:00")
  const [closesDaysBefore, setClosesDaysBefore] = useState(initialTemplate?.booking_closes_days_before ?? 2)
  const [closesTime, setClosesTime] = useState(initialTemplate?.booking_closes_time?.slice(0, 5) ?? "18:00")
  const [timezone] = useState(initialTemplate?.timezone ?? "America/New_York")

  const [newTime, setNewTime] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  const addTimeSlot = () => {
    if (newTime && !timeSlots.includes(newTime)) {
      setTimeSlots([...timeSlots, newTime].sort())
      setNewTime("")
    }
  }

  const removeTimeSlot = (time: string) => {
    setTimeSlots(timeSlots.filter((t) => t !== time))
  }

  const handleSaveTemplate = async () => {
    if (timeSlots.length === 0) {
      toast({ title: "Error", description: "Add at least one time slot", variant: "destructive" })
      return
    }

    setIsSaving(true)
    const result = await saveTemplate({
      season_id: season.id,
      day_of_week: dayOfWeek,
      time_slots: timeSlots,
      max_slots: maxSlots,
      booking_opens_days_before: opensDaysBefore,
      booking_opens_time: opensTime,
      booking_closes_days_before: closesDaysBefore,
      booking_closes_time: closesTime,
      timezone,
    })
    setIsSaving(false)

    if (result.success) {
      toast({ title: "Template saved", description: "Your weekly template has been saved." })
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateResult(null)

    // Save template first
    const saveResult = await saveTemplate({
      season_id: season.id,
      day_of_week: dayOfWeek,
      time_slots: timeSlots,
      max_slots: maxSlots,
      booking_opens_days_before: opensDaysBefore,
      booking_opens_time: opensTime,
      booking_closes_days_before: closesDaysBefore,
      booking_closes_time: closesTime,
      timezone,
    })

    if (!saveResult.success) {
      setIsGenerating(false)
      setGenerateResult({ success: false, error: saveResult.error })
      return
    }

    // Generate tee times
    const result = await generateTeeTimesFromTemplate(season.id)
    setIsGenerating(false)
    setGenerateResult(result)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Time Slots */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Slots
            </CardTitle>
            <CardDescription>Configure recurring tee time slots</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Day of Week</Label>
              <select
                className="w-full mt-1 p-2 border rounded-md bg-background"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {DAYS_OF_WEEK.map((day, i) => (
                  <option key={i} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Max Players Per Tee Time</Label>
              <Input
                type="number"
                min={1}
                max={8}
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value))}
              />
            </div>

            <div>
              <Label>Add Time Slot</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
                <Button onClick={addTimeSlot} size="icon" disabled={!newTime}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Quick Add</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["15:30", "15:40", "15:50", "16:00", "16:10", "16:20"].map((time) => (
                  <Button
                    key={time}
                    variant="outline"
                    size="sm"
                    disabled={timeSlots.includes(time)}
                    onClick={() => {
                      if (!timeSlots.includes(time)) {
                        setTimeSlots([...timeSlots, time].sort())
                      }
                    }}
                  >
                    {formatTime24to12(time)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Current time slots */}
            <div className="space-y-2">
              <Label>Current Slots ({timeSlots.length})</Label>
              {timeSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time slots added</p>
              ) : (
                <div className="space-y-1">
                  {timeSlots.map((time) => (
                    <div key={time} className="flex items-center justify-between p-2 border rounded">
                      <Badge>{formatTime24to12(time)}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => removeTimeSlot(time)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Booking Window */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Booking Window
            </CardTitle>
            <CardDescription>When users can book these tee times</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">How it works:</p>
              <p className="text-muted-foreground mt-1">
                For each {DAYS_OF_WEEK[dayOfWeek]}, the booking window opens a set number of days before and
                closes a set number of days before the tee time date.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Booking Opens</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">Days before</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={opensDaysBefore}
                      onChange={(e) => setOpensDaysBefore(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">At time (ET)</Label>
                    <Input
                      type="time"
                      value={opensTime}
                      onChange={(e) => setOpensTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Booking Closes</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">Days before</Label>
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={closesDaysBefore}
                      onChange={(e) => setClosesDaysBefore(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">At time (ET)</Label>
                    <Input
                      type="time"
                      value={closesTime}
                      onChange={(e) => setClosesTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium mb-2">Example Preview:</p>
              <p className="text-sm text-muted-foreground">
                For a {DAYS_OF_WEEK[dayOfWeek]} tee time, booking would open{" "}
                <span className="font-medium text-foreground">
                  {opensDaysBefore} days before at {formatTime24to12(opensTime)} ET
                </span>{" "}
                and close{" "}
                <span className="font-medium text-foreground">
                  {closesDaysBefore} days before at {formatTime24to12(closesTime)} ET
                </span>.
              </p>
            </div>

            <div className="text-xs text-muted-foreground">
              Timezone: {timezone}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSaveTemplate} disabled={isSaving || timeSlots.length === 0}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Template"
          )}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" disabled={isGenerating || timeSlots.length === 0}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Tee Times for Season"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Generate Tee Times?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create tee times for every {DAYS_OF_WEEK[dayOfWeek]} in the {season.name} (
                {formatDisplayDate(season.start_date)} — {formatDisplayDate(season.end_date)}).
                Existing tee times will have their booking windows updated. New slots will be created where missing.
                Existing reservations will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleGenerate}>Generate</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Generate Result */}
      {generateResult && (
        <Alert variant={generateResult.success ? "default" : "destructive"}>
          {generateResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{generateResult.success ? generateResult.message : generateResult.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ─── SCHEDULE TAB ────────────────────────────────────────────────────────────

function ScheduleTab({ season }: { season: TeeTimeManagerProps["season"] }) {
  const { toast } = useToast()
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [teeTimes, setTeeTimes] = useState<any[]>([])
  const [isLoadingDates, setIsLoadingDates] = useState(true)
  const [isLoadingTimes, setIsLoadingTimes] = useState(false)

  // Load upcoming dates on mount
  useEffect(() => {
    const load = async () => {
      setIsLoadingDates(true)
      const result = await getUpcomingTeeTimeDates()
      if (result.success && result.dates) {
        setDates(result.dates)
        if (result.dates.length > 0) {
          setSelectedDate(result.dates[0])
        }
      }
      setIsLoadingDates(false)
    }
    load()
  }, [])

  // Load tee times when date changes
  useEffect(() => {
    if (!selectedDate) return
    const load = async () => {
      setIsLoadingTimes(true)
      const result = await getTeeTimesForDate(selectedDate)
      if (result.success && result.teeTimes) {
        setTeeTimes(result.teeTimes)
      }
      setIsLoadingTimes(false)
    }
    load()
  }, [selectedDate])

  const handleToggle = async (teeTimeId: string, currentValue: boolean) => {
    const result = await toggleTeeTime(teeTimeId, !currentValue)
    if (result.success) {
      setTeeTimes((prev) =>
        prev.map((tt) => (tt.id === teeTimeId ? { ...tt, is_available: !currentValue } : tt))
      )
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" })
    }
  }

  const getBookingStatus = (tt: any) => {
    if (!tt.booking_opens_at || !tt.booking_closes_at) {
      return { label: "No window set", variant: "secondary" as const }
    }
    const now = new Date()
    const opens = new Date(tt.booking_opens_at)
    const closes = new Date(tt.booking_closes_at)

    if (now < opens) {
      return { label: `Opens ${formatDisplayDateTime(tt.booking_opens_at)}`, variant: "secondary" as const }
    }
    if (now > closes) {
      return { label: "Booking closed", variant: "destructive" as const }
    }
    return { label: "Booking open", variant: "default" as const }
  }

  if (isLoadingDates) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (dates.length === 0) {
    return (
      <div className="p-8 text-center border rounded-lg">
        <p className="text-lg font-medium">No tee times generated yet</p>
        <p className="text-muted-foreground mt-2">
          Go to the Weekly Template tab and generate tee times for the season.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Date Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming Dates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            {dates.map((date) => (
              <button
                key={date}
                className={`w-full text-left px-4 py-3 border-b transition-colors ${
                  selectedDate === date
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-accent/50"
                }`}
                onClick={() => setSelectedDate(date)}
              >
                {formatDisplayDate(date)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tee Times for Selected Date */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedDate ? formatDisplayDate(selectedDate) : "Select a date"}
          </CardTitle>
          <CardDescription>
            Manage tee times for this date. Toggle availability or view reservations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTimes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : teeTimes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tee times for this date.</p>
          ) : (
            <div className="space-y-3">
              {teeTimes.map((tt) => {
                const bookingStatus = getBookingStatus(tt)
                return (
                  <div key={tt.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-medium">
                          {formatTime24to12(tt.time)}
                        </span>
                        <Badge variant={bookingStatus.variant}>{bookingStatus.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {tt.reserved_slots}/{tt.max_slots} booked
                        </span>
                        <span>{tt.available_slots} available</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-sm text-muted-foreground">
                        {tt.is_available ? "Enabled" : "Disabled"}
                      </Label>
                      <Switch
                        checked={tt.is_available}
                        onCheckedChange={() => handleToggle(tt.id, tt.is_available)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatTime24to12(time: string): string {
  // Handle "HH:MM:SS" or "HH:MM" format
  const parts = time.split(":")
  const hours = parseInt(parts[0])
  const minutes = parts[1]
  const period = hours >= 12 ? "PM" : "AM"
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHour}:${minutes} ${period}`
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "—"
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDisplayDateTime(isoStr: string): string {
  const date = new Date(isoStr)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  })
}
