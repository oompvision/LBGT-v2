"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Trash2, X, Pencil } from "lucide-react"
import { PlayerPicker } from "@/components/player-picker"
import type { LeagueUserSummary } from "@/app/actions/reservation-players"
import {
  getPlayoffBracketsForYear,
  createPlayoffYear,
  togglePlayoffBracketPublished,
  addPlayoffMatch,
  deletePlayoffMatch,
  setPlayoffMatchResult,
  type BracketWithMatches,
  type Flight,
} from "@/app/actions/playoff-brackets"
import type { PlayoffMatch } from "@/types/supabase"

interface Props {
  initialYears: number[]
  initialYear: number
}

type PlayerSlot = { id: string; name: string } | null

function matchLine(m: PlayoffMatch): string {
  if (!m.player2_id) return `${m.player1_name} — Bye (advances)`
  if (m.winner_player_num === 1) return `${m.player1_name} def. ${m.player2_name}${m.score ? ` ${m.score}` : ""}`
  if (m.winner_player_num === 2) return `${m.player2_name} def. ${m.player1_name}${m.score ? ` ${m.score}` : ""}`
  return `${m.player1_name} vs ${m.player2_name}`
}

function groupByRound(matches: PlayoffMatch[]) {
  const rounds = new Map<number, PlayoffMatch[]>()
  for (const m of matches) {
    const list = rounds.get(m.round_number) || []
    list.push(m)
    rounds.set(m.round_number, list)
  }
  return Array.from(rounds.entries()).sort((a, b) => a[0] - b[0])
}

