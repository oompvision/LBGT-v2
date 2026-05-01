"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Calendar, Clock, UserRound, Copy, Check } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ZELLE_PAYMENT_EMAIL, BASE_TEE_TIME_COST } from "@/lib/constants"
import { formatTimeOfDay, type BookingPlayerSummary } from "@/lib/booking-summary"
import { formatPhone } from "@/lib/phone"

type Props = {
  open: boolean
  date: string
  time: string
  cashGameTitle: string | null
  players: BookingPlayerSummary[]
  onDismiss: () => void
}

function formatLongDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "EEEE, MMMM d, yyyy")
  } catch {
    return dateStr
  }
}

export function BookingConfirmationModal({
  open,
  date,
  time,
  cashGameTitle,
  players,
  onDismiss,
}: Props) {
  const booker = players.find((p) => p.isBooker)
  const bookerOwe = booker?.owe ?? BASE_TEE_TIME_COST
  const [copied, setCopied] = useState(false)

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(ZELLE_PAYMENT_EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("Copy failed:", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="sm:max-w-lg bg-white text-slate-900 p-0 gap-0 max-h-[90dvh] flex flex-col">
        <div className="shrink-0 flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold text-slate-900">Tee time booked</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              You&rsquo;re all set. Here are the details.
            </DialogDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="font-semibold">{formatLongDate(date)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-slate-700">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>{formatTimeOfDay(time)} EST</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Cost per player
            </p>
            <ul className="space-y-2">
              {players.map((p) => {
                const breakdown =
                  p.optedIn && cashGameTitle && p.entryAmount > 0
                    ? `$${BASE_TEE_TIME_COST} green fee + $${p.entryAmount} ${cashGameTitle} entry`
                    : `$${BASE_TEE_TIME_COST} green fee`
                const isBooker = p.isBooker
                return (
                  <li
                    key={p.index}
                    className={
                      "rounded-md border p-3 " +
                      (isBooker
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-200 bg-white")
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={
                            "flex h-8 w-8 items-center justify-center rounded-full shrink-0 " +
                            (isBooker ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-600")
                          }
                        >
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 truncate">{p.name}</p>
                            {isBooker && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          {p.guestPhone && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatPhone(p.guestPhone)}
                            </p>
                          )}
                          <p className="text-xs text-slate-600 mt-0.5">{breakdown}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-slate-900 whitespace-nowrap">
                        ${p.owe}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              Payment
            </p>
            <p className="text-sm text-slate-900">
              Please Zelle <span className="font-semibold">${bookerOwe}</span> to:
            </p>
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-400 bg-white px-3 py-2 max-w-full">
              <span className="font-mono text-sm font-semibold text-slate-900 break-all">
                {ZELLE_PAYMENT_EMAIL}
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                aria-label={copied ? "Email address copied" : "Copy email address"}
                aria-live="polite"
                className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-sm text-slate-700">
              Thank you in advance for making prompt payment and streamlining LBGT operations.
            </p>
            {cashGameTitle && booker?.optedIn && (
              <p className="text-sm font-semibold text-red-700">
                If cash game entry is not received before your tee time you will not be entered.
              </p>
            )}
            {cashGameTitle && booker && !booker.optedIn && (
              <p className="text-sm text-slate-700">
                You are not currently opted into the cash game.
              </p>
            )}
            <p className="text-sm text-slate-700">
              Then text your playing partners to Zelle for their tee time.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50 sm:justify-end">
          <Button onClick={onDismiss} className="text-white">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
