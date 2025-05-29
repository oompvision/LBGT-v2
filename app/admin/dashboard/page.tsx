import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AdminTabs } from "../admin-tabs"
import { AdminDashboardTabs } from "./admin-dashboard-tabs"
import { ExportData } from "./export-data"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle } from "lucide-react"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

// Force dynamic rendering and disable all caching
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"
export const runtime = "nodejs"

async function getAdminData() {
  try {
    // Import these functions only when needed to avoid build-time issues
    const { createClient } = await import("@/lib/supabase/server")
    const { getAllRoundsWithDetails, getAllReservationsWithDetails, getAllTeeTimes, getAllUsersForAdmin } =
      await import("@/app/actions/admin-management")

    const supabase = createClient()

    // Create admin client to bypass RLS policies
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Check if user is authenticated
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("Session error in admin dashboard:", sessionError)
      throw new Error("Authentication error. Please try signing in again.")
    }

    if (!session) {
      return { redirect: "/signin" }
    }

    // Check if user is an admin using the admin client to bypass RLS
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("*, is_admin")
      .eq("id", session.user.id)
      .single()

    if (userError) {
      console.error("User data error in admin dashboard:", userError)
      throw new Error("Error fetching user data. Please try again.")
    }

    // If not an admin, redirect to dashboard
    if (!userData?.is_admin) {
      return { redirect: "/dashboard" }
    }

    // Get data with error handling - fetch each one individually
    const roundsResult = await getAllRoundsWithDetails().catch((error) => {
      console.error("Error fetching rounds:", error)
      return { success: false, error: error.message, rounds: [] }
    })

    const reservationsResult = await getAllReservationsWithDetails().catch((error) => {
      console.error("Error fetching reservations:", error)
      return { success: false, error: error.message, reservations: [] }
    })

    const teeTimesResult = await getAllTeeTimes().catch((error) => {
      console.error("Error fetching tee times:", error)
      return { success: false, error: error.message, teeTimes: [] }
    })

    const usersResult = await getAllUsersForAdmin().catch((error) => {
      console.error("Error fetching users:", error)
      return { success: false, error: error.message, users: [] }
    })

    return {
      rounds: roundsResult.rounds || [],
      roundsError: roundsResult.success === false ? roundsResult.error : null,
      roundsSuccess: roundsResult.success !== false,
      reservations: reservationsResult.reservations || [],
      reservationsError: reservationsResult.success === false ? reservationsResult.error : null,
      teeTimes: teeTimesResult.teeTimes || [],
      teeTimesError: teeTimesResult.success === false ? teeTimesResult.error : null,
      users: usersResult.users || [],
      usersError: usersResult.success === false ? usersResult.error : null,
    }
  } catch (error: any) {
    console.error("Error in getAdminData:", error)
    throw error
  }
}

function LoadingSkeleton() {
  return (
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
  )
}

async function AdminContent() {
  const data = await getAdminData()

  if ("redirect" in data) {
    redirect(data.redirect)
  }

  const {
    rounds,
    roundsError,
    roundsSuccess,
    reservations,
    reservationsError,
    teeTimes,
    teeTimesError,
    users,
    usersError,
  } = data

  // Check if any rounds have errors
  const hasRoundErrors = rounds.some((round: any) => round.error)

  return (
    <>
      {/* Display errors if any */}
      {roundsError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading rounds</AlertTitle>
          <AlertDescription>{roundsError}</AlertDescription>
        </Alert>
      )}

      {reservationsError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading reservations</AlertTitle>
          <AlertDescription>{reservationsError}</AlertDescription>
        </Alert>
      )}

      {teeTimesError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading tee times</AlertTitle>
          <AlertDescription>{teeTimesError}</AlertDescription>
        </Alert>
      )}

      {usersError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading users</AlertTitle>
          <AlertDescription>{usersError}</AlertDescription>
        </Alert>
      )}

      {/* Warning for rounds with missing scores */}
      {roundsSuccess && hasRoundErrors && (
        <Alert variant="warning" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some scores could not be loaded</AlertTitle>
          <AlertDescription>
            Some rounds have missing scores due to rate limiting. You can still manage rounds and users.
          </AlertDescription>
        </Alert>
      )}

      <AdminTabs />

      <div className="mt-6 grid gap-6 md:grid-cols-4">
        <div className="md:col-span-3">
          <AdminDashboardTabs rounds={rounds} reservations={reservations} teeTimes={teeTimes} users={users} />
        </div>
        <div>
          <ExportData />
        </div>
      </div>
    </>
  )
}

export default async function AdminDashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
            <p className="text-muted-foreground">Manage rounds, scores, and reservations</p>
          </div>

          <Suspense fallback={<LoadingSkeleton />}>
            <AdminContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
