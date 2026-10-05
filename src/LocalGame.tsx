import { useState } from 'react'
import Preparation from './Preparation'

type Player = {
  id: number
  name: string
  host: boolean
}

export default function LocalGame({ onExit }: { onExit: () => void }) {
  const [started, setStarted] = useState(false)
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'Você', host: true },
  ])

  function addTestPlayer() {
    if (players.length >= 15) return
    const next = players.length + 1
    setPlayers([
      ...players,
      { id: next, name: `Jogador ${next}`, host: false },
    ])
  }

  function removeTestPlayer() {
    if (players.length <= 1) return
    setPlayers(players.slice(0, -1))
  }

  if (started) {
    return (
      <Preparation
        names={players.map((p) => p.name)}
        onExit={() => setStarted(false)}
      />
    )
  }

  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby">
        <header className="lobby-title">
          <div className="eyebrow">MODO LOCAL DE TESTE</div>
          <h1>CONFERÊNCIA DOS VILÕES</h1>
          <p>Um só aparelho, passando o tablet entre os jogadores.</p>
        </header>

        <section className="players-card">
          <header className="players-header">
            <div>
              <span className="section-label">PARTICIPANTES</span>
              <h2>Jogadores de teste</h2>
            </div>
            <div className="player-count">
              <strong>{players.length}</strong>
              <span>/ 15</span>
            </div>
          </header>

          <div className="players-list">
            {players.map((p, i) => (
              <div className="player" key={p.id}>
                <span className="player-number">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="avatar">{p.name.charAt(0)}</div>
                <div className="player-name">
                  <strong>{p.name}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lobby-actions">
          <button
            className="primary-button"
            disabled={players.length < 5}
            onClick={() => setStarted(true)}
          >
            INICIAR PARTIDA
          </button>
          <button className="secondary-button" onClick={onExit}>
            VOLTAR
          </button>

          <div className="test-buttons">
            <button onClick={addTestPlayer}>+ jogador teste</button>
            <button onClick={removeTestPlayer}>− jogador teste</button>
          </div>
        </section>
      </section>
    </main>
  )
}
