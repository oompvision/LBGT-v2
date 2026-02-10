"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createSeason, setActiveSeason, deleteSeason, updateSeasonDates, type Season } from "@/app/actions/seasons"
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface SeasonManagerProps {
  initialSeasons: Season[]
}

export function SeasonManager({ initialSeasons }: SeasonManagerProps) {
  const [seasons, setSeasons] = useState<Season[]>(initialSeasons)
  const [newYear, setNewYear] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleCreateSeason = async () => {
    const year = Number.parseInt(newYear)
    if (!year || year < 2025 || year > 2100) {
      alert("Please enter a valid year (2025-2100)")
      return
    }
    if (!newStartDate || !newEndDate) {
      alert("Please enter both a start date and end date")
      return
    }
    if (newStartDate >= newEndDate) {
      alert("Start date must be before end date")
      return
    }

    setIsCreating(true)
    const result = await createSeason(year, `${year} Season`, newStartDate, newEndDate)
    setIsCreating(false)

    if (result.success && result.season) {
      setSeasons([result.season, ...seasons])
      setNewYear("")
      setNewStartDate("")
      setNewEndDate("")
    } else {
      alert(result.error || "Failed to create season")
    }
  }

  const startEditing = (season: Season) => {
    setEditingId(season.id)
    setEditStartDate(season.start_date)
    setEditEndDate(season.end_date)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditStartDate("")
    setEditEndDate("")
  }

  const handleSaveDates = async (seasonId: string) => {
    if (!editStartDate || !editEndDate) {
      alert("Please enter both a start date and end date")
      return
    }
    if (editStartDate >= editEndDate) {
      alert("Start date must be before end date")
      return
    }

    setIsSaving(true)
    const result = await updateSeasonDates(seasonId, editStartDate, editEndDate)
    setIsSaving(false)

    if (result.success && result.season) {
      setSeasons(seasons.map((s) => (s.id === seasonId ? { ...s, start_date: result.season.start_date, end_date: result.season.end_date } : s)))
      setEditingId(null)
    } else {
      alert(result.error || "Failed to update season dates")
    }
  }

  const handleSetActive = async (seasonId: string) => {
    const result = await setActiveSeason(seasonId)
    if (result.success) {
      setSeasons(
        seasons.map((s) => ({
          ...s,
          is_active: s.id === seasonId,
        })),
      )
    } else {
      alert(result.error || "Failed to set active season")
    }
  }

  const handleDelete = async (seasonId: string) => {
    const result = await deleteSeason(seasonId)
    if (result.success) {
      setSeasons(seasons.filter((s) => s.id !== seasonId))
    } else {
      alert(result.error || "Failed to delete season")
    }
  }

  const activeSeason = seasons.find((s) => s.is_active)

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "—"
    const date = new Date(dateStr + "T00:00:00")
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="space-y-6">
      {/* Create New Season */}
      <div className="space-y-4 p-4 border rounded-lg">
        <h3 className="font-semibold">Create New Season</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <Label htmlFor="year">Season Year</Label>
            <Input
              id="year"
              type="number"
              placeholder="2026"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              min="2025"
              max="2100"
            />
          </div>
          <div>
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
            />
          </div>
          <Button onClick={handleCreateSeason} disabled={isCreating || !newYear || !newStartDate || !newEndDate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Season
          </Button>
        </div>
      </div>

      {/* Active Season Info */}
      {activeSeason && (
        <div className="p-4 bg-primary/10 border border-primary rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">Active Season: {activeSeason.name}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDisplayDate(activeSeason.start_date)} — {formatDisplayDate(activeSeason.end_date)}.
            All new bookings and scorecards will be recorded for the {activeSeason.year} season.
          </p>
        </div>
      )}

      {/* Seasons List */}
      <div className="space-y-3">
        <h3 className="font-semibold">All Seasons</h3>
        {seasons.length === 0 ? (
          <p className="text-muted-foreground">No seasons created yet.</p>
        ) : (
          <div className="space-y-2">
            {seasons.map((season) => (
              <div
                key={season.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{season.name}</span>
                      {season.is_active && <Badge variant="default">Active</Badge>}
                    </div>
                    {editingId === season.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                          type="date"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className="w-40 h-8 text-sm"
                        />
                        <Button size="sm" onClick={() => handleSaveDates(season.id)} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {formatDisplayDate(season.start_date)} — {formatDisplayDate(season.end_date)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingId !== season.id && (
                    <Button variant="ghost" size="sm" onClick={() => startEditing(season)} title="Edit dates">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {!season.is_active && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Set Active
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Activate {season.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will make {season.year} the active season. All new bookings and scorecards will be
                            recorded for this season. The current active season will become read-only for users.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleSetActive(season.id)}>
                            Activate Season
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {!season.is_active && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {season.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. You can only delete seasons that have no recorded data (no
                            rounds, tee times, or reservations).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(season.id)}>Delete Season</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
