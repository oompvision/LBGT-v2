import type { PlayoffMatch, PlayoffSeed } from "@/types/supabase"
import { isByeMatch, slotLabel } from "@/lib/playoff-bracket-utils"

interface Props {
  matches: PlayoffMatch[]
  seeds: PlayoffSeed[]
}

type SeedMap = Map<string, number>

function NameWithSeed({ name, playerId, seedMap }: { name: string; playerId: string | null; seedMap: SeedMap }) {
  const seedNumber = playerId ? seedMap.get(playerId) : undefined
  return (
    <span className="pbt-name-wrap">
      {seedNumber !== undefined && <span className="pbt-seed">{seedNumber}</span>}
      <span className="pbt-name">{name}</span>
    </span>
  )
}

function MatchBox({ match, allMatches, seedMap }: { match: PlayoffMatch; allMatches: PlayoffMatch[]; seedMap: SeedMap }) {
  const bye = isByeMatch(match)
  const p1Name = slotLabel(match, 1, allMatches, seedMap)
  const p2Name = bye ? "Bye" : slotLabel(match, 2, allMatches, seedMap)
  const p1Won = match.winner_player_num === 1
  const p2Won = match.winner_player_num === 2

  return (
    <div className="pbt-box">
      <div className={`pbt-slot ${p2Won ? "pbt-slot-loser" : p1Won ? "pbt-slot-winner" : ""}`}>
        <NameWithSeed name={p1Name} playerId={match.player1_id} seedMap={seedMap} />
        {p1Won && match.score && <span className="pbt-score">{match.score}</span>}
      </div>
      <div className={`pbt-slot pbt-slot-last ${p1Won ? "pbt-slot-loser" : p2Won ? "pbt-slot-winner" : ""}`}>
        <NameWithSeed name={p2Name} playerId={bye ? null : match.player2_id} seedMap={seedMap} />
        {p2Won && match.score && <span className="pbt-score">{match.score}</span>}
      </div>
    </div>
  )
}

function BracketNode({
  match,
  matches,
  seedMap,
  side,
}: {
  match: PlayoffMatch
  matches: PlayoffMatch[]
  seedMap: SeedMap
  side: "left" | "right"
}) {
  const feeders = matches
    .filter((m) => m.next_match_id === match.id)
    .sort((a, b) => (a.next_match_slot || 0) - (b.next_match_slot || 0))

  if (feeders.length === 0) {
    return <MatchBox match={match} allMatches={matches} seedMap={seedMap} />
  }

  return (
    <div className={`pbt-node pbt-node-${side}`}>
      <div className="pbt-feeders">
        {feeders.map((feeder) => (
          <BracketNode key={feeder.id} match={feeder} matches={matches} seedMap={seedMap} side={side} />
        ))}
      </div>
      <div className="pbt-connector" />
      <MatchBox match={match} allMatches={matches} seedMap={seedMap} />
    </div>
  )
}

export function PlayoffBracketTree({ matches, seeds }: Props) {
  if (matches.length === 0) return null

  const seedMap: SeedMap = new Map(seeds.map((s) => [s.player_id, s.seed_number]))

  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const final = matches.find((m) => m.round_number === totalRounds)
  if (!final) return null

  const feeders = matches
    .filter((m) => m.next_match_id === final.id)
    .sort((a, b) => (a.next_match_slot || 0) - (b.next_match_slot || 0))

  return (
    <div className="pbt-scroll">
      <style>{`
        .pbt-scroll { overflow-x: auto; padding: 8px 4px 24px; }
        .pbt-bracket { display: flex; align-items: center; justify-content: center; width: max-content; margin: 0 auto; }
        .pbt-box { border: 2px solid #3A5A40; background: white; width: 220px; flex-shrink: 0; font-size: 13px; }
        .pbt-slot { padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #3A5A40; color: #3A5A40; }
        .pbt-slot-last { border-bottom: none; }
        .pbt-name-wrap { display: flex; align-items: center; gap: 5px; min-width: 0; flex: 1; }
        .pbt-seed { flex-shrink: 0; color: #9ca3af; font-weight: 400; font-size: 0.85em; }
        .pbt-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
        .pbt-slot-winner { font-weight: 700; }
        .pbt-slot-loser { color: #9ca3af; font-weight: 400; }
        .pbt-score { flex-shrink: 0; background: #3A5A40; color: white; border-radius: 4px; padding: 0 6px; font-size: 11px; }
        .pbt-node { display: flex; align-items: center; }
        .pbt-node-right { flex-direction: row-reverse; }
        .pbt-feeders { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .pbt-feeders::after { content: ''; position: absolute; top: 0; bottom: 0; width: 2px; background: #3A5A40; }
        .pbt-node-left > .pbt-feeders::after { right: -24px; }
        .pbt-node-right > .pbt-feeders::after { left: -24px; }
        .pbt-connector { width: 24px; height: 2px; background: #3A5A40; flex-shrink: 0; }
        .pbt-center { display: flex; flex-direction: column; align-items: center; padding: 0 32px; flex-shrink: 0; }
        .pbt-center-label { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 1px; }
      `}</style>
      <div className="pbt-bracket">
        {feeders[0] && (
          <div className="pbt-node-left">
            <BracketNode match={feeders[0]} matches={matches} seedMap={seedMap} side="left" />
          </div>
        )}
        <div className="pbt-center">
          <span className="pbt-center-label">Championship</span>
          <MatchBox match={final} allMatches={matches} seedMap={seedMap} />
        </div>
        {feeders[1] && (
          <div className="pbt-node-right">
            <BracketNode match={feeders[1]} matches={matches} seedMap={seedMap} side="right" />
          </div>
        )}
      </div>
    </div>
  )
}
