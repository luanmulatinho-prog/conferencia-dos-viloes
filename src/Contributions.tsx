import { useState } from 'react'
import type { GameState } from './game'

type Props = {
  game: GameState
  participants: number[]
  title: string
  onDone: (amounts: number[]) => void
}

export default function Contributions({
  game,
  participants,
  title,
  onDone,
}: Props) {
  const n = game.players.length

  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [amounts, setAmounts] = useState<number[]>(() => Array(n).fill(0))
  const [value, setValue] = useState(0)

  const player = game.players[participants[pos]]

  function step(delta: number) {
    setValue(Math.max(0, Math.min(player.influence, value + delta)))
  }

  function confirm() {
    const next = [...amounts]
    next[player.id] = value

    if (pos + 1 >= participants.length) {
      onDone(next)
    } else {
      setAmounts(next)
      setPos(pos + 1)
      setRevealed(false)
      setValue(0)
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
            CONTRIBUIÇÃO SECRETA {pos + 1} DE {participants.length}
          </div>
          <h1>{title}</h1>
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
                CONTRIBUIR
              </button>
            </>
          ) : (
            <>
              <div className="room-label">
                {player.name}: seu saldo é {player.influence}
              </div>

              <h2 className="preparation-title" style={{ fontSize: 40 }}>
                {value}
              </h2>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 18,
                }}
              >
                {[-5, -1, 1, 5].map((d) => (
                  <button
                    key={d}
                    className="copy-button"
                    onClick={() => step(d)}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>

              <button className="primary-button" onClick={confirm}>
                CONFIRMAR
              </button>
            </>
          )}
        </section>
      </section>
    </main>
  )
}
