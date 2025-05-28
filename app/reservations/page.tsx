export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatTime } from "@/lib/utils"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, Clock, Plus } from "lucide-react"

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
            <Link href="/dashboard">
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
                      <CardTitle>{formatDate(new Date(date))}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {dateReservations.map((reservation) => (
                        <div key={reservation.id} className="p-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatTime(reservation.tee_times.time)}</span>
                          </div>
                          <div className="mt-2">
                            <p className="font-medium">
                              {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                            </p>
                            {reservation.player_names && reservation.player_names.length > 0 && (
                              <div className="mt-1 text-sm text-muted-foreground">
                                <p>Additional players:</p>
                                <ul className="list-inside list-disc">
                                  {reservation.player_names.map((name, i) => (
                                    <li key={i}>{name}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
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
                <Link href="/dashboard">
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
