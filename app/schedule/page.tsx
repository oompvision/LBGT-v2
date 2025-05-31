import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Clock, Users } from "lucide-react"

// Add this export to prevent static rendering
export const dynamic = "force-dynamic"

// Helper function to safely format dates without timezone issues
function formatDateSafely(dateString: string): string {
  // Parse the date string as YYYY-MM-DD and treat it as local time
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Helper function to safely format time strings
function formatTimeFromString(timeString: string): string {
  // Parse time string (HH:MM:SS or HH:MM)
  const [hours, minutes] = timeString.split(":").map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

async function getScheduleData() {
  const supabase = createClient()

  // Get today's date in YYYY-MM-DD format for comparison
  const today = new Date()
  const todayString =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0")

  // Get all tee times for current and future dates only
  const { data: teeTimes, error: teeTimesError } = await supabase
    .from("tee_times")
    .select("*")
    .gte("date", todayString) // Only get current and future dates
    .order("date")
    .order("time")

  if (teeTimesError) {
    console.error("Error fetching tee times:", teeTimesError)
    return { teeTimes: [], reservations: [] }
  }

  // Get all reservations with user info
  const { data: reservations, error: reservationsError } = await supabase.from("reservations").select(`
      id,
      tee_time_id,
      user_id,
      slots,
      player_names,
      users (
        name,
        email
      )
    `)

  if (reservationsError) {
    console.error("Error fetching reservations:", reservationsError)
    return { teeTimes, reservations: [] }
  }

  return { teeTimes, reservations }
}

export default async function SchedulePage() {
  const { teeTimes, reservations } = await getScheduleData()

  // Group tee times by date
  const teeTimesByDate =
    teeTimes?.reduce(
      (acc, teeTime) => {
        const date = teeTime.date
        if (!acc[date]) {
          acc[date] = []
        }
        acc[date].push(teeTime)
        return acc
      },
      {} as Record<string, any[]>,
    ) || {}

  // Group reservations by tee time
  const reservationsByTeeTime =
    reservations?.reduce(
      (acc, reservation) => {
        const teeTimeId = reservation.tee_time_id
        if (!acc[teeTimeId]) {
          acc[teeTimeId] = []
        }
        acc[teeTimeId].push(reservation)
        return acc
      },
      {} as Record<string, any[]>,
    ) || {}

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8 flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight">Tour Schedule</h1>
            <p className="text-muted-foreground">View all tee times and reservations for the season</p>
          </div>

          <div className="space-y-8">
            {Object.keys(teeTimesByDate).length > 0 ? (
              Object.entries(teeTimesByDate).map(([date, dateTimes]) => (
                <Card key={date} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>{formatDateSafely(date)}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {dateTimes.map((teeTime) => {
                        const teeTimeReservations = reservationsByTeeTime[teeTime.id] || []
                        const totalSlots = teeTime.max_slots
                        const reservedSlots = teeTimeReservations.reduce((sum, r) => sum + r.slots, 0)
                        const availableSlots = totalSlots - reservedSlots

                        return (
                          <div key={teeTime.id} className="p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{formatTimeFromString(teeTime.time)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {availableSlots} of {totalSlots} slots available
                                </span>
                                {availableSlots === 0 ? (
                                  <Badge variant="destructive">Full</Badge>
                                ) : (
                                  <Badge variant="outline">{availableSlots} Open</Badge>
                                )}
                              </div>
                            </div>

                            {teeTimeReservations.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                <h4 className="text-sm font-medium">Reservations:</h4>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {teeTimeReservations.map((reservation) => (
                                    <div key={reservation.id} className="rounded-md border p-2 text-sm">
                                      <div className="font-medium">{reservation.users.name}</div>
                                      <div className="text-muted-foreground">
                                        {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                                      </div>
                                      {reservation.player_names && reservation.player_names.length > 0 && (
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          Players: {reservation.player_names.join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-sm text-muted-foreground">No reservations yet</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Tee Times Available</CardTitle>
                  <CardDescription>Tee times for the season have not been added yet.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
