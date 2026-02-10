"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Pencil, Trash2, Trophy } from "lucide-react"
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
import {
  getPlayoffResults,
  createPlayoffResult,
  updatePlayoffResult,
  deletePlayoffResult,
} from "@/app/actions/playoff-results"
import type { PlayoffResult } from "@/types/supabase"

export function PlayoffResultsManager() {
  const [results, setResults] = useState<PlayoffResult[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingResult, setEditingResult] = useState<PlayoffResult | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [resultToDelete, setResultToDelete] = useState<PlayoffResult | null>(null)

  // Form state
  const [formYear, setFormYear] = useState(new Date().getFullYear())
  const [formChampion, setFormChampion] = useState("")
  const [formRunnerUp, setFormRunnerUp] = useState("")

  const fetchResults = async () => {
    const result = await getPlayoffResults()
    if (result.success) {
      setResults(result.results)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchResults()
  }, [])

  const resetForm = () => {
    setFormYear(new Date().getFullYear())
    setFormChampion("")
    setFormRunnerUp("")
    setEditingResult(null)
    setIsCreating(false)
  }

  const startCreate = () => {
    setFormYear(new Date().getFullYear())
    setFormChampion("")
    setFormRunnerUp("")
    setEditingResult(null)
    setIsCreating(true)
  }

  const startEdit = (r: PlayoffResult) => {
    setFormYear(r.year)
    setFormChampion(r.champion_name)
    setFormRunnerUp(r.runner_up_name)
    setEditingResult(r)
    setIsCreating(true)
  }

  const handleSave = async () => {
    if (!formChampion.trim() || !formRunnerUp.trim()) {
      toast({ title: "Error", description: "Champion and runner-up names are required.", variant: "destructive" })
      return
    }
    if (formYear < 2020 || formYear > 2100) {
      toast({ title: "Error", description: "Please enter a valid year.", variant: "destructive" })
      return
    }

    // Check for duplicate year (only when creating or changing year)
    if (!editingResult || editingResult.year !== formYear) {
      const existing = results.find((r) => r.year === formYear)
      if (existing) {
        toast({ title: "Error", description: `A result for ${formYear} already exists.`, variant: "destructive" })
        return
      }
    }

    setSaving(true)
    try {
      if (editingResult) {
        const result = await updatePlayoffResult(editingResult.id, {
          year: formYear,
          champion_name: formChampion.trim(),
          runner_up_name: formRunnerUp.trim(),
        })
        if (result.success) {
          toast({ title: "Success", description: "Playoff result updated." })
        } else {
          toast({ title: "Error", description: result.error || "Failed to update.", variant: "destructive" })
        }
      } else {
        const result = await createPlayoffResult({
          year: formYear,
          champion_name: formChampion.trim(),
          runner_up_name: formRunnerUp.trim(),
        })
        if (result.success) {
          toast({ title: "Success", description: "Playoff result added." })
        } else {
          toast({ title: "Error", description: result.error || "Failed to create.", variant: "destructive" })
        }
      }
      resetForm()
      await fetchResults()
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!resultToDelete) return
    const result = await deletePlayoffResult(resultToDelete.id)
    if (result.success) {
      toast({ title: "Success", description: "Playoff result deleted." })
      await fetchResults()
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete.", variant: "destructive" })
    }
    setDeleteDialogOpen(false)
    setResultToDelete(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Playoff Results ({results.length})</h2>
        {!isCreating && (
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Year
          </Button>
        )}
      </div>

      {/* Results list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  {r.year}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => startEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setResultToDelete(r)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div>
                <span className="text-sm font-semibold text-green-600">Champion:</span>{" "}
                <span className="text-sm">{r.champion_name}</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-muted-foreground">Runner Up:</span>{" "}
                <span className="text-sm">{r.runner_up_name}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length === 0 && !isCreating && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No playoff results yet. Click "Add Year" to create one.
          </CardContent>
        </Card>
      )}

      {/* Create/Edit form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>{editingResult ? `Edit ${editingResult.year} Result` : "Add Playoff Result"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min={2020}
                  max={2100}
                  value={formYear}
                  onChange={(e) => setFormYear(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="champion">Champion</Label>
                <Input
                  id="champion"
                  value={formChampion}
                  onChange={(e) => setFormChampion(e.target.value)}
                  placeholder="Champion name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="runner-up">Runner Up</Label>
                <Input
                  id="runner-up"
                  value={formRunnerUp}
                  onChange={(e) => setFormRunnerUp(e.target.value)}
                  placeholder="Runner-up name"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingResult ? "Save Changes" : "Add Result"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete playoff result?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {resultToDelete?.year} playoff result.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
