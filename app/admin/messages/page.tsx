export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Footer } from "@/components/footer"
import { AdminTabs } from "../admin-tabs"
import { MessageManager } from "./message-manager"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function AdminMessagesPage() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("Session error in admin messages page:", sessionError)
      throw new Error("Authentication error. Please try signing in again.")
    }

    if (!session) {
      redirect("/signin")
    }

    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*, is_admin")
      .eq("id", session.user.id)
      .single()

    if (userError) {
      console.error("User data error in admin messages page:", userError)
      throw new Error("Error fetching user data. Please try again.")
    }

    // If not an admin, redirect to dashboard
    if (!userData?.is_admin) {
      redirect("/dashboard")
    }

    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Messages</h1>
              <p className="text-muted-foreground">Create and manage site-wide announcements</p>
            </div>

            <AdminTabs />

            <div className="mt-6">
              <MessageManager />
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
        <main className="flex-1 py-8">
          <div className="container">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">Admin Messages</h1>
              <p className="text-muted-foreground">Create and manage site-wide announcements</p>
            </div>

            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error loading admin messages</AlertTitle>
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
