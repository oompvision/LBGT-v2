import type { PlayoffMatch, PlayoffSeed } from "@/types/supabase"
import { isByeMatch, slotLabel, groupIntoPairs } from "@/lib/playoff-bracket-utils"

interface Props {
  matches: PlayoffMatch[]
  seeds: PlayoffSeed[]
}

function withSeed(label: string, playerId: string | null, seedMap: Map<string, number>): string {
  const seedNumber = playerId ? seedMap.get(playerId) : undefined
  return seedNumber !== undefined ? `${seedNumber} ${label}` : label
}

function matchLine(match: PlayoffMatch, allMatches: PlayoffMatch[], seedMap: Map<string, number>): string {
  const bye = isByeMatch(match)
  const p1 = withSeed(slotLabel(match, 1, allMatches, seedMap), match.player1_id, seedMap)
  if (bye) return `${p1} — Bye`
  const p2 = withSeed(slotLabel(match, 2, allMatches, seedMap), match.player2_id, seedMap)
  if (match.winner_player_num === 1) return `${p1} def. ${p2}${match.score ? ` ${match.score}` : ""}`
  if (match.winner_player_num === 2) return `${p2} def. ${p1}${match.score ? ` ${match.score}` : ""}`
  return `${p1} vs ${p2}`
}

function groupByRound(matches: PlayoffMatch[]) {
  const rounds = new Map<number, PlayoffMatch[]>()
  for (const m of matches) {
    const list = rounds.get(m.round_number) || []
    list.push(m)
    rounds.set(m.round_number, list)
  }
  return Array.from(rounds.entries()).sort((a, b) => a[0] - b[0])
}

export function PlayoffBracketMobile({ matches, seeds }: Props) {
  if (matches.length === 0) return null

  const seedMap = new Map(seeds.map((s) => [s.player_id, s.seed_number]))

  return (
    <div className="space-y-6">
      {groupByRound(matches).map(([roundNumber, roundMatches]) => (
        <div key={roundNumber} className="space-y-2">
          <h3 className="font-semibold">{roundMatches[0].round_label}</h3>
          <div className="space-y-3">
            {groupIntoPairs(roundMatches.sort((a, b) => a.sort_order - b.sort_order)).map((pair, i) => (
              <div
                key={i}
                className={
                  pair.length === 2
                    ? "relative space-y-1.5 pr-6 after:absolute after:bottom-2 after:right-1.5 after:top-2 after:w-2.5 after:rounded-r-md after:border-2 after:border-l-0 after:border-muted-foreground/40 after:content-['']"
                    : "space-y-1.5"
                }
              >
                {pair.map((m) => (
                  <div key={m.id} className="rounded-md border px-3 py-2 text-sm">
                    {matchLine(m, matches, seedMap)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
