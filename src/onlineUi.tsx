import { useState, type ReactNode } from 'react'
import type { MatchView } from './onlineTypes'
import { objectiveInfo } from './objectives'
import { powerCardInfo } from './powerCards'

export const nm = (v: MatchView, i: number | null | undefined) =>
  i === null || i === undefined ? '—' : (v.players[i]?.name ?? '?')

export function Corners() {
  return (
    <>
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>
    </>
  )
}

export type Item = {
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}

export function Buttons({ items }: { items: Item[] }) {
  return (
    <>
      {items.map((it, i) => (
        <button
          key={i}
          className={it.primary ? 'primary-button' : 'secondary-button'}
          disabled={it.disabled}
          style={it.disabled ? { opacity: 0.4 } : undefined}
          onClick={it.onClick}
        >
          {it.label}
        </button>
      ))}
    </>
  )
}

export function Stepper({
  value,
  max,
  onChange,
  steps = [-10, -5, -1, 1, 5, 10],
}: {
  value: number
  max: number
  onChange: (v: number) => void
  steps?: number[]
}) {
  const step = (d: number) => onChange(Math.max(0, Math.min(max, value + d)))

  return (
    <>
      <h2 className="preparation-title" style={{ fontSize: 40 }}>
        {value}
      </h2>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 18,
        }}
      >
        {steps.map((d) => (
          <button key={d} className="copy-button" onClick={() => step(d)}>
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </>
  )
}

// Carta de Objetivo com a descrição
export function ObjectiveCard({
  name,
  label = 'CARTA DE OBJETIVO',
}: {
  name: string
  label?: string
}) {
  const info = objectiveInfo(name)

  return (
    <div
      style={{
        border: '1px solid rgba(197, 151, 73, 0.55)',
        background:
          'linear-gradient(145deg, rgba(73, 42, 20, 0.78), rgba(31, 17, 10, 0.92))',
        padding: '16px 14px',
        textAlign: 'center',
        margin: '8px 0',
      }}
    >
      <div className="room-label">{label}</div>
      <h2 className="preparation-title" style={{ fontSize: 24, margin: '6px 0 8px' }}>
        {name}
      </h2>
      <p className="preparation-text" style={{ margin: '4px 0' }}>
        {info.goal}
      </p>
      {info.note && (
        <p
          className="preparation-text"
          style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.85 }}
        >
          {info.note}
        </p>
      )}
    </div>
  )
}

// Carta de Poder com nome e descrição da ação
export function PowerCardView({
  name,
  count,
}: {
  name: string
  count?: number
}) {
  const info = powerCardInfo(name)

  return (
    <div
      style={{
        border: '1px solid rgba(197, 151, 73, 0.55)',
        background:
          'linear-gradient(145deg, rgba(60, 36, 22, 0.9), rgba(24, 13, 8, 0.95))',
        padding: '14px 12px',
        margin: '8px 0',
        textAlign: 'center',
      }}
    >
      <div className="room-label">
        CARTA DE PODER{count && count > 1 ? ` · ×${count}` : ''}
      </div>
      <h3
        className="preparation-title"
        style={{ fontSize: 20, margin: '6px 0 8px' }}
      >
        {name}
      </h3>
      <p className="preparation-text" style={{ margin: '4px 0' }}>
        {info.desc}
      </p>
      {info.note && (
        <p
          className="preparation-text"
          style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.85 }}
        >
          {info.note}
        </p>
      )}
    </div>
  )
}

// Agrupa cartas repetidas: [['Furto', 3], ['Roubo', 1]]
export function groupCards(cards: string[]): [string, number][] {
  const map = new Map<string, number>()
  for (const c of cards) map.set(c, (map.get(c) ?? 0) + 1)
  return [...map.entries()]
}

export function Wait({ children }: { children: ReactNode }) {
  return (
    <p className="preparation-text" style={{ textAlign: 'center' }}>
      {children}
    </p>
  )
}

type FrameProps = {
  view: MatchView
  error: string
  onLeave: () => void
  eyebrow: string
  title: string
  sub?: string
  plain?: boolean
  children: ReactNode
}

