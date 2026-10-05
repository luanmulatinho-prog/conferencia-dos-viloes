import { useState } from 'react'
import type { PlayerState } from './setup'
import { tally, finalists, topTied } from './election'

type Props = {
  players: PlayerState[]
  soberanoIndex: number
  presetElected?: number
  excludeAppointed?: number
  keepAppointed?: number
  onDone: (elected: number, appointed: number) => void
}

type Phase = 'voting' | 'result' | 'appoint'

export default function Election({
  players,
  soberanoIndex,
  presetElected,
  excludeAppointed,
  keepAppointed,
  onDone,
}: Props) {
  const voters = players.map((p) => p.id).filter((i) => i !== soberanoIndex)

  const [round, setRound] = useState<1 | 2>(1)
  const [candidates, setCandidates] = useState<number[]>(voters)
  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [votes, setVotes] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>(
    presetElected !== undefined ? 'appoint' : 'voting'
  )
  const [elected, setElected] = useState<number | null>(
    presetElected ?? null
  )

  const soberano = players[soberanoIndex]

  function vote(candidate: number) {
    const next = [...votes, candidate]
    setVotes(next)

    if (pos + 1 >= voters.length) {
      setPhase('result')
    } else {
      setPos(pos + 1)
      setRevealed(false)
    }
  }

  function startSecondRound(list: number[]) {
    setCandidates(list)
    setRound(2)
    setVotes([])
    setPos(0)
    setRevealed(false)
    setPhase('voting')
  }

  function win(index: number) {
    setElected(index)

    // Eleição convocada por líder: o Indicado continua, a menos que
    // ele próprio tenha sido eleito.
    if (keepAppointed !== undefined && index !== keepAppointed) {
      onDone(index, keepAppointed)
      return
    }

    setPhase('appoint')
  }

  const t = tally(votes, candidates)

  let body = null

  if (phase === 'voting') {
    const voter = players[voters[pos]]
    const options = candidates.filter((c) => c !== voter.id)

    body = (
      <section className="home-card">
        <p className="preparation-text">
          Soberano: <strong>{soberano.name}</strong> (não participa da
          votação). Aguarde a votação.
        </p>

        {!revealed ? (
          <>
            <p className="preparation-text">
              Passe o tablet para <strong>{voter.name}</strong>.
            </p>
            <button
              className="primary-button"
              onClick={() => setRevealed(true)}
            >
              VOTAR
            </button>
          </>
        ) : (
          <>
            <div className="room-label">
              {voter.name}, escolha o Membro Eleito
            </div>
            {options.map((c) => (
              <button
                key={c}
                className="secondary-button"
                onClick={() => vote(c)}
              >
                {players[c].name}
              </button>
            ))}
          </>
        )}
      </section>
    )
  }

  if (phase === 'result') {
    const finalList = round === 1 ? finalists(t, candidates) : []
    const tied = round === 2 ? topTied(t, candidates) : []

    body = (
      <section className="home-card">
        <div className="room-label">RESULTADO DA VOTAÇÃO</div>

        <div className="players-list">
          {candidates.map((c) => (
            <div className="player" key={c}>
              <div className="player-name">
                <strong>{players[c].name}</strong>
              </div>
              <span className="player-crown">{t[c]}</span>
            </div>
          ))}
        </div>

        {round === 1 && (
          <>
            <p className="preparation-text">
              Avançam: {finalList.map((c) => players[c].name).join(', ')}
            </p>
            <button
              className="primary-button"
              onClick={() =>
                finalList.length === 1
                  ? win(finalList[0])
                  : startSecondRound(finalList)
              }
            >
              {finalList.length === 1
                ? 'CONTINUAR'
                : 'IR PARA O SEGUNDO TURNO'}
            </button>
          </>
        )}

        {round === 2 && tied.length === 1 && (
          <>
            <p className="preparation-text">
              Membro Eleito: <strong>{players[tied[0]].name}</strong>
            </p>
            <button
              className="primary-button"
              onClick={() => win(tied[0])}
            >
              CONTINUAR
            </button>
          </>
        )}

        {round === 2 && tied.length > 1 && (
          <>
            <p className="preparation-text">
              Empate! <strong>{soberano.name}</strong> (Soberano) escolhe
              diretamente um dos candidatos.
            </p>
            {tied.map((c) => (
              <button
                key={c}
                className="secondary-button"
                onClick={() => win(c)}
              >
                {players[c].name}
              </button>
            ))}
          </>
        )}
      </section>
    )
  }

  if (phase === 'appoint' && elected !== null) {
    const options = players
      .map((p) => p.id)
      .filter(
        (i) =>
          i !== soberanoIndex &&
          i !== elected &&
          i !== excludeAppointed
      )

    body = (
      <section className="home-card">
        <p className="preparation-text">
          Membro Eleito: <strong>{players[elected].name}</strong>
        </p>
        <div className="room-label">
          {soberano.name} (Soberano), escolha o Membro Indicado
        </div>
        {options.map((c) => (
          <button
            key={c}
            className="secondary-button"
            onClick={() => onDone(elected, c)}
          >
            {players[c].name}
          </button>
        ))}
      </section>
    )
  }

  const title =
    phase === 'appoint'
      ? 'MEMBRO INDICADO'
      : round === 1
        ? 'ELEIÇÃO — 1º TURNO'
        : 'ELEIÇÃO — 2º TURNO'

  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby preparation">
        <header className="lobby-title">
          <div className="eyebrow">COMITÊ</div>
          <h1>{title}</h1>
        </header>

        {body}
      </section>
    </main>
  )
}
