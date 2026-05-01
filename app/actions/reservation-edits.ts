"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
  isBookingWindowOpen,
  isBeforeCutoff,
} from "@/lib/booking-summary"
import { sendBookingConfirmationEmails } from "@/app/actions/booking-emails"
import { checkPlayersForDateConflict } from "@/app/actions/reservation-players"
import { isValidPhone, stripPhone } from "@/lib/phone"

const OPT_IN_BUFFER_MINUTES = 60

type ReservationFetch = {
  id: string
  user_id: string
  slots: number
  player_names: string[] | null
  player_user_ids: (string | null)[] | null
  guest_phones: (string | null)[] | null
  play_for_money: boolean[] | null
  tee_time_id: string
  tee_times: { id: string; date: string; time: string; max_slots: number; booking_closes_at: string | null } | null
}

async function fetchReservation(reservationId: string): Promise<{
  data: ReservationFetch | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, user_id, slots, player_names, player_user_ids, guest_phones, play_for_money, tee_time_id, tee_times(id, date, time, max_slots, booking_closes_at)",
    )
    .eq("id", reservationId)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as unknown as ReservationFetch, error: null }
}

async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

// Admins bypass the booking-window cutoff and the opt-in cutoff so they can
// fix things up after the deadline. Returns null when the caller isn't
// authenticated or isn't an admin.
async function getSessionAdminId(): Promise<string | null> {
  const userId = await getSessionUserId()
  if (!userId) return null
  const supabaseAdmin = createAdminClient()
  const { data } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single()
  return data?.is_admin ? userId : null
}

function bookerCheck(reservation: ReservationFetch, userId: string) {
  if (reservation.user_id !== userId) {
    return { ok: false as const, error: "Only the booker can edit this reservation." }
  }
  return { ok: true as const }
}

// Initial-booking entry point. Lives server-side so the booking-window
// deadline can be enforced even against a tampered client (the previous
// flow inserted directly from the browser, which let users book past
// booking_closes_at). Admins bypass the deadline check; everything else
// — capacity, conflict detection, guest-phone validation — applies to all
// callers.
export async function createReservation(input: {
  teeTimeId: string
  additionalPlayers: Array<
    | { type: "user"; userId: string; name: string }
    | { type: "guest"; name: string; phone: string }
  >
  bookerPlayForMoney: boolean
  additionalPlayForMoney: boolean[]
}): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  try {
    const userId = await getSessionUserId()
    if (!userId) return { success: false, error: "You must be signed in to book." }

    const adminId = await getSessionAdminId()
    const isAdmin = adminId === userId

    const supabase = await createClient()

    const { data: teeTime, error: teeTimeErr } = await supabase
      .from("tee_times")
      .select("id, date, time, max_slots, booking_closes_at, season")
      .eq("id", input.teeTimeId)
      .single()

    if (teeTimeErr || !teeTime) {
      return { success: false, error: "Tee time not found." }
    }

    if (!isAdmin && !isBookingWindowOpen(teeTime.booking_closes_at)) {
      return {
        success: false,
        error: "Booking has closed for this tee time.",
      }
    }

    // Re-check capacity server-side; client state may be stale.
    const { data: existing } = await supabase
      .from("reservations")
      .select("slots")
      .eq("tee_time_id", input.teeTimeId)
    const reservedSlots = (existing || []).reduce((sum, r) => sum + (r.slots ?? 0), 0)
    const availableSlots = (teeTime.max_slots ?? 4) - reservedSlots
    const totalSlots = input.additionalPlayers.length + 1
    if (totalSlots > availableSlots) {
      return {
        success: false,
        error: `Only ${availableSlots} slot${availableSlots === 1 ? "" : "s"} left at this tee time.`,
      }
    }

    // Validate guest names + phones server-side too — defense in depth.
    for (let i = 0; i < input.additionalPlayers.length; i++) {
      const p = input.additionalPlayers[i]
      if (p.type === "guest") {
        if (!p.name?.trim()) {
          return { success: false, error: `Guest in seat ${i + 2} is missing a name.` }
        }
        const digits = stripPhone(p.phone || "")
        if (!isValidPhone(digits)) {
          return {
            success: false,
            error: `Guest in seat ${i + 2} needs a valid 10-digit phone.`,
          }
        }
      }
    }

    // Conflict pre-check for all league players in the group (admins still
    // get this guard — it keeps the same player from double-booking by
    // accident, which an admin probably also doesn't want).
    const playerUserIds: (string | null)[] = input.additionalPlayers.map((p) =>
      p.type === "user" ? p.userId : null,
    )
    const leagueIdsToCheck = [userId, ...playerUserIds.filter((id): id is string => !!id)]
    try {
      const conflictResult = await checkPlayersForDateConflict(teeTime.date, leagueIdsToCheck)
      if (conflictResult.success && conflictResult.conflicts && conflictResult.conflicts.length > 0) {
        const names = conflictResult.conflicts.map((c) => c.name).join(", ")
        return {
          success: false,
          error: `${names} already has a reservation that day.`,
        }
      }
    } catch (err) {
      console.error("Conflict pre-check failed:", err)
    }

    const player_names = input.additionalPlayers.map((p) => p.name.trim())
    const guest_phones: (string | null)[] = input.additionalPlayers.map((p) =>
      p.type === "guest" ? stripPhone(p.phone) : null,
    )
    const play_for_money = [
      input.bookerPlayForMoney,
      ...input.additionalPlayForMoney,
    ]

    const { data: insertedRows, error: insertErr } = await supabase
      .from("reservations")
      .insert([
        {
          tee_time_id: input.teeTimeId,
          user_id: userId,
          slots: totalSlots,
          player_names,
          player_user_ids: playerUserIds,
          guest_phones,
          play_for_money,
          season: teeTime.season,
        },
      ])
      .select("id")

    if (insertErr) {
      return { success: false, error: insertErr.message }
    }

    const reservationId = insertedRows?.[0]?.id as string | undefined
    revalidatePath("/my-reservations")
    revalidatePath("/schedule")
    return { success: true, reservationId }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create reservation.",
    }
  }
}

