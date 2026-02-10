import { AdminTabs } from "../admin-tabs"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Prevent prerendering and force dynamic rendering
export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper function to format time from time string
function formatTimeFromString(timeString: string): string {
  if (!timeString) return "Unknown Time"

  try {
    // If it's already in HH:MM format, parse it directly
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours, 10)
    const minute = Number.parseInt(minutes, 10)

    if (isNaN(hour) || isNaN(minute)) return "Unknown Time"

    const period = hour >= 12 ? "PM" : "AM"
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

    return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
  } catch (error) {
    return "Unknown Time"
  }
}

// Helper function to format date safely
function formatDateSafely(dateString: string): string {
  if (!dateString) return "Unknown Date"

  try {
    // Parse the date string and format it
    const date = new Date(dateString + "T00:00:00") // Add time to avoid timezone issues
    if (isNaN(date.getTime())) return "Invalid Date"

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch (error) {
    return "Invalid Date"
  }
}

export default async function AdminReservationsPage() {
  let reservations = null
  let error = null

  try {
    const supabase = await createClient()

    // Fetch all reservations with related data
    const { data, error: fetchError } = await supabase
      .from("reservations")
      .select(`
        *,
        tee_times (
          date,
          time
        ),
        users (
          name,
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (fetchError) {
      error = fetchError
    } else {
      reservations = data
    }
  } catch (err) {
    error = { message: "Failed to load reservations" }
  }

  // Group reservations by date
  const reservationsByDate = {}

  if (reservations) {
    reservations.forEach((reservation) => {
      const date = reservation.tee_times?.date
      if (date) {
        if (!reservationsByDate[date]) {
          reservationsByDate[date] = []
        }
        reservationsByDate[date].push(reservation)
      }
    })
  }

  // Sort dates in descending order
  const sortedDates = Object.keys(reservationsByDate).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Admin</h1>
      <AdminTabs />

      <div className="mt-6">
        <h2 className="text-2xl font-bold mb-4">Reservations Management</h2>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">Error loading reservations: {error.message}</p>
              </div>
            </div>
          </div>
        )}

        {sortedDates.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Reservations</CardTitle>
              <CardDescription>There are no reservations in the system yet.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div key={date}>
                <h3 className="text-xl font-semibold mb-3">{formatDateSafely(date)}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reservationsByDate[date].map((reservation) => (
                    <Card key={reservation.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {formatTimeFromString(reservation.tee_times?.time)}
                            </CardTitle>
                            <CardDescription>Reserved by {reservation.users?.name || "Unknown User"}</CardDescription>
                          </div>
                          <div className="bg-lbgt-light text-white px-2 py-1 rounded text-sm">
                            {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          <div className="font-medium">{reservation.users?.email || "No email"}</div>
                          {Array.isArray(reservation.player_names) && reservation.player_names.length > 0 && (
                            <div className="mt-2">
                              <div className="font-medium">Additional Players:</div>
                              <ul className="list-disc list-inside text-muted-foreground">
                                {reservation.player_names.map((name, index) => (
                                  <li key={index}>{name || "Unnamed Player"}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(reservation.play_for_money) && reservation.play_for_money.length > 0 && (
                            <div className="mt-2">
                              <div className="font-medium">Playing for Money:</div>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full ${reservation.play_for_money[0] ? "bg-green-500" : "bg-gray-300"}`}
                                  ></div>
                                  <span>
                                    {reservation.users?.name || "Main Player"}:{" "}
                                    {reservation.play_for_money[0] ? "Yes" : "No"}
                                  </span>
                                </div>
                                {reservation.player_names.map((name, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <div
                                      className={`w-3 h-3 rounded-full ${reservation.play_for_money[index + 1] ? "bg-green-500" : "bg-gray-300"}`}
                                    ></div>
                                    <span>
                                      {name || `Player ${index + 2}`}:{" "}
                                      {reservation.play_for_money[index + 1] ? "Yes" : "No"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
