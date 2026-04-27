// Minimal .ics builder for tee time reservations.
// Uses TZID=America/New_York so EST/EDT is handled correctly by major
// calendar clients (Apple, Google, Outlook) without a VTIMEZONE block.

const DEFAULT_DURATION_MINUTES = 4 * 60

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

// "2026-05-01" + "14:30" or "14:30:00" -> "20260501T143000"
function toLocalIcsStamp(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map((s) => Number.parseInt(s, 10))
  const [hh, mm] = timeStr.split(":")
  const hour = Number.parseInt(hh, 10)
  const minute = Number.parseInt(mm ?? "0", 10)
  return `${y}${pad2(m)}${pad2(d)}T${pad2(hour)}${pad2(minute)}00`
}

function addMinutesToLocalIcs(stamp: string, minutes: number): string {
  // stamp = YYYYMMDDTHHMMSS local
  const y = Number.parseInt(stamp.slice(0, 4), 10)
  const mo = Number.parseInt(stamp.slice(4, 6), 10) - 1
  const d = Number.parseInt(stamp.slice(6, 8), 10)
  const h = Number.parseInt(stamp.slice(9, 11), 10)
  const mi = Number.parseInt(stamp.slice(11, 13), 10)
  // Use Date in UTC slot just for safe arithmetic; we don't care about wall tz here.
  const t = Date.UTC(y, mo, d, h, mi) + minutes * 60_000
  const dt = new Date(t)
  return (
    `${dt.getUTCFullYear()}` +
    pad2(dt.getUTCMonth() + 1) +
    pad2(dt.getUTCDate()) +
    "T" +
    pad2(dt.getUTCHours()) +
    pad2(dt.getUTCMinutes()) +
    "00"
  )
}

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  )
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

export function buildTeeTimeIcs(opts: {
  uid: string
  date: string
  time: string
  summary: string
  description?: string
  location?: string
  durationMinutes?: number
}): string {
  const start = toLocalIcsStamp(opts.date, opts.time)
  const end = addMinutesToLocalIcs(start, opts.durationMinutes ?? DEFAULT_DURATION_MINUTES)
  const dtstamp = utcStamp(new Date())

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Long Beach Golf Tour//Tee Time//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=America/New_York:${start}`,
    `DTEND;TZID=America/New_York:${end}`,
    `SUMMARY:${escapeIcsText(opts.summary)}`,
  ]
  if (opts.description) lines.push(`DESCRIPTION:${escapeIcsText(opts.description)}`)
  if (opts.location) lines.push(`LOCATION:${escapeIcsText(opts.location)}`)
  lines.push("END:VEVENT", "END:VCALENDAR")

  return lines.join("\r\n") + "\r\n"
}
