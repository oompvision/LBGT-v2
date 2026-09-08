import type { PlayoffMatch } from "@/types/supabase"

interface Props {
  matches: PlayoffMatch[]
}

// Byes only ever occur in round 1 (a seed with no possible opponent); every
// later round eventually gets both players, even if one arrives immediately
// via a bye cascade at generation time.
function isByeMatch(match: PlayoffMatch): boolean {
  return match.round_number === 1 && !!match.player1_id && !match.player2_id
}

function MatchBox({ match }: { match: PlayoffMatch }) {
  const bye = isByeMatch(match)
  const p1Name = match.player1_name || "TBD"
  const p2Name = bye ? "Bye" : match.player2_name || "TBD"
  const p1Won = match.winner_player_num === 1
  const p2Won = match.winner_player_num === 2

  return (
    <div className="pbt-box">
      <div className={`pbt-slot ${p2Won ? "pbt-slot-loser" : p1Won ? "pbt-slot-winner" : ""}`}>
        <span className="pbt-name">{p1Name}</span>
        {p1Won && match.score && <span className="pbt-score">{match.score}</span>}
      </div>
      <div className={`pbt-slot pbt-slot-last ${p1Won ? "pbt-slot-loser" : p2Won ? "pbt-slot-winner" : ""}`}>
        <span className="pbt-name">{p2Name}</span>
        {p2Won && match.score && <span className="pbt-score">{match.score}</span>}
      </div>
    </div>
  )
}

function BracketNode({ match, matches, side }: { match: PlayoffMatch; matches: PlayoffMatch[]; side: "left" | "right" }) {
  const feeders = matches
    .filter((m) => m.next_match_id === match.id)
    .sort((a, b) => (a.next_match_slot || 0) - (b.next_match_slot || 0))

  if (feeders.length === 0) {
    return <MatchBox match={match} />
  }

  return (
    <div className={`pbt-node pbt-node-${side}`}>
      <div className="pbt-feeders">
        {feeders.map((feeder) => (
          <BracketNode key={feeder.id} match={feeder} matches={matches} side={side} />
        ))}
      </div>
      <div className="pbt-connector" />
      <MatchBox match={match} />
    </div>
  )
}

export function PlayoffBracketTree({ matches }: Props) {
  if (matches.length === 0) return null

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
        .pbt-box { border: 2px solid #3A5A40; background: white; width: 170px; flex-shrink: 0; font-size: 18px; }
        .pbt-slot { padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #3A5A40; color: #3A5A40; }
        .pbt-slot-last { border-bottom: none; }
        .pbt-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pbt-slot-winner { font-weight: 700; }
        .pbt-slot-loser { color: #9ca3af; font-weight: 400; }
        .pbt-score { flex-shrink: 0; background: #3A5A40; color: white; border-radius: 4px; padding: 0 6px; font-size: 16px; }
        .pbt-node { display: flex; align-items: center; }
        .pbt-node-right { flex-direction: row-reverse; }
        .pbt-feeders { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .pbt-feeders::after { content: ''; position: absolute; top: 0; bottom: 0; width: 2px; background: #3A5A40; }
        .pbt-node-left > .pbt-feeders::after { right: -24px; }
        .pbt-node-right > .pbt-feeders::after { left: -24px; }
        .pbt-connector { width: 24px; height: 2px; background: #3A5A40; flex-shrink: 0; }
        .pbt-center { display: flex; flex-direction: column; align-items: center; padding: 0 32px; flex-shrink: 0; }
        .pbt-center-label { font-size: 16px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 1px; }
      `}</style>
      <div className="pbt-bracket">
        {feeders[0] && (
          <div className="pbt-node-left">
            <BracketNode match={feeders[0]} matches={matches} side="left" />
          </div>
        )}
        <div className="pbt-center">
          <span className="pbt-center-label">Championship</span>
          <MatchBox match={final} />
        </div>
        {feeders[1] && (
          <div className="pbt-node-right">
            <BracketNode match={feeders[1]} matches={matches} side="right" />
          </div>
        )}
        {feeders.length === 0 && (
          // Trivial 2-player bracket: the final IS round 1, already rendered as the center box.
          <></>
        )}
      </div>
    </div>
  )
}
