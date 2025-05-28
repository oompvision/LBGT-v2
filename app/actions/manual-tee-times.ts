"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function createManualTeeTimes(date: string, times: string[]) {
  try {
    console.log(`Creating manual tee times for ${date}:`, times)

    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    // First, check which tee times already exist
    const { data: existingTeeTimes, error: checkError } = await supabase
      .from("tee_times")
      .select("time")
      .eq("date", date)
      .in("time", times)

    if (checkError) {
      console.error("Error checking existing tee times:", checkError)
      return { success: false, error: checkError.message }
    }

    // Filter out times that already exist
    const existingTimes = existingTeeTimes?.map((tt) => tt.time) || []
    const newTimes = times.filter((time) => !existingTimes.includes(time))

    if (newTimes.length === 0) {
      return {
        success: false,
        error: `All selected times already exist for ${date}. Existing times: ${existingTimes.join(", ")}`,
      }
    }

    // Create only the new tee times
    const teeTimesToInsert = newTimes.map((time) => ({
      date,
      time,
      max_slots: 4, // Each tee time can have up to 4 players
    }))

    const { data: insertedTeeTimes, error: insertError } = await supabase
      .from("tee_times")
      .insert(teeTimesToInsert)
      .select()

    if (insertError) {
      console.error("Error creating tee times:", insertError)
      return { success: false, error: insertError.message }
    }

    console.log(`Successfully created ${insertedTeeTimes?.length || 0} tee times`)

    // Revalidate all relevant paths so changes appear immediately
    revalidatePath("/admin/manual-tee-times")
    revalidatePath("/dashboard")
    revalidatePath("/reservations")
    revalidatePath("/schedule")
    revalidatePath("/admin/dashboard")
    revalidatePath("/admin/tee-times")

    let message = `Successfully created ${newTimes.length} tee times for ${date}`
    if (existingTimes.length > 0) {
      message += `. Skipped ${existingTimes.length} existing times: ${existingTimes.join(", ")}`
    }

    return { success: true, message }
  } catch (error: any) {
    console.error("Error in createManualTeeTimes:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function deleteManualTeeTime(teeTimeId: string) {
  try {
    console.log(`Deleting tee time ${teeTimeId}`)

    const supabase = createAdminClient()

    // Check if there are any reservations for this tee time
    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("id")
      .eq("tee_time_id", teeTimeId)

    if (reservationsError) {
      console.error("Error checking reservations:", reservationsError)
      return { success: false, error: reservationsError.message }
    }

    if (reservations && reservations.length > 0) {
      return {
        success: false,
        error: "Cannot delete tee time with existing reservations. Please delete the reservations first.",
      }
    }

    // Delete the tee time
    const { error } = await supabase.from("tee_times").delete().eq("id", teeTimeId)

    if (error) {
      console.error("Error deleting tee time:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/manual-tee-times")
    revalidatePath("/dashboard")
    revalidatePath("/reservations")
    revalidatePath("/schedule")

    return { success: true, message: "Tee time deleted successfully" }
  } catch (error: any) {
    console.error("Error in deleteManualTeeTime:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function getAllManualTeeTimes() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("tee_times")
      .select(`
        *,
        reservations (
          id,
          slots,
          user_id,
          users (
            name
          )
        )
      `)
      .order("date", { ascending: true })
      .order("time", { ascending: true })

    if (error) {
      console.error("Error fetching tee times:", error)
      return { success: false, error: error.message, teeTimes: [] }
    }

    // Calculate available slots for each tee time
    const teeTimesWithAvailability =
      data?.map((teeTime) => {
        const reservedSlots =
          teeTime.reservations?.reduce((sum: number, reservation: any) => sum + reservation.slots, 0) || 0
        const availableSlots = (teeTime.max_slots || 4) - reservedSlots

        return {
          ...teeTime,
          reservedSlots,
          availableSlots,
          is_available: availableSlots > 0 && (teeTime.max_slots || 0) > 0,
        }
      }) || []

    return { success: true, teeTimes: teeTimesWithAvailability }
  } catch (error: any) {
    console.error("Error in getAllManualTeeTimes:", error)
    return { success: false, error: error.message || "An unexpected error occurred", teeTimes: [] }
  }
}

export async function toggleTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  try {
    console.log(`Toggling tee time ${teeTimeId} availability to ${isAvailable}`)

    const supabase = createAdminClient()

    // Toggle availability by setting max_slots (0 = disabled, 4 = enabled)
    const maxSlots = isAvailable ? 4 : 0

    const { error } = await supabase.from("tee_times").update({ max_slots: maxSlots }).eq("id", teeTimeId)

    if (error) {
      console.error("Error toggling tee time availability:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/manual-tee-times")
    revalidatePath("/dashboard")
    revalidatePath("/reservations")

    return { success: true, message: `Tee time ${isAvailable ? "enabled" : "disabled"} successfully` }
  } catch (error: any) {
    console.error("Error in toggleTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function checkExistingTeeTimes(date: string, times: string[]) {
  try {
    // Use admin client to bypass RLS
    const supabase = createAdminClient()

    const { data: existingTeeTimes, error } = await supabase
      .from("tee_times")
      .select("time")
      .eq("date", date)
      .in("time", times)

    if (error) {
      console.error("Error checking existing tee times:", error)
      return { success: false, error: error.message, existingTimes: [] }
    }

    const existingTimes = existingTeeTimes?.map((tt) => tt.time) || []
    return { success: true, existingTimes }
  } catch (error: any) {
    console.error("Error in checkExistingTeeTimes:", error)
    return { success: false, error: error.message || "An unexpected error occurred", existingTimes: [] }
  }
}