export function PlayoffBracketsManager({ initialYears, initialYear }: Props) {
  const [years, setYears] = useState<number[]>(initialYears)
  const [selectedYear, setSelectedYear] = useState<number>(initialYear)
  const [brackets, setBrackets] = useState<BracketWithMatches[]>([])
  const [loading, setLoading] = useState(true)
  const [newYearInput, setNewYearInput] = useState(String(new Date().getFullYear()))
  const [addingYear, setAddingYear] = useState(false)

  // Add-match dialog
  const [matchDialog, setMatchDialog] = useState<{
    open: boolean
    bracketId: string
    flight: Flight
    roundNumber: number
    roundLabel: string
    isNewRound: boolean
    player1: PlayerSlot
    player2: PlayerSlot
  } | null>(null)
  const [pickerTarget, setPickerTarget] = useState<"player1" | "player2" | null>(null)
  const [savingMatch, setSavingMatch] = useState(false)

  // Record-result dialog
  const [resultDialog, setResultDialog] = useState<{ match: PlayoffMatch; winner: 1 | 2 | null; score: string } | null>(
    null,
  )
  const [savingResult, setSavingResult] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<PlayoffMatch | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadBrackets = async (year: number) => {
    setLoading(true)
    try {
      const res = await getPlayoffBracketsForYear(year)
      if (res.success) {
        setBrackets(res.brackets)
      } else {
        toast({ title: "Error", description: res.error || "Failed to load brackets.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to load brackets.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBrackets(selectedYear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear])

  const handleAddYear = async () => {
    const year = parseInt(newYearInput, 10)
    if (!year || year < 2026) {
      toast({ title: "Error", description: "Please enter a valid year (2026 or later).", variant: "destructive" })
      return
    }
    setAddingYear(true)
    try {
      const res = await createPlayoffYear(year)
      if (res.success) {
        const nextYears = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a)
        setYears(nextYears)
        setSelectedYear(year)
        toast({ title: "Success", description: `${year} playoff brackets created.` })
      } else {
        toast({ title: "Error", description: res.error || "Failed to create year.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to create year.", variant: "destructive" })
    } finally {
      setAddingYear(false)
    }
  }

  const handleTogglePublish = async (bracket: BracketWithMatches) => {
    try {
      const res = await togglePlayoffBracketPublished(bracket.id, !bracket.is_published)
      if (res.success) {
        setBrackets((prev) => prev.map((b) => (b.id === bracket.id ? { ...b, is_published: !b.is_published } : b)))
        toast({
          title: "Success",
          description: `${bracket.flight} Flight ${!bracket.is_published ? "published" : "unpublished"}.`,
        })
      } else {
        toast({ title: "Error", description: res.error || "Failed to update.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update.", variant: "destructive" })
    }
  }

  const openAddMatch = (bracket: BracketWithMatches, roundNumber: number, roundLabel: string, isNewRound: boolean) => {
    setMatchDialog({
      open: true,
      bracketId: bracket.id,
      flight: bracket.flight as Flight,
      roundNumber,
      roundLabel,
      isNewRound,
      player1: null,
      player2: null,
    })
  }

  const previousRoundWinners = (bracket: BracketWithMatches, roundNumber: number): PlayerSlot[] => {
    const prevRound = bracket.matches.filter((m) => m.round_number === roundNumber - 1)
    const usedInThisRound = new Set(
      bracket.matches
        .filter((m) => m.round_number === roundNumber)
        .flatMap((m) => [m.player1_id, m.player2_id].filter(Boolean) as string[]),
    )
    const winners: PlayerSlot[] = []
    for (const m of prevRound) {
      let winnerId: string | null = null
      let winnerName: string | null = null
      if (!m.player2_id) {
        winnerId = m.player1_id
        winnerName = m.player1_name
      } else if (m.winner_player_num === 1) {
        winnerId = m.player1_id
        winnerName = m.player1_name
      } else if (m.winner_player_num === 2) {
        winnerId = m.player2_id
        winnerName = m.player2_name
      }
      if (winnerId && winnerName && !usedInThisRound.has(winnerId)) {
        winners.push({ id: winnerId, name: winnerName })
      }
    }
    return winners
  }

  const handleSaveMatch = async () => {
    if (!matchDialog || !matchDialog.player1) return
    setSavingMatch(true)
    try {
      const bracket = brackets.find((b) => b.id === matchDialog.bracketId)
      const sortOrder = bracket ? bracket.matches.filter((m) => m.round_number === matchDialog.roundNumber).length : 0
      const res = await addPlayoffMatch({
        bracketId: matchDialog.bracketId,
        roundNumber: matchDialog.roundNumber,
        roundLabel: matchDialog.roundLabel.trim() || `Round ${matchDialog.roundNumber}`,
        sortOrder,
        player1Id: matchDialog.player1.id,
        player1Name: matchDialog.player1.name,
        player2Id: matchDialog.player2?.id || null,
        player2Name: matchDialog.player2?.name || null,
      })
      if (res.success) {
        setMatchDialog(null)
        await loadBrackets(selectedYear)
        toast({ title: "Success", description: "Match added." })
      } else {
        toast({ title: "Error", description: res.error || "Failed to add match.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to add match.", variant: "destructive" })
    } finally {
      setSavingMatch(false)
    }
  }

  const openResultDialog = (match: PlayoffMatch) => {
    setResultDialog({ match, winner: (match.winner_player_num as 1 | 2 | null) || null, score: match.score || "" })
  }

  const handleSaveResult = async () => {
    if (!resultDialog || !resultDialog.winner) return
    setSavingResult(true)
    try {
      const res = await setPlayoffMatchResult(resultDialog.match.id, resultDialog.winner, resultDialog.score.trim() || null)
      if (res.success) {
        setResultDialog(null)
        await loadBrackets(selectedYear)
        toast({ title: "Success", description: "Result saved." })
      } else {
        toast({ title: "Error", description: res.error || "Failed to save result.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to save result.", variant: "destructive" })
    } finally {
      setSavingResult(false)
    }
  }

  const handleClearResult = async () => {
    if (!resultDialog) return
    setSavingResult(true)
    try {
      const res = await setPlayoffMatchResult(resultDialog.match.id, null, null)
      if (res.success) {
        setResultDialog(null)
        await loadBrackets(selectedYear)
        toast({ title: "Success", description: "Result cleared." })
      } else {
        toast({ title: "Error", description: res.error || "Failed to clear result.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to clear result.", variant: "destructive" })
    } finally {
      setSavingResult(false)
    }
  }

  const handleDeleteMatch = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await deletePlayoffMatch(deleteTarget.id)
      if (res.success) {
        setDeleteTarget(null)
        await loadBrackets(selectedYear)
        toast({ title: "Success", description: "Match deleted." })
      } else {
        toast({ title: "Error", description: res.error || "Failed to delete match.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete match.", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const handlePickerConfirm = (users: LeagueUserSummary[]) => {
    if (!matchDialog || !pickerTarget || users.length === 0) return
    const picked = { id: users[0].id, name: users[0].name }
    setMatchDialog({ ...matchDialog, [pickerTarget]: picked })
    setPickerTarget(null)
  }

  const excludeIds = [matchDialog?.player1?.id, matchDialog?.player2?.id].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Year</CardTitle>
          <CardDescription>Choose a playoff year to configure, or add a new one.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Year</Label>
            <Select
              value={years.length ? String(selectedYear) : undefined}
              onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
              disabled={years.length === 0}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="No years yet" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Add Year</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                className="w-28"
              />
              <Button onClick={handleAddYear} disabled={addingYear}>
                {addingYear ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : brackets.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {years.length === 0 ? "Add a year above to get started." : "No brackets found for this year."}
        </p>
      ) : (
        brackets.map((bracket) => (
          <Card key={bracket.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{bracket.flight} Flight</CardTitle>
                <CardDescription>
                  {bracket.matches.length === 0 ? "No matches yet" : `${bracket.matches.length} match(es)`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={bracket.is_published ? "default" : "secondary"}>
                  {bracket.is_published ? "Published" : "Draft"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => handleTogglePublish(bracket)}>
                  {bracket.is_published ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {groupByRound(bracket.matches).map(([roundNumber, matches]) => (
                <div key={roundNumber} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{matches[0].round_label}</h4>
                    <Button size="sm" variant="ghost" onClick={() => openAddMatch(bracket, roundNumber, matches[0].round_label, false)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Match
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {matches.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <span>{matchLine(m)}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {m.player2_id && (
                            <Button size="sm" variant="ghost" onClick={() => openResultDialog(m)}>
                              {m.winner_player_num ? <Pencil className="h-3.5 w-3.5" /> : "Record Result"}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const maxRound = bracket.matches.reduce((max, m) => Math.max(max, m.round_number), 0)
                  const nextRound = maxRound + 1
                  openAddMatch(bracket, nextRound, `Round ${nextRound}`, true)
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Start New Round
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      {/* Add Match Dialog */}
      <Dialog open={!!matchDialog} onOpenChange={(open) => !open && setMatchDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Match</DialogTitle>
          </DialogHeader>
          {matchDialog && (
            <div className="space-y-4">
              {matchDialog.isNewRound && (
                <div className="space-y-2">
                  <Label>Round Name</Label>
                  <Input
                    value={matchDialog.roundLabel}
                    onChange={(e) => setMatchDialog({ ...matchDialog, roundLabel: e.target.value })}
                    placeholder="e.g. Semifinal"
                  />
                </div>
              )}

              {matchDialog.roundNumber > 1 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Winners advancing from the previous round
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {previousRoundWinners(
                      brackets.find((b) => b.id === matchDialog.bracketId)!,
                      matchDialog.roundNumber,
                    ).map((w) => (
                      <Button
                        key={w!.id}
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (!matchDialog.player1) setMatchDialog({ ...matchDialog, player1: w })
                          else if (!matchDialog.player2) setMatchDialog({ ...matchDialog, player2: w })
                        }}
                      >
                        {w!.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Player 1</Label>
                {matchDialog.player1 ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm">{matchDialog.player1.name}</span>
                    <button onClick={() => setMatchDialog({ ...matchDialog, player1: null })}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setPickerTarget("player1")}>
                    Select Player
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Player 2 (leave empty for a bye)</Label>
                {matchDialog.player2 ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm">{matchDialog.player2.name}</span>
                    <button onClick={() => setMatchDialog({ ...matchDialog, player2: null })}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setPickerTarget("player2")}>
                    Select Player
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMatchDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMatch} disabled={!matchDialog?.player1 || savingMatch} className="text-white">
              {savingMatch ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlayerPicker
        open={!!pickerTarget}
        onOpenChange={(open) => !open && setPickerTarget(null)}
        excludeUserIds={excludeIds}
        maxSelectable={1}
        onConfirm={handlePickerConfirm}
      />

      {/* Record Result Dialog */}
      <Dialog open={!!resultDialog} onOpenChange={(open) => !open && setResultDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Result</DialogTitle>
          </DialogHeader>
          {resultDialog && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Winner</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={resultDialog.winner === 1 ? "default" : "outline"}
                    className={resultDialog.winner === 1 ? "text-white flex-1" : "flex-1"}
                    onClick={() => setResultDialog({ ...resultDialog, winner: 1 })}
                  >
                    {resultDialog.match.player1_name}
                  </Button>
                  <Button
                    type="button"
                    variant={resultDialog.winner === 2 ? "default" : "outline"}
                    className={resultDialog.winner === 2 ? "text-white flex-1" : "flex-1"}
                    onClick={() => setResultDialog({ ...resultDialog, winner: 2 })}
                  >
                    {resultDialog.match.player2_name}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Score</Label>
                <Input
                  value={resultDialog.score}
                  onChange={(e) => setResultDialog({ ...resultDialog, score: e.target.value })}
                  placeholder="e.g. 4&3, 1 up, 20th hole"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {resultDialog?.match.winner_player_num ? (
              <Button variant="ghost" onClick={handleClearResult} disabled={savingResult}>
                Clear Result
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setResultDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveResult} disabled={!resultDialog?.winner || savingResult} className="text-white">
                {savingResult ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this match?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && matchLine(deleteTarget)} — this can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMatch} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
