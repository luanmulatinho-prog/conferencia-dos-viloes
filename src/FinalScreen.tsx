import type { GameState } from './game'
import { evaluateObjectives, reasonText, type EndReason } from './round'

type Props = {
  game: GameState
  reason: EndReason
  onExit: () => void
}

export default function FinalScreen({ game, reason, onExit }: Props) {
  const done = evaluateObjectives(game, reason)
  const winners = game.players.filter((p) => done[p.id])

  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby">
        <header className="lobby-title">
          <div className="eyebrow">FIM DA PARTIDA</div>
          <h1>
            {winners.length > 0
              ? `Vencedor${winners.length > 1 ? 'es' : ''}: ${winners
                  .map((p) => p.name)
                  .join(', ')}`
              : 'Nenhum vencedor'}
          </h1>
          <p>{reasonText(reason)}</p>
          <p>Rodada final: {game.round}</p>
        </header>

        <section className="players-card">
          <span className="section-label">RESULTADO DE CADA JOGADOR</span>

          <div className="players-list">
            {game.players.map((p) => (
              <div className="player" key={p.id}>
                <div className="avatar">{done[p.id] ? '✓' : '✗'}</div>
                <div className="player-name">
                  <strong>
                    {p.name}
                    {p.id === game.soberanoIndex ? ' ♛' : ''}
                  </strong>
                  <span>
                    {p.objective}:{' '}
                    {done[p.id] ? 'cumprido' : 'não cumprido'} ·{' '}
                    {p.influence} Influência
                  </span>
                  <span>
                    Soberano: {game.sovereignRounds[p.id]} rodada(s) ·
                    Comitê: {game.committeeRounds[p.id]} rodada(s) ·
                    Roubou: {game.stolen[p.id]}
                  </span>
                  <span>
                    Partido:{' '}
                    {game.parties.find((pt) => pt.memberIds.includes(p.id))
                      ?.name ?? 'nenhum'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {game.parties.length > 0 && (
          <section className="players-card">
            <span className="section-label">PARTIDOS AO FINAL</span>
            <div className="players-list">
              {game.parties.map((pt) => (
                <div className="player" key={pt.id}>
                  <div className="player-name">
                    <strong>{pt.name}</strong>
                    <span>
                      Líder: {game.players[pt.leaderId]?.name ?? '—'} ·
                      Cofre: {pt.influence} ·{' '}
                      {pt.memberIds.map((i) => game.players[i].name).join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="lobby-actions">
          <button className="secondary-button" onClick={onExit}>
            VOLTAR AO INÍCIO
          </button>
        </section>
      </section>
    </main>
  )
}
