import { AdminTabs } from "@/app/admin/admin-tabs"
import { getPlayoffBracketYears } from "@/app/actions/playoff-brackets"
import { PlayoffBracketsManager } from "./playoff-brackets-manager"

export const dynamic = "force-dynamic"

export default async function PlayoffBracketsPage() {
  const { years } = await getPlayoffBracketYears()
  const initialYear = years[0] || new Date().getFullYear()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Configure the A and B Flight playoff brackets</p>
      </div>
      <AdminTabs />
      <div className="mt-6">
        <PlayoffBracketsManager initialYears={years} initialYear={initialYear} />
      </div>
    </div>
  )
}
