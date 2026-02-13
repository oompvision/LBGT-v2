"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function getEmailHistory() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  const supabaseAdmin = createAdminClient()

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", session.user.id)
    .single()

  if (!userData?.is_admin) {
    return { success: false, error: "Forbidden" }
  }

  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("*, users:sent_by(name)")
    .order("sent_at", { ascending: false })
    .limit(50)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, campaigns: data }
}

export async function getAllMembers() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  const supabaseAdmin = createAdminClient()

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", session.user.id)
    .single()

  if (!userData?.is_admin) {
    return { success: false, error: "Forbidden" }
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, email")
    .order("name")

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, members: data }
}
