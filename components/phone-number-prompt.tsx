"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Phone, Flag } from "lucide-react"
import { formatPhone, stripPhone, isValidPhone } from "@/lib/phone"
import {
  formatHandicapInput,
  parseHandicap,
  isValidHandicap,
  MIN_HANDICAP,
  MAX_HANDICAP,
} from "@/lib/handicap"
import { updateUserProfile } from "@/app/actions/auth"

const MODAL_DISMISSED_KEY = "profile-prompt-dismissed"

export function PhoneNumberPrompt() {
  const { user, isLoading } = useAuth()
  const [hasPhone, setHasPhone] = useState<boolean | null>(null)
  const [hasHandicap, setHasHandicap] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [phone, setPhone] = useState("")
  const [handicap, setHandicap] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [phoneError, setPhoneError] = useState("")
  const [handicapError, setHandicapError] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (!user || isLoading) return

    const checkProfile = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single()

      // If we can't read the profile, don't risk prompting incorrectly.
      if (error || !data) return

      const phoneSet = !!data.phone_number
      // `handicap` column may not exist yet if the migration hasn't been run —
      // treat undefined the same as null (unset) but never let it claim phone
      // is missing.
      const handicapSet = data.handicap !== null && data.handicap !== undefined

      setHasPhone(phoneSet)
      setHasHandicap(handicapSet)

      // Show modal once per session if either field is missing
      if ((!phoneSet || !handicapSet) && !sessionStorage.getItem(MODAL_DISMISSED_KEY)) {
        setShowModal(true)
      }
    }

    checkProfile()
  }, [user, isLoading])

  const handleSave = async () => {
    setPhoneError("")
    setHandicapError("")

    const payload: { phone_number?: string | null; handicap?: number | null } = {}

    if (!hasPhone) {
      const digits = stripPhone(phone)
      if (!isValidPhone(digits)) {
        setPhoneError("Please enter a valid 10-digit US phone number.")
        return
      }
      payload.phone_number = digits
    }

    if (!hasHandicap) {
      const parsed = parseHandicap(handicap)
      if (parsed === null || !isValidHandicap(parsed)) {
        setHandicapError(`Please enter a handicap between ${MIN_HANDICAP} and ${MAX_HANDICAP}.`)
        return
      }
      payload.handicap = parsed
    }

    setIsSaving(true)

    const result = await updateUserProfile(payload)

    if (result.success) {
      if (payload.phone_number !== undefined) setHasPhone(true)
      if (payload.handicap !== undefined) setHasHandicap(true)
      setShowModal(false)
      router.refresh()
    } else {
      setPhoneError(result.error || "Failed to save your profile.")
    }

    setIsSaving(false)
  }

  const dismissModal = () => {
    sessionStorage.setItem(MODAL_DISMISSED_KEY, "1")
    setShowModal(false)
  }

  // Don't show anything if loading, not logged in, or both fields are set
  if (isLoading || !user || hasPhone === null || hasHandicap === null) return null
  if (hasPhone && hasHandicap) return null

  const bannerMessage =
    !hasPhone && !hasHandicap
      ? "Please add your phone number and handicap to complete your profile."
      : !hasPhone
        ? "Please add your phone number to streamline communication."
        : "Please add your handicap to complete your profile."

  return (
    <>
      {/* Persistent banner */}
      <div className="bg-primary text-primary-foreground">
        <div className="container flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            {!hasPhone ? <Phone className="h-4 w-4 shrink-0" /> : <Flag className="h-4 w-4 shrink-0" />}
            <span>{bannerMessage}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasPhone && (
              <Button size="sm" variant="secondary" onClick={() => setShowModal(true)}>
                Add Phone #
              </Button>
            )}
            {!hasHandicap && (
              <Button size="sm" variant="secondary" onClick={() => setShowModal(true)}>
                Add Handicap
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) dismissModal() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Profile</DialogTitle>
            <DialogDescription>
              {!hasPhone && !hasHandicap
                ? "Please add your phone number and handicap to finish setting up your profile."
                : !hasPhone
                  ? "Please add your phone number to streamline communication."
                  : "Please add your handicap to complete your profile."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!hasPhone && (
              <div className="space-y-2">
                <Label htmlFor="modal-phone">Phone Number</Label>
                <Input
                  id="modal-phone"
                  type="tel"
                  placeholder="(555) 123 - 4567"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value))
                    setPhoneError("")
                  }}
                />
                {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
              </div>
            )}
            {!hasHandicap && (
              <div className="space-y-2">
                <Label htmlFor="modal-handicap">Handicap</Label>
                <Input
                  id="modal-handicap"
                  type="text"
                  inputMode="decimal"
                  placeholder="12.5"
                  value={handicap}
                  onChange={(e) => {
                    setHandicap(formatHandicapInput(e.target.value))
                    setHandicapError("")
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your handicap index (e.g., 12.5). Range: {MIN_HANDICAP} to {MAX_HANDICAP}.
                </p>
                {handicapError && <p className="text-sm text-destructive">{handicapError}</p>}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={dismissModal} disabled={isSaving}>
              Later
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                (!hasPhone && !phone) ||
                (!hasHandicap && !handicap)
              }
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
