import { useState, type ReactNode } from 'react'
import type { GameState } from './game'
import { setCommitteeMembers } from './turns'
import {
  startPowerResolution,
  stepPower,
  type Choice,
  type LogEntry,
  type Need,
  type QueueItem,
} from './power'
import PowerSelection from './PowerSelection'
import Election from './Election'

type Props = {
  game: GameState
  onExit: () => void
  onNext: (game: GameState) => void
}

type Phase = 'select' | 'decide' | 'report'

function Shell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
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
        </header>
        {children}
      </section>
    </main>
  )
}

export default function PowerPhase({ game, onExit, onNext }: Props) {
  const [g, setG] = useState<GameState>(game)
  const [phase, setPhase] = useState<Phase>('select')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [need, setNeed] = useState<Need>(null)
  const [oldAppointed, setOldAppointed] = useState<number | undefined>()
  const [viewing, setViewing] = useState<number | null>(null)
  const [made, setMade] = useState<Choice[]>([])

  // Processa a fila de efeitos até acabar ou até precisar de uma decisão
  function run(
    start: GameState,
    items: QueueItem[],
    logs: LogEntry[],
    ch: Choice[]
  ) {
    let cur = start
    let rest = items
    const all = [...logs]

    while (rest.length > 0) {
      const r = stepPower(cur, rest[0])
      const prevAppointed = cur.appointed
      cur = r.game
      all.push(...r.log)
      rest = rest.slice(1)

      if (r.need) {
        setG(cur)
        setQueue(rest)
        setLog(all)
        setNeed(r.need)
        setOldAppointed(prevAppointed)
        setPhase('decide')
        return
      }
    }

    setG({ ...cur, lastPower: { choices: ch, log: all } })
    setQueue([])
    setLog(all)
    setPhase('report')
  }

  function onChoices(choices: Choice[]) {
    const s = startPowerResolution(g, choices)
    setMade(choices)
    run(s.game, s.queue, [], choices)
  }

  if (phase === 'select') {
    return <PowerSelection game={g} onDone={onChoices} />
  }

  if (phase === 'decide') {
    const eleitoVirouSoberano =
      need === 'succession' && g.elected === g.soberanoIndex

    return (
      <Election
        players={g.players}
        soberanoIndex={g.soberanoIndex}
        presetElected={eleitoVirouSoberano ? undefined : g.elected}
        excludeAppointed={need === 'appoint' ? oldAppointed : undefined}
        onDone={(elected, appointed) => {
          const next = setCommitteeMembers(g, elected, appointed)
          setNeed(null)
          run(next, queue, log, made)
        }}
      />
    )
  }

  // ---------- Relatório ----------
  const publicLog = log.filter((l) => l.to === 'all')
  const privateOf = (i: number) => log.filter((l) => l.to === i)

  return (
    <Shell eyebrow={`RODADA ${g.round} — FASE DE PODER`} title="Resultados">
      <section className="home-card">
        <div className="room-label">O QUE TODOS VIRAM</div>
        {publicLog.length === 0 && (
          <p className="preparation-text">Nada de público aconteceu.</p>
        )}
        {publicLog.map((l, i) => (
          <p className="preparation-text" key={i}>
            {l.text}
          </p>
        ))}
        <p className="preparation-text">
          Soberano atual: <strong>{g.players[g.soberanoIndex].name}</strong>
        </p>
      </section>

      <section className="players-card">
        <span className="section-label">MENSAGENS PRIVADAS</span>
        <div className="players-list">
          {g.players.map((p) => (
            <div key={p.id}>
              <div className="player">
                <div className="player-name">
                  <strong>{p.name}</strong>
                </div>
                <button
                  className="copy-button"
                  onClick={() => setViewing(viewing === p.id ? null : p.id)}
                >
                  {viewing === p.id ? 'OCULTAR' : 'VER'}
                </button>
              </div>

              {viewing === p.id && (
                <div style={{ padding: '8px 12px' }}>
                  {privateOf(p.id).length === 0 ? (
                    <p className="preparation-text" style={{ margin: 0 }}>
                      Nenhuma mensagem.
                    </p>
                  ) : (
                    privateOf(p.id).map((l, i) => (
                      <p
                        className="preparation-text"
                        style={{ margin: '4px 0' }}
                        key={i}
                      >
                        {l.text}
                      </p>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

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
        <button className="primary-button" onClick={() => onNext(g)}>
          CONTINUAR: ENCERRAR A RODADA
        </button>
        <button className="secondary-button" onClick={onExit}>
          VOLTAR AO INÍCIO
        </button>
      </section>
    </Shell>
  )
}
