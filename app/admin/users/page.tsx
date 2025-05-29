export const dynamic = "force-dynamic"
export const revalidate = 0

import { redirect } from "next/navigation"
import { Footer } from "@/components/footer"
import { AdminTabs } from "@/app/admin/admin-tabs"
import { UserManagement } from "./user-management"

async function getAdminUsersData() {
  try {
    // Dynamic import to avoid build-time issues
    const { createClient } = await import("@/lib/supabase/server")
    const { getAllUsersWithDetails } = await import("@/app/actions/admin-management")

    const supabase = createClient()

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      redirect("/signin")
    }

    // Check if user is an admin
    const { data: userData } = await supabase.from("users").select("*, is_admin").eq("id", session.user.id).single()

    // If not an admin, redirect to dashboard
    if (!userData?.is_admin) {
      redirect("/dashboard")
    }

    // Get all users with details
    const { users } = await getAllUsersWithDetails()

    return { users: users || [] }
  } catch (error) {
    console.error("Error in getAdminUsersData:", error)
    return { users: [] }
  }
}

export default async function AdminUsersPage() {
  const { users } = await getAdminUsersData()

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
            <p className="text-muted-foreground">Manage your golf league</p>
          </div>

          <AdminTabs />

          <div className="mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
              <p className="text-muted-foreground">Manage user profiles and handicaps</p>
            </div>

            <UserManagement users={users} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