export async function addPlayerToReservation(
  reservationId: string,
  addition:
    | { type: "user"; userId: string }
    | { type: "guest"; name: string; phone: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getSessionUserId()
    if (!userId) return { success: false, error: "You must be signed in." }

    const adminId = await getSessionAdminId()
    const isAdmin = adminId === userId

    const { data: reservation, error } = await fetchReservation(reservationId)
    if (error || !reservation || !reservation.tee_times) {
      return { success: false, error: error || "Reservation not found." }
    }

    if (!isAdmin) {
      const auth = bookerCheck(reservation, userId)
      if (!auth.ok) return { success: false, error: auth.error }

      if (!isBookingWindowOpen(reservation.tee_times.booking_closes_at)) {
        return { success: false, error: "The booking window has closed." }
      }
    }

    if (reservation.slots >= reservation.tee_times.max_slots) {
      return { success: false, error: "This tee time is already full." }
    }

    const playerNames = reservation.player_names || []
    const playerUserIds = reservation.player_user_ids || []
    const guestPhones = reservation.guest_phones || []
    const playForMoney = reservation.play_for_money || [false]

    let nameToInsert: string
    let userIdToInsert: string | null
    let phoneToInsert: string | null = null

    if (addition.type === "user") {
      // Block re-adding the booker or anyone already in the group.
      if (addition.userId === reservation.user_id) {
        return { success: false, error: "Player is already in the reservation." }
      }
      if (playerUserIds.includes(addition.userId)) {
        return { success: false, error: "Player is already in the reservation." }
      }
      // Conflict check: are they already booked elsewhere that day?
      const conflict = await checkPlayersForDateConflict(
        reservation.tee_times.date,
        [addition.userId],
      )
      if (conflict.success && conflict.conflicts && conflict.conflicts.length > 0) {
        return {
          success: false,
          error: `${conflict.conflicts[0].name} already has a reservation that day.`,
        }
      }
      const supabaseAdmin = createAdminClient()
      const { data: u, error: uErr } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("id", addition.userId)
        .single()
      if (uErr || !u) {
        return { success: false, error: "Could not find that league member." }
      }
      nameToInsert = (u as { name: string }).name
      userIdToInsert = addition.userId
    } else {
      const trimmed = addition.name.trim()
      if (!trimmed) return { success: false, error: "Guest name required." }
      const digits = stripPhone(addition.phone)
      if (!isValidPhone(digits)) {
        return { success: false, error: "A valid 10-digit phone number is required for guests." }
      }
      nameToInsert = trimmed
      userIdToInsert = null
      phoneToInsert = digits
    }

    const newPlayerNames = [...playerNames, nameToInsert]
    const newPlayerUserIds = [...playerUserIds, userIdToInsert]
    const newGuestPhones = [...guestPhones, phoneToInsert]
    const newPlayForMoney = [...playForMoney, false]
    const newSlots = reservation.slots + 1

    const supabase = await createClient()
    const { error: updErr } = await supabase
      .from("reservations")
      .update({
        slots: newSlots,
        player_names: newPlayerNames,
        player_user_ids: newPlayerUserIds,
        guest_phones: newGuestPhones,
        play_for_money: newPlayForMoney,
      })
      .eq("id", reservationId)

    if (updErr) return { success: false, error: updErr.message }

    if (userIdToInsert) {
      sendBookingConfirmationEmails(reservationId, { onlyUserIds: [userIdToInsert] }).catch((err) =>
        console.error("New-player confirmation email failed:", err),
      )
    }

    revalidatePath("/my-reservations")
    revalidatePath("/schedule")
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add player.",
    }
  }
}

