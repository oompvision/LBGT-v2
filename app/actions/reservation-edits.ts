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

function bookerCheck(reservation: ReservationFetch, userId: string) {
  if (reservation.user_id !== userId) {
    return { ok: false as const, error: "Only the booker can edit this reservation." }
  }
  return { ok: true as const }
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

    const { data: reservation, error } = await fetchReservation(reservationId)
    if (error || !reservation || !reservation.tee_times) {
      return { success: false, error: error || "Reservation not found." }
    }

    const auth = bookerCheck(reservation, userId)
    if (!auth.ok) return { success: false, error: auth.error }

    if (!isBookingWindowOpen(reservation.tee_times.booking_closes_at)) {
      return { success: false, error: "The booking window has closed." }
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

    const auth = bookerCheck(reservation, userId)
    if (!auth.ok) return { success: false, error: auth.error }

    if (!isBookingWindowOpen(reservation.tee_times.booking_closes_at)) {
      return { success: false, error: "The booking window has closed." }
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

    const { data: reservation, error } = await fetchReservation(reservationId)
    if (error || !reservation || !reservation.tee_times) {
      return { success: false, error: error || "Reservation not found." }
    }

    if (!isBeforeCutoff(reservation.tee_times.date, reservation.tee_times.time, OPT_IN_BUFFER_MINUTES)) {
      return { success: false, error: "Opt-in editing is closed within an hour of tee time." }
    }

    const expectedLength = reservation.slots
    if (optIns.length !== expectedLength) {
      return { success: false, error: "Opt-in payload doesn't match the reservation." }
    }

    const isBooker = reservation.user_id === userId
    const playerUserIds = reservation.player_user_ids || []
    const invitedIndex = playerUserIds.findIndex((uid) => uid === userId)

    if (!isBooker && invitedIndex === -1) {
      return { success: false, error: "You're not on this reservation." }
    }

    const current = reservation.play_for_money || new Array(expectedLength).fill(false)
    let next: boolean[]

    if (isBooker) {
      // Booker can change anyone's opt-in.
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
