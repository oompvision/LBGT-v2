"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { isAdminCreatedReservation } from "@/lib/booking-summary"
import type { CashGame, PaymentStatus } from "@/types/supabase"

export type OptedInPlayer = {
  name: string
  isBooker: boolean
  bookerName: string
}

export type CashGameDateSummary = {
  date: string
  cashGame: CashGame | null
  optedInPlayers: OptedInPlayer[]
  reservationCount: number
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type ReservationRow = {
  id: string
  user_id: string
  slots: number
  player_names: string[] | null
  play_for_money: boolean[] | null
  tee_times: { date: string } | null
  users: { name: string | null } | null
}

function buildOptIns(reservations: ReservationRow[]): Map<string, OptedInPlayer[]> {
  const byDate = new Map<string, OptedInPlayer[]>()
  for (const r of reservations) {
    const date = r.tee_times?.date
    if (!date) continue
    const bookerName = r.users?.name || "Booker"
    const pfm = r.play_for_money || []
    const additional = r.player_names || []
    const list = byDate.get(date) || []

    if (pfm[0]) {
      list.push({ name: bookerName, isBooker: true, bookerName })
    }
    for (let i = 1; i < pfm.length; i++) {
      if (pfm[i]) {
        const name = additional[i - 1]?.trim() || `Player ${i + 1}`
        list.push({ name, isBooker: false, bookerName })
      }
    }
    byDate.set(date, list)
  }
  return byDate
}

export async function getCashGameForDate(date: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("cash_games")
      .select("*")
      .eq("date", date)
      .maybeSingle()
    if (error) {
      return { success: false, error: error.message, cashGame: null as CashGame | null }
    }
    return { success: true, cashGame: (data as CashGame | null) ?? null }
  } catch (err) {
    console.error("getCashGameForDate error:", err)
    return { success: false, error: "Failed to load cash game", cashGame: null as CashGame | null }
  }
}

export async function getUpcomingCashGameSummaries(limit: number) {
  try {
    const supabaseAdmin = createAdminClient()
    const today = todayISO()

    const { data: teeTimes, error: ttErr } = await supabaseAdmin
      .from("tee_times")
      .select("date")
      .gte("date", today)
      .order("date", { ascending: true })
    if (ttErr) {
      return { success: false, error: ttErr.message, items: [] as CashGameDateSummary[], totalDates: 0 }
    }

    const allDates = Array.from(new Set((teeTimes || []).map((t: { date: string }) => t.date)))
    const totalDates = allDates.length
    const dates = allDates.slice(0, Math.max(0, limit))

    if (dates.length === 0) {
      return { success: true, items: [] as CashGameDateSummary[], totalDates }
    }

    const [cashGamesRes, reservationsRes] = await Promise.all([
      supabaseAdmin.from("cash_games").select("*").in("date", dates),
      supabaseAdmin
        .from("reservations")
        .select(
          "id, user_id, slots, player_names, play_for_money, tee_times!inner(date), users:user_id(name)"
        )
        .in("tee_times.date", dates),
    ])

    const cashGames = (cashGamesRes.data as CashGame[] | null) || []
    const cashGamesByDate = new Map<string, CashGame>()
    for (const cg of cashGames) cashGamesByDate.set(cg.date, cg)

    const reservations = (reservationsRes.data as unknown as ReservationRow[]) || []
    const optInsByDate = buildOptIns(reservations)
    const reservationCounts = new Map<string, number>()
    for (const r of reservations) {
      const d = r.tee_times?.date
      if (!d) continue
      reservationCounts.set(d, (reservationCounts.get(d) || 0) + 1)
    }

    const items: CashGameDateSummary[] = dates.map((d) => ({
      date: d,
      cashGame: cashGamesByDate.get(d) || null,
      optedInPlayers: optInsByDate.get(d) || [],
      reservationCount: reservationCounts.get(d) || 0,
    }))

    return { success: true, items, totalDates }
  } catch (err) {
    console.error("getUpcomingCashGameSummaries error:", err)
    return { success: false, error: "Failed to load cash games", items: [] as CashGameDateSummary[], totalDates: 0 }
  }
}

export async function getPastCashGameSummaries() {
  try {
    const supabaseAdmin = createAdminClient()
    const today = todayISO()

    const { data: cashGames, error: cgErr } = await supabaseAdmin
      .from("cash_games")
      .select("*")
      .lt("date", today)
      .order("date", { ascending: false })
    if (cgErr) {
      return { success: false, error: cgErr.message, items: [] as CashGameDateSummary[] }
    }

    const list = (cashGames as CashGame[] | null) || []
    if (list.length === 0) {
      return { success: true, items: [] as CashGameDateSummary[] }
    }

    const dates = list.map((c) => c.date)
    const { data: resData, error: resErr } = await supabaseAdmin
      .from("reservations")
      .select(
        "id, user_id, slots, player_names, play_for_money, tee_times!inner(date), users:user_id(name)"
      )
      .in("tee_times.date", dates)
    if (resErr) {
      return { success: false, error: resErr.message, items: [] as CashGameDateSummary[] }
    }

    const reservations = (resData as unknown as ReservationRow[]) || []
    const optInsByDate = buildOptIns(reservations)
    const reservationCounts = new Map<string, number>()
    for (const r of reservations) {
      const d = r.tee_times?.date
      if (!d) continue
      reservationCounts.set(d, (reservationCounts.get(d) || 0) + 1)
    }

    const items: CashGameDateSummary[] = list.map((cg) => ({
      date: cg.date,
      cashGame: cg,
      optedInPlayers: optInsByDate.get(cg.date) || [],
      reservationCount: reservationCounts.get(cg.date) || 0,
    }))

    return { success: true, items }
  } catch (err) {
    console.error("getPastCashGameSummaries error:", err)
    return { success: false, error: "Failed to load past cash games", items: [] as CashGameDateSummary[] }
  }
}

