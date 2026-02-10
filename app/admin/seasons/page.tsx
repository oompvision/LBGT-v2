import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSeasons } from "@/app/actions/seasons"
import { SeasonManager } from "./season-manager"
import { AdminTabs } from "@/app/admin/admin-tabs"

export default async function SeasonsPage() {
  const { seasons } = await getSeasons()

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Manage golf league seasons</p>
      </div>

      <AdminTabs />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Season Management</CardTitle>
          <CardDescription>
            Manage golf league seasons. Create new seasons and switch between them. Only one season can be active at a
            time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeasonManager initialSeasons={seasons} />
        </CardContent>
      </Card>
    </div>
  )
}
