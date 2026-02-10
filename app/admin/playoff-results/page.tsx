import { AdminTabs } from "@/app/admin/admin-tabs"
import { PlayoffResultsManager } from "./playoff-results-manager"

export const dynamic = "force-dynamic"

export default function PlayoffResultsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Manage LBGT Playoff results</p>
      </div>
      <AdminTabs />
      <div className="mt-6">
        <PlayoffResultsManager />
      </div>
    </div>
  )
}
