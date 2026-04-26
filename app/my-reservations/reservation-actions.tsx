"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, LogOut, Trash2 } from "lucide-react"
import {
  cancelReservationAsBooker,
  removePlayerFromReservation,
} from "@/app/actions/reservation-players"

interface ReservationActionsProps {
  reservationId: string
  role: "booker" | "invited"
  /** Booker has no other players in the group — "Remove myself" would just cancel. */
  bookerIsSolo?: boolean
}

export function ReservationActions({ reservationId, role, bookerIsSolo }: ReservationActionsProps) {
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const result = await cancelReservationAsBooker(reservationId)
      if (result.success) {
        toast({
          title: "Reservation cancelled",
          description: "The reservation has been cancelled for everyone in the group.",
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to cancel reservation",
          variant: "destructive",
        })
      }
    } finally {
      setIsCancelling(false)
    }
  }

  const handleRemoveSelf = async () => {
    setIsRemoving(true)
    try {
      const result = await removePlayerFromReservation(reservationId)
      if (result.success) {
        toast({
          title: role === "booker" ? "Removed from group" : "You've been removed",
          description:
            role === "booker"
              ? "The booking was transferred to another league player."
              : "Your seat has been released.",
        })
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to remove from reservation",
          variant: "destructive",
        })
      }
    } finally {
      setIsRemoving(false)
    }
  }

  // Booker & solo → one button only ("Cancel"), since removing self = cancel.
  if (role === "booker" && bookerIsSolo) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="text-white" disabled={isCancelling}>
            {isCancelling ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <Trash2 className="mr-1 h-4 w-4" />
                Cancel
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              The tee time slot will be released back to the schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCancel()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancelling}
            >
              Cancel Reservation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  if (role === "invited") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isRemoving}>
            {isRemoving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <LogOut className="mr-1 h-4 w-4" />
                Remove Myself
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove yourself from this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The seat will be released back to the tee time. The booker keeps the reservation for the rest of the group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRemoveSelf()
              }}
              disabled={isRemoving}
            >
              Remove Me
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  // Booker in a group: two buttons, remove-self (transfers) and cancel (whole thing).
  return (
    <div className="flex flex-col gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isRemoving || isCancelling}>
            {isRemoving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <LogOut className="mr-1 h-4 w-4" />
                Remove Myself
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove yourself from this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Your seat will be released and the booking will be transferred to the first other league player in the group. If there's no other league player to take over, you'll need to cancel instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRemoveSelf()
              }}
              disabled={isRemoving}
            >
              Remove Me
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="text-white" disabled={isCancelling || isRemoving}>
            {isCancelling ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <Trash2 className="mr-1 h-4 w-4" />
                Cancel Reservation
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel the whole reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels the booking for everyone in the group, including your invited players. The tee time slots will be released.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCancel()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancelling}
            >
              Cancel for Everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
