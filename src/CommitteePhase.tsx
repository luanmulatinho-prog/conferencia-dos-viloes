import { useState } from 'react'
import {
  committeeRecipients,
  applyCommitteeDistribution,
  freezeCommittee,
  type GameState,
} from './game'

type Props = {
  game: GameState
  onExit: () => void
  onNext: (game: GameState) => void
}

type Phase = 'propose' | 'response' | 'result'

export default function CommitteePhase({ game, onExit, onNext }: Props) {
  const n = game.players.length

  // Rodadas ímpares: o Membro Eleito propõe.
  // Rodadas pares: o Membro Indicado propõe.
  const proposerIndex = game.round % 2 === 1 ? game.elected : game.appointed
  const responderIndex = game.round % 2 === 1 ? game.appointed : game.elected
  const proposer = game.players[proposerIndex]
  const responder = game.players[responderIndex]

  const recipients = committeeRecipients(game)

  const [proposal, setProposal] = useState<number[]>(() =>
    Array(n).fill(0)
  )
  const [phase, setPhase] = useState<Phase>('propose')
  const [result, setResult] = useState<{
    game: GameState
    agreed: boolean
  } | null>(null)

  const total = proposal.reduce((a, b) => a + b, 0)
  const available = game.committeeInfluence - total

  function change(index: number, delta: number) {
    if (delta > 0 && available <= 0) return
    if (proposal[index] + delta < 0) return

    const next = [...proposal]
    next[index] += delta
    setProposal(next)
  }

  function agree() {
    setResult({
      game: applyCommitteeDistribution(game, proposal),
      agreed: true,
    })
    setPhase('result')
  }

  function noDeal() {
    setResult({ game: freezeCommittee(game), agreed: false })
    setPhase('result')
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as const

  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby">
        <header className="lobby-title">
          <div className="eyebrow">
            RODADA {game.round} — FASE DO COMITÊ
          </div>
          <h1>Influência do Comitê: {game.committeeInfluence}</h1>
          <p>
            {proposer.name} propõe · {responder.name} responde
          </p>
        </header>

        {phase === 'propose' && (
          <>
            <section className="players-card">
              <span className="section-label">
                PROPOSTA DE {proposer.name.toUpperCase()}
              </span>

              <div className="players-list">
                {game.players.map((p, i) => (
                  <div className="player" key={p.id}>
                    <div className="avatar">{p.name.charAt(0)}</div>
                    <div className="player-name">
                      <strong>{p.name}</strong>
                      {i === game.soberanoIndex && <span>SOBERANO</span>}
                      {i === game.elected && <span>MEMBRO ELEITO</span>}
                      {i === game.appointed && <span>MEMBRO INDICADO</span>}
                    </div>

                    {recipients.includes(i) ? (
                      <div style={rowStyle}>
                        <button
                          className="copy-button"
                          onClick={() => change(i, -1)}
                        >
                          −
                        </button>
                        <strong style={{ minWidth: 22, textAlign: 'center' }}>
                          {proposal[i]}
                        </strong>
                        <button
                          className="copy-button"
                          onClick={() => change(i, 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="player-crown">—</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="waiting">
                <span>DISPONÍVEL</span>
                <p>
                  <strong>{available}</strong> de {game.committeeInfluence}.
                  Para haver distribuição, toda a Influência deve ser
                  distribuída.
                </p>
              </div>
            </section>

            <section className="lobby-actions">
              <button
                className="primary-button"
                disabled={available !== 0}
                onClick={() => setPhase('response')}
              >
                ENVIAR PROPOSTA
              </button>
            </section>
          </>
        )}

        {phase === 'response' && (
          <section className="home-card">
            <div className="room-label">
              {responder.name}, você aceita a proposta?
            </div>

            <div className="players-list">
              {game.players.map(
                (p, i) =>
                  proposal[i] > 0 && (
                    <div className="player" key={p.id}>
                      <div className="player-name">
                        <strong>{p.name}</strong>
                      </div>
                      <span className="player-crown">+{proposal[i]}</span>
                    </div>
                  )
              )}
            </div>

            <button className="primary-button" onClick={agree}>
              REALIZAR DISTRIBUIÇÃO
            </button>
            <button className="secondary-button" onClick={noDeal}>
              NÃO HÁ ACORDO
            </button>
          </section>
        )}

        {phase === 'result' && result && (
          <>
            <section className="home-card">
              <div className="room-label">RESULTADO</div>

              {result.agreed ? (
                <>
                  <h2 className="preparation-title" style={{ fontSize: 22 }}>
                    Distribuição realizada
                  </h2>
                  <div className="players-list">
                    {game.players.map(
                      (p, i) =>
                        proposal[i] > 0 && (
                          <div className="player" key={p.id}>
                            <div className="player-name">
                              <strong>{p.name}</strong>
                            </div>
                            <span className="player-crown">
                              +{proposal[i]}
                            </span>
                          </div>
                        )
                    )}
                  </div>
                </>
              ) : (
                <h2 className="preparation-title" style={{ fontSize: 22 }}>
                  Influências congeladas até a próxima rodada
                </h2>
              )}

              <p className="preparation-text">
                Influência do Comitê agora:{' '}
                <strong>{result.game.committeeInfluence}</strong>
              </p>
            </section>

            <section className="players-card">
              <span className="section-label">
                MODO DE TESTE: saldos secretos visíveis
              </span>
              <div className="players-list">
                {result.game.players.map((p) => (
                  <div className="player" key={p.id}>
                    <div className="player-name">
                      <strong>{p.name}</strong>
                      <span>
                        {result.game.committeeRounds[p.id]} rodada(s) no
                        Comitê
                      </span>
                    </div>
                    <span className="player-crown">{p.influence}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="lobby-actions">
              <button
                className="primary-button"
                onClick={() => onNext(result.game)}
              >
                CONTINUAR: SELEÇÃO DOS TURNOS
              </button>
              <button className="secondary-button" onClick={onExit}>
                VOLTAR AO INÍCIO
              </button>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
