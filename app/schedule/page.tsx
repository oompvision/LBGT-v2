import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CalendarIcon, Clock, BadgeCheck, Plus } from "lucide-react"

export const dynamic = "force-dynamic"

function formatDateSafely(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatTimeFromString(timeString: string): string {
  const [hours, minutes] = timeString.split(":").map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export default async function SchedulePage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    redirect("/signin")
  }
  const userId = session.user.id

  // Find the date to display: the latest tee_time date whose booking window
  // has already opened. This naturally produces the cutover behavior — at
  // 8:59pm on Friday May 1 the latest opened-window date is May 1; at 9:00pm
  // when May 8's window opens, May 8 becomes the latest.
  const nowIso = new Date().toISOString()
  const { data: openedTeeTimes, error: openedErr } = await supabase
    .from("tee_times")
    .select("date")
    .lte("booking_opens_at", nowIso)
    .order("date", { ascending: false })
    .limit(1)

  if (openedErr) {
    console.error("Error finding target schedule date:", openedErr)
  }

  const targetDate: string | null = (openedTeeTimes?.[0] as { date: string } | undefined)?.date ?? null

  let teeTimes: Array<{
    id: string
    date: string
    time: string
    max_slots: number
  }> = []
  let reservations: Array<{
    id: string
    tee_time_id: string
    user_id: string
    slots: number
    player_names: string[] | null
    player_user_ids: (string | null)[] | null
    play_for_money: boolean[] | null
    users: { name: string | null } | null
  }> = []

  if (targetDate) {
    const [teeTimesRes, reservationsRes] = await Promise.all([
      supabase
        .from("tee_times")
        .select("id, date, time, max_slots")
        .eq("date", targetDate)
        .order("time", { ascending: true }),
      supabase
        .from("reservations")
        .select(
          "id, tee_time_id, user_id, slots, player_names, player_user_ids, play_for_money, users:user_id(name), tee_times!inner(date)",
        )
        .eq("tee_times.date", targetDate),
    ])

    if (teeTimesRes.data) teeTimes = teeTimesRes.data as typeof teeTimes
    if (reservationsRes.data) reservations = reservationsRes.data as unknown as typeof reservations
  }

  const reservationsByTeeTime = reservations.reduce(
    (acc, r) => {
      ;(acc[r.tee_time_id] ||= []).push(r)
      return acc
    },
    {} as Record<string, typeof reservations>,
  )

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {targetDate ? `Tee Sheet for ${formatDateSafely(targetDate)}` : "Tee Sheet"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Booked tee times for the upcoming round
            </p>
          </div>

          {!targetDate ? (
            <Card>
              <CardHeader>
                <CardTitle>No upcoming round</CardTitle>
                <CardDescription>
                  The schedule will appear here once booking opens for the next tee time.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : teeTimes.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No tee times scheduled</CardTitle>
                <CardDescription>Check back soon.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardHeader className="bg-muted/50">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <CardTitle className="text-base sm:text-lg">{formatDateSafely(targetDate)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {teeTimes.map((tt) => {
                  const slotReservations = reservationsByTeeTime[tt.id] || []
                  const reservedSlots = slotReservations.reduce((sum, r) => sum + r.slots, 0)
                  const availableSlots = Math.max(0, tt.max_slots - reservedSlots)
                  const isFull = availableSlots === 0

                  return (
                    <div key={tt.id} className="p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{formatTimeFromString(tt.time)} EST</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">
                            {availableSlots} of {tt.max_slots} open
                          </span>
                          {isFull ? (
                            <Badge variant="destructive">Full</Badge>
                          ) : (
                            <Badge variant="outline">{availableSlots} Open</Badge>
                          )}
                        </div>
                        {!isFull && (
                          <Button asChild size="sm" className="text-white">
                            <Link href="/book-tee-time">
                              <Plus className="h-4 w-4 mr-1" />
                              Book Now
                            </Link>
                          </Button>
                        )}
                      </div>

                      {slotReservations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No reservations yet.</p>
                      ) : (
                        <div className="space-y-4">
                          {slotReservations.map((r) => {
                            const bookerName = r.users?.name || "Booker"
                            const playerUserIds = r.player_user_ids || []
                            const playerNames = r.player_names || []
                            const playForMoney = r.play_for_money || []

                            type Row = {
                              name: string
                              isViewer: boolean
                              isBooker: boolean
                              isLeague: boolean
                              optedIn: boolean
                            }

                            const rows: Row[] = [
                              {
                                name: bookerName,
                                isViewer: r.user_id === userId,
                                isBooker: true,
                                isLeague: true,
                                optedIn: !!playForMoney[0],
                              },
                              ...playerNames.map((name, i) => ({
                                name,
                                isViewer: playerUserIds[i] === userId,
                                isBooker: false,
                                isLeague: !!playerUserIds[i],
                                optedIn: !!playForMoney[i + 1],
                              })),
                            ]

                            const viewerIdx = rows.findIndex((p) => p.isViewer)
                            if (viewerIdx > 0) {
                              const [self] = rows.splice(viewerIdx, 1)
                              rows.unshift(self)
                            }

                            const showBookedBy = !rows[0]?.isBooker
                            const anyOptedIn = playForMoney.some(Boolean)

                            return (
                              <div key={r.id} className="rounded-md border bg-muted/30 p-3 space-y-2">
                                <ul className="space-y-1.5">
                                  {rows.map((p, i) => (
                                    <li
                                      key={i}
                                      className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm"
                                    >
                                      <span className={p.isViewer ? "font-semibold" : ""}>
                                        {p.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {p.isLeague ? "(Tour Member)" : "(Guest)"}
                                      </span>
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
                                  {showBookedBy && <p>Booked by {bookerName}</p>}
                                  {anyOptedIn && (
                                    <p>
                                      <span className="inline-flex items-center gap-1">
                                        money <BadgeCheck className="h-3 w-3" />
                                      </span>{" "}
                                      indicates players opted into the weekly cash contest
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