export async function upsertCashGame(input: {
  date: string
  title: string
  description: string
  entry_amount: number
}) {
  try {
    if (!input.date || !input.title.trim()) {
      return { success: false, error: "Date and title are required." }
    }
    if (!Number.isFinite(input.entry_amount) || input.entry_amount < 0 || !Number.isInteger(input.entry_amount)) {
      return { success: false, error: "Entry amount must be a whole dollar amount." }
    }

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from("cash_games")
      .upsert(
        {
          date: input.date,
          title: input.title.trim(),
          description: input.description,
          entry_amount: input.entry_amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "date" }
      )

    if (error) {
      console.error("upsertCashGame error:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/cash-games")
    revalidatePath("/admin/cash-games/past")
    revalidatePath("/book-tee-time")
    return { success: true }
  } catch (err) {
    console.error("upsertCashGame error:", err)
    return { success: false, error: "Failed to save cash game" }
  }
}

export type PaymentGridPlayer = {
  playerIndex: number
  name: string | null
  isBooker: boolean
  isOptedIn: boolean
  greenFeePaid: boolean
  cashGamePaid: boolean
}

export type PaymentGridReservation = {
  reservationId: string
  bookerName: string
  slots: number
  players: PaymentGridPlayer[]
  // True when the booker is metadata only (admin booked seats for others
  // without playing themselves). Detected via player_names.length === slots.
  adminCreated: boolean
}

export type PaymentGridTeeTime = {
  teeTimeId: string
  time: string
  maxSlots: number
  reservations: PaymentGridReservation[]
}

export type PaymentGridDate = {
  date: string
  cashGame: CashGame | null
  teeTimes: PaymentGridTeeTime[]
}

type GridReservationRow = {
  id: string
  user_id: string
  tee_time_id: string
  slots: number
  player_names: string[] | null
  play_for_money: boolean[] | null
  users: { name: string | null } | null
}

export async function getPaymentGrid(limit: number) {
  try {
    const supabaseAdmin = createAdminClient()
    const today = todayISO()

    const { data: teeTimes, error: ttErr } = await supabaseAdmin
      .from("tee_times")
      .select("id, date, time, max_slots")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
    if (ttErr) {
      return {
        success: false,
        error: ttErr.message,
        items: [] as PaymentGridDate[],
        totalDates: 0,
      }
    }

    const teeTimeRows = (teeTimes as Array<{
      id: string
      date: string
      time: string
      max_slots: number
    }> | null) || []

    const allDates = Array.from(new Set(teeTimeRows.map((t) => t.date)))
    const totalDates = allDates.length
    const dates = allDates.slice(0, Math.max(0, limit))

    if (dates.length === 0) {
      return { success: true, items: [] as PaymentGridDate[], totalDates }
    }

    const visibleTeeTimes = teeTimeRows.filter((t) => dates.includes(t.date))
    const teeTimeIds = visibleTeeTimes.map((t) => t.id)

    const [cashGamesRes, reservationsRes] = await Promise.all([
      supabaseAdmin.from("cash_games").select("*").in("date", dates),
      supabaseAdmin
        .from("reservations")
        .select(
          "id, user_id, tee_time_id, slots, player_names, play_for_money, users:user_id(name)"
        )
        .in("tee_time_id", teeTimeIds),
    ])

    if (reservationsRes.error) {
      return {
        success: false,
        error: reservationsRes.error.message,
        items: [] as PaymentGridDate[],
        totalDates,
      }
    }

    const reservations =
      (reservationsRes.data as unknown as GridReservationRow[]) || []
    const reservationIds = reservations.map((r) => r.id)

    let paymentStatuses: PaymentStatus[] = []
    if (reservationIds.length > 0) {
      const { data: psData, error: psErr } = await supabaseAdmin
        .from("payment_statuses")
        .select("*")
        .in("reservation_id", reservationIds)
      if (psErr) {
        return {
          success: false,
          error: psErr.message,
          items: [] as PaymentGridDate[],
          totalDates,
        }
      }
      paymentStatuses = (psData as PaymentStatus[] | null) || []
    }

    const psByReservation = new Map<string, Map<number, PaymentStatus>>()
    for (const ps of paymentStatuses) {
      const inner =
        psByReservation.get(ps.reservation_id) ||
        new Map<number, PaymentStatus>()
      inner.set(ps.player_index, ps)
      psByReservation.set(ps.reservation_id, inner)
    }

    const cashGames = (cashGamesRes.data as CashGame[] | null) || []
    const cashGameByDate = new Map<string, CashGame>()
    for (const cg of cashGames) cashGameByDate.set(cg.date, cg)

    const reservationsByTeeTime = new Map<string, GridReservationRow[]>()
    for (const r of reservations) {
      const list = reservationsByTeeTime.get(r.tee_time_id) || []
      list.push(r)
      reservationsByTeeTime.set(r.tee_time_id, list)
    }

    const teeTimesByDate = new Map<string, typeof visibleTeeTimes>()
    for (const tt of visibleTeeTimes) {
      const list = teeTimesByDate.get(tt.date) || []
      list.push(tt)
      teeTimesByDate.set(tt.date, list)
    }

    const items: PaymentGridDate[] = dates.map((d) => {
      const teeTimesForDate = teeTimesByDate.get(d) || []
      return {
        date: d,
        cashGame: cashGameByDate.get(d) || null,
        teeTimes: teeTimesForDate.map((tt) => {
          const reservationsForTT = reservationsByTeeTime.get(tt.id) || []
          return {
            teeTimeId: tt.id,
            time: tt.time,
            maxSlots: tt.max_slots,
            reservations: reservationsForTT.map((r) => {
              const bookerName = r.users?.name || "Booker"
              const pfm = r.play_for_money || []
              const playerNames = r.player_names || []
              const psMap = psByReservation.get(r.id)
              const adminCreated = isAdminCreatedReservation({
                slots: r.slots,
                player_names: playerNames,
              })
              const players: PaymentGridPlayer[] = []
              for (let i = 0; i < r.slots; i++) {
                const ps = psMap?.get(i) || null
                if (adminCreated) {
                  // Admin-created: booker is metadata only. Every slot maps to
                  // player_names[i], with play_for_money[0] a phantom false and
                  // play_for_money[i+1] the opt-in for that slot.
                  const rawName = playerNames[i]?.trim()
                  players.push({
                    playerIndex: i,
                    name: rawName && rawName.length > 0 ? rawName : null,
                    isBooker: false,
                    isOptedIn: !!pfm[i + 1],
                    greenFeePaid: ps?.green_fee_paid ?? false,
                    cashGamePaid: ps?.cash_game_paid ?? false,
                  })
                } else if (i === 0) {
                  players.push({
                    playerIndex: 0,
                    name: bookerName,
                    isBooker: true,
                    isOptedIn: !!pfm[0],
                    greenFeePaid: ps?.green_fee_paid ?? false,
                    cashGamePaid: ps?.cash_game_paid ?? false,
                  })
                } else {
                  const rawName = playerNames[i - 1]?.trim()
                  players.push({
                    playerIndex: i,
                    name: rawName && rawName.length > 0 ? rawName : null,
                    isBooker: false,
                    isOptedIn: !!pfm[i],
                    greenFeePaid: ps?.green_fee_paid ?? false,
                    cashGamePaid: ps?.cash_game_paid ?? false,
                  })
                }
              }
              return {
                reservationId: r.id,
                bookerName,
                slots: r.slots,
                players,
                adminCreated,
              }
            }),
          }
        }),
      }
    })

    return { success: true, items, totalDates }
  } catch (err) {
    console.error("getPaymentGrid error:", err)
    return {
      success: false,
      error: "Failed to load payment grid",
      items: [] as PaymentGridDate[],
      totalDates: 0,
    }
  }
}

export async function upsertPaymentStatuses(
  entries: Array<{
    reservation_id: string
    player_index: number
    green_fee_paid: boolean
    cash_game_paid: boolean
  }>
) {
  try {
    if (entries.length === 0) return { success: true }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile?.is_admin) {
      return { success: false, error: "Admins only" }
    }

    const supabaseAdmin = createAdminClient()
    const now = new Date().toISOString()
    const rows = entries.map((e) => ({
      reservation_id: e.reservation_id,
      player_index: e.player_index,
      green_fee_paid: e.green_fee_paid,
      cash_game_paid: e.cash_game_paid,
      updated_at: now,
      updated_by: user.id,
    }))

    const { error } = await supabaseAdmin
      .from("payment_statuses")
      .upsert(rows, { onConflict: "reservation_id,player_index" })

    if (error) {
      console.error("upsertPaymentStatuses error:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/cash-games")
    return { success: true }
  } catch (err) {
    console.error("upsertPaymentStatuses error:", err)
    return { success: false, error: "Failed to save payment statuses" }
  }
}

export async function deleteCashGame(id: string) {
  try {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from("cash_games").delete().eq("id", id)
    if (error) {
      return { success: false, error: error.message }
    }
    revalidatePath("/admin/cash-games")
    revalidatePath("/admin/cash-games/past")
    revalidatePath("/book-tee-time")
    return { success: true }
  } catch (err) {
    console.error("deleteCashGame error:", err)
    return { success: false, error: "Failed to delete cash game" }
  }
}
