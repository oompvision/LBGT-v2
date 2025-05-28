"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateTeeTimeAvailability(teeTimeId: string, isAvailable: boolean) {
  const supabase = createClient()

  try {
    console.log(`Updating tee time ${teeTimeId} availability to ${isAvailable}`)

    // Use the correct upsert syntax with onConflict
    const { data, error } = await supabase.from("tee_time_availability").upsert(
      {
        tee_time_id: teeTimeId,
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "tee_time_id",
        update: ["is_available", "updated_at"],
      },
    )

    if (error) {
      console.error("Error updating tee time availability:", error)
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath("/admin/tee-times")
    revalidatePath("/dashboard")
    revalidatePath("/schedule")
    revalidatePath("/reservations")

    return { success: true }
  } catch (error: any) {
    console.error("Error in updateTeeTimeAvailability:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