export async function removePlayerByIndex(
  reservationId: string,
  playerIndex: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getSessionUserId()
    if (!userId) return { success: false, error: "You must be signed in." }

    const { data: reservation, error } = await fetchReservation(reservationId)
    if (error || !reservation || !reservation.tee_times) {
      return { success: false, error: error || "Reservation not found." }
    }

    const adminId = await getSessionAdminId()
    const isAdmin = adminId === userId

    if (!isAdmin) {
      const auth = bookerCheck(reservation, userId)
      if (!auth.ok) return { success: false, error: auth.error }

      if (!isBookingWindowOpen(reservation.tee_times.booking_closes_at)) {
        return { success: false, error: "The booking window has closed." }
      }
    }

    const playerNames = reservation.player_names || []
    const playerUserIds = reservation.player_user_ids || []
    const guestPhones = reservation.guest_phones || []
    const playForMoney = reservation.play_for_money || [false]

    if (playerIndex < 0 || playerIndex >= playerNames.length) {
      return { success: false, error: "Invalid player." }
    }

    const newPlayerNames = playerNames.filter((_, i) => i !== playerIndex)
    const newPlayerUserIds = playerUserIds.filter((_, i) => i !== playerIndex)
    const newGuestPhones = guestPhones.filter((_, i) => i !== playerIndex)
    // play_for_money index 0 is booker; additional player i corresponds to index i+1.
    const newPlayForMoney = playForMoney.filter((_, i) => i !== playerIndex + 1)
    const newSlots = Math.max(1, reservation.slots - 1)

    const supabase = await createClient()
    const { error: updErr } = await supabase
      .from("reservations")
      .update({
        slots: newSlots,
        player_names: newPlayerNames,
        player_user_ids: newPlayerUserIds,
        guest_phones: newGuestPhones,
        play_for_money: newPlayForMoney,
      })
      .eq("id", reservationId)

    if (updErr) return { success: false, error: updErr.message }

    revalidatePath("/my-reservations")
    revalidatePath("/schedule")
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove player.",
    }
  }
}

export async function updateOptIns(
  reservationId: string,
  optIns: boolean[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getSessionUserId()
    if (!userId) return { success: false, error: "You must be signed in." }

    const adminId = await getSessionAdminId()
    const isAdmin = adminId === userId

    const { data: reservation, error } = await fetchReservation(reservationId)
    if (error || !reservation || !reservation.tee_times) {
      return { success: false, error: error || "Reservation not found." }
    }

    if (!isAdmin && !isBeforeCutoff(reservation.tee_times.date, reservation.tee_times.time, OPT_IN_BUFFER_MINUTES)) {
      return { success: false, error: "Opt-in editing is closed within an hour of tee time." }
    }

    const expectedLength = reservation.slots
    if (optIns.length !== expectedLength) {
      return { success: false, error: "Opt-in payload doesn't match the reservation." }
    }

    const isBooker = reservation.user_id === userId
    const playerUserIds = reservation.player_user_ids || []
    const invitedIndex = playerUserIds.findIndex((uid) => uid === userId)

    if (!isBooker && !isAdmin && invitedIndex === -1) {
      return { success: false, error: "You're not on this reservation." }
    }

    const current = reservation.play_for_money || new Array(expectedLength).fill(false)
    let next: boolean[]

    if (isBooker || isAdmin) {
      // Booker (or admin acting on any reservation) can change every slot.
      next = optIns
    } else {
      // Invited player can change ONLY their own slot (player_user_ids index n maps to play_for_money[n+1]).
      next = current.slice()
      const slotIndex = invitedIndex + 1
      next[slotIndex] = optIns[slotIndex]
    }

    const supabase = await createClient()
    const { error: updErr } = await supabase
      .from("reservations")
      .update({ play_for_money: next })
      .eq("id", reservationId)

    if (updErr) return { success: false, error: updErr.message }

    revalidatePath("/my-reservations")
    revalidatePath("/schedule")
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update opt-ins.",
    }
  }
}

// True for reservations created by an admin where they aren't on the tee
// time as a player. We disambiguate by the array shape, not by `is_admin`
// on the booker, so the answer doesn't drift if a user gets promoted to
// admin later: regular bookings keep `slots = 1 + player_names.length`
// (booker + additional players), while admin-owned ones keep
// `slots = player_names.length` (booker is metadata only, every entry in
// player_names is an actual player).
export function isAdminCreatedReservation(reservation: {
  slots: number
  player_names: string[] | null
}): boolean {
  return (reservation.player_names?.length ?? 0) === reservation.slots
}

