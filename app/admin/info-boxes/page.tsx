import { AdminTabs } from "@/app/admin/admin-tabs"
import { InfoBoxManager } from "./info-box-manager"

export const dynamic = "force-dynamic"

export default function InfoBoxesPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Manage home page info boxes</p>
      </div>
      <AdminTabs />
      <div className="mt-6">
        <InfoBoxManager />
      </div>
    </div>
  )
}
