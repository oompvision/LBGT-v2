"use server"

import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/server"
import { buildBrandedEmailHtml } from "@/lib/email-template"
import { buildTeeTimeIcs } from "@/lib/ics"
import {
  computePlayerOwed,
  formatTimeOfDay,
  type BookingPlayerSummary,
} from "@/lib/booking-summary"
import { BASE_TEE_TIME_COST, ZELLE_PAYMENT_EMAIL } from "@/lib/constants"
import { formatPhone } from "@/lib/phone"

const FROM_ADDRESS = "Long Beach Golf Tour <commissioner@updates.longbeachgolftour.com>"
const COURSE_LOCATION = "The Golf Club at Middlebay, Oceanside, NY"

function formatLongDate(dateStr: string): string {
  // YYYY-MM-DD -> "Friday, May 1, 2026"
  try {
    const [y, m, d] = dateStr.split("-").map((s) => Number.parseInt(s, 10))
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    })
  } catch {
    return dateStr
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

type ReservationFetch = {
  id: string
  user_id: string
  slots: number
  player_names: string[] | null
  player_user_ids: (string | null)[] | null
  guest_phones: (string | null)[] | null
  play_for_money: boolean[] | null
  tee_times: { date: string; time: string } | null
  users: { name: string | null; email: string | null } | null
}

async function fetchReservationDetails(
  reservationId: string,
): Promise<{ data: ReservationFetch | null; error: string | null }> {
  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select(
      "id, user_id, slots, player_names, player_user_ids, guest_phones, play_for_money, tee_times(date, time), users:user_id(name, email)",
    )
    .eq("id", reservationId)
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as unknown as ReservationFetch, error: null }
}

async function fetchLeagueUsers(ids: string[]) {
  if (ids.length === 0) return new Map<string, { name: string | null; email: string | null }>()
  const supabaseAdmin = createAdminClient()
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name, email")
    .in("id", ids)
  const map = new Map<string, { name: string | null; email: string | null }>()
  for (const u of data || []) map.set(u.id, { name: u.name, email: u.email })
  return map
}

async function buildPlayerSummaries(
  res: ReservationFetch,
  cashGameEntry: number,
): Promise<BookingPlayerSummary[]> {
  const additionalNames = res.player_names || []
  const additionalIds = res.player_user_ids || []
  const additionalPhones = res.guest_phones || []
  const pfm = res.play_for_money || []

  const idsToLookup = additionalIds.filter((id): id is string => !!id)
  const userMap = await fetchLeagueUsers(idsToLookup)

  const players: BookingPlayerSummary[] = []
  const bookerOptedIn = !!pfm[0]
  players.push({
    index: 0,
    name: res.users?.name || "Booker",
    isBooker: true,
    optedIn: bookerOptedIn,
    entryAmount: bookerOptedIn ? cashGameEntry : 0,
    owe: computePlayerOwed(bookerOptedIn, cashGameEntry),
    email: res.users?.email || null,
    userId: res.user_id,
    guestPhone: null,
  })

  for (let i = 0; i < additionalNames.length; i++) {
    const optedIn = !!pfm[i + 1]
    const uid = additionalIds[i] || null
    const lookup = uid ? userMap.get(uid) : null
    players.push({
      index: i + 1,
      name: lookup?.name || additionalNames[i] || `Player ${i + 2}`,
      isBooker: false,
      optedIn,
      entryAmount: optedIn ? cashGameEntry : 0,
      owe: computePlayerOwed(optedIn, cashGameEntry),
      email: lookup?.email || null,
      userId: uid,
      guestPhone: uid ? null : additionalPhones[i] ?? null,
    })
  }
  return players
}

