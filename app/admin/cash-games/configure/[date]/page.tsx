import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { AdminTabs } from "@/app/admin/admin-tabs"
import { Button } from "@/components/ui/button"
import { getCashGameForDate } from "@/app/actions/cash-games"
import { ConfigureCashGameForm } from "./configure-cash-game-form"

export const dynamic = "force-dynamic"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function ConfigureCashGamePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  if (!ISO_DATE.test(date)) notFound()

  const res = await getCashGameForDate(date)
  const cashGame = res.success ? res.cashGame : null

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configure Cash Game</h1>
        <p className="text-muted-foreground">
          Set the title, entry amount, and description shown on the booking page.
        </p>
      </div>
      <AdminTabs />
      <div className="mt-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/cash-games">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Cash Mgmt
          </Link>
        </Button>
      </div>
      <ConfigureCashGameForm date={date} initialCashGame={cashGame} />
    </div>
  )
}
