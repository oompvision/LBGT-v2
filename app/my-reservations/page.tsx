export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, Clock, BadgeCheck } from "lucide-react"
import { ReservationActions } from "./reservation-actions"
import { formatPhone } from "@/lib/phone"

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
    guest_phones,
    play_for_money,
    season,
    tee_times (
      id,
      date,
      time,
      max_slots,
      booking_closes_at
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
  // The booker-side query (.eq("user_id", userId)) also matches admin-created
  // reservations where the admin is the metadata owner without being a player.
  // Filter those out so an admin doesn't see admin-created bookings listed as
  // "theirs" on /my-reservations — they only show up if the admin is also in
  // player_user_ids (i.e., admin added themselves as a league player).
  for (const r of asBookerResult.data || []) {
    const slots = (r as any).slots ?? 0
    const playerNamesLength = ((r as any).player_names ?? []).length
    const adminCreated = playerNamesLength === slots
    if (!adminCreated) merged.set(r.id, r)
  }
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

  // Cash games for the dates in this user's reservations, so each card can show
  // the correct opt-in label inside the Edit dialog.
  const allDates = Array.from(
    new Set(userReservations.map((r) => (r.tee_times as any)?.date).filter(Boolean) as string[]),
  )
  const cashGamesByDate = new Map<string, string>()
  if (allDates.length > 0) {
    const { data: cashGames } = await supabase
      .from("cash_games")
      .select("date, title")
      .in("date", allDates)
    for (const cg of (cashGames as { date: string; title: string }[] | null) || []) {
      cashGamesByDate.set(cg.date, cg.title)
    }
  }

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
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Reservations</h1>
            <p className="text-sm text-muted-foreground">
              View and manage your tee time reservations
            </p>
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
            <div className="space-y-6">
              {Object.entries(reservationsByDate).map(([date, dateReservations]) => (
                <Card key={date}>
                  <CardHeader className="bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <CardTitle className="text-base sm:text-lg">{formatDateSafely(date)}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-6">
                    {dateReservations.map((reservation) => {
                      const playerNames: string[] = reservation.player_names || []
                      const playerUserIds: (string | null)[] =
                        (reservation.player_user_ids as (string | null)[] | null) || []
                      const guestPhones: (string | null)[] =
                        (reservation.guest_phones as (string | null)[] | null) || []
                      const playForMoney: boolean[] = reservation.play_for_money || []
                      // Admin-created reservations don't have a "booker" who's
                      // playing — admin's user_id is metadata, not a player. Use
                      // array shape to detect (matches isAdminCreatedReservation).
                      const adminCreated = playerNames.length === reservation.slots
                      // For admin-created bookings, every viewer (even the
                      // admin themselves, though we filter those out below)
                      // is treated as "invited" — there is no booker player.
                      const role: "booker" | "invited" =
                        !adminCreated && reservation.user_id === userId ? "booker" : "invited"
                      const bookerName = (reservation.users as any)?.name as string | undefined
                      const bookerIsSolo = role === "booker" && playerUserIds.length === 0

                      type PlayerEntry = {
                        name: string
                        isViewer: boolean
                        isLeague: boolean
                        optedIn: boolean
                        // Only populated for the booker's view; null for invited
                        // viewers so we don't leak the number to non-bookers.
                        guestPhone: string | null
                      }

                      const players: PlayerEntry[] = [
                        // Admin-created bookings have no booker-as-player row;
                        // skip the synthetic booker entry so the admin's name
                        // doesn't appear as a player on a tee time they're not
                        // actually on.
                        ...(adminCreated
                          ? []
                          : [
                              {
                                name:
                                  role === "booker"
                                    ? userData?.name || "You"
                                    : bookerName || "Booker",
                                isViewer: role === "booker",
                                isLeague: true,
                                optedIn: !!playForMoney[0],
                                guestPhone: null,
                              },
                            ]),
                        ...playerNames.map((name, i) => ({
                          name,
                          isViewer: playerUserIds[i] === userId,
                          isLeague: !!playerUserIds[i],
                          optedIn: !!playForMoney[i + 1],
                          guestPhone:
                            role === "booker" && !playerUserIds[i] ? guestPhones[i] ?? null : null,
                        })),
                      ]

                      // Move the viewer to the top of the list (if they aren't already).
                      const viewerIdx = players.findIndex((p) => p.isViewer)
                      if (viewerIdx > 0) {
                        const [self] = players.splice(viewerIdx, 1)
                        players.unshift(self)
                      }

                      const showOptInLegend = playForMoney.some(Boolean)

                      return (
                        <div key={reservation.id} className="space-y-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">
                              {formatTimeFromString((reservation.tee_times as any)?.time)} EST
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">
                              {reservation.slots} {reservation.slots === 1 ? "player" : "players"}
                            </span>
                          </div>

                          <ul className="space-y-2">
                            {players.map((p, i) => (
                              <li
                                key={i}
                                className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm"
                              >
                                <span className={p.isViewer ? "font-semibold" : ""}>{p.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {p.isLeague ? "(Tour Member)" : "(Guest)"}
                                </span>
                                {p.guestPhone && (
                                  <span className="text-xs text-muted-foreground">
                                    · {formatPhone(p.guestPhone)}
                                  </span>
                                )}
                                {p.optedIn && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                    money
                                    <BadgeCheck className="h-3 w-3" />
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>

                          <div className="space-y-1 text-xs text-muted-foreground">
                            {role === "invited" && (
                              <p>Booked by {bookerName || "another player"}</p>
                            )}
                            {showOptInLegend && (
                              <p>
                                <span className="inline-flex items-center gap-1">
                                  money <BadgeCheck className="h-3 w-3" />
                                </span>{" "}
                                indicates players opted into the weekly cash contest
                              </p>
                            )}
                          </div>

                          <ReservationActions
                            reservationId={reservation.id}
                            role={role}
                            bookerIsSolo={bookerIsSolo}
                            viewerUserId={userId}
                            cashGameTitle={
                              cashGamesByDate.get((reservation.tee_times as any)?.date) ?? null
                            }
                            editData={{
                              id: reservation.id,
                              slots: reservation.slots,
                              maxSlots: (reservation.tee_times as any)?.max_slots ?? 4,
                              teeTimeDate: (reservation.tee_times as any)?.date ?? "",
                              teeTimeTime: (reservation.tee_times as any)?.time ?? "",
                              bookingClosesAt:
                                (reservation.tee_times as any)?.booking_closes_at ?? null,
                              bookerName: bookerName || "Booker",
                              bookerUserId: reservation.user_id,
                              additionalPlayers: playerNames.map((name, i) => ({
                                name,
                                userId: playerUserIds[i] ?? null,
                                phone: role === "booker" ? guestPhones[i] ?? null : null,
                              })),
                              playForMoney: Array.from(
                                { length: reservation.slots },
                                (_, i) => !!playForMoney[i],
                              ),
                            }}
                          />
                        </div>
                      )
                    })}
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
              <CardContent>
                <Link href="/book-tee-time">
                  <Button className="w-full sm:w-auto">Book Tee Time</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
