"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil, Trash2, Plus, History, CheckCircle2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format, parseISO } from "date-fns"
import {
  getUpcomingCashGameSummaries,
  upsertCashGame,
  deleteCashGame,
  type CashGameDateSummary,
} from "@/app/actions/cash-games"

const PAGE_SIZE = 4

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "EEEE, MMMM d, yyyy")
  } catch {
    return dateStr
  }
}

export function CashGamesManager() {
  const [items, setItems] = useState<CashGameDateSummary[]>([])
  const [totalDates, setTotalDates] = useState(0)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)

  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formEntryAmount, setFormEntryAmount] = useState<string>("")
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CashGameDateSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async (limit: number) => {
    setLoading(true)
    const res = await getUpcomingCashGameSummaries(limit)
    if (res.success) {
      setItems(res.items)
      setTotalDates(res.totalDates)
    } else {
      toast({ title: "Error", description: res.error || "Failed to load.", variant: "destructive" })
    }
    setLoading(false)
  }

  useEffect(() => {
    load(visibleCount)
  }, [visibleCount])

  const startEdit = (summary: CashGameDateSummary) => {
    setEditingDate(summary.date)
    if (summary.cashGame) {
      setFormTitle(summary.cashGame.title)
      setFormDescription(summary.cashGame.description)
      setFormEntryAmount(String(summary.cashGame.entry_amount))
    } else {
      setFormTitle("")
      setFormDescription("")
      setFormEntryAmount("")
    }
  }

  const cancelEdit = () => {
    setEditingDate(null)
    setFormTitle("")
    setFormDescription("")
    setFormEntryAmount("")
  }

  const handleSave = async (date: string) => {
    if (!formTitle.trim()) {
      toast({ title: "Title required", description: "Add a title for the cash game.", variant: "destructive" })
      return
    }
    const amount = Number(formEntryAmount)
    if (!Number.isInteger(amount) || amount < 0) {
      toast({
        title: "Invalid entry amount",
        description: "Enter a whole dollar amount (0 or more).",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    const res = await upsertCashGame({
      date,
      title: formTitle.trim(),
      description: formDescription,
      entry_amount: amount,
    })
    setSaving(false)

    if (res.success) {
      toast({ title: "Saved", description: `Cash game for ${formatDate(date)} updated.` })
      cancelEdit()
      await load(visibleCount)
    } else {
      toast({ title: "Error", description: res.error || "Failed to save.", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget?.cashGame) return
    setDeleting(true)
    const res = await deleteCashGame(deleteTarget.cashGame.id)
    setDeleting(false)
    if (res.success) {
      toast({ title: "Deleted", description: "Cash game removed." })
      setDeleteTarget(null)
      await load(visibleCount)
    } else {
      toast({ title: "Error", description: res.error || "Failed to delete.", variant: "destructive" })
    }
  }

  const canShowMore = items.length < totalDates

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {totalDates} upcoming round{totalDates === 1 ? "" : "s"}.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/cash-games/past">
            <History className="h-4 w-4 mr-2" />
            Past cash contests
          </Link>
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No upcoming tee times scheduled. Generate a schedule under Tee Times first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((summary) => {
            const isEditing = editingDate === summary.date
            const cg = summary.cashGame
            return (
              <Card key={summary.date}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{formatDate(summary.date)}</CardTitle>
                      <CardDescription>
                        {summary.reservationCount} reservation{summary.reservationCount === 1 ? "" : "s"} ·{" "}
                        {summary.optedInPlayers.length} opted in
                      </CardDescription>
                    </div>
                    {!isEditing && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(summary)}>
                          {cg ? (
                            <>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 mr-1" /> Configure
                            </>
                          )}
                        </Button>
                        {cg && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(summary)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`title-${summary.date}`}>Title</Label>
                        <Input
                          id={`title-${summary.date}`}
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="e.g. Skins Game"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`amount-${summary.date}`}>Entry amount (USD, whole dollars)</Label>
                        <Input
                          id={`amount-${summary.date}`}
                          type="number"
                          min={0}
                          step={1}
                          value={formEntryAmount}
                          onChange={(e) => setFormEntryAmount(e.target.value)}
                          placeholder="e.g. 20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`desc-${summary.date}`}>Description</Label>
                        <Textarea
                          id={`desc-${summary.date}`}
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          rows={4}
                          placeholder="How the game works, payout structure, etc."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSave(summary.date)} disabled={saving}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {cg ? "Save changes" : "Create cash game"}
                        </Button>
                        <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : cg ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-base font-semibold">{cg.title}</span>
                        <span className="text-sm text-muted-foreground">
                          ${cg.entry_amount} entry
                        </span>
                      </div>
                      {cg.description && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cg.description}</p>
                      )}
                      {summary.optedInPlayers.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium mb-2">Opted in</p>
                          <ul className="space-y-1">
                            {summary.optedInPlayers.map((p, idx) => (
                              <li key={`${summary.date}-${idx}`} className="text-sm flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                <span>{p.name}</span>
                                {!p.isBooker && (
                                  <span className="text-xs text-muted-foreground">
                                    (booked by {p.bookerName})
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No cash game configured for this date.</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {canShowMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            View {Math.min(PAGE_SIZE, totalDates - items.length)} more
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cash game?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the cash game for {deleteTarget && formatDate(deleteTarget.date)}. Existing per-player
              opt-ins on reservations are kept but will no longer be associated with a configured game.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
