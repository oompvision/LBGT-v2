"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { checkTeeTimeAvailability } from "@/app/actions/available-tee-times"

interface ReservationFormProps {
  teeTimeId: string
  teeTimeDate: string
  teeTimeTime: string
  maxSlots: number
  userId: string
  userName: string
}

export function ReservationForm({
  teeTimeId,
  teeTimeDate,
  teeTimeTime,
  maxSlots,
  userId,
  userName,
}: ReservationFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [isAvailable, setIsAvailable] = useState(true)
  const [slots, setSlots] = useState(1)
  const [playerNames, setPlayerNames] = useState<string[]>([])
  const [playForMoney, setPlayForMoney] = useState<boolean[]>([false]) // First element is for the main player

  // Verify tee time availability on load
  useEffect(() => {
    const verifyAvailability = async () => {
      setIsVerifying(true)
      try {
        const result = await checkTeeTimeAvailability(teeTimeId)

        if (!result.success || !result.isAvailable) {
          setIsAvailable(false)
          toast({
            title: "Tee Time Unavailable",
            description: "This tee time is no longer available for booking.",
            variant: "destructive",
          })

          // Redirect back to dashboard after a short delay
          setTimeout(() => {
            router.push("/dashboard")
          }, 3000)
        } else {
          setIsAvailable(true)
        }
      } catch (error) {
        console.error("Error verifying tee time availability:", error)
        setIsAvailable(false)
      } finally {
        setIsVerifying(false)
      }
    }

    verifyAvailability()
  }, [teeTimeId, router, toast])

  // Generate array of additional player slots based on selected number
  useEffect(() => {
    // Adjust player names array based on slots
    if (slots > 1) {
      const newPlayerNames = [...playerNames]
      // Add empty strings if we need more slots
      while (newPlayerNames.length < slots - 1) {
        newPlayerNames.push("")
      }
      // Remove extra slots if we need fewer
      while (newPlayerNames.length > slots - 1) {
        newPlayerNames.pop()
      }
      setPlayerNames(newPlayerNames)

      // Adjust play for money array based on slots
      const newPlayForMoney = [...playForMoney]
      // Add false values if we need more slots
      while (newPlayForMoney.length < slots) {
        newPlayForMoney.push(false)
      }
      // Remove extra values if we need fewer
      while (newPlayForMoney.length > slots) {
        newPlayForMoney.pop()
      }
      setPlayForMoney(newPlayForMoney)
    } else {
      setPlayerNames([])
      setPlayForMoney([playForMoney[0]]) // Keep main player's preference
    }
  }, [slots])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Double-check availability before submitting
    const availabilityCheck = await checkTeeTimeAvailability(teeTimeId)

    if (!availabilityCheck.success || !availabilityCheck.isAvailable) {
      toast({
        title: "Tee Time Unavailable",
        description: "This tee time is no longer available for booking.",
        variant: "destructive",
      })
      router.push("/dashboard")
      return
    }

    setIsSubmitting(true)

    try {
      // Use the RPC function to create the reservation
      const { data, error } = await fetch("/api/reservations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teeTimeId,
          userId,
          slots,
          playerNames,
          playForMoney,
        }),
      }).then((res) => res.json())

      if (error) {
        console.error("Error creating reservation:", error)
        toast({
          title: "Reservation Failed",
          description: error || "Failed to create reservation. Please try again.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Reservation Confirmed",
          description: `Your tee time has been reserved for ${new Date(teeTimeDate).toLocaleDateString()} at ${teeTimeTime}.`,
        })
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error) {
      console.error("Error creating reservation:", error)
      toast({
        title: "Reservation Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isVerifying) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Verifying Availability</CardTitle>
          <CardDescription>Please wait while we verify this tee time is available...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    )
  }

  if (!isAvailable) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Tee Time Unavailable</CardTitle>
          <CardDescription>This tee time is no longer available for booking.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">Redirecting you to the dashboard...</p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Reserve Tee Time</CardTitle>
        <CardDescription>
          {new Date(teeTimeDate).toLocaleDateString()} at {teeTimeTime}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slots">Number of Players</Label>
            <Input
              id="slots"
              type="number"
              min={1}
              max={maxSlots}
              value={slots}
              onChange={(e) => setSlots(Number.parseInt(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mainPlayerMoney"
                checked={playForMoney[0]}
                onCheckedChange={(checked) => {
                  const newPlayForMoney = [...playForMoney]
                  newPlayForMoney[0] = checked === true
                  setPlayForMoney(newPlayForMoney)
                }}
              />
              <Label htmlFor="mainPlayerMoney" className="text-sm font-medium">
                I want to play for money
              </Label>
            </div>
          </div>

          {slots > 1 && (
            <div className="space-y-4">
              <Label>Additional Players</Label>
              {Array.from({ length: slots - 1 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Input
                    placeholder={`Player ${index + 2} Name`}
                    value={playerNames[index] || ""}
                    onChange={(e) => {
                      const newPlayerNames = [...playerNames]
                      newPlayerNames[index] = e.target.value
                      setPlayerNames(newPlayerNames)
                    }}
                    required
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`player${index}Money`}
                      checked={playForMoney[index + 1] || false}
                      onCheckedChange={(checked) => {
                        const newPlayForMoney = [...playForMoney]
                        newPlayForMoney[index + 1] = checked === true
                        setPlayForMoney(newPlayForMoney)
                      }}
                    />
                    <Label htmlFor={`player${index}Money`} className="text-sm font-medium">
                      This player wants to play for money
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Reserving..." : "Confirm Reservation"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
