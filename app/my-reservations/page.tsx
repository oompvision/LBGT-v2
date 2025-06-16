export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, Clock, Plus } from "lucide-react"
import { ReservationActions } from "./reservation-actions"

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

export default async function MyReservationsPage() {
  const supabase = createClient()

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/signin")
  }

  // Get user's reservations
  const { data: userReservations, error } = await supabase
    .from("reservations")
    .select(`
      id,
      tee_time_id,
      slots,
      player_names,
      play_for_money,
      tee_times (
        id,
        date,
        time
      )
    `)
    .eq("user_id", session.user.id)
    .order("tee_times(date)", { ascending: true })
    .order("tee_times(time)", { ascending: true })

  if (error) {
    console.error("Error fetching reservations:", error)
  }

  // Get user data for display
  const { data: userData } = await supabase.from("users").select("name").eq("id", session.user.id).single()

  // Group reservations by date
  const reservationsByDate = (userReservations || []).reduce(
    (acc, reservation) => {
      const date = reservation.tee_times.date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(reservation)
      return acc
    },
    {} as Record<string, typeof userReservations>,
  )

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Reservations</h1>
              <p className="text-muted-foreground">View and manage your tee time reservations</p>
            </div>
            <Link href="/book-tee-time">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Book Tee Time
              </Button>
            </Link>
          </div>

          {Object.keys(reservationsByDate).length > 0 ? (
            <div className="space-y-8">
              {Object.entries(reservationsByDate).map(([date, dateReservations]) => (
                <Card key={date}>
                  <CardHeader className="bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>{formatDateSafely(date)}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {dateReservations.map((reservation) => (
                        <div key={reservation.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{formatTimeFromString(reservation.tee_times.time)}</span>
                              </div>
                              <div className="mt-2">
                                <p className="font-medium">
                                  {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                                </p>

                                <div className="mt-1 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{userData?.name || "You"}</span>
                                    {reservation.play_for_money && reservation.play_for_money[0] && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                        Playing for money
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {reservation.player_names && reservation.player_names.length > 0 && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    <p>Additional players:</p>
                                    <ul className="list-inside list-disc">
                                      {reservation.player_names.map((name, i) => (
                                        <li key={i} className="flex items-center gap-2">
                                          <span>{name}</span>
                                          {reservation.play_for_money && reservation.play_for_money[i + 1] && (
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                              Playing for money
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <ReservationActions reservationId={reservation.id} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Reservations</CardTitle>
                <CardDescription>You haven&apos;t made any tee time reservations yet.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Link href="/book-tee-time">
                  <Button>Book Your First Tee Time</Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
