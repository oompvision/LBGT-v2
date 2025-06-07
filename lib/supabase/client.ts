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
    try {
      // Clear all possible Supabase auth keys
      const keysToRemove = [
        "sb-supabase-auth-token",
        "supabase.auth.token",
        "sb-auth-token",
        "supabase-auth-token",
        `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0]}-auth-token`,
      ]

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

      // Clear all sessionStorage items that start with 'sb-'
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("sb-")) {
          sessionStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error("Error clearing auth storage:", error)
    }
  }
}

export const getSafeSession = async () => {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      // Handle various auth errors
      if (
        error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Invalid Refresh Token") ||
        error.message?.includes("JWT") ||
        error.message?.includes("Invalid")
      ) {
        console.log("Auth token invalid, clearing storage")
        clearAuthStorage()
        return { data: { session: null }, error: null }
      }
      throw error
    }

    return { data, error: null }
  } catch (error: any) {
    console.error("Session error:", error)
    if (
      error.message?.includes("refresh_token_not_found") ||
      error.message?.includes("Invalid Refresh Token") ||
      error.message?.includes("JWT") ||
      error.message?.includes("Invalid")
    ) {
      clearAuthStorage()
      return { data: { session: null }, error: null }
    }
    throw error
  }
}
