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
  generatePlayoffBracketFromSeeds,
  type BracketWithMatches,
  type Flight,
} from "@/app/actions/playoff-brackets"
import type { PlayoffMatch } from "@/types/supabase"

interface Props {
  initialYears: number[]
  initialYear: number
}

type PlayerSlot = { id: string; name: string } | null

// Byes only ever occur in round 1 (a seed with no possible opponent); every
// later round eventually gets both players, even if one arrives immediately
// via a bye cascade at generation time.
function matchLine(m: PlayoffMatch): string {
  const isBye = m.round_number === 1 && !!m.player1_id && !m.player2_id
  if (isBye) return `${m.player1_name} — Bye (advances)`
  const p1 = m.player1_name || "TBD"
  const p2 = m.player2_name || "TBD"
  if (m.winner_player_num === 1) return `${p1} def. ${p2}${m.score ? ` ${m.score}` : ""}`
  if (m.winner_player_num === 2) return `${p2} def. ${p1}${m.score ? ` ${m.score}` : ""}`
  return `${p1} vs ${p2}`
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

  // Seed editor (row index + 1 = seed number; gaps from empty rows are
  // compacted away on generate)
  const [seedEditor, setSeedEditor] = useState<{ bracketId: string; rows: PlayerSlot[] } | null>(null)
  const [seedPickerIndex, setSeedPickerIndex] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)

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

  const openSeedEditor = (bracket: BracketWithMatches) => {
    const existing = bracket.seeds.map((s) => ({ id: s.player_id, name: s.player_name }))
    setSeedEditor({ bracketId: bracket.id, rows: existing.length > 0 ? existing : [null, null] })
  }

  const addSeedRow = () => {
    if (!seedEditor) return
    setSeedEditor({ ...seedEditor, rows: [...seedEditor.rows, null] })
  }

  const removeSeedRow = (idx: number) => {
    if (!seedEditor) return
    setSeedEditor({ ...seedEditor, rows: seedEditor.rows.filter((_, i) => i !== idx) })
  }

  const moveSeedRow = (idx: number, dir: -1 | 1) => {
    if (!seedEditor) return
    const target = idx + dir
    if (target < 0 || target >= seedEditor.rows.length) return
    const rows = [...seedEditor.rows]
    ;[rows[idx], rows[target]] = [rows[target], rows[idx]]
    setSeedEditor({ ...seedEditor, rows })
  }

  const handleSeedPickerConfirm = (users: LeagueUserSummary[]) => {
    if (!seedEditor || seedPickerIndex === null || users.length === 0) return
    const rows = [...seedEditor.rows]
    rows[seedPickerIndex] = { id: users[0].id, name: users[0].name }
    setSeedEditor({ ...seedEditor, rows })
    setSeedPickerIndex(null)
  }

  const handleGenerate = async () => {
    if (!seedEditor) return
    const filled = seedEditor.rows.filter((p): p is { id: string; name: string } => !!p)
    if (filled.length < 2) {
      toast({ title: "Error", description: "Enter at least 2 seeded players.", variant: "destructive" })
      return
    }
    setGenerating(true)
    try {
      const res = await generatePlayoffBracketFromSeeds(
        seedEditor.bracketId,
        filled.map((p, i) => ({ seedNumber: i + 1, playerId: p.id, playerName: p.name })),
      )
      if (res.success) {
        setSeedEditor(null)
        await loadBrackets(selectedYear)
        toast({ title: "Success", description: "Bracket generated." })
      } else {
        toast({ title: "Error", description: res.error || "Failed to generate bracket.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to generate bracket.", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const seedExcludeIds = (seedEditor?.rows.filter(Boolean) as { id: string; name: string }[] | undefined)?.map(
    (p) => p.id,
  ) || []

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
              {seedEditor?.bracketId === bracket.id ? (
                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Seed Players</h4>
                    <Button size="sm" variant="ghost" onClick={() => setSeedEditor(null)}>
                      Cancel
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {seedEditor.rows.map((row, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-right text-sm text-muted-foreground">{idx + 1}</span>
                        {row ? (
                          <div className="flex flex-1 items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-sm">{row.name}</span>
                            <button onClick={() => removeSeedRow(idx)}>
                              <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="flex-1 justify-start"
                            onClick={() => setSeedPickerIndex(idx)}
                          >
                            Select Player
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => moveSeedRow(idx, -1)}>
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={idx === seedEditor.rows.length - 1}
                          onClick={() => moveSeedRow(idx, 1)}
                        >
                          ↓
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeSeedRow(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <Button size="sm" variant="outline" onClick={addSeedRow}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Seed
                    </Button>
                    <Button
                      onClick={handleGenerate}
                      disabled={generating || bracket.matches.some((m) => m.winner_player_num)}
                      className="text-white"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : bracket.matches.length > 0 ? (
                        "Regenerate Bracket"
                      ) : (
                        "Generate Bracket"
                      )}
                    </Button>
                  </div>
                  {bracket.matches.some((m) => m.winner_player_num) && (
                    <p className="text-xs text-destructive">
                      Results have already been recorded for this bracket — delete those matches manually before
                      re-generating from seeds.
                    </p>
                  )}
                </div>
              ) : bracket.matches.length === 0 ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No bracket yet.</p>
                  <Button onClick={() => openSeedEditor(bracket)} className="text-white">
                    Seed Players
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => openSeedEditor(bracket)}>
                    Edit Seeds
                  </Button>
                </div>
              )}

              {bracket.matches.length > 0 &&
                groupByRound(bracket.matches).map(([roundNumber, matches]) => (
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
                            {m.player1_id && m.player2_id && (
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

              {bracket.matches.length > 0 && (
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
              )}
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

      <PlayerPicker
        open={seedPickerIndex !== null}
        onOpenChange={(open) => !open && setSeedPickerIndex(null)}
        excludeUserIds={seedExcludeIds}
        maxSelectable={1}
        onConfirm={handleSeedPickerConfirm}
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
