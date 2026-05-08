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
import { Phone, Flag, Trophy } from "lucide-react"
import { formatPhone, stripPhone, isValidPhone } from "@/lib/phone"
import {
  formatHandicapInput,
  parseHandicap,
  isValidHandicap,
  MIN_HANDICAP,
  MAX_HANDICAP,
} from "@/lib/handicap"
import { updateUserProfile } from "@/app/actions/auth"
import { setMyRingerOptIn } from "@/app/actions/ringer-pool"

const MODAL_DISMISSED_KEY = "profile-prompt-dismissed"

export function PhoneNumberPrompt() {
  const { user, isLoading } = useAuth()
  const [hasPhone, setHasPhone] = useState<boolean | null>(null)
  const [hasHandicap, setHasHandicap] = useState<boolean | null>(null)
  const [ringerDecided, setRingerDecided] = useState<boolean | null>(null)
  const [seasonYear, setSeasonYear] = useState<number | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showRingerModal, setShowRingerModal] = useState(false)
  const [phone, setPhone] = useState("")
  const [handicap, setHandicap] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingRinger, setIsSavingRinger] = useState(false)
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

      // Show the complete-your-profile modal once per session if either field
      // is missing.
      if ((!phoneSet || !handicapSet) && !sessionStorage.getItem(MODAL_DISMISSED_KEY)) {
        setShowProfileModal(true)
      }

      // Determine active season + ringer opt-in for that season.
      const { data: activeSeason } = await supabase
        .from("seasons")
        .select("year")
        .eq("is_active", true)
        .maybeSingle()

      const year = activeSeason?.year ?? null
      setSeasonYear(year)

      if (year === null) {
        setRingerDecided(true) // no active season → don't prompt
        return
      }

      const { data: optIn, error: optInError } = await supabase
        .from("ringer_pool_opt_ins")
        .select("opted_in")
        .eq("user_id", user.id)
        .eq("season_year", year)
        .maybeSingle()

      // If the table doesn't exist yet (migration not applied), treat as decided
      // so we don't break the page.
      if (optInError) {
        setRingerDecided(true)
        return
      }

      setRingerDecided(!!optIn)
    }

    checkProfile()
  }, [user, isLoading])

  const handleSaveProfile = async () => {
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
      setShowProfileModal(false)
      router.refresh()
    } else {
      setPhoneError(result.error || "Failed to save your profile.")
    }

    setIsSaving(false)
  }

  const handleRingerDecision = async (optedIn: boolean) => {
    setIsSavingRinger(true)
    const result = await setMyRingerOptIn(optedIn)
    setIsSavingRinger(false)

    if (result.success) {
      setRingerDecided(true)
      setShowRingerModal(false)
      router.refresh()
    }
  }

  const dismissProfileModal = () => {
    sessionStorage.setItem(MODAL_DISMISSED_KEY, "1")
    setShowProfileModal(false)
  }

  // Don't show anything until everything has loaded.
  if (isLoading || !user || hasPhone === null || hasHandicap === null || ringerDecided === null) {
    return null
  }
  // Hide entirely if there's nothing to prompt for.
  if (hasPhone && hasHandicap && ringerDecided) return null

  const bannerSegments: string[] = []
  if (!hasPhone) bannerSegments.push("phone number")
  if (!hasHandicap) bannerSegments.push("handicap")
  if (!ringerDecided) bannerSegments.push("Net Ringer Pool selection")

  const bannerMessage =
    bannerSegments.length > 0
      ? `Please add your ${bannerSegments.join(" and ")} to complete your profile.`
      : ""

  const BannerIcon = !hasPhone ? Phone : !hasHandicap ? Flag : Trophy

  return (
    <>
      {/* Persistent banner */}
      <div className="bg-primary text-primary-foreground">
        <div className="container flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <BannerIcon className="h-4 w-4 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasPhone && (
              <Button size="sm" variant="secondary" onClick={() => setShowProfileModal(true)}>
                Add Phone #
              </Button>
            )}
            {!hasHandicap && (
              <Button size="sm" variant="secondary" onClick={() => setShowProfileModal(true)}>
                Add Handicap
              </Button>
            )}
            {!ringerDecided && (
              <Button size="sm" variant="secondary" onClick={() => setShowRingerModal(true)}>
                Ringer Pool Opt In
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Profile completion modal */}
      <Dialog open={showProfileModal} onOpenChange={(open) => { if (!open) dismissProfileModal() }}>
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
            <Button variant="ghost" onClick={dismissProfileModal} disabled={isSaving}>
              Later
            </Button>
            <Button
              onClick={handleSaveProfile}
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

      {/* Ringer pool opt-in modal */}
      <Dialog open={showRingerModal} onOpenChange={(open) => { if (!open) setShowRingerModal(false) }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Net Ringer Pool{seasonYear ? ` — ${seasonYear} Season` : ""}
            </DialogTitle>
            <DialogDescription>
              Build a season-long composite scorecard from your best net score on each
              hole across every round you play. i.e. if you par a stroke hole, it&apos;s
              logged as a birdie. Lowest composite wins.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/50 p-3 space-y-1">
              <p>
                <span className="font-medium">Entry:</span> $50 per player
              </p>
              <p>
                <span className="font-medium">Prize:</span> Winner takes all
              </p>
            </div>
            <p>
              To opt in, Zelle <span className="font-semibold">$50</span> to{" "}
              <span className="font-semibold break-all">anthony@longbeachgolftour.com</span>{" "}
              and tap <span className="font-semibold">Opt In</span> below to confirm.
            </p>
            <p className="text-xs text-muted-foreground">
              Not interested this season? Tap Decline and we won&apos;t prompt you again.
              You can change your mind any time from your profile.
            </p>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleRingerDecision(false)}
              disabled={isSavingRinger}
              className="w-full sm:w-auto"
            >
              {isSavingRinger ? "Saving..." : "Decline"}
            </Button>
            <Button
              onClick={() => handleRingerDecision(true)}
              disabled={isSavingRinger}
              className="w-full sm:w-auto"
            >
              {isSavingRinger ? "Saving..." : "Opt In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
