"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { generateNewTeeTimesForSeason } from "@/app/actions/generate-new-tee-times"

export default function GenerateTeeTimesPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  const handleGenerateTeeTimesClick = async () => {
    setIsGenerating(true)
    setResult(null)

    try {
      const result = await generateNewTeeTimesForSeason()
      setResult(result)
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || "An unexpected error occurred",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Generate New Tee Times</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Update Tee Time Schedule</CardTitle>
          <CardDescription>
            Generate new tee times for all Fridays in the season with the following times: 3:30 PM, 3:40 PM, 3:50 PM,
            4:00 PM, 4:10 PM, and 4:20 PM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">This action will:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Delete any existing tee times outside the 3:30 PM - 4:20 PM range</li>
            <li>Create new tee times at the specified intervals if they don't already exist</li>
            <li>Update all Fridays in the 2025 season (May 23 - August 29)</li>
          </ul>
          <p className="text-amber-600 font-medium">
            Note: This will not affect any existing reservations for tee times within the new time range.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateTeeTimesClick} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Tee Times...
              </>
            ) : (
              "Generate New Tee Times"
            )}
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{result.success ? result.message : result.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
