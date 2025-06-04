"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient, clearAuthStorage } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

type AuthContextType = {
  user: User | null
  isAdmin: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (mounted) {
          if (session && !error) {
            setUser(session.user)

            // Check if user is admin
            const { data: userData } = await supabase
              .from("users")
              .select("is_admin")
              .eq("id", session.user.id)
              .single()

            setIsAdmin(userData?.is_admin === true)
          } else {
            setUser(null)
            setIsAdmin(false)
          }
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error getting session:", error)
        if (mounted) {
          clearAuthStorage()
          setUser(null)
          setIsAdmin(false)
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

      if (event === "SIGNED_IN" && session) {
        setUser(session.user)

        // Check if user is admin
        const { data: userData } = await supabase.from("users").select("is_admin").eq("id", session.user.id).single()

        setIsAdmin(userData?.is_admin === true)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setIsAdmin(false)
        clearAuthStorage()
      } else if (event === "TOKEN_REFRESHED" && session) {
        setUser(session.user)

        // Check if user is admin
        const { data: userData } = await supabase.from("users").select("is_admin").eq("id", session.user.id).single()

        setIsAdmin(userData?.is_admin === true)
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
      setIsAdmin(false)
      clearAuthStorage()
    } catch (error) {
      console.error("Error signing out:", error)
      setUser(null)
      setIsAdmin(false)
      clearAuthStorage()
    }
  }

  return <AuthContext.Provider value={{ user, isAdmin, isLoading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
