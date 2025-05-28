import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

let supabaseClient: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const createClient = () => {
  // Return existing client if available
  if (supabaseClient) {
    return supabaseClient
  }

  try {
    supabaseClient = createClientComponentClient<Database>({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
    return supabaseClient
  } catch (error) {
    console.error("Failed to create Supabase client:", error)
    return null
  }
}

export const clearAuthStorage = () => {
  if (typeof window !== "undefined") {
    // Clear all possible Supabase auth keys
    const keysToRemove = ["sb-supabase-auth-token", "supabase.auth.token", "sb-auth-token", "supabase-auth-token"]

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    })

    // Clear all localStorage items that start with 'sb-'
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-")) {
        localStorage.removeItem(key)
      }
    })
  }
}

export const getSafeSession = async () => {
  try {
    const supabase = createClient()
    return await supabase.auth.getSession()
  } catch (error: any) {
    if (error.message?.includes("JWT") || error.message?.includes("Invalid")) {
      clearAuthStorage()
      return { data: { session: null }, error: null }
    }
    throw error
  }
}
