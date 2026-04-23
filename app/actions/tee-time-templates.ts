"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import { getSeasonDatesForDay, toUTC } from "@/lib/tee-time-utils"
import type { TeeTime } from "@/types/supabase"

const DAYS_OF_WEEK_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export interface TeeTimeTemplate {
  id: string
  season_id: string
  day_of_week: number
  time_slots: string[]
  max_slots: number
  booking_opens_days_before: number
  booking_opens_time: string
  booking_closes_days_before: number
  booking_closes_time: string
  timezone: string
  created_at: string
  updated_at: string
}

// Get the template for a season
export async function getTemplateForSeason(seasonId: string): Promise<{
  success: boolean
  template?: TeeTimeTemplate | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("tee_time_templates")
      .select("*")
      .eq("season_id", seasonId)
      .maybeSingle()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, template: data }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to get template" }
  }
}

// Save (create or update) a template for a season
export async function saveTemplate(input: {
  season_id: string
  day_of_week: number
  time_slots: string[]
  max_slots: number
  booking_opens_days_before: number
  booking_opens_time: string
  booking_closes_days_before: number
  booking_closes_time: string
  timezone: string
}): Promise<{ success: boolean; template?: TeeTimeTemplate; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Check if template already exists for this season
    const { data: existing } = await supabase
      .from("tee_time_templates")
      .select("id")
      .eq("season_id", input.season_id)
      .maybeSingle()

    const templateData = {
      ...input,
      updated_at: new Date().toISOString(),
    }

    let result
    if (existing) {
      result = await supabase
        .from("tee_time_templates")
        .update(templateData)
        .eq("id", existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from("tee_time_templates")
        .insert(templateData)
        .select()
        .single()
    }

    if (result.error) {
      return { success: false, error: result.error.message }
    }

    revalidatePath("/admin/tee-times")
    return { success: true, template: result.data }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to save template" }
  }
}

// Generate tee times for the entire season based on the template
export async function generateTeeTimesFromTemplate(
  seasonId: string,
  options: { overwriteExisting?: boolean } = {},
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from("tee_time_templates")
      .select("*")
      .eq("season_id", seasonId)
      .single()

    if (templateError || !template) {
      return { success: false, error: "No template found for this season. Please save a template first." }
    }

    // Get the season
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("*")
      .eq("id", seasonId)
      .single()

    if (seasonError || !season) {
      return { success: false, error: "Season not found." }
    }

    // Get all dates matching the template's day_of_week within the season
    const seasonStart = new Date(season.start_date + "T00:00:00")
    const seasonEnd = new Date(season.end_date + "T00:00:00")
    const dates = getSeasonDatesForDay(seasonStart, seasonEnd, template.day_of_week)

    if (dates.length === 0) {
      return { success: false, error: "No matching dates found in the season date range." }
    }

    const dateStrs = dates.map((d) => format(d, "yyyy-MM-dd"))
    const normalizeTime = (t: string) => t.slice(0, 5)
    const templateTimes = new Set(template.time_slots.map(normalizeTime))

    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0

    // Overwrite mode: delete existing tee times on matching-day-of-week dates
    // whose times are NOT in the template. Cascades reservations + availability.
    if (options.overwriteExisting) {
      const { data: existingOnDates, error: findErr } = await supabase
        .from("tee_times")
        .select("id, time")
        .in("date", dateStrs)

      if (findErr) {
        return { success: false, error: `Failed to look up existing tee times: ${findErr.message}` }
      }

      const toDeleteIds = (existingOnDates || [])
        .filter((tt) => !templateTimes.has(normalizeTime(tt.time)))
        .map((tt) => tt.id)

      if (toDeleteIds.length > 0) {
        const { error: delResErr } = await supabase
          .from("reservations")
          .delete()
          .in("tee_time_id", toDeleteIds)
        if (delResErr) {
          return { success: false, error: `Failed to delete reservations: ${delResErr.message}` }
        }

        const { error: delAvailErr } = await supabase
          .from("tee_time_availability")
          .delete()
          .in("tee_time_id", toDeleteIds)
        if (delAvailErr) {
          console.error("Error deleting tee_time_availability rows:", delAvailErr)
        }

        const { error: delTtErr } = await supabase
          .from("tee_times")
          .delete()
          .in("id", toDeleteIds)
        if (delTtErr) {
          return { success: false, error: `Failed to delete tee times: ${delTtErr.message}` }
        }

        deletedCount = toDeleteIds.length
      }
    }

    for (const date of dates) {
      const dateStr = format(date, "yyyy-MM-dd")

      // Compute booking window for this date
      const opensDate = new Date(date)
      opensDate.setDate(opensDate.getDate() - template.booking_opens_days_before)
      const opensDateStr = format(opensDate, "yyyy-MM-dd")

      const closesDate = new Date(date)
      closesDate.setDate(closesDate.getDate() - template.booking_closes_days_before)
      const closesDateStr = format(closesDate, "yyyy-MM-dd")

      const bookingOpensAt = toUTC(opensDateStr, template.booking_opens_time, template.timezone)
      const bookingClosesAt = toUTC(closesDateStr, template.booking_closes_time, template.timezone)

      for (const timeSlot of template.time_slots) {
        const timeWithSeconds = timeSlot.length === 5 ? timeSlot + ":00" : timeSlot

        // Check if this tee time already exists
        const { data: existing } = await supabase
          .from("tee_times")
          .select("id")
          .eq("date", dateStr)
          .eq("time", timeWithSeconds)
          .maybeSingle()

        if (existing) {
          // Update existing tee time with current season, booking window, and settings
          const { error: updateError } = await supabase
            .from("tee_times")
            .update({
              booking_opens_at: bookingOpensAt,
              booking_closes_at: bookingClosesAt,
              max_slots: template.max_slots,
              is_available: true,
              season: season.year,
            })
            .eq("id", existing.id)

          if (updateError) {
            console.error(`Error updating tee time ${existing.id}:`, updateError)
          } else {
            updatedCount++
          }
        } else {
          // Create new tee time
          const { error: insertError } = await supabase.from("tee_times").insert({
            date: dateStr,
            time: timeWithSeconds,
            max_slots: template.max_slots,
            is_available: true,
            season: season.year,
            booking_opens_at: bookingOpensAt,
            booking_closes_at: bookingClosesAt,
          })

          if (insertError) {
            console.error(`Error inserting tee time ${dateStr} ${timeWithSeconds}:`, insertError)
          } else {
            createdCount++
          }
        }
      }
    }

    revalidatePath("/admin/tee-times")
    revalidatePath("/dashboard")
    revalidatePath("/schedule")

    const parts = [`${createdCount} created`, `${updatedCount} updated`]
    if (options.overwriteExisting) {
      parts.push(`${deletedCount} deleted`)
    }
    const dayName = DAYS_OF_WEEK_NAMES[template.day_of_week] || "day"
    return {
      success: true,
      message: `Tee times: ${parts.join(", ")} across ${dates.length} ${dayName}s in ${season.name} (season year: ${season.year}).`,
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to generate tee times" }
  }
}

