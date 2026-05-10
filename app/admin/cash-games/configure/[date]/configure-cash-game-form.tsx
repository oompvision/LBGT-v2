"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Loader2, Trash2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { upsertCashGame, deleteCashGame } from "@/app/actions/cash-games"
import type { CashGame } from "@/types/supabase"

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "EEEE, MMMM d, yyyy")
  } catch {
    return dateStr
  }
}

export function ConfigureCashGameForm({
  date,
  initialCashGame,
}: {
  date: string
  initialCashGame: CashGame | null
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialCashGame?.title ?? "")
  const [description, setDescription] = useState(initialCashGame?.description ?? "")
  const [entryAmount, setEntryAmount] = useState<string>(
    initialCashGame ? String(initialCashGame.entry_amount) : ""
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Add a title for the cash game.",
        variant: "destructive",
      })
      return
    }
    const amount = Number(entryAmount)
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
      title: title.trim(),
      description,
      entry_amount: amount,
    })
    setSaving(false)

    if (res.success) {
      toast({ title: "Saved", description: `Cash game for ${formatDate(date)} updated.` })
      router.push("/admin/cash-games")
      router.refresh()
    } else {
      toast({
        title: "Error",
        description: res.error || "Failed to save.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!initialCashGame) return
    setDeleting(true)
    const res = await deleteCashGame(initialCashGame.id)
    setDeleting(false)
    if (res.success) {
      toast({ title: "Deleted", description: "Cash game removed." })
      router.push("/admin/cash-games")
      router.refresh()
    } else {
      toast({
        title: "Error",
        description: res.error || "Failed to delete.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formatDate(date)}</CardTitle>
        <CardDescription>
          {initialCashGame ? "Editing existing cash game." : "No cash game configured yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Skins Game"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Entry amount (USD, whole dollars)</Label>
          <Input
            id="amount"
            type="number"
            min={0}
            step={1}
            value={entryAmount}
            onChange={(e) => setEntryAmount(e.target.value)}
            placeholder="e.g. 20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="How the game works, payout structure, etc."
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialCashGame ? "Save changes" : "Create cash game"}
          </Button>
          {initialCashGame && (
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cash game?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the cash game for {formatDate(date)}. Existing per-player
              opt-ins on reservations are kept but will no longer be associated with a
              configured game.
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
    </Card>
  )
}
