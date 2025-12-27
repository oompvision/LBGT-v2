"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createSeason, setActiveSeason, deleteSeason, type Season } from "@/app/actions/seasons"
import { CheckCircle2, Plus, Trash2 } from "lucide-react"
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
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateSeason = async () => {
    const year = Number.parseInt(newYear)
    if (!year || year < 2025 || year > 2100) {
      alert("Please enter a valid year (2025-2100)")
      return
    }

    setIsCreating(true)
    const result = await createSeason(year, `${year} Season`)
    setIsCreating(false)

    if (result.success && result.season) {
      setSeasons([result.season, ...seasons])
      setNewYear("")
    } else {
      alert(result.error || "Failed to create season")
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

  return (
    <div className="space-y-6">
      {/* Create New Season */}
      <div className="space-y-4 p-4 border rounded-lg">
        <h3 className="font-semibold">Create New Season</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
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
          <Button onClick={handleCreateSeason} disabled={isCreating || !newYear}>
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
                    <p className="text-sm text-muted-foreground">Year {season.year}</p>
                  </div>
                </div>
                <div className="flex gap-2">
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
