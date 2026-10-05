import { useState } from 'react'
import type { MatchView, PowerPlay, Send } from './onlineTypes'
import { Frame, Wait, nm } from './onlineUi'

type Props = {
  view: MatchView
  error: string
  send: Send
  onLeave: () => void
}

const NEEDS_TARGET = ['Golpe Baixo', 'Assalto', 'Roubo', 'Furto']

const CARD_INFO: Record<string, string> = {
  'Golpe Supremo': 'Vira Soberano sem votação (só se o Comitê não distribuiu)',
  'Golpe Baixo': 'Rouba uma carta Golpe de outro jogador',
  'Ataque Triplo': 'Permite usar até 3 cartas adicionais',
  Assalto: 'Rouba 5 Influências (autor e vítima são públicos)',
  Roubo: 'Rouba 3 Influências (só a vítima sabe)',
  Furto: 'Rouba 1 Influência (a vítima não sabe quem fez)',
  'Troca de Gestão': 'Remove o Membro Indicado (autor público)',
}

// Sem Ataque Triplo: 1 carta. Com Ataque Triplo: ele + 3 adicionais.
const maxCards = (plays: PowerPlay[]) =>
  plays.some((p) => p.card === 'Ataque Triplo') ? 4 : 1

type Entry = { play: PowerPlay; handIndex: number }

export default function OnlinePower({ view, error, send, onLeave }: Props) {
  const p = view.power!
  const hand = view.me.powerCards

  const [entries, setEntries] = useState<Entry[]>([])
  const [pending, setPending] = useState<{ handIndex: number; card: string } | null>(
    null
  )

  const plays = entries.map((e) => e.play)
  const usedIdx = entries.map((e) => e.handIndex)

  function canAdd(card: string): boolean {
    if (card === 'Golpe Supremo' && !p.supremeAllowed) return false
    if (card === 'Ataque Triplo' && plays.some((x) => x.card === card)) return false
    const next = [...plays, { card }]
    return next.length <= maxCards(next)
  }

  function add(handIndex: number, card: string, target?: number) {
    setEntries([...entries, { play: { card, target }, handIndex }])
    setPending(null)
  }

  function pick(handIndex: number, card: string) {
    if (NEEDS_TARGET.includes(card)) setPending({ handIndex, card })
    else add(handIndex, card)
  }

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow={`RODADA ${view.round} — FASE DE PODER`}
      title="Escolhas secretas"
      sub={`Soberano: ${nm(view, view.soberano)} ♛`}
    >
      <section className="home-card">
        {p.iSubmitted ? (
          <Wait>
            Escolha registrada. Aguardando os outros ({p.submittedCount} de{' '}
            {view.players.length}).
          </Wait>
        ) : pending ? (
          <>
            <div className="room-label">{pending.card}: escolha o alvo</div>
            {view.players
              .filter((x) => x.index !== view.you)
              .map((x) => (
                <button
                  key={x.index}
                  className="secondary-button"
                  onClick={() => add(pending.handIndex, pending.card, x.index)}
                >
                  {x.icon} {x.name}
                  {view.golpes[x.index] > 0 && pending.card === 'Golpe Baixo'
                    ? ` (${view.golpes[x.index]} Golpe)`
                    : ''}
                </button>
              ))}
            <button className="secondary-button" onClick={() => setPending(null)}>
              CANCELAR
            </button>
          </>
        ) : (
          <>
            <div className="room-label">
              SUAS CARTAS (LIMITE AGORA: {maxCards(plays)})
            </div>

            {hand.length === 0 && (
              <p className="preparation-text">Você não tem cartas de Poder.</p>
            )}

            {hand.map((card, i) =>
              usedIdx.includes(i) ? null : (
                <button
                  key={i}
                  className="secondary-button"
                  disabled={!canAdd(card)}
                  style={canAdd(card) ? undefined : { opacity: 0.4 }}
                  onClick={() => pick(i, card)}
                >
                  {card.toUpperCase()}
                  <br />
                  <small style={{ fontFamily: 'Inter', fontWeight: 400 }}>
                    {CARD_INFO[card]}
                  </small>
                </button>
              )
            )}

            <div className="room-label" style={{ marginTop: 18 }}>
              SUAS JOGADAS (EM ORDEM)
            </div>

            {entries.length === 0 && (
              <p className="preparation-text">Nenhuma carta escolhida.</p>
            )}

            {entries.map((e, i) => (
              <div className="player" key={i} style={{ marginTop: 8 }}>
                <div className="player-name">
                  <strong>
                    {i + 1}. {e.play.card}
                  </strong>
                  {e.play.target !== undefined && (
                    <span>alvo: {nm(view, e.play.target)}</span>
                  )}
                </div>
                <button
                  className="copy-button"
                  onClick={() => setEntries(entries.filter((_, k) => k !== i))}
                >
                  REMOVER
                </button>
              </div>
            ))}

            <button
              className="primary-button"
              style={{ marginTop: 18 }}
              onClick={() => send({ kind: 'plays', plays })}
            >
              CONFIRMAR ESCOLHA (SECRETA)
            </button>
          </>
        )}
      </section>
    </Frame>
  )
}
