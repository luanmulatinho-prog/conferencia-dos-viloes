import { useState } from 'react'
import type { GameState } from './game'
import { checkEnd, startNextRound, type EndReason } from './round'
import Extension from './Extension'
import SovereignPhase from './SovereignPhase'
import CommitteePhase from './CommitteePhase'
import TurnsPhase from './TurnsPhase'
import PowerPhase from './PowerPhase'
import PartiesPhase from './PartiesPhase'
import FinalScreen from './FinalScreen'

type Props = {
  game: GameState
  onExit: () => void
}

type Step =
  | 'extension'
  | 'sovereign'
  | 'committee'
  | 'turns'
  | 'power'
  | 'parties'
  | 'roundEnd'
  | 'final'

// Prorrogação: Rodada 19, a partir da 7ª rodada consecutiva do Soberano
function canAskExtension(g: GameState): boolean {
  return g.round === 19 && !g.extension && g.consecutive >= 6
}

export default function Match({ game, onExit }: Props) {
  const [g, setG] = useState<GameState>(game)
  const [step, setStep] = useState<Step>('sovereign')
  const [reason, setReason] = useState<EndReason | null>(null)

  const key = `${g.round}-${step}`

  if (step === 'extension') {
    return (
      <Extension
        key={key}
        game={g}
        onDone={(extended) => {
          setG({ ...g, extension: extended })
          setStep('sovereign')
        }}
      />
    )
  }

  if (step === 'sovereign') {
    return (
      <SovereignPhase
        key={key}
        game={g}
        onExit={onExit}
        onNext={(next) => {
          setG(next)
          setStep('committee')
        }}
      />
    )
  }

  if (step === 'committee') {
    return (
      <CommitteePhase
        key={key}
        game={g}
        onExit={onExit}
        onNext={(next) => {
          setG(next)
          setStep('turns')
        }}
      />
    )
  }

  if (step === 'turns') {
    return (
      <TurnsPhase
        key={key}
        game={g}
        onExit={onExit}
        onNext={(next) => {
          setG(next)
          setStep('power')
        }}
      />
    )
  }

  if (step === 'power') {
    return (
      <PowerPhase
        key={key}
        game={g}
        onExit={onExit}
        onNext={(next) => {
          setG(next)
          setStep('parties')
        }}
      />
    )
  }

  if (step === 'parties') {
    return (
      <PartiesPhase
        key={key}
        game={g}
        onNext={(next) => {
          setG(next)
          const r = checkEnd(next)
          if (r) {
            setReason(r)
            setStep('final')
          } else {
            setStep('roundEnd')
          }
        }}
      />
    )
  }

  if (step === 'final' && reason) {
    return <FinalScreen game={g} reason={reason} onExit={onExit} />
  }

  // ---------- Fim de rodada ----------
  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby">
        <header className="lobby-title">
          <div className="eyebrow">FIM DA RODADA {g.round}</div>
          <h1>Soberano: {g.players[g.soberanoIndex].name} ♛</h1>
          <p>Rodadas consecutivas de mandato: {g.consecutive}</p>
          {g.golpeThisRound && (
            <p>
              Houve Golpe bem-sucedido nesta rodada: a partida não termina
              agora.
            </p>
          )}
        </header>

        <section className="players-card">
          <span className="section-label">
            MODO DE TESTE: informações secretas visíveis
          </span>
          <div className="players-list">
            {g.players.map((p) => (
              <div className="player" key={p.id}>
                <div className="player-name">
                  <strong>
                    {p.name}
                    {p.id === g.soberanoIndex ? ' ♛' : ''}
                    {p.id === g.elected ? ' · Eleito' : ''}
                    {p.id === g.appointed ? ' · Indicado' : ''}
                  </strong>
                  <span>
                    {p.objective} · {p.influence} Influência ·{' '}
                    {g.golpes[p.id]} Golpe
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="preparation-text">
            Influência do Comitê: <strong>{g.committeeInfluence}</strong>
          </p>
        </section>

        <section className="lobby-actions">
          <button
            className="primary-button"
            onClick={() => {
              const next = startNextRound(g)
              setG(next)
              setStep(canAskExtension(next) ? 'extension' : 'sovereign')
            }}
          >
            INICIAR RODADA {g.round + 1}
          </button>
          <button className="secondary-button" onClick={onExit}>
            VOLTAR AO INÍCIO
          </button>
        </section>
      </section>
    </main>
  )
}
