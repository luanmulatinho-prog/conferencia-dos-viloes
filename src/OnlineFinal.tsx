import type { MatchView, Send } from './onlineTypes'
import { Frame, nm } from './onlineUi'
import { objectiveInfo } from './objectives'

type Props = {
  view: MatchView
  error: string
  send: Send
  onLeave: () => void
}

export default function OnlineFinal({ view, error, onLeave }: Props) {
  const f = view.final!
  const winners = f.players.filter((p) => p.fulfilled)

  const partyName = (id: number | null) =>
    id === null ? 'nenhum' : (view.parties.find((p) => p.id === id)?.name ?? 'nenhum')

  const topParty =
    view.parties.length > 0
      ? Math.max(...view.parties.map((p) => p.influence))
      : null

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      plain
      eyebrow="FIM DA PARTIDA"
      title={
        winners.length > 0
          ? `Vencedor${winners.length > 1 ? 'es' : ''}: ${winners
              .map((w) => nm(view, w.index))
              .join(', ')}`
          : 'Nenhum vencedor'
      }
      sub={`${f.reasonText} Rodada final: ${view.round}.`}
    >
      <section className="players-card">
        <span className="section-label">OBJETIVOS REVELADOS</span>

        <div className="players-list">
          {f.players.map((p) => (
            <div className="player" key={p.index}>
              <div className="avatar">{p.fulfilled ? '✓' : '✗'}</div>
              <div className="player-name">
                <strong>
                  {nm(view, p.index)}
                  {p.index === view.you ? ' (você)' : ''}
                  {p.index === view.soberano ? ' ♛' : ''}
                </strong>
                <span>
                  {p.objective}: {p.fulfilled ? 'cumprido' : 'não cumprido'} ·{' '}
                  {p.influence} Influência
                </span>
                <span style={{ opacity: 0.8 }}>
                  {objectiveInfo(p.objective).goal}
                </span>
                <span>
                  Soberano: {p.sovereignRounds} rodada(s) · Comitê:{' '}
                  {p.committeeRounds} rodada(s) · Roubou: {p.stolen}
                </span>
                <span>Partido: {partyName(p.partyId)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {view.parties.length > 0 && (
        <section className="players-card" style={{ marginTop: 14 }}>
          <span className="section-label">PARTIDOS AO FINAL</span>
          <div className="players-list">
            {view.parties.map((p) => (
              <div className="player" key={p.id}>
                <div className="player-name">
                  <strong>
                    {p.name}
                    {p.influence === topParty ? ' ★ maior Influência Partidária' : ''}
                  </strong>
                  <span>
                    Líder: {nm(view, p.leaderId)} · Cofre: {p.influence}
                  </span>
                  <span>
                    Membros: {p.memberIds.map((i) => nm(view, i)).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Frame>
  )
}
