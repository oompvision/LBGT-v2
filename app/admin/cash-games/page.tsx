import { AdminTabs } from "@/app/admin/admin-tabs"
import { CashGamesManager } from "./cash-games-manager"

export const dynamic = "force-dynamic"

export default function CashGamesPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cash Mgmt</h1>
        <p className="text-muted-foreground">
          Track green-fee and cash-game payments by tee time. Configure the cash game
          itself from each tee time&apos;s “Configure cash game” button.
        </p>
      </div>
      <AdminTabs />
      <div className="mt-6">
        <CashGamesManager />
      </div>
    </div>
  )
}
