import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { AdminTabs } from "../admin-tabs"
import { AdminDashboardTabs } from "./admin-dashboard-tabs"
import { ExportData } from "./export-data"

// Force dynamic rendering and disable all caching
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminDashboardPage() {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = createClient()

    // Check if user is authenticated
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      redirect("/signin")
    }

    // Create admin client to check admin status
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", session.user.id)
      .single()

    if (userError || !userData?.is_admin) {
      redirect("/dashboard")
    }

    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Management Dashboard</h1>
              <p className="text-muted-foreground">Manage rounds, scores, and reservations</p>
            </div>

            <AdminTabs />

            <div className="mt-6 grid gap-6 md:grid-cols-4">
              <div className="md:col-span-3">
                <AdminDashboardTabs />
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
    redirect("/signin")
  }
}
