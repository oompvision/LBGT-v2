"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DashboardTabs } from "./dashboard-tabs"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getUpcomingFridayForSeason } from "@/lib/utils"

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [userData, setUserData] = useState<any>(null)
  const [userReservations, setUserReservations] = useState<any[]>([])
  const [allTeeTimes, setAllTeeTimes] = useState<any[]>([])
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [upcomingFriday, setUpcomingFriday] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboardData = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      if (!supabase) {
        setError("Unable to connect to database")
        setIsLoading(false)
        return
      }

      // Get user data with better error handling
      const { data: userDataResult, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (userError) {
        console.error("Error fetching user data:", userError)
        // If user doesn't exist in database, create them
        if (userError.code === "PGRST116") {
          const { error: createError } = await supabase.from("users").insert({
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
          })

          if (createError) {
            setError("Error creating user profile")
            setIsLoading(false)
            return
          }

          // Retry fetching user data
          const { data: newUserData } = await supabase.from("users").select("*").eq("id", user.id).single()

          setUserData(newUserData)
        } else {
          setError("Error loading user data")
          setIsLoading(false)
          return
        }
      } else {
        setUserData(userDataResult)
      }

      // Get user's reservations with error handling
      try {
        const { data: userReservationsResult, error: reservationsError } = await supabase
          .from("reservations")
          .select(`
          id,
          tee_time_id,
          slots,
          player_names,
          tee_times (
            id,
            date,
            time
          )
        `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (reservationsError) {
          console.error("Error fetching reservations:", reservationsError)
          setUserReservations([])
        } else {
          setUserReservations(userReservationsResult || [])
        }
      } catch (err) {
        console.error("Reservations fetch error:", err)
        setUserReservations([])
      }

      // Get the upcoming Friday date using the updated logic (now returns a string)
      const fridayDateString = getUpcomingFridayForSeason()
      setUpcomingFriday(fridayDateString)

      // Get tee times for the upcoming Friday with error handling
      try {
        const { data: allTeeTimesResult, error: teeTimesError } = await supabase
          .from("tee_times")
          .select("*")
          .eq("date", fridayDateString)
          .order("time")

        if (teeTimesError) {
          console.error("Error fetching tee times:", teeTimesError)
          setAllTeeTimes([])
        } else {
          setAllTeeTimes(allTeeTimesResult || [])
        }
      } catch (err) {
        console.error("Tee times fetch error:", err)
        setAllTeeTimes([])
      }

      // Get all reservations for calculating available slots
      try {
        const { data: allReservationsResult, error: allReservationsError } = await supabase
          .from("reservations")
          .select("tee_time_id, slots")

        if (allReservationsError) {
          console.error("Error fetching all reservations:", allReservationsError)
          setAllReservations([])
        } else {
          setAllReservations(allReservationsResult || [])
        }
      } catch (err) {
        console.error("All reservations fetch error:", err)
        setAllReservations([])
      }

      setIsLoading(false)
    } catch (error: any) {
      console.error("Unexpected error loading dashboard:", error)

      // Handle specific error types
      if (error.message?.includes("Too Many")) {
        setError("Server is busy. Please try again in a moment.")
      } else if (error.message?.includes("JWT") || error.message?.includes("Invalid")) {
        setError("Authentication error. Please sign in again.")
      } else {
        setError("Unable to load dashboard. Please refresh the page.")
      }

      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      loadDashboardData()
    }
  }, [user, authLoading])

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show sign in prompt if not authenticated
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold">Authentication Required</h1>
            <p className="text-muted-foreground">You need to sign in to access the dashboard.</p>
            <Button asChild>
              <Link href="/signin">Sign In</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show loading while dashboard data is loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Loading dashboard...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show error if there was a problem loading data
  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold text-red-600">Error</h1>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {userData?.name || "Golfer"}</p>
          </div>

          <DashboardTabs
            user={userData}
            userReservations={userReservations}
            teeTimes={allTeeTimes}
            allReservations={allReservations}
            upcomingFriday={upcomingFriday}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
