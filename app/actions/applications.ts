"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export type ApplicationFormData = {
  name: string
  email: string
  phone: string
  hometown: string
  handicap: string
  referralSource: string
  notes?: string
}

export async function submitApplication(formData: ApplicationFormData) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Use the SQL function we created to bypass RLS
    const { data, error } = await supabase.rpc("submit_application", {
      p_name: formData.name,
      p_email: formData.email,
      p_phone: formData.phone,
      p_hometown: formData.hometown,
      p_handicap: formData.handicap,
      p_referral_source: formData.referralSource,
      p_notes: formData.notes || null,
    })

    if (error) {
      console.error("Error submitting application:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error in submitApplication:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function getApplications() {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching applications:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error in getApplications:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function updateApplicationStatus(id: string, status: string) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.from("applications").update({ status }).eq("id", id)

    if (error) {
      console.error("Error updating application status:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in updateApplicationStatus:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function deleteApplication(id: string) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.from("applications").delete().eq("id", id)

    if (error) {
      console.error("Error deleting application:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Error in deleteApplication:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