function buildConfirmationEmailHtml(opts: {
  recipient: BookingPlayerSummary
  players: BookingPlayerSummary[]
  date: string
  time: string
  cashGameTitle: string | null
  cashGameDescription: string | null
}): { subject: string; html: string } {
  const longDate = formatLongDate(opts.date)
  const niceTime = formatTimeOfDay(opts.time)
  const subject = `Tee time confirmed — ${longDate} at ${niceTime} EST`

  const playerLines = opts.players
    .map((p) => {
      const youTag = p.name === opts.recipient.name && p.isBooker === opts.recipient.isBooker ? " (you)" : ""
      const optTag = p.optedIn && opts.cashGameTitle ? ` · opted in to ${escapeHtml(opts.cashGameTitle)}` : ""
      // Show guest phone only to the booker — invited players shouldn't see it.
      const phoneTag =
        opts.recipient.isBooker && p.guestPhone
          ? ` · ${escapeHtml(formatPhone(p.guestPhone))}`
          : ""
      return `<li style="margin: 4px 0;">${escapeHtml(p.name)}${youTag}${phoneTag}${optTag}</li>`
    })
    .join("")

  const cashGameBlock =
    opts.cashGameTitle
      ? `<p style="margin: 16px 0 4px;"><strong>Cash game:</strong> ${escapeHtml(opts.cashGameTitle)}</p>${
          opts.cashGameDescription
            ? `<p style="margin: 0 0 8px; color: #4a4a4a;">${escapeHtml(opts.cashGameDescription)}</p>`
            : ""
        }`
      : ""

  const youOwe = opts.recipient.owe
  const breakdown = opts.recipient.optedIn && opts.cashGameTitle
    ? `$${BASE_TEE_TIME_COST} green fee + $${opts.recipient.entryAmount} ${escapeHtml(opts.cashGameTitle)} entry`
    : `$${BASE_TEE_TIME_COST} green fee`

  // Cash-game opt-in note. Only show when there's actually a cash game on
  // this date. The opted-in line is a soft warning (deadline) and gets red
  // emphasis; the not-opted-in line is purely informational.
  const cashGameNote = opts.cashGameTitle
    ? opts.recipient.optedIn
      ? `<p style="margin: 12px 0 0; color: #B91C1C; font-weight: 600; font-size: 14px;">If cash game entry is not received before your tee time you will not be entered.</p>`
      : `<p style="margin: 12px 0 0; color: #4a4a4a; font-size: 14px;">You are not currently opted into the cash game.</p>`
    : ""

  // Email clients can't run JS, so a real "copy on click" button isn't
  // possible. We render the address as a bordered monospace box (no link)
  // and rely on the user to tap-and-hold / select to copy. The
  // x-apple-data-detectors attribute and the format-detection meta in
  // lib/email-template.ts together prevent iOS Mail / Apple Mail from
  // auto-converting the address into a mailto link.
  const highlight = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">
      <tr>
        <td style="background-color: #FFF7E0; border: 1px solid #F2C84B; border-radius: 8px; padding: 16px;">
          <p style="margin: 0 0 6px; font-weight: 600; color: #1a1a1a;">You owe $${youOwe}</p>
          <p style="margin: 0 0 12px; color: #4a4a4a; font-size: 14px;">${breakdown}</p>
          <p style="margin: 0 0 8px; color: #1a1a1a;">Send via Zelle to:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0;">
            <tr>
              <td x-apple-data-detectors="false" style="background-color: #ffffff; border: 1px solid #F2C84B; border-radius: 8px; padding: 10px 14px; font-family: SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size: 15px; font-weight: 600; color: #1a1a1a;">
                ${escapeHtml(ZELLE_PAYMENT_EMAIL)}
              </td>
            </tr>
          </table>
          <p style="margin: 12px 0 0; color: #4a4a4a; font-size: 14px;">
            Thank you in advance for making prompt payment and streamlining LBGT operations.
          </p>
          ${cashGameNote}
        </td>
      </tr>
    </table>
  `

  const body = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(opts.recipient.name)},</p>
    <p style="margin: 0 0 12px;">Your tee time is confirmed.</p>
    <p style="margin: 0 0 4px;"><strong>${longDate}</strong></p>
    <p style="margin: 0 0 12px;">${niceTime} EST · ${escapeHtml(COURSE_LOCATION)}</p>
    <p style="margin: 12px 0 4px;"><strong>Players in your group</strong></p>
    <ul style="margin: 0 0 8px; padding-left: 20px;">${playerLines}</ul>
    ${cashGameBlock}
    ${highlight}
    <p style="margin: 12px 0 0; color: #4a4a4a; font-size: 13px;">
      An invite has been attached for your calendar.
    </p>
  `

  const html = buildBrandedEmailHtml({ subject, body })
  return { subject, html }
}

