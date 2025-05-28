import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AdminTabs } from "../admin-tabs"
import { AdminDashboardTabs } from "./admin-dashboard-tabs"
import { ExportData } from "./export-data"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Force dynamic rendering
export const dynamic = "force-dynamic"
export const revalidate = 0

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

    // Get data with error handling
    const [roundsResult, reservationsResult, teeTimesResult, usersResult] = await Promise.allSettled([
      getAllRoundsWithDetails(),
      getAllReservationsWithDetails(),
      getAllTeeTimes(),
      getAllUsersForAdmin(),
    ])

    // Extract data and errors
    const rounds = roundsResult.status === "fulfilled" ? roundsResult.value.rounds || [] : []
    const roundsError = roundsResult.status === "rejected" ? roundsResult.reason : null
    const roundsSuccess = roundsResult.status === "fulfilled" ? roundsResult.value.success : false

    const reservations = reservationsResult.status === "fulfilled" ? reservationsResult.value.reservations || [] : []
    const reservationsError = reservationsResult.status === "rejected" ? reservationsResult.reason : null

    const teeTimes = teeTimesResult.status === "fulfilled" ? teeTimesResult.value.teeTimes || [] : []
    const teeTimesError = teeTimesResult.status === "rejected" ? teeTimesResult.reason : null

    const users = usersResult.status === "fulfilled" ? usersResult.value.users || [] : []
    const usersError = usersResult.status === "rejected" ? usersResult.reason : null

    return {
      rounds,
      roundsError,
      roundsSuccess,
      reservations,
      reservationsError,
      teeTimes,
      teeTimesError,
      users,
      usersError,
    }
  } catch (error: any) {
    console.error("Error in getAdminData:", error)
    throw error
  }
}

export default async function AdminDashboardPage() {
  try {
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
      <div className="flex min-h-screen flex-col">
        <Header />
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
                  <AlertDescription>
                    {typeof roundsError === "string"
                      ? roundsError
                      : roundsError instanceof Error
                        ? roundsError.message
                        : "Failed to load rounds data"}
                  </AlertDescription>
                </Alert>
              )}

              {reservationsError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error loading reservations</AlertTitle>
                  <AlertDescription>
                    {typeof reservationsError === "string"
                      ? reservationsError
                      : reservationsError instanceof Error
                        ? reservationsError.message
                        : "Failed to load reservations data"}
                  </AlertDescription>
                </Alert>
              )}

              {teeTimesError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error loading tee times</AlertTitle>
                  <AlertDescription>
                    {typeof teeTimesError === "string"
                      ? teeTimesError
                      : teeTimesError instanceof Error
                        ? teeTimesError.message
                        : "Failed to load tee times data"}
                  </AlertDescription>
                </Alert>
              )}

              {usersError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error loading users</AlertTitle>
                  <AlertDescription>
                    {typeof usersError === "string"
                      ? usersError
                      : usersError instanceof Error
                        ? usersError.message
                        : "Failed to load users data"}
                  </AlertDescription>
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
  } catch (error: any) {
    // Fallback UI in case of errors
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
              <AlertDescription>
                {error.message || "An unexpected error occurred. Please try again later."}
              </AlertDescription>
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
}
