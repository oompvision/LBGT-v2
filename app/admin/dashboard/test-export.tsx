"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { exportReservationsToCSV } from "@/app/actions/export-data"
import { toast } from "@/components/ui/use-toast"
import { createTestReservation } from "@/app/actions/test-utils"

export function TestExport() {
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingTestData, setIsCreatingTestData] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleTest = async () => {
    setIsLoading(true)
    try {
      // Use the current month for the test instead of just today
      const today = new Date()
      const exportResult = await exportReservationsToCSV(today.toISOString())
      setResult(exportResult)

      if (exportResult.success) {
        toast({
          title: "Export Test Successful",
          description: `Generated ${exportResult.count} player rows in the CSV`,
        })
      } else {
        toast({
          title: "Export Test Failed",
          description: exportResult.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error testing export:", error)
      toast({
        title: "Export Test Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTestData = async () => {
    setIsCreatingTestData(true)
    try {
      const result = await createTestReservation()

      if (result.success) {
        toast({
          title: "Test Data Created",
          description: `Created a test reservation with ${result.playerCount} players`,
        })
      } else {
        toast({
          title: "Failed to Create Test Data",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating test data:", error)
      toast({
        title: "Failed to Create Test Data",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsCreatingTestData(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Reservation Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          <Button onClick={handleCreateTestData} disabled={isCreatingTestData}>
            {isCreatingTestData ? "Creating..." : "Create Test Reservation"}
          </Button>

          <Button onClick={handleTest} disabled={isLoading}>
            {isLoading ? "Testing..." : "Run Export Test"}
          </Button>
        </div>

        {result && (
          <div className="mt-4">
            <h3 className="text-lg font-medium">Test Results:</h3>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>

            {result.success && result.csv && (
              <div className="mt-4">
                <h4 className="font-medium">CSV Preview:</h4>
                <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto max-h-96">
                  {result.csv.substring(0, 1000)}
                  {result.csv.length > 1000 ? "..." : ""}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
