import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSeasons } from "@/app/actions/seasons"
import { SeasonManager } from "./season-manager"

export default async function SeasonsPage() {
  const { seasons } = await getSeasons()

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
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
