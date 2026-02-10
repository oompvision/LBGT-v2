"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { submitScores } from "@/app/actions/scores"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CalendarIcon, Loader2 } from "lucide-react"
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

export function ScoreSubmissionForm({ users, currentUserId }: ScoreSubmissionFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [date, setDate] = useState<Date>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usersWithHandicap, setUsersWithHandicap] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Initialize player data
  const [players, setPlayers] = useState([
    { userId: currentUserId, scores: Array(18).fill(""), netScores: Array(18).fill("") },
    { userId: "", scores: Array(18).fill(""), netScores: Array(18).fill("") },
    { userId: "", scores: Array(18).fill(""), netScores: Array(18).fill("") },
    { userId: "", scores: Array(18).fill(""), netScores: Array(18).fill("") },
  ])

  // Fetch user handicaps
  useEffect(() => {
    const fetchUserHandicaps = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, strokes_given")
          .in(
            "id",
            users.map((u) => u.id),
          )

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

    // Reset scores when player changes
    newPlayers[index].scores = Array(18).fill("")
    newPlayers[index].netScores = Array(18).fill("")

    setPlayers(newPlayers)
  }

  const handleScoreChange = (playerIndex: number, holeIndex: number, value: string) => {
    // Only allow numbers
    if (value !== "" && !/^\d+$/.test(value)) return

    const newPlayers = [...players]
    newPlayers[playerIndex].scores[holeIndex] = value

    // Calculate net score if we have a valid score
    if (value !== "") {
      const userId = newPlayers[playerIndex].userId
      const strokesGiven = usersWithHandicap[userId] || 0

      if (strokesGiven > 0) {
        // Get the sorted holes by handicap difficulty
        const sortedHoleIndexes = [...Array(18).keys()].sort(
          (a, b) => COURSE_DATA.whiteHdcp[a] - COURSE_DATA.whiteHdcp[b],
        )

        // Check if this hole should get a stroke off
        const holeGetsStroke = sortedHoleIndexes.slice(0, strokesGiven).includes(holeIndex)

        const grossScore = Number.parseInt(value)
        const netScore = holeGetsStroke ? grossScore - 1 : grossScore
        newPlayers[playerIndex].netScores[holeIndex] = netScore.toString()
      } else {
        // No strokes given, net = gross
        newPlayers[playerIndex].netScores[holeIndex] = value
      }
    } else {
      newPlayers[playerIndex].netScores[holeIndex] = ""
    }

    setPlayers(newPlayers)
  }

  const calculateTotal = (scores: string[], startIndex: number, endIndex: number) => {
    return scores.slice(startIndex, endIndex).reduce((sum, score) => sum + (score ? Number.parseInt(score) : 0), 0)
  }

  const handleSubmit = async () => {
    // Clear any previous errors
    setError(null)

    // Validate that at least one player has scores
    const hasScores = players.some((player) => player.userId && player.scores.some((score) => score !== ""))

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
      // Convert scores to numbers and include net scores
      const playerScores = players
        .filter((player) => player.userId)
        .map((player) => {
          // Convert string scores to numbers, using 0 for empty strings
          const numericScores = player.scores.map((score) => (score ? Number.parseInt(score) : 0))
          const numericNetScores = player.netScores.map((score) => (score ? Number.parseInt(score) : 0))

          return {
            userId: player.userId,
            scores: numericScores,
            netScores: numericNetScores,
            strokesGiven: usersWithHandicap[player.userId] || 0,
          }
        })

      const result = await submitScores(format(date, "yyyy-MM-dd"), playerScores)

      if (result.success) {
        toast({
          title: "Success!",
          description: "Scores have been submitted successfully",
        })
        router.push("/scores/my-rounds")
      } else {
        setError(result.error || "Failed to submit scores")
        toast({
          title: "Error",
          description: result.error || "Failed to submit scores",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error submitting scores:", error)
      setError(error.message || "An unexpected error occurred")
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Round Information</CardTitle>
          <CardDescription>Select the date when the round was played</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant="outline"
                    className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(date) => date && setDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="relative overflow-x-auto">
        <div className="mb-6 overflow-x-auto">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/courseId%3D146332%26facilityId%3D9687%26view%3Dwide%26img%3D1%26renew%3D0%26t%3D1747506793-JHI1YeuyRUCwkhK12BkRks55Qh1U65.png"
            alt="Golf Course Scorecard"
            className="w-full max-w-[900px]"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Player Scores</CardTitle>
            <CardDescription>Enter scores for each player and hole</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Hole</th>
                    {COURSE_DATA.holes.map((hole) => (
                      <th key={hole} className="px-2 py-2 text-center font-medium">
                        {hole}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-medium">Out</th>
                    <th className="px-2 py-2 text-center font-medium">In</th>
                    <th className="px-2 py-2 text-center font-medium">Total</th>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2 text-left font-medium">Par</th>
                    {COURSE_DATA.pars.map((par, index) => (
                      <td key={index} className="px-2 py-2 text-center">
                        {par}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-medium">{COURSE_DATA.frontNinePar}</td>
                    <td className="px-2 py-2 text-center font-medium">{COURSE_DATA.backNinePar}</td>
                    <td className="px-2 py-2 text-center font-medium">{COURSE_DATA.totalPar}</td>
                  </tr>
                  <tr className="border-b bg-muted/20">
                    <th className="px-4 py-2 text-left font-medium">White Hdcp</th>
                    {COURSE_DATA.whiteHdcp.map((hdcp, index) => (
                      <td key={index} className="px-2 py-2 text-center">
                        {hdcp}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-medium">-</td>
                    <td className="px-2 py-2 text-center font-medium">-</td>
                    <td className="px-2 py-2 text-center font-medium">-</td>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, playerIndex) => {
                    const strokesGiven = player.userId ? usersWithHandicap[player.userId] || 0 : 0

                    return (
                      <React.Fragment key={playerIndex}>
                        <tr className="border-b">
                          <td className="px-4 py-2">
                            <div>
                              <Select
                                value={player.userId}
                                onValueChange={(value) => handlePlayerChange(playerIndex, value)}
                                disabled={isSubmitting}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="Select player" />
                                </SelectTrigger>
                                <SelectContent>
                                  {users.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.name} {usersWithHandicap[user.id] ? `(${usersWithHandicap[user.id]})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {strokesGiven > 0 && (
                                <div className="mt-1 text-xs text-muted-foreground">Strokes Given: {strokesGiven}</div>
                              )}
                            </div>
                          </td>
                          {player.scores.map((score, holeIndex) => (
                            <td key={holeIndex} className="px-1 py-1 text-center">
                              <Input
                                type="text"
                                value={score}
                                onChange={(e) => handleScoreChange(playerIndex, holeIndex, e.target.value)}
                                className="h-8 w-10 text-center"
                                disabled={!player.userId || isSubmitting}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-medium">
                            {player.userId ? calculateTotal(player.scores, 0, 9) : "-"}
                          </td>
                          <td className="px-2 py-2 text-center font-medium">
                            {player.userId ? calculateTotal(player.scores, 9, 18) : "-"}
                          </td>
                          <td className="px-2 py-2 text-center font-medium">
                            {player.userId ? calculateTotal(player.scores, 0, 18) : "-"}
                          </td>
                        </tr>

                        {/* Net Score Row (only shown if player has strokes given) */}
                        {player.userId && strokesGiven > 0 && (
                          <tr className="border-b bg-green-50">
                            <td className="px-4 py-2 text-sm font-medium text-green-700">Net Score</td>
                            {player.netScores.map((netScore, holeIndex) => (
                              <td key={holeIndex} className="px-2 py-2 text-center text-green-700">
                                {netScore || "-"}
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center font-medium text-green-700">
                              {calculateTotal(player.netScores, 0, 9)}
                            </td>
                            <td className="px-2 py-2 text-center font-medium text-green-700">
                              {calculateTotal(player.netScores, 9, 18)}
                            </td>
                            <td className="px-2 py-2 text-center font-medium text-green-700">
                              {calculateTotal(player.netScores, 0, 18)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between mt-4">
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
    </div>
  )
}
