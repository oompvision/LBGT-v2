"use client"

import React, { useRef } from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { submitScores } from "@/app/actions/scores"
import { uploadAndParseScorecard } from "@/app/actions/ocr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CalendarIcon, Camera, Loader2, X } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { COURSE_DATA } from "@/lib/constants"

interface ScoreSubmissionFormProps {
  users: { id: string; name: string }[]
  currentUserId: string
}

/** Turn "Anthony Piazza" into "A. Pia." */
function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 5)
  const first = parts[0][0].toUpperCase() + "."
  const last = parts[parts.length - 1].slice(0, 3) + "."
  return `${first} ${last}`
}

// Downscale the photo just enough to fit under the server-action body limit.
// All real preprocessing (grayscale, denoise, adaptive threshold) happens
// server-side in lib/ocr/preprocess.ts where sharp gives us proper image-
// processing primitives. The browser's only job here is to avoid sending
// 20 MB phone photos we'd have to reject.
async function downscaleForUpload(file: File, maxEdge = 3000, quality = 0.92): Promise<File> {
  const blobUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Could not decode image"))
      el.src = blobUrl
    })

    const longest = Math.max(img.width, img.height)
    // If it's already a reasonable size AND file size, skip re-encoding —
    // server-side preprocessing prefers to work on the original bytes.
    if (longest <= maxEdge && file.size <= 8 * 1024 * 1024) return file

    const scale = Math.min(1, maxEdge / longest)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        quality,
      ),
    )
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    })
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

