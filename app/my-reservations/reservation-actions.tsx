"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Trash2 } from "lucide-react"

interface ReservationActionsProps {
  reservationId: string
}

export function ReservationActions({ reservationId }: ReservationActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleCancelReservation = async () => {
    setIsDeleting(true)

    try {
      const { error } = await supabase.from("reservations").delete().eq("id", reservationId)

      if (error) {
        throw error
      }

      toast({
        title: "Reservation cancelled",
        description: "Your tee time reservation has been cancelled",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel reservation",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleCancelReservation}
      disabled={isDeleting}
      className="text-white"
    >
      {isDeleting ? (
        "Cancelling..."
      ) : (
        <>
          <Trash2 className="mr-1 h-4 w-4" />
          Cancel
        </>
      )}
    </Button>
  )
}