// Admin-only entry point for creating a reservation on behalf of league
// members + guests without putting the admin on the tee time. The schema
// stores admin's user_id as the row's `user_id` (metadata / audit owner)
// but admin doesn't count toward `slots` and never appears in
// `player_names`. The booker-aligned `play_for_money[0]` is kept as a
// phantom `false` so existing read code that maps `play_for_money[i+1]`
// to additional player `i` still works without a special case.
export async function adminCreateReservation(input: {
  teeTimeId: string
  players: Array<
    | { type: "user"; userId: string; name: string; optedIn: boolean }
    | { type: "guest"; name: string; phone: string; optedIn: boolean }
  >
}): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  try {
    const userId = await getSessionUserId()
    if (!userId) return { success: false, error: "You must be signed in." }

    const adminId = await getSessionAdminId()
    if (adminId !== userId) {
      return { success: false, error: "Forbidden — admin only." }
    }

    if (input.players.length === 0) {
      return { success: false, error: "Add at least one player." }
    }

    const supabase = await createClient()

    const { data: teeTime, error: teeTimeErr } = await supabase
      .from("tee_times")
      .select("id, date, time, max_slots, season")
      .eq("id", input.teeTimeId)
      .single()

    if (teeTimeErr || !teeTime) {
      return { success: false, error: "Tee time not found." }
    }

    // Admin bypass on booking_closes_at — by design (per spec). Capacity
    // still applies and is re-checked here.
    const { data: existing } = await supabase
      .from("reservations")
      .select("slots")
      .eq("tee_time_id", input.teeTimeId)
    const reservedSlots = (existing || []).reduce((sum, r) => sum + (r.slots ?? 0), 0)
    const availableSlots = (teeTime.max_slots ?? 4) - reservedSlots
    if (input.players.length > availableSlots) {
      return {
        success: false,
        error: `Only ${availableSlots} slot${availableSlots === 1 ? "" : "s"} left at this tee time.`,
      }
    }

    // Validate guest names + phones; same rules as regular booking.
    for (let i = 0; i < input.players.length; i++) {
      const p = input.players[i]
      if (p.type === "guest") {
        if (!p.name?.trim()) {
          return { success: false, error: `Guest in seat ${i + 1} is missing a name.` }
        }
        const digits = stripPhone(p.phone || "")
        if (!isValidPhone(digits)) {
          return {
            success: false,
            error: `Guest in seat ${i + 1} needs a valid 10-digit phone.`,
          }
        }
      }
    }

    // Conflict check — even admins shouldn't accidentally double-book the
    // same league member on the same day.
    const playerUserIds: (string | null)[] = input.players.map((p) =>
      p.type === "user" ? p.userId : null,
    )
    const leagueIdsToCheck = playerUserIds.filter((id): id is string => !!id)
    if (leagueIdsToCheck.length > 0) {
      try {
        const conflictResult = await checkPlayersForDateConflict(
          teeTime.date,
          leagueIdsToCheck,
        )
        if (conflictResult.success && conflictResult.conflicts && conflictResult.conflicts.length > 0) {
          const names = conflictResult.conflicts.map((c) => c.name).join(", ")
          return {
            success: false,
            error: `${names} already has a reservation that day.`,
          }
        }
      } catch (err) {
        console.error("Admin conflict pre-check failed:", err)
      }
    }

    const player_names = input.players.map((p) => p.name.trim())
    const guest_phones: (string | null)[] = input.players.map((p) =>
      p.type === "guest" ? stripPhone(p.phone) : null,
    )
    // Phantom `false` at index 0 represents the admin's non-playing slot;
    // entries 1..N align with additional player i in the schema's view.
    const play_for_money = [false, ...input.players.map((p) => p.optedIn)]

    const { data: insertedRows, error: insertErr } = await supabase
      .from("reservations")
      .insert([
        {
          tee_time_id: input.teeTimeId,
          user_id: userId,
          slots: input.players.length,
          player_names,
          player_user_ids: playerUserIds,
          guest_phones,
          play_for_money,
          season: teeTime.season,
        },
      ])
      .select("id")

    if (insertErr) {
      return { success: false, error: insertErr.message }
    }

    const reservationId = insertedRows?.[0]?.id as string | undefined

    // Send confirmation emails to every league member on the booking.
    // Admin themselves isn't on the tee time so they don't get emailed.
    if (reservationId) {
      sendBookingConfirmationEmails(reservationId).catch((err) =>
        console.error("Admin-created booking email send failed:", err),
      )
    }

    revalidatePath("/my-reservations")
    revalidatePath("/schedule")
    revalidatePath("/admin/dashboard")
    return { success: true, reservationId }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create reservation.",
    }
  }
}