export function ScoreSubmissionForm({ users, currentUserId }: ScoreSubmissionFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [date, setDate] = useState<Date>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOcring, setIsOcring] = useState(false)
  const [usersWithHandicap, setUsersWithHandicap] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [ocrDebug, setOcrDebug] = useState<unknown>(null)
  const [preprocessSteps, setPreprocessSteps] = useState<string[]>([])
  const [scorecardImagePath, setScorecardImagePath] = useState<string | null>(null)
  const [scorecardImageUrl, setScorecardImageUrl] = useState<string | null>(null)
  // Whether the scorecard photo is expanded in a full-viewport overlay.
  // We deliberately AVOID opening the image in a new tab — on mobile that
  // wipes the current page history entry, and back-navigating loses all
  // form input. An in-page overlay preserves state.
  const [isImageZoomed, setIsImageZoomed] = useState(false)
  const supabase = createClient()
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // Pending auto-advance timer. Cleared on each keystroke so typing "1"
  // then "0" merges into "10" instead of auto-advancing after "1".
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize player data. `ocrName` is set when scores came from OCR and is
  // shown as a hint so the user remembers which column was whose.
  // `uncertainHoles` is the set of 0-indexed holes the OCR model flagged as
  // low-confidence — those cells stay blank and get a yellow border so the
  // user fills them in manually rather than accepting a shaky guess.
  const [players, setPlayers] = useState<
    {
      userId: string
      scores: string[]
      netScores: string[]
      ocrName?: string
      uncertainHoles?: Set<number>
      // Handwritten Out/In/Total from OCR — shown alongside the computed
      // sum to flag per-hole extraction errors (e.g. if the handwritten Out
      // is 50 but the sum of the nine scores is 49, the user knows to
      // double-check the front 9).
      handwrittenOutTotal?: number | null
      handwrittenInTotal?: number | null
      handwrittenTotal?: number | null
    }[]
  >([
    { userId: currentUserId, scores: Array(18).fill(""), netScores: Array(18).fill("") },
    { userId: "", scores: Array(18).fill(""), netScores: Array(18).fill("") },
    { userId: "", scores: Array(18).fill(""), netScores: Array(18).fill("") },
    { userId: "", scores: Array(18).fill(""), netScores: Array(18).fill("") },
  ])

  const activePlayers = players

  // Fetch user handicaps
  useEffect(() => {
    const fetchUserHandicaps = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, strokes_given")
          .in("id", users.map((u) => u.id))

        if (error) {
          console.error("Error fetching user handicaps:", error)
          return
        }

        const handicaps: Record<string, number> = {}
        data.forEach((user) => {
          handicaps[user.id] = user.strokes_given || 0
        })

        setUsersWithHandicap(handicaps)
      } catch (err) {
        console.error("Error in fetchUserHandicaps:", err)
      }
    }

    fetchUserHandicaps()
  }, [supabase, users])

  const computeNetScores = (scores: string[], userId: string): string[] => {
    if (!userId) return scores.map(() => "")
    const strokesGiven = usersWithHandicap[userId] || 0
    if (strokesGiven === 0) return [...scores]
    const sortedHoleIndexes = [...Array(18).keys()].sort(
      (a, b) => COURSE_DATA.whiteHdcp[a] - COURSE_DATA.whiteHdcp[b],
    )
    const strokeHoles = new Set(sortedHoleIndexes.slice(0, strokesGiven))
    return scores.map((s, i) => {
      if (s === "") return ""
      const gross = Number.parseInt(s)
      return (strokeHoles.has(i) ? gross - 1 : gross).toString()
    })
  }

  const handlePlayerChange = (index: number, userId: string) => {
    const newPlayers = [...players]
    newPlayers[index].userId = userId
    // Preserve any OCR-populated scores; just recompute net for the new player.
    newPlayers[index].netScores = computeNetScores(newPlayers[index].scores, userId)
    setPlayers(newPlayers)
  }

  const clearPlayer = (index: number) => {
    const newPlayers = [...players]
    newPlayers[index].userId = ""
    newPlayers[index].scores = Array(18).fill("")
    newPlayers[index].netScores = Array(18).fill("")
    newPlayers[index].ocrName = undefined
    newPlayers[index].uncertainHoles = undefined
    newPlayers[index].handwrittenOutTotal = undefined
    newPlayers[index].handwrittenInTotal = undefined
    newPlayers[index].handwrittenTotal = undefined
    setPlayers(newPlayers)
  }

  const handleScorecardUpload = async (file: File) => {
    setError(null)
    setIsOcring(true)
    try {
      // Just downscale to keep the upload under the server-action body limit.
      // Server-side preprocessing is minimal now (EXIF rotation + upscale if
      // tiny); Gemini handles the hard work from the original color image.
      const uploadFile = await downscaleForUpload(file).catch(() => file)

      const formData = new FormData()
      formData.append("scorecard", uploadFile)
      const result = await uploadAndParseScorecard(formData)

      if (!result.success) {
        setError(result.error)
        toast({ title: "Upload failed", description: result.error, variant: "destructive" })
        return
      }

      // Always surface debug info from a successful OCR call, even on zero
      // players, so we can diagnose parser regressions from the UI.
      setOcrDebug(result.debug ?? null)
      setPreprocessSteps(result.preprocessSteps ?? [])

      if (result.players.length === 0) {
        setError("We couldn't detect any player rows in that photo. Try a clearer shot.")
        return
      }

      setScorecardImagePath(result.imagePath)
      setScorecardImageUrl(result.imageUrl ?? null)

      // Seed the form with up to 4 OCR'd rows; any remaining slots stay blank
      // so the user can still add more manually if needed. Uncertain cells
      // (yellow in the UI) are the UNION of holes Gemini flagged as low-
      // confidence AND holes it couldn't read at all (null score) — a
      // stamped/unreadable cell is exactly the kind of thing the user
      // needs to fill in and should be visually findable.
      const newPlayers = Array.from({ length: 4 }, (_, i) => {
        const ocr = result.players[i]
        if (!ocr) {
          return { userId: "", scores: Array(18).fill(""), netScores: Array(18).fill("") }
        }
        const scores = ocr.scores.map((s) => (s === null ? "" : String(s)))
        const nullHoles = ocr.scores
          .map((s, idx) => (s === null ? idx : -1))
          .filter((idx) => idx >= 0)
        return {
          userId: "",
          scores,
          netScores: scores.slice(), // no handicap until user picks a player
          ocrName: ocr.name,
          uncertainHoles: new Set<number>([...(ocr.uncertainHoles ?? []), ...nullHoles]),
          handwrittenOutTotal: ocr.handwrittenOutTotal ?? null,
          handwrittenInTotal: ocr.handwrittenInTotal ?? null,
          handwrittenTotal: ocr.handwrittenTotal ?? null,
        }
      })
      setPlayers(newPlayers)

      toast({
        title: "Scorecard uploaded",
        description:
          "Match each column to the right player, then fill in any blank cells before submitting.",
      })
    } catch (err: any) {
      console.error("OCR upload error:", err)
      setError(err.message || "Failed to process scorecard")
    } finally {
      setIsOcring(false)
    }
  }

  const handleScoreChange = (playerIndex: number, holeIndex: number, value: string) => {
    if (value !== "" && !/^\d+$/.test(value)) return

    const newPlayers = [...players]
    newPlayers[playerIndex].scores[holeIndex] = value

    // Once the user types into a cell the OCR flagged as uncertain, it's no
    // longer uncertain — clear the highlight.
    const uncertain = newPlayers[playerIndex].uncertainHoles
    if (uncertain?.has(holeIndex)) {
      const next = new Set(uncertain)
      next.delete(holeIndex)
      newPlayers[playerIndex].uncertainHoles = next
    }

    if (value !== "") {
      const userId = newPlayers[playerIndex].userId
      const strokesGiven = usersWithHandicap[userId] || 0

      if (strokesGiven > 0) {
        const sortedHoleIndexes = [...Array(18).keys()].sort(
          (a, b) => COURSE_DATA.whiteHdcp[a] - COURSE_DATA.whiteHdcp[b],
        )
        const holeGetsStroke = sortedHoleIndexes.slice(0, strokesGiven).includes(holeIndex)
        const grossScore = Number.parseInt(value)
        const netScore = holeGetsStroke ? grossScore - 1 : grossScore
        newPlayers[playerIndex].netScores[holeIndex] = netScore.toString()
      } else {
        newPlayers[playerIndex].netScores[holeIndex] = value
      }

      // Auto-advance to the next hole (same player). A bare "1" might be
      // the start of "10"-"15" — wait ~750ms before advancing so the user
      // can type the second digit. Any other single digit ("2"-"9") is
      // unambiguous and advances immediately; "10"-"15" (already 2 chars)
      // also advances immediately.
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
      if (holeIndex < 17) {
        const currentKey = `${playerIndex}-${holeIndex}`
        const nextKey = `${playerIndex}-${holeIndex + 1}`
        const delay = value === "1" ? 750 : 50
        autoAdvanceTimer.current = setTimeout(() => {
          // Only advance if the user is still on this cell — prevents
          // stealing focus if they Tab'd or clicked away.
          if (document.activeElement === inputRefs.current[currentKey]) {
            inputRefs.current[nextKey]?.focus()
          }
          autoAdvanceTimer.current = null
        }, delay)
      }
    } else {
      newPlayers[playerIndex].netScores[holeIndex] = ""
    }

    setPlayers(newPlayers)
  }

  const calculateTotal = (scores: string[], startIndex: number, endIndex: number) => {
    const filled = scores.slice(startIndex, endIndex).filter((s) => s !== "")
    if (filled.length === 0) return "-"
    return filled.reduce((sum, score) => sum + Number.parseInt(score), 0)
  }

  // Render a subtotal cell showing the computed sum, with the handwritten
  // total from OCR in parens + yellow when they disagree. A mismatch means
  // one of the per-hole scores is wrong — the user scans for the yellow
  // row and checks the uncertain cells.
  const renderSubtotalCell = (
    computed: number | string,
    handwritten: number | null | undefined,
  ) => {
    const mismatch =
      typeof computed === "number" &&
      typeof handwritten === "number" &&
      computed !== handwritten
    if (!mismatch) {
      return <span>{computed}</span>
    }
    return (
      <span
        className="text-yellow-400"
        title={`Handwritten total on the card was ${handwritten}. One of the scores in this column may be off.`}
      >
        {computed} <span className="text-[10px] font-normal">({handwritten})</span>
      </span>
    )
  }

  // A column "has scores" if ANY of its 18 inputs are filled. For every such
  // column, the form is only valid if:
  //   - a player has been selected for it, AND
  //   - all 18 holes have a score entered.
  // Empty columns are ignored (you don't have to use all 4 slots).
  const validation = (() => {
    const scored = activePlayers.filter((p) => p.scores.some((s) => s !== ""))
    if (scored.length === 0) {
      return { ok: false as const, reason: "Enter scores for at least one player." }
    }
    const missingPlayer = scored.some((p) => !p.userId)
    if (missingPlayer) {
      return { ok: false as const, reason: "Pick a player for every column that has scores." }
    }
    const incomplete = scored.some((p) => p.scores.some((s) => s === ""))
    if (incomplete) {
      return { ok: false as const, reason: "Fill in every hole for each scored player (18 scores each)." }
    }
    return { ok: true as const, reason: "" }
  })()

  const handleSubmit = async () => {
    setError(null)

    if (!validation.ok) {
      toast({
        title: "Validation Error",
        description: validation.reason,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const playerScores = activePlayers
        .filter((player) => player.userId)
        .map((player) => ({
          userId: player.userId,
          scores: player.scores.map((score) => (score ? Number.parseInt(score) : 0)),
          netScores: player.netScores.map((score) => (score ? Number.parseInt(score) : 0)),
          strokesGiven: usersWithHandicap[player.userId] || 0,
        }))

      const result = await submitScores(
        format(date, "yyyy-MM-dd"),
        playerScores,
        scorecardImagePath,
      )

      if (result.success) {
        toast({ title: "Success!", description: "Scores have been submitted successfully" })
        router.push("/scores/my-rounds")
      } else {
        setError(result.error || "Failed to submit scores")
        toast({ title: "Error", description: result.error || "Failed to submit scores", variant: "destructive" })
      }
    } catch (error: any) {
      console.error("Error submitting scores:", error)
      setError(error.message || "An unexpected error occurred")
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name || ""

  return (
    <div className="space-y-6">
      {/* Fullscreen scorecard photo overlay. In-page (not a link) so tapping
          the preview, viewing the photo, and dismissing doesn't wipe form
          inputs via navigation. */}
      {isImageZoomed && scorecardImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsImageZoomed(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setIsImageZoomed(false)}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scorecardImageUrl}
            alt="Uploaded scorecard"
            className="max-h-[95vh] max-w-[98vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Date picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Round Date</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("justify-start text-left font-normal w-full sm:w-auto", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(date) => date && setDate(date)} initialFocus />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Scorecard photo upload (optional shortcut) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Upload Scorecard Photo (optional)</CardTitle>
          <CardDescription>
            Snap a photo of the paper scorecard and we'll pre-fill the scores below. You can still edit any value, and unreadable cells will be left blank for you to fill in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <input
              id="scorecard-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isOcring || isSubmitting}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleScorecardUpload(file)
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isOcring || isSubmitting}
              onClick={() => document.getElementById("scorecard-upload")?.click()}
            >
              {isOcring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reading scorecard...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  {scorecardImagePath ? "Replace scorecard photo" : "Upload scorecard photo"}
                </>
              )}
            </Button>
          </div>

          {scorecardImagePath && !isOcring && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Review scores against the photo</AlertTitle>
              <AlertDescription>
                Double-check highlighted scores — they're the OCR's best guesses. Totals shown in parentheses are read from the card photo; if they don't match your computed sum, one of the scores in that row needs correcting. Pick the correct player for each column.
              </AlertDescription>
            </Alert>
          )}

          {scorecardImageUrl && !isOcring && (
            // Reference image so the user can verify scores without toggling
            // back to their camera roll. Tapping opens an in-page overlay
            // (no new tab / no route change) so form inputs are preserved.
            <button
              type="button"
              onClick={() => setIsImageZoomed(true)}
              className="block w-full overflow-hidden rounded-md border"
              title="Tap to view full size"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scorecardImageUrl}
                alt="Uploaded scorecard"
                className="w-full max-h-[320px] object-contain bg-muted"
              />
            </button>
          )}

          {preprocessSteps.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              Preprocessing: {preprocessSteps.join(" → ")}
            </div>
          )}

          {ocrDebug !== null && (
            <details className="rounded-md border border-dashed p-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                OCR debug info (tap to expand)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[10px] leading-tight">
                {JSON.stringify(ocrDebug, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Scorecard */}
      {/* Break out of the parent container's 16px mobile side-padding so the
           scorecard uses full viewport width and all 4 player columns fit
           without horizontal scroll. */}
      <Card className="-mx-4 sm:mx-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Scorecard</CardTitle>
          <CardDescription>Enter scores for each hole</CardDescription>
        </CardHeader>
        <CardContent className="px-1 sm:px-6">
          <table className="w-full text-sm border-collapse table-fixed">
            {/* Sticky header with player selectors */}
            <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b">
                  <th className="px-0.5 sm:px-3 py-2 text-left font-medium text-muted-foreground w-[34px] sm:w-12">Hole</th>
                  <th className="px-0.5 sm:px-2 py-2 text-center font-medium text-muted-foreground w-[28px] sm:w-10">Par</th>
                  {activePlayers.map((player, pIdx) => (
                    <th key={pIdx} className="px-0.5 sm:px-1 py-1 text-center align-top">
                      {player.userId ? (
                        <button
                          type="button"
                          onClick={() => clearPlayer(pIdx)}
                          disabled={isSubmitting}
                          className="flex items-center justify-between w-full h-7 rounded-md border border-input bg-background px-1.5 text-xs hover:bg-muted/50"
                        >
                          <span className="truncate font-medium">{toInitials(getUserName(player.userId))}</span>
                          <X className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </button>
                      ) : (
                        <Select
                          value={player.userId}
                          onValueChange={(value) => handlePlayerChange(pIdx, value)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="h-7 text-xs px-1.5 w-full min-w-0">
                            <SelectValue placeholder="Player" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} {usersWithHandicap[user.id] ? `(${usersWithHandicap[user.id]})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {player.ocrName && !player.userId && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground truncate" title={`OCR read: ${player.ocrName}`}>
                          ~{player.ocrName}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* Front 9 */}
                {COURSE_DATA.holes.slice(0, 9).map((hole, holeIndex) => (
                  <tr key={holeIndex} className="border-b">
                    <td className="px-0.5 sm:px-3 py-1.5 text-center font-medium text-sm">{hole}</td>
                    <td className="px-0.5 sm:px-2 py-1.5 text-center text-muted-foreground text-sm">
                      {COURSE_DATA.pars[holeIndex]}
                    </td>
                    {activePlayers.map((player, pIdx) => {
                      const uncertain = player.uncertainHoles?.has(holeIndex) ?? false
                      return (
                        <td key={pIdx} className="px-0.5 py-0.5 text-center">
                          <Input
                            ref={(el) => { inputRefs.current[`${pIdx}-${holeIndex}`] = el }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={player.scores[holeIndex]}
                            onChange={(e) => handleScoreChange(pIdx, holeIndex, e.target.value)}
                            className={cn(
                              "h-8 sm:h-9 w-full text-center text-base sm:text-sm px-0 min-w-0",
                              uncertain &&
                                "border-yellow-500 bg-yellow-500/10 focus-visible:ring-yellow-500",
                            )}
                            title={uncertain ? "OCR wasn't confident — please enter manually" : undefined}
                            disabled={!player.userId || isSubmitting}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* OUT subtotal */}
                <tr className="border-b-2 border-t bg-muted/50 font-medium">
                  <td className="px-0.5 sm:px-3 py-2 text-center text-sm">Out</td>
                  <td className="px-0.5 sm:px-2 py-2 text-center text-sm">{COURSE_DATA.frontNinePar}</td>
                  {activePlayers.map((player, pIdx) => (
                    <td key={pIdx} className="px-0.5 sm:px-1 py-2 text-center text-sm font-semibold">
                      {renderSubtotalCell(
                        calculateTotal(player.scores, 0, 9),
                        player.handwrittenOutTotal,
                      )}
                    </td>
                  ))}
                </tr>

                {/* Spacer row */}
                <tr className="h-3" />

                {/* Back 9 */}
                {COURSE_DATA.holes.slice(9, 18).map((hole, i) => {
                  const holeIndex = i + 9
                  return (
                    <tr key={holeIndex} className="border-b">
                      <td className="px-0.5 sm:px-3 py-1.5 text-center font-medium text-sm">{hole}</td>
                      <td className="px-0.5 sm:px-2 py-1.5 text-center text-muted-foreground text-sm">
                        {COURSE_DATA.pars[holeIndex]}
                      </td>
                      {activePlayers.map((player, pIdx) => {
                        const uncertain = player.uncertainHoles?.has(holeIndex) ?? false
                        return (
                          <td key={pIdx} className="px-0.5 py-0.5 text-center">
                            <Input
                              ref={(el) => { inputRefs.current[`${pIdx}-${holeIndex}`] = el }}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={player.scores[holeIndex]}
                              onChange={(e) => handleScoreChange(pIdx, holeIndex, e.target.value)}
                              className={cn(
                                "h-8 sm:h-9 w-full text-center text-base sm:text-sm px-0 min-w-0",
                                uncertain &&
                                  "border-yellow-500 bg-yellow-500/10 focus-visible:ring-yellow-500",
                              )}
                              title={uncertain ? "OCR wasn't confident — please enter manually" : undefined}
                              disabled={!player.userId || isSubmitting}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* IN subtotal */}
                <tr className="border-b-2 border-t bg-muted/50 font-medium">
                  <td className="px-0.5 sm:px-3 py-2 text-center text-sm">In</td>
                  <td className="px-0.5 sm:px-2 py-2 text-center text-sm">{COURSE_DATA.backNinePar}</td>
                  {activePlayers.map((player, pIdx) => (
                    <td key={pIdx} className="px-0.5 sm:px-1 py-2 text-center text-sm font-semibold">
                      {renderSubtotalCell(
                        calculateTotal(player.scores, 9, 18),
                        player.handwrittenInTotal,
                      )}
                    </td>
                  ))}
                </tr>

                {/* TOTAL */}
                <tr className="bg-muted font-bold">
                  <td className="px-0.5 sm:px-3 py-2.5 text-center text-sm">Total</td>
                  <td className="px-0.5 sm:px-2 py-2.5 text-center text-sm">{COURSE_DATA.totalPar}</td>
                  {activePlayers.map((player, pIdx) => (
                    <td key={pIdx} className="px-0.5 sm:px-1 py-2.5 text-center text-base font-bold">
                      {renderSubtotalCell(
                        calculateTotal(player.scores, 0, 18),
                        player.handwrittenTotal,
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4">
          {!validation.ok && (
            <span className="w-full text-center text-xs text-muted-foreground sm:text-right">
              {validation.reason}
            </span>
          )}
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !validation.ok}
              className="text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Scores"
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
