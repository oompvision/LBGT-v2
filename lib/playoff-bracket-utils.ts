import type { PlayoffMatch } from "@/types/supabase"

// Byes only ever occur in round 1 (a seed with no possible opponent); every
// later round eventually gets both players, even if one arrives immediately
// via a bye cascade at generation time.
export function isByeMatch(match: PlayoffMatch): boolean {
  return match.round_number === 1 && !!match.player1_id && !match.player2_id
}

// The set of seed numbers who could still emerge as the winner of this match
// (or, if already decided, just the one seed who did). Recurses through
// whichever of the match's own feeders are themselves still undecided.
export function possibleSeeds(match: PlayoffMatch, allMatches: PlayoffMatch[], seedMap: Map<string, number>): number[] {
  const seedOf = (id: string | null) => (id ? seedMap.get(id) : undefined)

  if (match.winner_player_num === 1) {
    const s = seedOf(match.player1_id)
    return s !== undefined ? [s] : []
  }
  if (match.winner_player_num === 2) {
    const s = seedOf(match.player2_id)
    return s !== undefined ? [s] : []
  }

  const feeders = allMatches.filter((m) => m.next_match_id === match.id)
  if (feeders.length === 0) {
    const seeds: number[] = []
    const s1 = seedOf(match.player1_id)
    const s2 = seedOf(match.player2_id)
    if (s1 !== undefined) seeds.push(s1)
    if (s2 !== undefined) seeds.push(s2)
    return seeds
  }

  return feeders.flatMap((f) => possibleSeeds(f, allMatches, seedMap)).sort((a, b) => a - b)
}

// Display text for one slot of a match: the resolved player's name if known,
// otherwise the "possible seeds" of whichever match still needs to be played
// to fill it (e.g. "8/9"), so a not-yet-reached round shows who could still
// arrive there instead of a bare "TBD".
export function slotLabel(
  match: PlayoffMatch,
  slot: 1 | 2,
  allMatches: PlayoffMatch[],
  seedMap: Map<string, number>,
): string {
  const name = slot === 1 ? match.player1_name : match.player2_name
  if (name) return name

  const feeder = allMatches.find((m) => m.next_match_id === match.id && m.next_match_slot === slot)
  if (!feeder) return "TBD"

  const seeds = possibleSeeds(feeder, allMatches, seedMap)
  return seeds.length > 0 ? seeds.join("/") : "TBD"
}

export function groupIntoPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = []
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2))
  }
  return pairs
}
