"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Season } from "@/app/actions/seasons"

interface SeasonSelectorProps {
  seasons: Season[]
  selectedSeason: number
  showLabel?: boolean
}

export function SeasonSelector({ seasons, selectedSeason, showLabel = true }: SeasonSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleSeasonChange = (newSeason: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("season", newSeason)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      {showLabel && <span className="text-sm font-medium">Season:</span>}
      <Select value={selectedSeason.toString()} onValueChange={handleSeasonChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((season) => (
            <SelectItem key={season.id} value={season.year.toString()}>
              {season.year} {season.is_active && "⭐"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
