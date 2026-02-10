import { createClient } from "@/lib/supabase/server"
import { TeeTimeManager } from "./tee-time-manager"
import { AdminTabs } from "@/app/admin/admin-tabs"

export default async function TeeTimesPage() {
  const supabase = await createClient()

  // Get active season
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .single()

  // Get template for active season (if exists)
  let template = null
  if (activeSeason) {
    const { data } = await supabase
      .from("tee_time_templates")
      .select("*")
      .eq("season_id", activeSeason.id)
      .maybeSingle()
    template = data
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Tee Time Management</h1>
        <p className="text-muted-foreground">
          Configure your weekly tee time template, generate the season schedule, and manage individual weeks.
        </p>
      </div>

      <AdminTabs />

      {activeSeason ? (
        <TeeTimeManager
          season={activeSeason}
          initialTemplate={template}
        />
      ) : (
        <div className="p-8 text-center border rounded-lg">
          <p className="text-lg font-medium">No active season</p>
          <p className="text-muted-foreground mt-2">
            Please go to the Seasons page and set an active season before managing tee times.
          </p>
        </div>
      )}
    </div>
  )
}
