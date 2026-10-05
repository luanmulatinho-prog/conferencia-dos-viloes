import { useState } from 'react'
import type { GameState } from './game'
import type { PowerCard } from './setup'
import {
  CARD_INFO,
  NEEDS_TARGET,
  maxCards,
  type Choice,
  type Play,
} from './power'

type Props = {
  game: GameState
  onDone: (choices: Choice[]) => void
}

type Entry = { play: Play; handIndex: number }

export default function PowerSelection({ game, onDone }: Props) {
  const n = game.players.length

  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [choices, setChoices] = useState<Choice[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [pending, setPending] = useState<{
    handIndex: number
    card: PowerCard
  } | null>(null)

  const player = game.players[pos]
  const hand = player.powerCards
  const usedIdx = entries.map((e) => e.handIndex)
  const plays = entries.map((e) => e.play)

  function canAdd(card: PowerCard): boolean {
    if (card === 'Golpe Supremo' && game.committeeDistributed) return false
    if (card === 'Ataque Triplo' && plays.some((p) => p.card === card)) {
      return false
    }
    const next = [...plays, { card }]
    return next.length <= maxCards(next)
  }

  function add(handIndex: number, card: PowerCard, target?: number) {
    setEntries([...entries, { play: { card, target }, handIndex }])
    setPending(null)
  }

  function pick(handIndex: number, card: PowerCard) {
    if (NEEDS_TARGET.includes(card)) {
      setPending({ handIndex, card })
    } else {
      add(handIndex, card)
    }
  }

  function confirm() {
    const next = [...choices, { player: player.id, plays }]

    if (pos + 1 >= n) {
      onDone(next)
    } else {
      setChoices(next)
      setPos(pos + 1)
      setRevealed(false)
      setEntries([])
      setPending(null)
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
          <div className="eyebrow">
            RODADA {game.round} — FASE DE PODER
          </div>
          <h1>
            Escolha secreta {pos + 1} de {n}
          </h1>
        </header>

        <section className="home-card">
          {!revealed ? (
            <>
              <p className="preparation-text">
                Passe o tablet para <strong>{player.name}</strong>.
              </p>
              <button
                className="primary-button"
                onClick={() => setRevealed(true)}
              >
                VER MINHAS CARTAS
              </button>
            </>
          ) : pending ? (
            <>
              <div className="room-label">
                {pending.card}: escolha o alvo
              </div>
              {game.players
                .filter((p) => p.id !== player.id)
                .map((p) => (
                  <button
                    key={p.id}
                    className="secondary-button"
                    onClick={() => add(pending.handIndex, pending.card, p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              <button
                className="secondary-button"
                onClick={() => setPending(null)}
              >
                CANCELAR
              </button>
            </>
          ) : (
            <>
              <div className="room-label">
                {player.name}: SUAS CARTAS (limite: {maxCards(plays)} agora)
              </div>

              {hand.length === 0 && (
                <p className="preparation-text">
                  Você não tem cartas de Poder.
                </p>
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
                SUAS JOGADAS (em ordem)
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
                      <span>alvo: {game.players[e.play.target].name}</span>
                    )}
                  </div>
                  <button
                    className="copy-button"
                    onClick={() =>
                      setEntries(entries.filter((_, k) => k !== i))
                    }
                  >
                    REMOVER
                  </button>
                </div>
              ))}

              <button
                className="primary-button"
                style={{ marginTop: 18 }}
                onClick={confirm}
              >
                CONFIRMAR ESCOLHA
              </button>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
