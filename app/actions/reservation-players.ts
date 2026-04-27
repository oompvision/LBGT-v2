"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import {
  captureCancellationSnapshot,
  sendBookingCancellationEmails,
} from "@/app/actions/booking-emails"

export interface LeagueUserSummary {
  id: string
  name: string
  email: string
}

// Search confirmed league members by name or email for the "Add Player" picker.
// Excludes any userIds the caller already has in the booking form (booker + already-added).
export async function searchLeagueUsers(
  query: string,
  excludeUserIds: string[] = [],
): Promise<{ success: boolean; users?: LeagueUserSummary[]; error?: string }> {
  const supabase = await createClient()

  try {
    let q = supabase
      .from("users")
      .select("id, name, email")
      .eq("is_confirmed", true)
      .order("name", { ascending: true })
      .limit(25)

    const trimmed = query.trim()
    if (trimmed) {
      const safe = trimmed.replace(/[%,]/g, "")
      q = q.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
    }

    const { data, error } = await q
    if (error) {
      return { success: false, error: error.message }
    }

    const excluded = new Set(excludeUserIds)
    const users = (data || []).filter((u) => !excluded.has(u.id))
    return { success: true, users }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to search users" }
  }
}

export interface PlayerDateConflict {
  userId: string
  name: string
  time: string
}

// Given a date and a list of league user IDs, return each user that already
// has a reservation (as booker or as invited player) on that date.
// Used both proactively in the booking form and defensively on the server
// before the insert.
export async function checkPlayersForDateConflict(
  date: string,
  userIds: string[],
): Promise<{ success: boolean; conflicts?: PlayerDateConflict[]; error?: string }> {
  if (userIds.length === 0) {
    return { success: true, conflicts: [] }
  }

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select(
        `
        id,
        user_id,
        player_user_ids,
        tee_times!inner ( date, time )
      `,
      )
      .eq("tee_times.date", date)

    if (error) {
      return { success: false, error: error.message }
    }

    const targetIds = new Set(userIds)
    const hits: { userId: string; time: string }[] = []

    for (const r of data || []) {
      const time = (r.tee_times as any)?.time as string
      if (targetIds.has(r.user_id)) {
        hits.push({ userId: r.user_id, time })
      }
      for (const uid of (r.player_user_ids as (string | null)[] | null) || []) {
        if (uid && targetIds.has(uid)) {
          hits.push({ userId: uid, time })
        }
      }
    }

    if (hits.length === 0) {
      return { success: true, conflicts: [] }
    }

    // De-dup to one conflict per user (earliest found is fine for our messages)
    const seen = new Set<string>()
    const deduped = hits.filter((h) => {
      if (seen.has(h.userId)) return false
      seen.add(h.userId)
      return true
    })

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name")
      .in(
        "id",
        deduped.map((h) => h.userId),
      )

    if (usersError) {
      return { success: false, error: usersError.message }
    }

    const nameById = new Map<string, string>((users || []).map((u) => [u.id, u.name]))
    const conflicts: PlayerDateConflict[] = deduped.map((h) => ({
      userId: h.userId,
      name: nameById.get(h.userId) || "Player",
      time: h.time,
    }))

    return { success: true, conflicts }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to check for conflicts" }
  }
}

