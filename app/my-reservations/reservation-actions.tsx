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
import { Loader2, LogOut, Pencil, Trash2 } from "lucide-react"
import {
  cancelReservationAsBooker,
  removePlayerFromReservation,
} from "@/app/actions/reservation-players"
import {
  EditReservationDialog,
  type EditReservationData,
} from "@/components/edit-reservation-dialog"
import { isBeforeBookingClose, isBeforeCutoff } from "@/lib/booking-summary"

const OPT_IN_BUFFER_MINUTES = 60

interface ReservationActionsProps {
  reservationId: string
  role: "booker" | "invited"
  bookerIsSolo?: boolean
  viewerUserId: string
  editData: EditReservationData
  cashGameTitle: string | null
}

export function ReservationActions({
  reservationId,
  role,
  bookerIsSolo,
  viewerUserId,
  editData,
  cashGameTitle,
}: ReservationActionsProps) {
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const bookingOpen = isBeforeBookingClose(editData.bookingClosesAt)
  const optInOpen = isBeforeCutoff(editData.teeTimeDate, editData.teeTimeTime, OPT_IN_BUFFER_MINUTES)
  const canEdit = bookingOpen || optInOpen

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

  const editButton = canEdit ? (
    <Button
      variant="outline"
      className="w-full sm:w-auto"
      onClick={() => setEditOpen(true)}
    >
      <Pencil className="mr-2 h-4 w-4" />
      {role === "booker" ? "Edit Reservation" : "Edit My Reservation"}
    </Button>
  ) : null

  const editDialog = (
    <EditReservationDialog
      open={editOpen}
      onOpenChange={setEditOpen}
      role={role}
      viewerUserId={viewerUserId}
      reservation={editData}
      cashGameTitle={cashGameTitle}
    />
  )

  // Invited player: a single CTA replaces the old Remove Myself button.
  if (role === "invited") {
    if (!canEdit) return null
    return (
      <>
        <div className="flex flex-col sm:flex-row gap-2">{editButton}</div>
        {editDialog}
      </>
    )
  }

  // Booker, solo: Edit + Cancel.
  if (role === "booker" && bookerIsSolo) {
    return (
      <>
        <div className="flex flex-col sm:flex-row gap-2">
          {editButton}
          {bookingOpen && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto text-white"
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cancel Reservation
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
          )}
        </div>
        {editDialog}
      </>
    )
  }

  // Booker with other players: Edit + Remove Myself + Cancel.
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        {editButton}
        {bookingOpen && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto" disabled={isRemoving || isCancelling}>
                {isRemoving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
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
        )}

        {bookingOpen && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto text-white" disabled={isCancelling || isRemoving}>
                {isCancelling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
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
        )}
      </div>
      {editDialog}
    </>
  )
}
