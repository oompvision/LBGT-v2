import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { AdminTabs } from "../admin-tabs"
import { AdminDashboardTabs } from "./admin-dashboard-tabs"
import { ExportData } from "./export-data"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle } from "lucide-react"

// Force dynamic rendering and disable all caching
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"
export const runtime = "nodejs"

export default async function AdminDashboardPage() {
  try {
    // Import these functions only when needed to avoid build-time issues
    const { createClient, createAdminClient } = await import("@/lib/supabase/server")
    const { getAllRoundsWithDetails, getAllReservationsWithDetails, getAllTeeTimes, getAllUsersForAdmin } =
      await import("@/app/actions/admin-management")

    const supabase = await createClient()

    // Create admin client to bypass RLS policies
    const supabaseAdmin = createAdminClient()

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
      redirect("/signin")
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
      redirect("/dashboard")
    }

    // Get data with error handling - fetch each one individually
    const roundsPromise = getAllRoundsWithDetails()
    const reservationsPromise = getAllReservationsWithDetails()
    const teeTimesPromise = getAllTeeTimes()
    const usersPromise = getAllUsersForAdmin()

    // Wait for all promises to settle
    const [roundsResult, reservationsResult, teeTimesResult, usersResult] = await Promise.all([
      roundsPromise.catch((error) => ({ success: false, error: error.message, rounds: [] })),
      reservationsPromise.catch((error) => ({ success: false, error: error.message, reservations: [] })),
      teeTimesPromise.catch((error) => ({ success: false, error: error.message, teeTimes: [] })),
      usersPromise.catch((error) => ({ success: false, error: error.message, users: [] })),
    ])

    const rounds = roundsResult.rounds || []
    const roundsError = roundsResult.success === false ? roundsResult.error : null
    const roundsSuccess = roundsResult.success !== false

    const reservations = reservationsResult.reservations || []
    const reservationsError = reservationsResult.success === false ? reservationsResult.error : null

    const teeTimes = teeTimesResult.teeTimes || []
    const teeTimesError = teeTimesResult.success === false ? teeTimesResult.error : null

    const users = usersResult.users || []
    const usersError = usersResult.success === false ? usersResult.error : null

    // Check if any rounds have errors
    const hasRoundErrors = rounds.some((round) => round.error)

    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
              <p className="text-muted-foreground">Manage rounds, scores, and reservations</p>

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
            </div>

            <AdminTabs />

            <div className="mt-6 grid gap-6 md:grid-cols-4">
              <div className="md:col-span-3">
                <AdminDashboardTabs rounds={rounds} reservations={reservations} teeTimes={teeTimes} users={users} />
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
  } catch (error) {
    // Fallback UI in case of errors
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
              <p className="text-muted-foreground">Manage rounds, scores, and reservations</p>
            </div>

            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error loading admin dashboard</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : "An unexpected error occurred. Please try again later."}
              </AlertDescription>
            </Alert>

            <AdminTabs />
          </div>
        </main>
        <Footer />
      </div>
    )
  }
}