// Remove the signed-in user from a reservation.
// - Invited user: splices themselves out, decrements slots.
// - Booker with at least one league user still in the group: transfers ownership
//   to the first league user in `player_user_ids` and removes themselves.
// - Booker alone (slots=1 and no linked users): deletes the reservation.
// - Booker with only guests remaining: returns an error pointing at Cancel.
// Blocked if the booking window has closed.
export async function removePlayerFromReservation(
  reservationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: "You must be signed in." }
    }
    const userId = session.user.id

    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select(
        `
        id,
        user_id,
        slots,
        player_names,
        player_user_ids,
        play_for_money,
        tee_time_id,
        tee_times ( booking_closes_at )
      `,
      )
      .eq("id", reservationId)
      .single()

    if (fetchError || !reservation) {
      return { success: false, error: "Reservation not found." }
    }

    const closesAt = (reservation.tee_times as any)?.booking_closes_at as string | null | undefined
    if (closesAt && new Date(closesAt) < new Date()) {
      return {
        success: false,
        error: "The booking window has closed. You can no longer remove yourself from this tee time.",
      }
    }

    const playerUserIds: (string | null)[] = (reservation.player_user_ids as (string | null)[]) || []
    const playerNames: string[] = reservation.player_names || []
    const playForMoney: boolean[] = reservation.play_for_money || []

    const isBooker = reservation.user_id === userId
    const invitedIndex = playerUserIds.findIndex((uid) => uid === userId)

    if (!isBooker && invitedIndex === -1) {
      return { success: false, error: "You are not a player on this reservation." }
    }

    if (isBooker) {
      // Booker alone (no additional seats) → treat remove-self as cancel
      if (playerUserIds.length === 0) {
        const snapshot = await captureCancellationSnapshot(reservationId)
        const { error: deleteError } = await supabase.from("reservations").delete().eq("id", reservationId)
        if (deleteError) {
          return { success: false, error: deleteError.message }
        }
        if (snapshot) {
          sendBookingCancellationEmails(snapshot).catch((err) => {
            console.error("Cancellation email send failed:", err)
          })
        }
        revalidatePath("/my-reservations")
        revalidatePath("/dashboard")
        return { success: true }
      }

      const firstLeagueIdx = playerUserIds.findIndex((uid) => uid !== null && uid !== undefined)
      if (firstLeagueIdx === -1) {
        return {
          success: false,
          error:
            "No other league players to transfer this reservation to. Please cancel the reservation instead.",
        }
      }

      const newBookerId = playerUserIds[firstLeagueIdx] as string
      const newPlayerUserIds = [
        ...playerUserIds.slice(0, firstLeagueIdx),
        ...playerUserIds.slice(firstLeagueIdx + 1),
      ]
      const newPlayerNames = [
        ...playerNames.slice(0, firstLeagueIdx),
        ...playerNames.slice(firstLeagueIdx + 1),
      ]
      // play_for_money: index 0 = booker, index i+1 = additional player i.
      // Promote play_for_money[firstLeagueIdx + 1] to the new booker flag,
      // drop the old booker flag (index 0), and remove the promoted player's
      // additional-slot flag from the rest.
      const newBookerPFM = playForMoney[firstLeagueIdx + 1] ?? false
      const additionalPFM = playForMoney.slice(1)
      const newAdditionalPFM = [
        ...additionalPFM.slice(0, firstLeagueIdx),
        ...additionalPFM.slice(firstLeagueIdx + 1),
      ]
      const newPlayForMoney = [newBookerPFM, ...newAdditionalPFM]

      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          user_id: newBookerId,
          slots: reservation.slots - 1,
          player_user_ids: newPlayerUserIds,
          player_names: newPlayerNames,
          play_for_money: newPlayForMoney,
        })
        .eq("id", reservationId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
    } else {
      // Invited league user removes themselves
      const newPlayerUserIds = [
        ...playerUserIds.slice(0, invitedIndex),
        ...playerUserIds.slice(invitedIndex + 1),
      ]
      const newPlayerNames = [
        ...playerNames.slice(0, invitedIndex),
        ...playerNames.slice(invitedIndex + 1),
      ]
      const newPlayForMoney = [
        ...playForMoney.slice(0, invitedIndex + 1),
        ...playForMoney.slice(invitedIndex + 2),
      ]

      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          slots: reservation.slots - 1,
          player_user_ids: newPlayerUserIds,
          player_names: newPlayerNames,
          play_for_money: newPlayForMoney,
        })
        .eq("id", reservationId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
    }

    revalidatePath("/my-reservations")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to remove from reservation" }
  }
}

// Booker-only cancel: deletes the whole reservation. Every invited player
// loses the reservation too.
export async function cancelReservationAsBooker(
  reservationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return { success: false, error: "You must be signed in." }
    }

    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("id, user_id")
      .eq("id", reservationId)
      .single()

    if (fetchError || !reservation) {
      return { success: false, error: "Reservation not found." }
    }

    if (reservation.user_id !== session.user.id) {
      return {
        success: false,
        error: "Only the booker can cancel this reservation. You can remove yourself instead.",
      }
    }

    const snapshot = await captureCancellationSnapshot(reservationId)
    const { error: deleteError } = await supabase.from("reservations").delete().eq("id", reservationId)
    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    if (snapshot) {
      sendBookingCancellationEmails(snapshot).catch((err) => {
        console.error("Cancellation email send failed:", err)
      })
    }

    revalidatePath("/my-reservations")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to cancel reservation" }
  }
}
