import { useState } from 'react'
import {
  createInitialGame,
  applyInitialChoice,
  finishSetup,
  setCommittee,
  type InitialChoice,
  type SetupState,
} from './setup'
import Election from './Election'
import { objectiveInfo } from './objectives'
import { startGame, type GameState } from './game'
import Match from './Match'

type Props = {
  names: string[]
  onExit: () => void
}

type Stage = 'choices' | 'summary' | 'election' | 'ready' | 'match'

export default function Preparation({ names, onExit }: Props) {
  const [game, setGame] = useState<SetupState>(() =>
    createInitialGame(names)
  )
  const [current, setCurrent] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [stage, setStage] = useState<Stage>('choices')
  const [live, setLive] = useState<GameState | null>(null)

  const n = names.length

  function choose(choice: InitialChoice) {
    const next = applyInitialChoice(game, current, choice)

    if (current + 1 >= n) {
      setGame(finishSetup(next))
      setStage('summary')
    } else {
      setGame(next)
      setCurrent(current + 1)
      setRevealed(false)
    }
  }

  if (stage === 'election' && game.soberanoIndex !== null) {
    return (
      <Election
        players={game.players}
        soberanoIndex={game.soberanoIndex}
        onDone={(elected, appointed) => {
          setGame(setCommittee(game, elected, appointed))
          setStage('ready')
        }}
      />
    )
  }

  if (stage === 'match' && live) {
    return <Match game={live} onExit={onExit} />
  }

  const player = game.players[current]
  const soberanoName =
    game.soberanoIndex !== null ? game.players[game.soberanoIndex].name : '-'

  function roleOf(index: number) {
    if (index === game.soberanoIndex) return 'Soberano'
    if (index === game.elected) return 'Membro Eleito'
    if (index === game.appointed) return 'Membro Indicado'
    return ''
  }

  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby preparation">
        {stage === 'choices' && (
          <>
            <header className="lobby-title">
              <div className="eyebrow">
                JOGADOR {current + 1} DE {n}
              </div>
              <h1>{player.name}</h1>
            </header>

            <section className="home-card">
              {!revealed ? (
                <>
                  <p className="preparation-text">
                    Passe o tablet para <strong>{player.name}</strong>.
                    Só essa pessoa deve olhar a tela.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setRevealed(true)}
                  >
                    VER MEU OBJETIVO
                  </button>
                </>
              ) : (
                <>
                  <div className="room-label">SEU OBJETIVO SECRETO</div>
                  <h2 className="preparation-title" style={{ fontSize: 26 }}>
                    {player.objective}
                  </h2>
                  <p className="preparation-text">
                    {objectiveInfo(player.objective).goal}
                  </p>
                  {objectiveInfo(player.objective).note && (
                    <p
                      className="preparation-text"
                      style={{ fontSize: 12, opacity: 0.85 }}
                    >
                      {objectiveInfo(player.objective).note}
                    </p>
                  )}

                  <p className="preparation-text">
                    Faça a sua escolha inicial
                  </p>

                  <button
                    className="primary-button"
                    onClick={() => choose('A')}
                  >
                    5 INFLUÊNCIA
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => choose('B')}
                  >
                    2 INFLUÊNCIA + 1 CARTA DE PODER
                  </button>
                </>
              )}
            </section>
          </>
        )}

        {(stage === 'summary' || stage === 'ready') && (
          <>
            <header className="lobby-title">
              <div className="eyebrow">
                {stage === 'summary'
                  ? 'PREPARAÇÃO CONCLUÍDA'
                  : 'RODADA 1 — FASE DO SOBERANO'}
              </div>
              <h1>Soberano: {soberanoName}</h1>
              <p>Bônus do primeiro Soberano: +{game.bonus} Influência</p>
              {stage === 'ready' &&
                game.elected !== null &&
                game.appointed !== null && (
                  <p>
                    Membro Eleito: {game.players[game.elected].name} ·
                    Membro Indicado: {game.players[game.appointed].name}
                  </p>
                )}
            </header>

            {game.replacedObjective && (
              <p className="preparation-text">
                {game.players[game.replacedObjective.index].name} foi eleito
                na Rodada 1 sendo Distribuidor. O objetivo dele foi
                substituído por: <strong>{game.replacedObjective.to}</strong>
              </p>
            )}

            <section className="players-card">
              <span className="section-label">
                MODO DE TESTE: tudo visível
              </span>
              <div className="players-list">
                {game.players.map((p) => (
                  <div className="player" key={p.id}>
                    <div className="avatar">{p.name.charAt(0)}</div>
                    <div className="player-name">
                      <strong>
                        {p.name}
                        {p.leadership === 'Soberano' ? ' ♛' : ''}
                        {roleOf(p.id) ? ` · ${roleOf(p.id)}` : ''}
                      </strong>
                      <span>
                        {p.objective} · {p.influence} Influência ·{' '}
                        {p.powerCards.length > 0
                          ? p.powerCards.join(', ')
                          : 'sem carta'}{' '}
                        · {p.leadership}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lobby-actions">
              {stage === 'summary' && (
                <button
                  className="primary-button"
                  onClick={() => setStage('election')}
                >
                  CONTINUAR: ELEIÇÃO DO COMITÊ
                </button>
              )}
              {stage === 'ready' && (
                <button
                  className="primary-button"
                  onClick={() => {
                    const g = startGame(game)
                    if (g) {
                      setLive(g)
                      setStage('match')
                    }
                  }}
                >
                  COMEÇAR RODADA 1
                </button>
              )}
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
