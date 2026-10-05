import { useState } from 'react'
import { completeSovereignDistribution } from './round'
import {
  needsCommitteeApproval,
  applyDistribution,
  rejectDistribution,
  type GameState,
} from './game'

type Props = {
  game: GameState
  onExit: () => void
  onNext: (game: GameState) => void
}

type Phase = 'propose' | 'approval' | 'result'
type Kind = 'confirmed' | 'approved' | 'rejected'

export default function SovereignPhase({ game, onExit, onNext }: Props) {
  const n = game.players.length

  const [proposal, setProposal] = useState<number[]>(() =>
    Array(n).fill(0)
  )
  const [phase, setPhase] = useState<Phase>('propose')
  const [approvals, setApprovals] = useState<Record<number, boolean>>({})
  const [result, setResult] = useState<{
    game: GameState
    received: number[]
    kind: Kind
  } | null>(null)

  const total = proposal.reduce((a, b) => a + b, 0)
  const available = n - total
  const needsApproval = needsCommitteeApproval(
    proposal,
    game.soberanoIndex,
    n
  )
  const soberano = game.players[game.soberanoIndex]
  const members = [game.elected, game.appointed]

  function change(index: number, delta: number) {
    if (delta > 0 && available <= 0) return
    if (proposal[index] + delta < 0) return

    const next = [...proposal]
    next[index] += delta
    setProposal(next)
  }

  function finish(kind: Kind) {
    if (kind === 'rejected') {
      setResult({
        game: rejectDistribution(game),
        received: Array(n).fill(0),
        kind,
      })
    } else {
      setResult({
        game: completeSovereignDistribution(
          applyDistribution(game, proposal)
        ),
        received: proposal,
        kind,
      })
    }
    setPhase('result')
  }

  function confirm() {
    if (needsApproval) {
      setPhase('approval')
    } else {
      finish('confirmed')
    }
  }

  function decide(member: number, ok: boolean) {
    const next = { ...approvals, [member]: ok }
    setApprovals(next)

    if (!ok) {
      finish('rejected')
    } else if (members.every((m) => next[m] === true)) {
      finish('approved')
    }
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
            RODADA {game.round} — FASE DO SOBERANO
          </div>
          <h1>{soberano.name} ♛</h1>
          <p>
            Comitê: {game.players[game.elected].name} (Eleito) ·{' '}
            {game.players[game.appointed].name} (Indicado)
          </p>
          <p>Influência do Comitê: {game.committeeInfluence}</p>
        </header>

        {phase === 'propose' && (
          <>
            <section className="players-card">
              <span className="section-label">
                PROPOSTA DE DISTRIBUIÇÃO
              </span>

              <div className="players-list">
                {game.players.map((p, i) => (
                  <div className="player" key={p.id}>
                    <div className="avatar">{p.name.charAt(0)}</div>
                    <div className="player-name">
                      <strong>{p.name}</strong>
                      {i === game.soberanoIndex && <span>SOBERANO</span>}
                    </div>

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
                  </div>
                ))}
              </div>

              <div className="waiting">
                <span>DISPONÍVEL</span>
                <p>
                  <strong>{available}</strong> de {n}. O que sobrar vai
                  para o Comitê.
                </p>
              </div>
            </section>

            <section className="lobby-actions">
              <button className="primary-button" onClick={confirm}>
                {needsApproval ? 'ENVIAR AO COMITÊ' : 'CONFIRMAR'}
              </button>
              {needsApproval && (
                <p className="preparation-text" style={{ margin: 0 }}>
                  Algum jogador receberá mais de {n / 2} Influências.
                </p>
              )}
            </section>
          </>
        )}

        {phase === 'approval' && (
          <section className="home-card">
            <div className="room-label">O COMITÊ DECIDE</div>

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

            {members.map((m) => (
              <div key={m} style={{ marginTop: 16 }}>
                <div className="room-label">
                  {game.players[m].name}
                  {approvals[m] === true ? ' — aprovou' : ''}
                </div>
                {approvals[m] !== true && (
                  <>
                    <button
                      className="primary-button"
                      onClick={() => decide(m, true)}
                    >
                      APROVAR
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => decide(m, false)}
                    >
                      REPROVAR
                    </button>
                  </>
                )}
              </div>
            ))}
          </section>
        )}

        {phase === 'result' && result && (
          <>
            <section className="home-card">
              <div className="room-label">RESULTADO</div>
              <h2 className="preparation-title" style={{ fontSize: 22 }}>
                {result.kind === 'confirmed' && 'Distribuição realizada'}
                {result.kind === 'approved' && 'Aprovada pelo Comitê'}
                {result.kind === 'rejected' && 'Reprovada pelo Comitê'}
              </h2>

              {result.kind === 'rejected' && (
                <p className="preparation-text">
                  Toda a Influência do Soberano foi para o Comitê.
                </p>
              )}

              <div className="players-list">
                {game.players.map(
                  (p, i) =>
                    result.received[i] > 0 && (
                      <div className="player" key={p.id}>
                        <div className="player-name">
                          <strong>{p.name}</strong>
                        </div>
                        <span className="player-crown">
                          +{result.received[i]}
                        </span>
                      </div>
                    )
                )}
              </div>

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
                CONTINUAR: FASE DO COMITÊ
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
