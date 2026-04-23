export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/signin")
  }

  const userId = session.user.id

  const { data: activeSeason } = await supabase.from("seasons").select("year").eq("is_active", true).single()

  const seasonYear = activeSeason?.year || new Date().getFullYear()

  // Get reservations where user is booker OR an invited player.
  // Two queries + merge is more robust than trying to compose .or() with
  // a `cs` (array contains) filter — the PostgREST filter-string parser
  // is finicky about curly braces inside .or().
  const reservationSelect = `
    id,
    tee_time_id,
    user_id,
    slots,
    player_names,
    player_user_ids,
    play_for_money,
    season,
    tee_times (
      id,
      date,
      time
    ),
    users (
      id,
      name
    )
  `

  const [asBookerResult, asInvitedResult] = await Promise.all([
    supabase
      .from("reservations")
      .select(reservationSelect)
      .eq("user_id", userId)
      .eq("season", seasonYear),
    supabase
      .from("reservations")
      .select(reservationSelect)
      .contains("player_user_ids", [userId])
      .eq("season", seasonYear),
  ])

  if (asBookerResult.error) {
    console.error("Error fetching booker reservations:", asBookerResult.error)
  }
  if (asInvitedResult.error) {
    console.error("Error fetching invited reservations:", asInvitedResult.error)
  }
  const queryError = asBookerResult.error || asInvitedResult.error

  const merged = new Map<string, any>()
  for (const r of asBookerResult.data || []) merged.set(r.id, r)
  for (const r of asInvitedResult.data || []) merged.set(r.id, r)
  const userReservations = Array.from(merged.values()).sort((a, b) => {
    const dateA = (a.tee_times as any)?.date || ""
    const dateB = (b.tee_times as any)?.date || ""
    if (dateA !== dateB) return dateA < dateB ? -1 : 1
    const timeA = (a.tee_times as any)?.time || ""
    const timeB = (b.tee_times as any)?.time || ""
    if (timeA !== timeB) return timeA < timeB ? -1 : 1
    return 0
  })

  // Get current user's name for "you" display
  const { data: userData } = await supabase.from("users").select("name").eq("id", userId).single()

  // Group reservations by date
  const reservationsByDate = (userReservations || []).reduce(
    (acc, reservation) => {
      const date = (reservation.tee_times as any)?.date
      if (!date) return acc
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

          {queryError && (
            <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-semibold text-destructive">Couldn&apos;t load your reservations</p>
              <p className="text-destructive/90 mt-1 break-words">{queryError.message}</p>
              <p className="text-muted-foreground mt-2">
                If this mentions <code>player_user_ids</code>, run{" "}
                <code>scripts/add-reservation-player-user-ids.sql</code> in Supabase SQL editor.
              </p>
            </div>
          )}

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
                      {dateReservations.map((reservation) => {
                        const role: "booker" | "invited" =
                          reservation.user_id === userId ? "booker" : "invited"
                        const bookerName = (reservation.users as any)?.name as string | undefined
                        const playerUserIds: (string | null)[] =
                          (reservation.player_user_ids as (string | null)[] | null) || []
                        const playerNames = reservation.player_names || []
                        const playForMoney = reservation.play_for_money || []
                        const bookerIsSolo = role === "booker" && playerUserIds.length === 0

                        return (
                          <div key={reservation.id} className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {formatTimeFromString((reservation.tee_times as any)?.time)}
                                  </span>
                                  {role === "invited" && (
                                    <Badge variant="secondary">
                                      Booked by {bookerName || "another player"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2">
                                  <p className="font-medium">
                                    {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                                  </p>

                                  <div className="mt-1 text-sm">
                                    {/* Booker line */}
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {role === "booker"
                                          ? userData?.name || "You"
                                          : bookerName || "Booker"}
                                      </span>
                                      {role === "booker" && (
                                        <span className="text-xs text-muted-foreground">(you)</span>
                                      )}
                                      {playForMoney[0] && (
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                          Playing for money
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {playerNames.length > 0 && (
                                    <div className="mt-2 text-sm text-muted-foreground">
                                      <p>Additional players:</p>
                                      <ul className="list-inside list-disc">
                                        {playerNames.map((name, i) => {
                                          const linkedUserId = playerUserIds[i]
                                          const isYou = linkedUserId === userId
                                          return (
                                            <li key={i} className="flex items-center gap-2">
                                              <span>
                                                {name}
                                                {linkedUserId ? " (league)" : " (guest)"}
                                                {isYou && " — you"}
                                              </span>
                                              {playForMoney[i + 1] && (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                                  Playing for money
                                                </span>
                                              )}
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="ml-4 shrink-0">
                                <ReservationActions
                                  reservationId={reservation.id}
                                  role={role}
                                  bookerIsSolo={bookerIsSolo}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
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
