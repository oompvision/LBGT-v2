"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { CalendarRange, RefreshCw } from "lucide-react"
import { updateToNextFriday } from "../actions/tee-times"

export function WeeklyUpdate() {
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleUpdateToNextFriday = async () => {
    setIsUpdating(true)

    try {
      const result = await updateToNextFriday()

      if (!result.success) {
        throw new Error(result.error || result.message)
      }

      toast({
        title: "Success!",
        description: result.message,
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update to next Friday",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Update</CardTitle>
        <CardDescription>
          Update the system to show tee times for the next Friday. This should be done every Saturday.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This action will make the next Friday's tee times available for booking. It should be performed after the
          current Friday has passed (typically on Saturday morning).
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The first tee time date is Friday, May 23, 2025. After that, tee times will be available for each Friday (May
          30, June 6, etc.) until Labor Day.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdateToNextFriday} disabled={isUpdating} className="w-full text-white">
          {isUpdating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <CalendarRange className="mr-2 h-4 w-4" />
              Update to Next Friday
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
