import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatTime } from "@/lib/utils"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ReservationForm } from "../reservation-form"
import { checkTeeTimeAvailability } from "@/app/actions/tee-times"

// Add this export to prevent static rendering
export const dynamic = "force-dynamic"

export default async function ReservationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to sign in if not authenticated
    redirect("/signin?redirect=/reservations/" + params.id)
  }

  // Check if the tee time exists and is available
  const availabilityCheck = await checkTeeTimeAvailability(params.id)

  if (!availabilityCheck.success || !availabilityCheck.isAvailable) {
    console.error("Tee time not available:", availabilityCheck)
    return notFound()
  }

  const teeTime = availabilityCheck.teeTime

  // Get the user's name
  const { data: userData, error: userError } = await supabase.from("users").select("name").eq("id", user.id).single()

  if (userError) {
    console.error("Error fetching user data:", userError)
    return notFound()
  }

  // Check if the tee time is within the allowed time range (3:00 PM to 4:00 PM)
  if (teeTime.time < "15:00:00" || teeTime.time > "16:00:00") {
    console.error(`Tee time ${teeTime.id} is outside the allowed time range`)
    return notFound()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Reserve Tee Time</h1>
            <p className="text-muted-foreground">
              Book your spot for {formatDate(new Date(teeTime.date))} at {formatTime(teeTime.time)}
            </p>
          </div>

          <ReservationForm
            teeTimeId={params.id}
            teeTimeDate={teeTime.date}
            teeTimeTime={teeTime.time}
            maxSlots={availabilityCheck.availableSlots}
            userId={user.id}
            userName={userData.name}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
