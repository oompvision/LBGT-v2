import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase credentials. Please check environment variables.")
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export function clearAuthStorage() {
  try {
    // Clear all Supabase-related items from localStorage
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("sb-")) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key)
    })

    // Also clear sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith("sb-")) {
        sessionStorage.removeItem(key)
      }
    }
  } catch (error) {
    console.error("Error clearing auth storage:", error)
  }
}
