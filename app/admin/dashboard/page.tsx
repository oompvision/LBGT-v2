"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AdminTabs } from "../admin-tabs"
import { AdminDashboardTabs } from "./admin-dashboard-tabs"
import { ExportData } from "./export-data"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

interface AdminData {
  rounds: any[]
  roundsError: any
  roundsSuccess: boolean
  reservations: any[]
  reservationsError: any
  teeTimes: any[]
  teeTimesError: any
  users: any[]
  usersError: any
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(true)
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuthAndLoadData() {
      try {
        // Quick auth check first
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("Session error:", sessionError)
          router.push("/signin")
          return
        }

        if (!session) {
          router.push("/signin")
          return
        }

        // Quick admin check
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", session.user.id)
          .single()

        if (userError || !userData?.is_admin) {
          router.push("/dashboard")
          return
        }

        setAuthChecking(false)

        // Now load admin data
        const { getAllRoundsWithDetails, getAllReservationsWithDetails, getAllTeeTimes, getAllUsersForAdmin } =
          await import("@/app/actions/admin-management")

        const [roundsResult, reservationsResult, teeTimesResult, usersResult] = await Promise.allSettled([
          getAllRoundsWithDetails(),
          getAllReservationsWithDetails(),
          getAllTeeTimes(),
          getAllUsersForAdmin(),
        ])

        const rounds = roundsResult.status === "fulfilled" ? roundsResult.value.rounds || [] : []
        const roundsError = roundsResult.status === "rejected" ? roundsResult.reason : null
        const roundsSuccess = roundsResult.status === "fulfilled" ? roundsResult.value.success : false

        const reservations =
          reservationsResult.status === "fulfilled" ? reservationsResult.value.reservations || [] : []
        const reservationsError = reservationsResult.status === "rejected" ? reservationsResult.reason : null

        const teeTimes = teeTimesResult.status === "fulfilled" ? teeTimesResult.value.teeTimes || [] : []
        const teeTimesError = teeTimesResult.status === "rejected" ? teeTimesResult.reason : null

        const users = usersResult.status === "fulfilled" ? usersResult.value.users || [] : []
        const usersError = usersResult.status === "rejected" ? usersResult.reason : null

        setData({
          rounds,
          roundsError,
          roundsSuccess,
          reservations,
          reservationsError,
          teeTimes,
          teeTimesError,
          users,
          usersError,
        })
      } catch (error: any) {
        console.error("Error loading admin data:", error)
        setError(error.message || "Failed to load admin data")
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndLoadData()
  }, [router, supabase])

  // Show loading immediately
  if (authChecking) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
              <p className="text-muted-foreground">Checking permissions...</p>
            </div>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
              <p className="text-muted-foreground">Loading admin data...</p>
            </div>

            <AdminTabs />

            <div className="mt-6 grid gap-6 md:grid-cols-4">
              <div className="md:col-span-3 space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
              <div>
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
              <p className="text-muted-foreground">Manage rounds, scores, and reservations</p>
            </div>

            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error loading admin dashboard</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="mt-6 flex flex-col items-center justify-center gap-4">
              <p>Please try refreshing the page. If the problem persists, you can return to the main admin page.</p>
              <Button asChild>
                <Link href="/admin">Return to Admin Home</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!data) {
    return null
  }

  const hasRoundErrors = data.rounds.some((round: any) => round.error)

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
            <p className="text-muted-foreground">Manage rounds, scores, and reservations</p>

            {/* Display errors if any */}
            {data.roundsError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error loading rounds</AlertTitle>
                <AlertDescription>
                  {typeof data.roundsError === "string"
                    ? data.roundsError
                    : data.roundsError instanceof Error
                      ? data.roundsError.message
                      : "Failed to load rounds data"}
                </AlertDescription>
              </Alert>
            )}

            {data.reservationsError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error loading reservations</AlertTitle>
                <AlertDescription>
                  {typeof data.reservationsError === "string"
                    ? data.reservationsError
                    : data.reservationsError instanceof Error
                      ? data.reservationsError.message
                      : "Failed to load reservations data"}
                </AlertDescription>
              </Alert>
            )}

            {data.teeTimesError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error loading tee times</AlertTitle>
                <AlertDescription>
                  {typeof data.teeTimesError === "string"
                    ? data.teeTimesError
                    : data.teeTimesError instanceof Error
                      ? data.teeTimesError.message
                      : "Failed to load tee times data"}
                </AlertDescription>
              </Alert>
            )}

            {data.usersError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error loading users</AlertTitle>
                <AlertDescription>
                  {typeof data.usersError === "string"
                    ? data.usersError
                    : data.usersError instanceof Error
                      ? data.usersError.message
                      : "Failed to load users data"}
                </AlertDescription>
              </Alert>
            )}

            {/* Warning for rounds with missing scores */}
            {data.roundsSuccess && hasRoundErrors && (
              <Alert variant="warning" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Some scores could not be loaded</AlertTitle>
                <AlertDescription>
                  Some rounds have missing scores due to rate limiting. You can still manage rounds and users.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <AdminTabs />

          <div className="mt-6 grid gap-6 md:grid-cols-4">
            <div className="md:col-span-3">
              <AdminDashboardTabs
                rounds={data.rounds}
                reservations={data.reservations}
                teeTimes={data.teeTimes}
                users={data.users}
              />
            </div>
            <div>
              <ExportData />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
