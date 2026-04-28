"use client"

import { useEffect, useMemo, useState } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Search, X } from "lucide-react"
import {
  searchLeagueUsers,
  type LeagueUserSummary,
} from "@/app/actions/reservation-players"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  excludeUserIds: string[]
  maxSelectable: number
  onConfirm: (users: LeagueUserSummary[]) => void
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isMobile
}

function PickerBody({
  query,
  setQuery,
  members,
  loading,
  selected,
  toggle,
  maxSelectable,
  onConfirm,
  onCancel,
}: {
  query: string
  setQuery: (v: string) => void
  members: LeagueUserSummary[]
  loading: boolean
  selected: Map<string, LeagueUserSummary>
  toggle: (u: LeagueUserSummary) => void
  maxSelectable: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    )
  }, [members, query])

  const count = selected.size
  const atMax = count >= maxSelectable

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Players..."
            className="pl-9"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {count} of {maxSelectable} slot{maxSelectable === 1 ? "" : "s"} selected
        </p>
      </div>

      <div className="flex-1 overflow-y-auto -mx-4 px-4 border-y">
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {query ? "No matching members" : "No members available"}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((m) => {
              const isSelected = selected.has(m.id)
              const isDisabled = !isSelected && atMax
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    className={
                      "w-full text-left flex items-center gap-3 py-3 transition-colors " +
                      (isSelected
                        ? "bg-accent/60"
                        : isDisabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-accent/40")
                    }
                    onClick={() => toggle(m)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      className="pointer-events-none"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 pt-3 flex flex-wrap items-center justify-end gap-2">
        {count > 0 && (
          <ul className="flex flex-wrap gap-1.5 mr-auto">
            {Array.from(selected.values()).map((u) => (
              <li
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground pl-2 pr-1 py-0.5 text-xs"
              >
                <span className="max-w-[140px] truncate">{u.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(u)}
                  aria-label={`Remove ${u.name}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} className="text-white" disabled={count === 0}>
          {count > 0 ? `Add ${count} player${count === 1 ? "" : "s"}` : "Done"}
        </Button>
      </div>
    </div>
  )
}

export function PlayerPicker({
  open,
  onOpenChange,
  excludeUserIds,
  maxSelectable,
  onConfirm,
}: Props) {
  const isMobile = useIsMobile()
  const [members, setMembers] = useState<LeagueUserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Map<string, LeagueUserSummary>>(new Map())
  const excludeKey = excludeUserIds.join(",")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setQuery("")
    setSelected(new Map())
    searchLeagueUsers("", excludeUserIds).then((res) => {
      if (cancelled) return
      if (res.success && res.users) setMembers(res.users)
      else setMembers([])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, excludeKey])

  const toggle = (u: LeagueUserSummary) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(u.id)) {
        next.delete(u.id)
      } else if (next.size < maxSelectable) {
        next.set(u.id, u)
      }
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selected.values()))
    onOpenChange(false)
  }

  const handleCancel = () => onOpenChange(false)

  const body = (
    <PickerBody
      query={query}
      setQuery={setQuery}
      members={members}
      loading={loading}
      selected={selected}
      toggle={toggle}
      maxSelectable={maxSelectable}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  // Don't autofocus the search input — users land on the list, keyboard stays closed.
  const preventAutoFocus = (e: Event) => e.preventDefault()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[85dvh] flex flex-col p-4"
          onOpenAutoFocus={preventAutoFocus}
        >
          <SheetTitle className="shrink-0 text-base font-semibold pr-8 mb-2">
            Add Players
          </SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-4 max-h-[80vh] flex flex-col"
        onOpenAutoFocus={preventAutoFocus}
      >
        <DialogTitle className="shrink-0 text-base font-semibold pr-8 mb-2">
          Add Players
        </DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  )
}
