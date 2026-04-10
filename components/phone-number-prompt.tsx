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
import { Phone, X } from "lucide-react"
import { formatPhone, stripPhone, isValidPhone } from "@/lib/phone"
import { updateUserProfile } from "@/app/actions/auth"

const MODAL_DISMISSED_KEY = "phone-prompt-dismissed"

export function PhoneNumberPrompt() {
  const { user, isLoading } = useAuth()
  const [hasPhone, setHasPhone] = useState<boolean | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [phone, setPhone] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (!user || isLoading) return

    const checkPhone = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("users")
        .select("phone_number")
        .eq("id", user.id)
        .single()

      if (data?.phone_number) {
        setHasPhone(true)
        return
      }

      setHasPhone(false)

      // Show modal once per session
      if (!sessionStorage.getItem(MODAL_DISMISSED_KEY)) {
        setShowModal(true)
      }
    }

    checkPhone()
  }, [user, isLoading])

  const handleSave = async () => {
    const digits = stripPhone(phone)
    if (!isValidPhone(digits)) {
      setError("Please enter a valid 10-digit US phone number.")
      return
    }

    setIsSaving(true)
    setError("")

    const result = await updateUserProfile({ name: "", phone_number: digits })

    if (result.success) {
      setHasPhone(true)
      setShowModal(false)
      router.refresh()
    } else {
      setError(result.error || "Failed to save phone number.")
    }

    setIsSaving(false)
  }

  const dismissModal = () => {
    sessionStorage.setItem(MODAL_DISMISSED_KEY, "1")
    setShowModal(false)
  }

  // Don't show anything if loading, not logged in, or phone is already set
  if (isLoading || !user || hasPhone === null || hasPhone) return null

  return (
    <>
      {/* Persistent banner */}
      <div className="bg-primary text-primary-foreground">
        <div className="container flex items-center justify-between gap-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" />
            <span>Please add your phone number to streamline communication.</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowModal(true)}
          >
            Add Phone #
          </Button>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) dismissModal() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Your Phone Number</DialogTitle>
            <DialogDescription>
              Please add your phone number to streamline communication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="modal-phone">Phone Number</Label>
              <Input
                id="modal-phone"
                type="tel"
                placeholder="(555) 123 - 4567"
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhone(e.target.value))
                  setError("")
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={dismissModal} disabled={isSaving}>
              Later
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !phone}>
              {isSaving ? "Saving..." : "Save Phone Number"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
