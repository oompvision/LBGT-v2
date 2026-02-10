"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import type { Score, User, HoleScores } from "@/types/supabase"

// Updated course data from the new scorecard
const courseData = {
  holes: Array.from({ length: 18 }, (_, i) => i + 1),
  pars: [4, 4, 3, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 4, 3, 4, 5],
  whiteHdcp: [13, 9, 15, 5, 1, 17, 3, 11, 7, 12, 16, 2, 10, 8, 14, 18, 6, 4], // White Handicap values
  frontNinePar: 36,
  backNinePar: 36,
  totalPar: 72,
}

interface ScoreEditorProps {
  score: Score & { users: Pick<User, "name"> | null }
  onSave: (scoreData: HoleScores) => Promise<void>
  isSubmitting: boolean
}

export function ScoreEditor({ score, onSave, isSubmitting }: ScoreEditorProps) {
  // Initialize scores from the provided score object
  const initialScores = [
    score.hole_1,
    score.hole_2,
    score.hole_3,
    score.hole_4,
    score.hole_5,
    score.hole_6,
    score.hole_7,
    score.hole_8,
    score.hole_9,
    score.hole_10,
    score.hole_11,
    score.hole_12,
    score.hole_13,
    score.hole_14,
    score.hole_15,
    score.hole_16,
    score.hole_17,
    score.hole_18,
  ]

  const [scores, setScores] = useState<(number | null)[]>(initialScores)

  const handleScoreChange = (index: number, value: string) => {
    // Only allow numbers
    if (value !== "" && !/^\d+$/.test(value)) return

    const newScores = [...scores]
    newScores[index] = value === "" ? null : Number.parseInt(value, 10)
    setScores(newScores)
  }

  const calculateTotal = (startIndex: number, endIndex: number) => {
    return scores.slice(startIndex, endIndex).reduce((sum, score) => sum + (score || 0), 0)
  }

  const handleSave = () => {
    // Convert scores to the format expected by the server action
    const scoreData = {
      hole_1: scores[0],
      hole_2: scores[1],
      hole_3: scores[2],
      hole_4: scores[3],
      hole_5: scores[4],
      hole_6: scores[5],
      hole_7: scores[6],
      hole_8: scores[7],
      hole_9: scores[8],
      hole_10: scores[9],
      hole_11: scores[10],
      hole_12: scores[11],
      hole_13: scores[12],
      hole_14: scores[13],
      hole_15: scores[14],
      hole_16: scores[15],
      hole_17: scores[16],
      hole_18: scores[17],
    }

    onSave(scoreData)
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-2 text-left font-medium">Hole</th>
              {courseData.holes.map((hole) => (
                <th key={hole} className="px-2 py-2 text-center font-medium">
                  {hole}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium">Out</th>
              <th className="px-2 py-2 text-center font-medium">In</th>
              <th className="px-2 py-2 text-center font-medium">Total</th>
            </tr>
            <tr className="border-b bg-muted/30">
              <th className="px-2 py-2 text-left font-medium">Par</th>
              {courseData.pars.map((par, index) => (
                <td key={index} className="px-2 py-2 text-center">
                  {par}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-medium">{courseData.frontNinePar}</td>
              <td className="px-2 py-2 text-center font-medium">{courseData.backNinePar}</td>
              <td className="px-2 py-2 text-center font-medium">{courseData.totalPar}</td>
            </tr>
            <tr className="border-b bg-muted/20">
              <th className="px-2 py-2 text-left font-medium">White Hdcp</th>
              {courseData.whiteHdcp.map((hdcp, index) => (
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
            <tr className="border-b">
              <td className="px-2 py-2 font-medium">{score.users.name}</td>
              {scores.map((holeScore, index) => {
                // Calculate if the score is under, over, or at par
                const par = courseData.pars[index]
                let scoreClass = ""

                if (holeScore !== null) {
                  if (holeScore < par) scoreClass = "text-green-600 font-medium"
                  else if (holeScore > par) scoreClass = "text-red-600 font-medium"
                }

                return (
                  <td key={index} className="px-1 py-1 text-center">
                    <Input
                      type="text"
                      value={holeScore === null ? "" : holeScore.toString()}
                      onChange={(e) => handleScoreChange(index, e.target.value)}
                      className={`h-8 w-10 text-center ${scoreClass}`}
                    />
                  </td>
                )
              })}
              <td className="px-2 py-2 text-center font-medium">{calculateTotal(0, 9)}</td>
              <td className="px-2 py-2 text-center font-medium">{calculateTotal(9, 18)}</td>
              <td className="px-2 py-2 text-center font-medium">{calculateTotal(0, 18)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" onClick={() => setScores(initialScores)} disabled={isSubmitting}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </DialogFooter>
    </div>
  )
}
