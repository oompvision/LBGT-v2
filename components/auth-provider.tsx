"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient, clearAuthStorage } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

type AuthContextType = {
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    // Get initial session
    const getInitialSession = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getSession()

        if (mounted) {
          if (error) {
            // Handle auth errors gracefully
            if (
              error.message?.includes("refresh_token_not_found") ||
              error.message?.includes("Invalid Refresh Token") ||
              error.message?.includes("JWT") ||
              error.message?.includes("Invalid")
            ) {
              console.log("Auth error, clearing storage:", error.message)
              clearAuthStorage()
              setUser(null)
            } else {
              console.error("Session error:", error)
              setUser(null)
            }
          } else if (data.session) {
            setUser(data.session.user)
          } else {
            setUser(null)
          }
          setIsLoading(false)
        }
      } catch (error: any) {
        console.error("Error getting session:", error)
        if (mounted) {
          // Clear auth storage on any auth-related error
          if (
            error.message?.includes("refresh_token_not_found") ||
            error.message?.includes("Invalid Refresh Token") ||
            error.message?.includes("JWT") ||
            error.message?.includes("Invalid")
          ) {
            clearAuthStorage()
          }
          setUser(null)
          setIsLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log("Auth event:", event)

      try {
        if (event === "SIGNED_IN" && session) {
          setUser(session.user)
        } else if (event === "SIGNED_OUT") {
          setUser(null)
          clearAuthStorage()
        } else if (event === "TOKEN_REFRESHED" && session) {
          setUser(session.user)
        } else if (event === "SIGNED_OUT" || !session) {
          setUser(null)
          clearAuthStorage()
        }
      } catch (error: any) {
        console.error("Auth state change error:", error)
        if (error.message?.includes("refresh_token_not_found") || error.message?.includes("Invalid Refresh Token")) {
          clearAuthStorage()
          setUser(null)
        }
      }

      setIsLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setUser(null)
      clearAuthStorage()
    } catch (error) {
      console.error("Error signing out:", error)
      setUser(null)
      clearAuthStorage()
    }
  }

  return <AuthContext.Provider value={{ user, isLoading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
