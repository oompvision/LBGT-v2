"use client"

import React, { useRef } from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { submitScores } from "@/app/actions/scores"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CalendarIcon, Loader2, X } from "lucide-react"
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

export function ScoreSubmissionForm({ users, currentUserId }: ScoreSubmissionFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [date, setDate] = useState<Date>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usersWithHandicap, setUsersWithHandicap] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Initialize player data
  const [players, setPlayers] = useState([
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

  const handlePlayerChange = (index: number, userId: string) => {
    const newPlayers = [...players]
    newPlayers[index].userId = userId
    newPlayers[index].scores = Array(18).fill("")
    newPlayers[index].netScores = Array(18).fill("")
    setPlayers(newPlayers)
  }

  const clearPlayer = (index: number) => {
    const newPlayers = [...players]
    newPlayers[index].userId = ""
    newPlayers[index].scores = Array(18).fill("")
    newPlayers[index].netScores = Array(18).fill("")
    setPlayers(newPlayers)
  }

  const handleScoreChange = (playerIndex: number, holeIndex: number, value: string) => {
    if (value !== "" && !/^\d+$/.test(value)) return

    const newPlayers = [...players]
    newPlayers[playerIndex].scores[holeIndex] = value

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

      // Auto-advance to next hole (same player)
      if (value.length >= 1 && holeIndex < 17) {
        const nextKey = `${playerIndex}-${holeIndex + 1}`
        setTimeout(() => inputRefs.current[nextKey]?.focus(), 50)
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

  const handleSubmit = async () => {
    setError(null)

    const hasScores = activePlayers.some(
      (player) => player.userId && player.scores.some((score) => score !== ""),
    )

    if (!hasScores) {
      toast({
        title: "Validation Error",
        description: "Please enter scores for at least one player",
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

      const result = await submitScores(format(date, "yyyy-MM-dd"), playerScores)

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

      {/* Scorecard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Scorecard</CardTitle>
          <CardDescription>Enter scores for each hole</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* Sticky header with player selectors */}
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b">
                  <th className="px-2 sm:px-3 py-2 text-left font-medium text-muted-foreground w-12">Hole</th>
                  <th className="px-1 sm:px-2 py-2 text-center font-medium text-muted-foreground w-10">Par</th>
                  {activePlayers.map((player, pIdx) => (
                    <th key={pIdx} className="px-1 py-1 text-center w-12">
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
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* Front 9 */}
                {COURSE_DATA.holes.slice(0, 9).map((hole, holeIndex) => (
                  <tr key={holeIndex} className="border-b">
                    <td className="px-2 sm:px-3 py-1.5 text-center font-medium text-sm">{hole}</td>
                    <td className="px-1 sm:px-2 py-1.5 text-center text-muted-foreground text-sm">
                      {COURSE_DATA.pars[holeIndex]}
                    </td>
                    {activePlayers.map((player, pIdx) => (
                      <td key={pIdx} className="px-0.5 py-0.5 text-center">
                        <Input
                          ref={(el) => { inputRefs.current[`${pIdx}-${holeIndex}`] = el }}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={player.scores[holeIndex]}
                          onChange={(e) => handleScoreChange(pIdx, holeIndex, e.target.value)}
                          className="h-9 w-full text-center text-sm px-0"
                          disabled={!player.userId || isSubmitting}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* OUT subtotal */}
                <tr className="border-b-2 border-t bg-muted/50 font-medium">
                  <td className="px-2 sm:px-3 py-2 text-center text-sm">Out</td>
                  <td className="px-1 sm:px-2 py-2 text-center text-sm">{COURSE_DATA.frontNinePar}</td>
                  {activePlayers.map((player, pIdx) => (
                    <td key={pIdx} className="px-1 py-2 text-center text-sm font-semibold">
                      {player.userId ? calculateTotal(player.scores, 0, 9) : "-"}
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
                      <td className="px-2 sm:px-3 py-1.5 text-center font-medium text-sm">{hole}</td>
                      <td className="px-1 sm:px-2 py-1.5 text-center text-muted-foreground text-sm">
                        {COURSE_DATA.pars[holeIndex]}
                      </td>
                      {activePlayers.map((player, pIdx) => (
                        <td key={pIdx} className="px-0.5 py-0.5 text-center">
                          <Input
                            ref={(el) => { inputRefs.current[`${pIdx}-${holeIndex}`] = el }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={player.scores[holeIndex]}
                            onChange={(e) => handleScoreChange(pIdx, holeIndex, e.target.value)}
                            className="h-9 w-full text-center text-sm px-0"
                            disabled={!player.userId || isSubmitting}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}

                {/* IN subtotal */}
                <tr className="border-b-2 border-t bg-muted/50 font-medium">
                  <td className="px-2 sm:px-3 py-2 text-center text-sm">In</td>
                  <td className="px-1 sm:px-2 py-2 text-center text-sm">{COURSE_DATA.backNinePar}</td>
                  {activePlayers.map((player, pIdx) => (
                    <td key={pIdx} className="px-1 py-2 text-center text-sm font-semibold">
                      {player.userId ? calculateTotal(player.scores, 9, 18) : "-"}
                    </td>
                  ))}
                </tr>

                {/* TOTAL */}
                <tr className="bg-muted font-bold">
                  <td className="px-2 sm:px-3 py-2.5 text-center text-sm">Total</td>
                  <td className="px-1 sm:px-2 py-2.5 text-center text-sm">{COURSE_DATA.totalPar}</td>
                  {activePlayers.map((player, pIdx) => (
                    <td key={pIdx} className="px-1 py-2.5 text-center text-base font-bold">
                      {player.userId ? calculateTotal(player.scores, 0, 18) : "-"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => router.push("/dashboard")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="text-white">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Scores"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
