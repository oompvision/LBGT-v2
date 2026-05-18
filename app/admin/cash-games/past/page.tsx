import { AdminTabs } from "@/app/admin/admin-tabs"
import { CashGamesManager } from "../cash-games-manager"

export const dynamic = "force-dynamic"

export default function PastCashGamesPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cash Mgmt — Past</h1>
        <p className="text-muted-foreground">
          Past rounds from the current season. Edit green-fee and cash-game
          payments just like upcoming rounds.
        </p>
      </div>
      <AdminTabs />
      <div className="mt-6">
        <CashGamesManager scope="past" />
      </div>
    </div>
  )
}
