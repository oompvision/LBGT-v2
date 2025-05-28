"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteReservation } from "@/app/actions/tee-times"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

interface Reservation {
  id: string
  slots: number
  player_names: string[]
  play_for_money: boolean[]
  users: {
    name: string
    email: string
  }
  tee_times: {
    date: string
    time: string
  }
}

interface AdminReservationsListProps {
  reservations: Reservation[]
}

export function AdminReservationsList({ reservations }: AdminReservationsListProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this reservation?")) {
      setIsDeleting(id)
      try {
        const result = await deleteReservation(id)
        if (result.success) {
          toast({
            title: "Reservation Deleted",
            description: "The tee time reservation has been deleted.",
          })
          router.refresh()
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to delete reservation",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error deleting reservation:", error)
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        })
      } finally {
        setIsDeleting(null)
      }
    }
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No reservations found.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => (
        <Card key={reservation.id}>
          <CardHeader>
            <CardTitle>
              {new Date(reservation.tee_times.date).toLocaleDateString()} at {reservation.tee_times.time}
            </CardTitle>
            <CardDescription>
              Reserved by: {reservation.users.name} ({reservation.users.email})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span>{reservation.users.name}</span>
                {reservation.play_for_money && reservation.play_for_money[0] && (
                  <Badge className="bg-green-500 hover:bg-green-600">Playing for money</Badge>
                )}
              </div>

              {reservation.player_names && reservation.player_names.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium mb-1">Additional Players ({reservation.player_names.length}):</h4>
                  <ul className="space-y-1">
                    {reservation.player_names.map((name, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <span>{name}</span>
                        {reservation.play_for_money && reservation.play_for_money[index + 1] && (
                          <Badge className="bg-green-500 hover:bg-green-600">Playing for money</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(reservation.id)}
                disabled={!!isDeleting}
              >
                {isDeleting === reservation.id ? "Deleting..." : "Delete Reservation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
