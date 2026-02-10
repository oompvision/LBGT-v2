export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAllUsers } from "@/app/actions/scores"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ScoreSubmissionForm } from "./score-submission-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default async function SubmitScorePage() {
  const supabase = await createClient()

  try {
    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      redirect("/signin")
    }

    // Get all users for the player selection dropdown
    const { users, error } = await getAllUsers()

    if (error) {
      return (
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 py-8">
            <div className="container">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Failed to load users: {error}</AlertDescription>
              </Alert>
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
              <h1 className="text-3xl font-bold tracking-tight">Submit Scores</h1>
              <p className="text-muted-foreground">Enter scores for yourself and up to three other players</p>
            </div>

            <ScoreSubmissionForm users={users || []} currentUserId={session.user.id} />
          </div>
        </main>
        <Footer />
      </div>
    )
  } catch (error: any) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>An unexpected error occurred: {error.message}</AlertDescription>
            </Alert>
          </div>
        </main>
        <Footer />
      </div>
    )
  }
}
