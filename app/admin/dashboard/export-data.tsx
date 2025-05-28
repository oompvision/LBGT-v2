"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CalendarIcon, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { exportReservationsToCSV, exportScoresToCSV } from "@/app/actions/export-data"

export function ExportData() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [exportType, setExportType] = useState<"reservations" | "scores">("reservations")
  const [scoreExportType, setScoreExportType] = useState<"week" | "all">("week")
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      let result

      if (exportType === "reservations") {
        if (!date) {
          throw new Error("Please select a date")
        }
        result = await exportReservationsToCSV(format(date, "yyyy-MM-dd"))
      } else {
        // Scores export
        if (scoreExportType === "week") {
          if (!date) {
            throw new Error("Please select a date")
          }
          result = await exportScoresToCSV(format(date, "yyyy-MM-dd"))
        } else {
          // All scores
          result = await exportScoresToCSV()
        }
      }

      if (!result.success) {
        throw new Error(result.error || "Export failed")
      }

      // Check if there's data to export
      if (result.count === 0) {
        toast({
          title: "No Data Found",
          description: `No ${exportType} found for the selected criteria.`,
          variant: "default",
        })
        return
      }

      // Create and download the CSV file
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", result.filename)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export Successful",
        description: `Exported ${result.count} ${exportType === "reservations" ? "reservations" : "scores"} to CSV.`,
      })
    } catch (error: any) {
      setError(error.message || "An unexpected error occurred")
      toast({
        title: "Export Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Data</CardTitle>
        <CardDescription>Export reservations or scores to CSV files</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Export Type</Label>
          <RadioGroup
            defaultValue="reservations"
            value={exportType}
            onValueChange={(value) => setExportType(value as "reservations" | "scores")}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="reservations" id="reservations" />
              <Label htmlFor="reservations" className="cursor-pointer">
                Tee Time Reservations
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="scores" id="scores" />
              <Label htmlFor="scores" className="cursor-pointer">
                Round Scores
              </Label>
            </div>
          </RadioGroup>
        </div>

        {exportType === "scores" && (
          <div className="space-y-2">
            <Label>Score Export Range</Label>
            <RadioGroup
              defaultValue="week"
              value={scoreExportType}
              onValueChange={(value) => setScoreExportType(value as "week" | "all")}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="week" id="week" />
                <Label htmlFor="week" className="cursor-pointer">
                  Specific Week
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="cursor-pointer">
                  All Scores
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {(exportType === "reservations" || (exportType === "scores" && scoreExportType === "week")) && (
          <div className="space-y-2">
            <Label>Select Week</Label>
            <div className="grid gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Select any date in the week you want to export. The export will include data for the entire week.
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleExport}
          disabled={
            isExporting ||
            (exportType === "reservations" && !date) ||
            (exportType === "scores" && scoreExportType === "week" && !date)
          }
          className="w-full"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export to CSV
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
