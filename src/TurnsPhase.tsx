import { useState, type ReactNode } from 'react'
import type { GameState } from './game'
import {
  eligiblePicks,
  accumulate,
  canBuyPower,
  buyPower,
  canGolpe,
  resolveGolpe,
  resolveConference,
  setCommitteeMembers,
} from './turns'
import Contributions from './Contributions'
import Election from './Election'

type Props = {
  game: GameState
  onExit: () => void
  onNext: (game: GameState) => void
}

type Phase =
  | 'select'
  | 'action'
  | 'golpe'
  | 'golpeResult'
  | 'conference'
  | 'conferenceResult'
  | 'succession'
  | 'end'

function Shell({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby">
        <header className="lobby-title">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </header>
        {children}
      </section>
    </main>
  )
}

export default function TurnsPhase({ game, onExit, onNext }: Props) {
  const [g, setG] = useState<GameState>(game)
  const [phase, setPhase] = useState<Phase>('select')
  const [current, setCurrent] = useState<number>(0)
  const [golpeInfo, setGolpeInfo] = useState<{
    success: boolean
    total: number
  } | null>(null)
  const [confInfo, setConfInfo] = useState<{
    success: boolean
    total: number
    required: number
  } | null>(null)

  const n = g.players.length
  const soberano = g.players[g.soberanoIndex]
  const name = (i: number) => g.players[i].name

  function advance(next: GameState) {
    setG(next)
    setPhase(next.chosen.length >= n - 1 ? 'end' : 'select')
  }

  const eyebrow = `RODADA ${g.round} — SELEÇÃO DOS TURNOS`
  const title = `Soberano: ${soberano.name} ♛`
  const sub = `Turnos realizados: ${g.chosen.length} de ${n - 1}`

  // ---------- Golpe: contribuições ----------
  if (phase === 'golpe') {
    return (
      <Contributions
        game={g}
        participants={g.players
          .map((p) => p.id)
          .filter((i) => i !== g.soberanoIndex)}
        title={`GOLPE DE ${name(current).toUpperCase()}`}
        onDone={(amounts) => {
          const r = resolveGolpe(g, current, amounts)
          setG(r.game)
          setGolpeInfo({ success: r.success, total: r.total })
          setPhase('golpeResult')
        }}
      />
    )
  }

  // ---------- Conferência de Soberania ----------
  if (phase === 'conference') {
    return (
      <Contributions
        game={g}
        participants={g.players
          .map((p) => p.id)
          .filter((i) => i !== g.soberanoIndex)}
        title="CONFERÊNCIA DE SOBERANIA"
        onDone={(donations) => {
          const r = resolveConference(g, donations)
          setG(r.game)
          setConfInfo({
            success: r.success,
            total: r.total,
            required: r.required,
          })
          setPhase('conferenceResult')
        }}
      />
    )
  }

  // ---------- Nova escolha de Comitê após Golpe bem-sucedido ----------
  if (phase === 'succession') {
    const eleitoVirouSoberano = g.elected === g.soberanoIndex

    return (
      <Election
        players={g.players}
        soberanoIndex={g.soberanoIndex}
        presetElected={eleitoVirouSoberano ? undefined : g.elected}
        onDone={(elected, appointed) =>
          advance(setCommitteeMembers(g, elected, appointed))
        }
      />
    )
  }

  // ---------- Seleção ----------
  if (phase === 'select') {
    const eligible = eligiblePicks(g)

    return (
      <Shell eyebrow={eyebrow} title={title} sub={sub}>
        <section className="players-card">
          <span className="section-label">
            {soberano.name}, escolha quem fará o próximo turno
          </span>

          <div className="players-list">
            {g.players.map((p) => {
              const done = g.chosen.includes(p.id)
              return (
                <div
                  className="player"
                  key={p.id}
                  style={
                    done ? { filter: 'grayscale(1)', opacity: 0.5 } : undefined
                  }
                >
                  <div className="avatar">{p.name.charAt(0)}</div>
                  <div className="player-name">
                    <strong>{p.name}</strong>
                    {p.id === g.soberanoIndex && <span>SOBERANO</span>}
                    {done && <span>JÁ FEZ SEU TURNO</span>}
                  </div>
                  {eligible.includes(p.id) && (
                    <button
                      className="copy-button"
                      onClick={() => {
                        setCurrent(p.id)
                        setPhase('action')
                      }}
                    >
                      ESCOLHER
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {eligible.length === 1 && (
            <div className="waiting">
              <p>
                Este jogador precisa ser escolhido: ficou sem turno na
                rodada anterior.
              </p>
            </div>
          )}
        </section>
      </Shell>
    )
  }

  // ---------- Ação do jogador escolhido ----------
  if (phase === 'action') {
    const buy = canBuyPower(g, current)
    const golpe = canGolpe(g, current)

    return (
      <Shell eyebrow={eyebrow} title={`Vez de ${name(current)}`} sub={sub}>
        <section className="home-card">
          <div className="room-label">ESCOLHA SUA AÇÃO</div>

          <button
            className="primary-button"
            onClick={() => advance(accumulate(g, current))}
          >
            ACUMULAR (+3 INFLUÊNCIA)
          </button>

          <button
            className="secondary-button"
            disabled={!buy}
            style={buy ? undefined : { opacity: 0.4 }}
            onClick={() => advance(buyPower(g, current))}
          >
            COMPRAR PODER
          </button>

          <button
            className="secondary-button"
            disabled={!golpe}
            style={golpe ? undefined : { opacity: 0.4 }}
            onClick={() => setPhase('golpe')}
          >
            GOLPE
          </button>
        </section>
      </Shell>
    )
  }

  // ---------- Resultado do Golpe ----------
  if (phase === 'golpeResult' && golpeInfo) {
    return (
      <Shell eyebrow={eyebrow} title="Resultado do Golpe">
        <section className="home-card">
          <div className="room-label">CONTRIBUIÇÃO TOTAL</div>
          <h2 className="preparation-title" style={{ fontSize: 40 }}>
            {golpeInfo.total}
          </h2>

          {golpeInfo.success ? (
            <>
              <p className="preparation-text">
                O Golpe foi bem-sucedido!{' '}
                <strong>{soberano.name}</strong> é o novo Soberano.
              </p>
              <button
                className="primary-button"
                onClick={() => setPhase('succession')}
              >
                CONTINUAR
              </button>
            </>
          ) : (
            <>
              <p className="preparation-text">
                O Golpe fracassou. <strong>{soberano.name}</strong>{' '}
                permanece Soberano.
              </p>
              <button
                className="primary-button"
                onClick={() => setPhase('conference')}
              >
                CONVOCAR CONFERÊNCIA DE SOBERANIA
              </button>
              <button className="secondary-button" onClick={() => advance(g)}>
                NÃO CONVOCAR
              </button>
            </>
          )}
        </section>
      </Shell>
    )
  }

  // ---------- Resultado da Conferência ----------
  if (phase === 'conferenceResult' && confInfo) {
    return (
      <Shell eyebrow={eyebrow} title="Conferência de Soberania">
        <section className="home-card">
          <div className="room-label">
            DOAÇÕES: {confInfo.total} (MÍNIMO {confInfo.required})
          </div>
          <p className="preparation-text">
            {confInfo.success
              ? 'Doações suficientes: todas foram para o Soberano.'
              : 'Doações insuficientes: todas foram para o Comitê.'}
          </p>
          <button className="primary-button" onClick={() => advance(g)}>
            CONTINUAR
          </button>
        </section>
      </Shell>
    )
  }

  // ---------- Fim dos turnos ----------
  const excluded = g.players
    .map((p) => p.id)
    .filter((i) => !g.chosen.includes(i))

  return (
    <Shell
      eyebrow={eyebrow}
      title="Turnos concluídos"
      sub={`Sem turno nesta rodada: ${excluded.map(name).join(', ')}`}
    >
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
                  {g.golpes[p.id]} Golpe ·{' '}
                  {p.powerCards.length > 0
                    ? p.powerCards.join(', ')
                    : 'sem cartas'}
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
          onClick={() =>
            onNext({ ...g, lastExcluded: excluded[0] ?? null })
          }
        >
          CONTINUAR: FASE DE PODER
        </button>
        <button className="secondary-button" onClick={onExit}>
          VOLTAR AO INÍCIO
        </button>
      </section>
    </Shell>
  )
}
