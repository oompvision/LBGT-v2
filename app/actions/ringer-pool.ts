"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const supabaseAdmin = createAdminClient()

async function resolveSeasonYear(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("seasons")
    .select("year")
    .eq("is_active", true)
    .maybeSingle()
  return data?.year ?? new Date().getFullYear()
}

export async function getMyRingerOptIn(): Promise<{
  seasonYear: number
  optedIn: boolean | null
}> {
  const supabase = await createClient()
  const seasonYear = await resolveSeasonYear()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { seasonYear, optedIn: null }
  }

  const { data } = await supabase
    .from("ringer_pool_opt_ins")
    .select("opted_in")
    .eq("user_id", session.user.id)
    .eq("season_year", seasonYear)
    .maybeSingle()

  return { seasonYear, optedIn: data ? data.opted_in : null }
}

export async function setMyRingerOptIn(optedIn: boolean) {
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: "You must be signed in." }
    }

    const seasonYear = await resolveSeasonYear()

    const { error } = await supabase
      .from("ringer_pool_opt_ins")
      .upsert(
        {
          user_id: session.user.id,
          season_year: seasonYear,
          opted_in: optedIn,
          decided_at: new Date().toISOString(),
        },
        { onConflict: "user_id,season_year" },
      )

    if (error) return { success: false, error: error.message }

    revalidatePath("/profile")
    revalidatePath("/scores/league-rounds")
    return { success: true, seasonYear }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to save opt-in." }
  }
}

export async function adminSetRingerOptIn(
  userId: string,
  status: "opted_in" | "declined" | "unset",
) {
  try {
    const seasonYear = await resolveSeasonYear()

    if (status === "unset") {
      const { error } = await supabaseAdmin
        .from("ringer_pool_opt_ins")
        .delete()
        .eq("user_id", userId)
        .eq("season_year", seasonYear)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await supabaseAdmin
        .from("ringer_pool_opt_ins")
        .upsert(
          {
            user_id: userId,
            season_year: seasonYear,
            opted_in: status === "opted_in",
            decided_at: new Date().toISOString(),
          },
          { onConflict: "user_id,season_year" },
        )
      if (error) return { success: false, error: error.message }
    }

    revalidatePath("/admin/users")
    revalidatePath("/profile")
    revalidatePath("/scores/league-rounds")
    return { success: true, seasonYear }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to save opt-in." }
  }
}

export async function getRingerOptInsForSeason(seasonYear: number) {
  const { data, error } = await supabaseAdmin
    .from("ringer_pool_opt_ins")
    .select("user_id, opted_in")
    .eq("season_year", seasonYear)

  if (error) return { success: false, error: error.message, optIns: [] as Array<{ user_id: string; opted_in: boolean }> }
  return { success: true, optIns: data || [] }
}
