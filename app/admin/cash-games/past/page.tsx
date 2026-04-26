import Link from "next/link"
import { AdminTabs } from "@/app/admin/admin-tabs"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { PastCashGames } from "./past-cash-games"

export const dynamic = "force-dynamic"

export default function PastCashGamesPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Past Cash Contests</h1>
        <p className="text-muted-foreground">All previously configured cash games, most recent first.</p>
      </div>
      <AdminTabs />
      <div className="mt-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/cash-games">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to upcoming
          </Link>
        </Button>
      </div>
      <PastCashGames />
    </div>
  )
}