// Moldura de todas as telas da partida: cabeçalho, resumo da fase anterior,
// mensagens privadas, placar público e informações pessoais.
export function Frame({
  view,
  error,
  onLeave,
  eyebrow,
  title,
  sub,
  plain,
  children,
}: FrameProps) {
  const [hiddenRecap, setHiddenRecap] = useState('')
  const [showStatus, setShowStatus] = useState(false)
  const [showMine, setShowMine] = useState(false)

  const recap = view.recap
  const myParty = view.parties.find((p) => p.memberIds.includes(view.you))
  const partyOf = (i: number) =>
    view.parties.find((p) => p.memberIds.includes(i))?.name

  const role = (i: number) =>
    [
      i === view.soberano ? 'Soberano' : '',
      i === view.elected ? 'Eleito' : '',
      i === view.appointed ? 'Indicado' : '',
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <main className="app">
      <Corners />

      <section className="lobby">
        <header className="lobby-title">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </header>

        {view.paused.length > 0 && (
          <section
            className="players-card"
            style={{ borderColor: '#c0643c', textAlign: 'center' }}
          >
            <span className="section-label">PARTIDA PAUSADA</span>
            <p className="preparation-text">
              Aguardando {view.paused.join(', ')} voltar. A partida continua
              quando todos estiverem conectados.
            </p>
          </section>
        )}

        {!plain && recap && hiddenRecap !== recap.title && (
          <section className="players-card" style={{ marginBottom: 14 }}>
            <header className="players-header">
              <span className="section-label">{recap.title}</span>
              <button
                className="copy-button"
                onClick={() => setHiddenRecap(recap.title)}
              >
                OCULTAR
              </button>
            </header>
            <div style={{ marginTop: 10 }}>
              {recap.lines.map((l, i) => (
                <p
                  className="preparation-text"
                  style={{ margin: '3px 0', textAlign: 'left' }}
                  key={i}
                >
                  {l}
                </p>
              ))}
            </div>
          </section>
        )}

        {!plain && view.privateMsgs.length > 0 && (
          <section
            className="players-card"
            style={{ marginBottom: 14, borderColor: '#d3ad67' }}
          >
            <span className="section-label">MENSAGENS PRIVADAS PARA VOCÊ</span>
            <div style={{ marginTop: 10 }}>
              {view.privateMsgs.map((l, i) => (
                <p
                  className="preparation-text"
                  style={{ margin: '3px 0', textAlign: 'left' }}
                  key={i}
                >
                  {l}
                </p>
              ))}
            </div>
          </section>
        )}

        {view.notice && !plain && (
          <Wait>{view.notice}</Wait>
        )}

        {children}

        {!plain && view.stats && (
          <section className="players-card" style={{ marginTop: 18 }}>
            <header className="players-header">
              <span className="section-label">PLACAR PÚBLICO</span>
              <button
                className="copy-button"
                onClick={() => setShowStatus(!showStatus)}
              >
                {showStatus ? 'OCULTAR' : 'MOSTRAR'}
              </button>
            </header>

            {showStatus && (
              <>
                <p className="preparation-text" style={{ textAlign: 'left' }}>
                  Influência do Comitê: <strong>{view.committeeInfluence}</strong>{' '}
                  · Mandato do Soberano: {view.stats.consecutive} rodada(s)
                  consecutiva(s)
                </p>
                <div className="players-list">
                  {view.players.map((p) => (
                    <div className="player" key={p.index}>
                      <div className="avatar">{p.icon}</div>
                      <div className="player-name">
                        <strong>
                          {p.name}
                          {p.index === view.you ? ' (você)' : ''}
                        </strong>
                        <span>
                          {role(p.index) || 'sem cargo'} ·{' '}
                          {partyOf(p.index) ?? 'sem partido'}
                        </span>
                        <span>
                          Golpe: {view.golpes[p.index]} · Soberano:{' '}
                          {view.stats!.sovereignRounds[p.index]} · Comitê:{' '}
                          {view.stats!.committeeRounds[p.index]}
                          {view.chosen.includes(p.index) ? ' · já teve turno' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {view.parties.length > 0 && (
                  <>
                    <div className="room-label" style={{ marginTop: 14 }}>
                      PARTIDOS
                    </div>
                    {view.parties.map((p) => (
                      <p
                        className="preparation-text"
                        style={{ margin: '3px 0', textAlign: 'left' }}
                        key={p.id}
                      >
                        <strong>{p.name}</strong> · líder {nm(view, p.leaderId)} ·
                        cofre {p.influence} ·{' '}
                        {p.memberIds.map((i) => nm(view, i)).join(', ')}
                      </p>
                    ))}
                  </>
                )}
              </>
            )}
          </section>
        )}

        {!plain && (
          <section className="players-card" style={{ marginTop: 14 }}>
            <header className="players-header">
              <span className="section-label">SUAS INFORMAÇÕES (SECRETAS)</span>
              <button
                className="copy-button"
                onClick={() => setShowMine(!showMine)}
              >
                {showMine ? 'OCULTAR' : 'MOSTRAR'}
              </button>
            </header>

            {showMine && (
              <div style={{ marginTop: 12 }}>
                <ObjectiveCard name={view.me.objective} />
                <p className="preparation-text" style={{ margin: '4px 0' }}>
                  Influência: <strong>{view.me.influence}</strong>
                </p>
                <div className="room-label" style={{ marginTop: 10 }}>
                  CARTAS DE PODER ({view.me.powerCards.length} DE 5)
                </div>
                {view.me.powerCards.length === 0 && (
                  <p className="preparation-text" style={{ margin: '4px 0' }}>
                    Nenhuma carta de Poder.
                  </p>
                )}
                {groupCards(view.me.powerCards).map(([card, count]) => (
                  <PowerCardView key={card} name={card} count={count} />
                ))}
                {view.phase === 'choice' || !view.stats ? null : (
                  <p className="preparation-text" style={{ margin: '4px 0' }}>
                    Cartas Golpe: {view.golpes[view.you]}
                  </p>
                )}
                {myParty && (
                  <>
                    <p className="preparation-text" style={{ margin: '8px 0 2px' }}>
                      Seu partido ({myParty.name}) — Influência dos membros:
                    </p>
                    {myParty.memberIds.map((i) => (
                      <p
                        className="preparation-text"
                        style={{ margin: '2px 0' }}
                        key={i}
                      >
                        {nm(view, i)}: {view.memberInfluence[i] ?? '?'}
                      </p>
                    ))}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {error && (
          <p
            className="preparation-text"
            style={{ color: '#e0a080', textAlign: 'center' }}
          >
            {error}
          </p>
        )}

        <section className="lobby-actions">
          <button className="secondary-button" onClick={onLeave}>
            SAIR DA PARTIDA
          </button>
        </section>
      </section>
    </main>
  )
}
