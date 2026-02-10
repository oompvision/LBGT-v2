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

function isAuthTokenError(error: { message?: string } | null): boolean {
  if (!error?.message) return false
  return (
    error.message.includes("refresh_token_not_found") ||
    error.message.includes("Invalid Refresh Token") ||
    error.message.includes("Auth session missing")
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          if (isAuthTokenError(error)) {
            clearAuthStorage()
          } else {
            console.error("Session error:", error)
          }
          setUser(null)
        } else {
          setUser(data.session?.user ?? null)
        }
      } catch (error: any) {
        if (!mounted) return
        console.error("Error getting session:", error)
        if (isAuthTokenError(error)) {
          clearAuthStorage()
        }
        setUser(null)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (session) {
        setUser(session.user)
      } else {
        setUser(null)
        if (event === "SIGNED_OUT") {
          clearAuthStorage()
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
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      setUser(null)
      clearAuthStorage()
    }
  }

  return <AuthContext.Provider value={{ user, isLoading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
