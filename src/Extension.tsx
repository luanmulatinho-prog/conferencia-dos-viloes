import { useState } from 'react'
import type { GameState } from './game'

type Props = {
  game: GameState
  onDone: (extended: boolean) => void
}

type Phase = 'ask' | 'approve' | 'result'

export default function Extension({ game, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('ask')
  const [approvals, setApprovals] = useState<Record<number, boolean>>({})
  const [ok, setOk] = useState(false)

  const members = [game.elected, game.appointed]
  const soberano = game.players[game.soberanoIndex]

  function decide(member: number, yes: boolean) {
    const next = { ...approvals, [member]: yes }
    setApprovals(next)

    if (!yes) {
      setOk(false)
      setPhase('result')
    } else if (members.every((m) => next[m] === true)) {
      setOk(true)
      setPhase('result')
    }
  }

  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby preparation">
        <header className="lobby-title">
          <div className="eyebrow">RODADA {game.round} — FASE DO SOBERANO</div>
          <h1>Prorrogação de Mandato</h1>
        </header>

        <section className="home-card">
          {phase === 'ask' && (
            <>
              <p className="preparation-text">
                <strong>{soberano.name}</strong> está na{' '}
                {game.consecutive + 1}ª rodada consecutiva de mandato e pode
                solicitar a Prorrogação.
              </p>
              <button
                className="primary-button"
                onClick={() => setPhase('approve')}
              >
                SOLICITAR PRORROGAÇÃO
              </button>
              <button
                className="secondary-button"
                onClick={() => onDone(false)}
              >
                NÃO SOLICITAR
              </button>
            </>
          )}

          {phase === 'approve' && (
            <>
              <div className="room-label">
                O COMITÊ DECIDE (CONSENSO)
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
            </>
          )}

          {phase === 'result' && (
            <>
              <h2 className="preparation-title" style={{ fontSize: 22 }}>
                {ok ? 'Prorrogação aprovada' : 'Prorrogação rejeitada'}
              </h2>
              <p className="preparation-text">
                {ok
                  ? 'A partida continua até o Soberano completar 11 rodadas consecutivas ou sofrer um Golpe bem-sucedido.'
                  : 'A partida termina normalmente ao final da Rodada 19.'}
              </p>
              <button className="primary-button" onClick={() => onDone(ok)}>
                CONTINUAR
              </button>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
