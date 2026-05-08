export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { UserProfile } from "./user-profile"

export default async function ProfilePage() {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/signin")
  }

  // Get user profile
  const { data: user, error } = await supabase.from("users").select("*").eq("id", session.user.id).single()

  if (error || !user) {
    console.error("Error fetching user profile:", error)
    redirect("/dashboard")
  }

  // Active season + ringer pool opt-in for this user
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("year")
    .eq("is_active", true)
    .maybeSingle()

  const seasonYear: number | null = activeSeason?.year ?? null
  let ringerOptIn: boolean | null = null
  if (seasonYear !== null) {
    const { data: optInRow } = await supabase
      .from("ringer_pool_opt_ins")
      .select("opted_in")
      .eq("user_id", session.user.id)
      .eq("season_year", seasonYear)
      .maybeSingle()
    ringerOptIn = optInRow ? optInRow.opted_in : null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
            <p className="text-muted-foreground">View and manage your profile information</p>
          </div>

          <UserProfile user={user} ringerSeasonYear={seasonYear} ringerOptIn={ringerOptIn} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