function buildCancellationEmailHtml(opts: {
  recipientName: string
  date: string
  time: string
}): { subject: string; html: string } {
  const longDate = formatLongDate(opts.date)
  const niceTime = formatTimeOfDay(opts.time)
  const subject = `Tee time canceled — ${longDate} at ${niceTime} EST`
  const body = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(opts.recipientName)},</p>
    <p style="margin: 0 0 12px;">Your tee time has been canceled.</p>
    <p style="margin: 0 0 4px;"><strong>${longDate}</strong></p>
    <p style="margin: 0 0 12px;">${niceTime} EST · ${escapeHtml(COURSE_LOCATION)}</p>
    <p style="margin: 0; color: #4a4a4a; font-size: 14px;">
      No payment is owed. If this was a mistake, you can rebook on the site.
    </p>
  `
  return { subject, html: buildBrandedEmailHtml({ subject, body }) }
}

export type CancellationSnapshot = {
  reservationId: string
  date: string
  time: string
  recipients: { name: string; email: string }[]
}

export async function captureCancellationSnapshot(
  reservationId: string,
): Promise<CancellationSnapshot | null> {
  const { data, error } = await fetchReservationDetails(reservationId)
  if (error || !data || !data.tee_times) return null

  const ids = (data.player_user_ids || []).filter((id): id is string => !!id)
  const userMap = await fetchLeagueUsers(ids)
  const recipients: { name: string; email: string }[] = []
  if (data.users?.email) {
    recipients.push({ name: data.users.name || "Player", email: data.users.email })
  }
  for (const id of ids) {
    const u = userMap.get(id)
    if (u?.email) recipients.push({ name: u.name || "Player", email: u.email })
  }
  return {
    reservationId: data.id,
    date: data.tee_times.date,
    time: data.tee_times.time,
    recipients,
  }
}

export async function sendBookingConfirmationEmails(
  reservationId: string,
  options?: { onlyUserIds?: string[] },
) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; skipping booking confirmation emails.")
      return { success: false, error: "Email service not configured" }
    }
    const resend = new Resend(apiKey)

    const { data: reservation, error: fetchErr } = await fetchReservationDetails(reservationId)
    if (fetchErr || !reservation || !reservation.tee_times) {
      return { success: false, error: fetchErr || "Reservation not found" }
    }

    const supabaseAdmin = createAdminClient()
    const { data: cashGameRow } = await supabaseAdmin
      .from("cash_games")
      .select("title, description, entry_amount")
      .eq("date", reservation.tee_times.date)
      .maybeSingle()

    const cashGameEntry = cashGameRow?.entry_amount ?? 0
    const players = await buildPlayerSummaries(reservation, cashGameEntry)

    const ics = buildTeeTimeIcs({
      uid: `reservation-${reservation.id}@longbeachgolftour.com`,
      date: reservation.tee_times.date,
      time: reservation.tee_times.time,
      summary: cashGameRow?.title
        ? `LBGT Tee Time — ${cashGameRow.title}`
        : "LBGT Tee Time",
      description: cashGameRow?.description || undefined,
      location: COURSE_LOCATION,
    })
    const icsBase64 = Buffer.from(ics, "utf8").toString("base64")

    const onlyIds = options?.onlyUserIds && options.onlyUserIds.length > 0
      ? new Set(options.onlyUserIds)
      : null
    const recipients = players
      .filter((p) => !!p.email)
      .filter((p) => (onlyIds ? p.userId && onlyIds.has(p.userId) : true))
    if (recipients.length === 0) {
      return { success: true, sent: 0, total: 0 }
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []
    for (const recipient of recipients) {
      const { subject, html } = buildConfirmationEmailHtml({
        recipient,
        players,
        date: reservation.tee_times.date,
        time: reservation.tee_times.time,
        cashGameTitle: cashGameRow?.title ?? null,
        cashGameDescription: cashGameRow?.description ?? null,
      })
      try {
        const result = await resend.emails.send({
          from: FROM_ADDRESS,
          to: recipient.email!,
          subject,
          html,
          attachments: [
            {
              filename: "tee-time.ics",
              content: icsBase64,
              contentType: "text/calendar; charset=utf-8; method=PUBLISH",
            },
          ],
        })
        if (result.error) {
          failed++
          if (errors.length < 3) errors.push(result.error.message || "Send failed")
        } else {
          sent++
        }
      } catch (err: unknown) {
        failed++
        if (errors.length < 3) errors.push(err instanceof Error ? err.message : "Send failed")
      }
    }

    return { success: failed === 0, sent, failed, total: recipients.length, errors }
  } catch (err) {
    console.error("sendBookingConfirmationEmails error:", err)
    return { success: false, error: "Failed to send confirmation emails" }
  }
}

export async function sendBookingCancellationEmails(snapshot: CancellationSnapshot) {
  try {
    if (snapshot.recipients.length === 0) return { success: true, sent: 0, total: 0 }
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; skipping booking cancellation emails.")
      return { success: false, error: "Email service not configured" }
    }
    const resend = new Resend(apiKey)

    let sent = 0
    let failed = 0
    for (const recipient of snapshot.recipients) {
      const { subject, html } = buildCancellationEmailHtml({
        recipientName: recipient.name,
        date: snapshot.date,
        time: snapshot.time,
      })
      try {
        const result = await resend.emails.send({
          from: FROM_ADDRESS,
          to: recipient.email,
          subject,
          html,
        })
        if (result.error) failed++
        else sent++
      } catch {
        failed++
      }
    }
    return { success: failed === 0, sent, failed, total: snapshot.recipients.length }
  } catch (err) {
    console.error("sendBookingCancellationEmails error:", err)
    return { success: false, error: "Failed to send cancellation emails" }
  }
}