// Add a single tee time to the schedule (used by the admin weekly view).
export async function addTeeTimeToSchedule(input: {
  date: string
  time: string
  maxSlots: number
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    const timeWithSeconds = input.time.length === 5 ? input.time + ":00" : input.time

    // Check if a tee time at this exact date/time already exists
    const { data: existing } = await supabase
      .from("tee_times")
      .select("id")
      .eq("date", input.date)
      .eq("time", timeWithSeconds)
      .maybeSingle()

    if (existing) {
      return { success: false, error: "A tee time at this date and time already exists." }
    }

    // Pull the active season so the new tee time gets tagged correctly
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("year")
      .eq("is_active", true)
      .maybeSingle()

    const { data: newTeeTime, error: insertError } = await supabase
      .from("tee_times")
      .insert({
        date: input.date,
        time: timeWithSeconds,
        max_slots: input.maxSlots,
        is_available: true,
        season: activeSeason?.year ?? new Date().getFullYear(),
      })
      .select("id")
      .single()

    if (insertError || !newTeeTime) {
      return { success: false, error: insertError?.message || "Failed to create tee time" }
    }

    // Mirror the availability row so booking flows see this slot as available
    const { error: availError } = await supabase.from("tee_time_availability").insert({
      tee_time_id: newTeeTime.id,
      is_available: true,
    })
    if (availError) {
      console.error("Error creating tee_time_availability row:", availError)
    }

    revalidatePath("/admin/tee-times")
    revalidatePath("/dashboard")
    revalidatePath("/schedule")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add tee time" }
  }
}

// Get tee times for a specific date with reservation counts
export async function getTeeTimesForDate(dateStr: string): Promise<{
  success: boolean
  teeTimes?: (TeeTime & { reserved_slots: number; available_slots: number })[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("tee_times")
      .select(`
        *,
        reservations (
          id,
          slots
        )
      `)
      .eq("date", dateStr)
      .order("time", { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    const teeTimes = (data || []).map((tt) => {
      const reservedSlots = tt.reservations?.reduce((sum: number, r: { slots: number }) => sum + r.slots, 0) || 0
      return {
        ...tt,
        reserved_slots: reservedSlots,
        available_slots: tt.max_slots - reservedSlots,
      }
    })

    return { success: true, teeTimes }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to get tee times" }
  }
}

// Toggle a specific tee time's availability
export async function toggleTeeTime(teeTimeId: string, isAvailable: boolean): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from("tee_times")
      .update({ is_available: isAvailable })
      .eq("id", teeTimeId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/tee-times")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to toggle tee time" }
  }
}

// Get all dates that have tee times for the active season
export async function getUpcomingTeeTimeDates(): Promise<{
  success: boolean
  dates?: string[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get active season
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .single()

    if (seasonError || !season) {
      console.error("getUpcomingTeeTimeDates: no active season", seasonError)
      return { success: true, dates: [] }
    }

    // Get all tee time dates for this season — no date filter so admin can see everything
    const { data, error } = await supabase
      .from("tee_times")
      .select("date")
      .eq("season", season.year)
      .order("date", { ascending: true })

    if (error) {
      console.error("getUpcomingTeeTimeDates: query error", error)
      return { success: false, error: error.message }
    }

    // Deduplicate dates
    const uniqueDates = [...new Set(data?.map((d) => d.date) || [])]
    return { success: true, dates: uniqueDates }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to get upcoming dates" }
  }
}
