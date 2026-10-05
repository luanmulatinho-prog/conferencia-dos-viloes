import { useState } from 'react'
import type { ElectionLast, MatchView, Send } from './onlineTypes'
import { Buttons, Frame, ObjectiveCard, Wait, nm } from './onlineUi'
import OnlineTurns from './OnlineTurns'
import OnlinePower from './OnlinePower'
import OnlineParties from './OnlineParties'
import OnlineFinal from './OnlineFinal'

export type { MatchView } from './onlineTypes'

type Props = {
  view: MatchView
  error: string
  onAction: Send
  onLeave: () => void
}

type ScreenProps = {
  view: MatchView
  error: string
  send: Send
  onLeave: () => void
}

// ---------------------------------------------------------------------
// Votação e indicação (usadas na preparação e nas trocas de Comitê)
// ---------------------------------------------------------------------

function LastResult({ view, last }: { view: MatchView; last: ElectionLast }) {
  return (
    <section className="players-card" style={{ marginBottom: 14 }}>
      <span className="section-label">
        RESULTADO DO {last.round}º TURNO
      </span>
      <div className="players-list">
        {Object.keys(last.tally).map((k) => (
          <div className="player" key={k}>
            <div className="player-name">
              <strong>{nm(view, Number(k))}</strong>
            </div>
            <span className="player-crown">{last.tally[Number(k)]}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function VoteBody({
  view,
  send,
  status,
  round,
  candidates,
  iAmVoter,
  hasVoted,
  votedCount,
  voterCount,
  last,
  tied,
  voteKind,
  tieKind,
}: {
  view: MatchView
  send: Send
  status: 'voting' | 'tiebreak'
  round: number
  candidates: number[]
  iAmVoter: boolean
  hasVoted: boolean
  votedCount: number
  voterCount: number
  last: ElectionLast | null
  tied: number[]
  voteKind: string
  tieKind: string
}) {
  const iAmSoberano = view.soberano === view.you
  const soberanoName = nm(view, view.soberano)

  return (
    <>
      {round === 2 && last && last.round === 1 && (
        <LastResult view={view} last={last} />
      )}

      <section className="home-card">
        {status === 'tiebreak' ? (
          iAmSoberano ? (
            <>
              <div className="room-label">EMPATE! ESCOLHA O MEMBRO ELEITO</div>
              <Buttons
                items={tied.map((c) => ({
                  label: nm(view, c),
                  onClick: () => send({ kind: tieKind, candidate: c }),
                }))}
              />
            </>
          ) : (
            <Wait>
              Empate! O Soberano ({soberanoName}) vai escolher diretamente
              entre: {tied.map((c) => nm(view, c)).join(', ')}.
            </Wait>
          )
        ) : !iAmVoter ? (
          <Wait>
            Aguarde a votação ({votedCount} de {voterCount} votos).
          </Wait>
        ) : hasVoted ? (
          <Wait>
            Voto registrado. Aguardando os outros ({votedCount} de {voterCount}
            ).
          </Wait>
        ) : (
          <>
            <div className="room-label">ESCOLHA O MEMBRO ELEITO DO COMITÊ</div>
            <Buttons
              items={candidates
                .filter((c) => c !== view.you)
                .map((c) => ({
                  label: `${view.players[c].icon} ${nm(view, c)}`,
                  onClick: () => send({ kind: voteKind, candidate: c }),
                }))}
            />
          </>
        )}
      </section>
    </>
  )
}

function AppointBody({
  view,
  send,
  options,
  kind,
  elected,
}: {
  view: MatchView
  send: Send
  options: number[]
  kind: string
  elected: number | null
}) {
  const iAmSoberano = view.soberano === view.you

  return (
    <section className="home-card">
      {elected !== null && (
        <p className="preparation-text">
          Membro Eleito: <strong>{nm(view, elected)}</strong>
        </p>
      )}

      {iAmSoberano ? (
        <>
          <div className="room-label">ESCOLHA O MEMBRO INDICADO</div>
          <Buttons
            items={options.map((c) => ({
              label: `${view.players[c].icon} ${nm(view, c)}`,
              onClick: () => send({ kind, candidate: c }),
            }))}
          />
        </>
      ) : (
        <Wait>
          Aguarde, o Soberano escolherá o Membro Indicado do Comitê.
        </Wait>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// Preparação
// ---------------------------------------------------------------------

function ChoiceScreen({ view, error, send, onLeave }: ScreenProps) {
  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow="PREPARAÇÃO"
      title="Escolha inicial"
    >
      <section className="home-card">
        <ObjectiveCard name={view.me.objective} label="SEU OBJETIVO SECRETO" />

        {!view.hasChosen ? (
          <>
            <p className="preparation-text">Faça a sua escolha inicial</p>
            <button
              className="primary-button"
              onClick={() => send({ kind: 'choose', choice: 'A' })}
            >
              5 INFLUÊNCIA
            </button>
            <button
              className="secondary-button"
              onClick={() => send({ kind: 'choose', choice: 'B' })}
            >
              2 INFLUÊNCIA + 1 CARTA DE PODER
            </button>
          </>
        ) : (
          <Wait>
            Escolha registrada. Aguardando os outros jogadores (
            {view.chosenCount} de {view.players.length}).
          </Wait>
        )}
      </section>
    </Frame>
  )
}

function ElectionScreen({ view, error, send, onLeave }: ScreenProps) {
  const e = view.election!
  const iAmSoberano = view.soberano === view.you

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow="COMITÊ"
      title={
        e.status === 'tiebreak' ? 'Empate na eleição' : `Eleição — ${e.round}º turno`
      }
      sub={`Soberano: ${nm(view, view.soberano)} ♛`}
    >
      {iAmSoberano && (
        <Wait>
          Você é o primeiro Soberano e recebeu +{view.bonus} Influência.
        </Wait>
      )}
      <VoteBody
        view={view}
        send={send}
        status={e.status}
        round={e.round}
        candidates={e.candidates}
        iAmVoter={!iAmSoberano}
        hasVoted={e.hasVoted}
        votedCount={e.votedCount}
        voterCount={e.voterCount}
        last={e.last}
        tied={e.tied}
        voteKind="vote"
        tieKind="tiebreak"
      />
    </Frame>
  )
}

function AppointScreen({ view, error, send, onLeave }: ScreenProps) {
  const options = view.players
    .map((p) => p.index)
    .filter((i) => i !== view.soberano && i !== view.elected)

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow="COMITÊ"
      title="Membro Indicado"
      sub={`Soberano: ${nm(view, view.soberano)} ♛`}
    >
      <AppointBody
        view={view}
        send={send}
        options={options}
        kind="appoint"
        elected={view.elected}
      />
    </Frame>
  )
}

// Eleição/indicação no meio de uma fase (Golpe, Poder, Partidos)
function SubScreen({ view, error, send, onLeave }: ScreenProps) {
  const sub = view.sub!
  const iAmSoberano = view.soberano === view.you

  if (sub.kind === 'leader') {
    return (
      <Frame
        view={view}
        error={error}
        onLeave={onLeave}
        eyebrow="PARTIDOS"
        title="Empate na liderança"
        sub={`Partido: ${sub.partyName}`}
      >
        <section className="home-card">
          {iAmSoberano ? (
            <>
              <div className="room-label">ESCOLHA O NOVO LÍDER DO PARTIDO</div>
              <Buttons
                items={sub.candidates.map((c) => ({
                  label: nm(view, c),
                  onClick: () => send({ kind: 'sleader', candidate: c }),
                }))}
              />
            </>
          ) : (
            <Wait>
              Empate entre os membros com mais Influência. O Soberano (
              {nm(view, view.soberano)}) escolhe o novo líder.
            </Wait>
          )}
        </section>
      </Frame>
    )
  }

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow="COMITÊ"
      title={sub.title}
      sub={`Soberano: ${nm(view, view.soberano)} ♛`}
    >
      {sub.status === 'appoint' ? (
        <AppointBody
          view={view}
          send={send}
          options={sub.appointOptions}
          kind="sappoint"
          elected={sub.elected}
        />
      ) : (
        <VoteBody
          view={view}
          send={send}
          status={sub.status}
          round={sub.round}
          candidates={sub.candidates}
          iAmVoter={sub.voters.includes(view.you)}
          hasVoted={sub.hasVoted}
          votedCount={sub.votedCount}
          voterCount={sub.voters.length}
          last={sub.last}
          tied={sub.tied}
          voteKind="svote"
          tieKind="stiebreak"
        />
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------
// Prorrogação de Mandato
// ---------------------------------------------------------------------

function ExtensionScreen({ view, error, send, onLeave }: ScreenProps) {
  const x = view.extension!
  const iAmSoberano = view.soberano === view.you

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow={`RODADA ${view.round} — FASE DO SOBERANO`}
      title="Prorrogação de Mandato"
      sub={`Soberano: ${nm(view, view.soberano)} ♛ (${x.consecutive}ª rodada consecutiva)`}
    >
      <section className="home-card">
        {x.status === 'ask' ? (
          iAmSoberano ? (
            <>
              <p className="preparation-text">
                Você pode solicitar a Prorrogação de Mandato.
              </p>
              <Buttons
                items={[
                  {
                    label: 'SOLICITAR PRORROGAÇÃO',
                    primary: true,
                    onClick: () => send({ kind: 'extask' }),
                  },
                  {
                    label: 'NÃO SOLICITAR',
                    onClick: () => send({ kind: 'extskip' }),
                  },
                ]}
              />
            </>
          ) : (
            <Wait>O Soberano está decidindo se solicita a Prorrogação.</Wait>
          )
        ) : x.canDecide ? (
          <>
            <div className="room-label">O COMITÊ DECIDE (CONSENSO)</div>
            <Buttons
              items={[
                {
                  label: 'APROVAR',
                  primary: true,
                  onClick: () => send({ kind: 'extapprove' }),
                },
                { label: 'REPROVAR', onClick: () => send({ kind: 'extreject' }) },
              ]}
            />
          </>
        ) : (
          <Wait>Aguardando a decisão do Comitê.</Wait>
        )}
      </section>
    </Frame>
  )
}

// ---------------------------------------------------------------------
// Fase do Soberano
// ---------------------------------------------------------------------

function SovereignScreen({ view, error, send, onLeave }: ScreenProps) {
  const s = view.sovereign!
  const iAmSoberano = view.soberano === view.you
  const [local, setLocal] = useState<number[] | null>(null)

  const proposal =
    iAmSoberano && s.status === 'proposing' && local ? local : s.proposal
  const total = proposal.reduce((a, b) => a + b, 0)
  const available = s.budget - total
  const needsApproval = proposal.some(
    (v, i) => i !== view.soberano && v * 2 > s.budget
  )

  function change(i: number, d: number) {
    if (d > 0 && available <= 0) return
    if (proposal[i] + d < 0) return

    const next = [...proposal]
    next[i] += d
    setLocal(next)
    send({ kind: 'proposal', values: next })
  }

  const roleOf = (i: number) =>
    i === view.soberano
      ? 'SOBERANO'
      : i === view.elected
        ? 'MEMBRO ELEITO'
        : i === view.appointed
          ? 'MEMBRO INDICADO'
          : ''

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow={`RODADA ${view.round} — FASE DO SOBERANO`}
      title={`${nm(view, view.soberano)} ♛`}
      sub={`Comitê: ${nm(view, view.elected)} (Eleito) · ${nm(view, view.appointed)} (Indicado) · Influência do Comitê: ${view.committeeInfluence}`}
    >
      {s.status === 'proposing' && (
        <>
          <section className="players-card">
            <span className="section-label">
              {iAmSoberano
                ? 'SUA PROPOSTA DE DISTRIBUIÇÃO'
                : 'PROPOSTA DO SOBERANO (EM TEMPO REAL)'}
            </span>

            <div className="players-list">
              {view.players.map((p) => (
                <div className="player" key={p.index}>
                  <div className="avatar">{p.icon}</div>
                  <div className="player-name">
                    <strong>
                      {p.name}
                      {p.index === view.you ? ' (você)' : ''}
                    </strong>
                    {roleOf(p.index) && <span>{roleOf(p.index)}</span>}
                  </div>

                  {iAmSoberano ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        className="copy-button"
                        onClick={() => change(p.index, -1)}
                      >
                        −
                      </button>
                      <strong style={{ minWidth: 22, textAlign: 'center' }}>
                        {proposal[p.index]}
                      </strong>
                      <button
                        className="copy-button"
                        onClick={() => change(p.index, 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="player-crown">{proposal[p.index]}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="waiting">
              <span>DISPONÍVEL</span>
              <p>
                <strong>{available}</strong> de {s.budget}. O que sobrar vai para
                o Comitê.
              </p>
            </div>
          </section>

          {iAmSoberano ? (
            <section className="lobby-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setLocal(null)
                  send({ kind: 'confirm' })
                }}
              >
                {needsApproval ? 'ENVIAR AO COMITÊ' : 'CONFIRMAR'}
              </button>
              {needsApproval && (
                <p className="preparation-text" style={{ margin: 0 }}>
                  Algum jogador receberá mais de {s.budget / 2} Influências.
                </p>
              )}
            </section>
          ) : (
            <Wait>Aguardando ordens do Soberano.</Wait>
          )}
        </>
      )}

      {s.status === 'approval' && (
        <section className="home-card">
          <div className="room-label">O COMITÊ DECIDE</div>

          <div className="players-list">
            {view.players.map(
              (p) =>
                s.proposal[p.index] > 0 && (
                  <div className="player" key={p.index}>
                    <div className="player-name">
                      <strong>{p.name}</strong>
                    </div>
                    <span className="player-crown">+{s.proposal[p.index]}</span>
                  </div>
                )
            )}
          </div>

          {s.canDecide ? (
            <Buttons
              items={[
                {
                  label: 'APROVAR',
                  primary: true,
                  onClick: () => send({ kind: 'approve' }),
                },
                { label: 'REPROVAR', onClick: () => send({ kind: 'reject' }) },
              ]}
            />
          ) : (
            <Wait>Aguardando a decisão do Comitê ({s.decidedCount} de 2).</Wait>
          )}
        </section>
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------
// Fase do Comitê
// ---------------------------------------------------------------------

function CommitteeScreen({ view, error, send, onLeave }: ScreenProps) {
  const c = view.committee!
  const [local, setLocal] = useState<number[] | null>(null)

  const iPropose = c.proposer === view.you
  const iRespond = c.responder === view.you
  const proposal = iPropose && c.status === 'proposing' && local ? local : c.proposal
  const total = proposal.reduce((a, b) => a + b, 0)
  const available = view.committeeInfluence - total

  function change(i: number, d: number) {
    if (d > 0 && available <= 0) return
    if (proposal[i] + d < 0) return

    const next = [...proposal]
    next[i] += d
    setLocal(next)
    send({ kind: 'cproposal', values: next })
  }

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow={`RODADA ${view.round} — FASE DO COMITÊ`}
      title={`Influência do Comitê: ${view.committeeInfluence}`}
      sub={`${nm(view, c.proposer)} propõe · ${nm(view, c.responder)} responde`}
    >
      {c.status === 'proposing' && (
        <>
          <section className="players-card">
            <span className="section-label">
              PROPOSTA DE {nm(view, c.proposer).toUpperCase()}
              {iPropose ? ' (VOCÊ)' : ' (EM TEMPO REAL)'}
            </span>

            <div className="players-list">
              {view.players.map((p) => {
                const canReceive = c.recipients.includes(p.index)
                return (
                  <div className="player" key={p.index}>
                    <div className="avatar">{p.icon}</div>
                    <div className="player-name">
                      <strong>{p.name}</strong>
                      {p.index === view.soberano && <span>SOBERANO</span>}
                      {p.index === view.elected && <span>MEMBRO ELEITO</span>}
                      {p.index === view.appointed && <span>MEMBRO INDICADO</span>}
                    </div>

                    {!canReceive ? (
                      <span className="player-crown">—</span>
                    ) : iPropose ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="copy-button"
                          onClick={() => change(p.index, -1)}
                        >
                          −
                        </button>
                        <strong style={{ minWidth: 22, textAlign: 'center' }}>
                          {proposal[p.index]}
                        </strong>
                        <button
                          className="copy-button"
                          onClick={() => change(p.index, 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="player-crown">{proposal[p.index]}</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="waiting">
              <span>DISPONÍVEL</span>
              <p>
                <strong>{available}</strong> de {view.committeeInfluence}. Para
                haver distribuição, toda a Influência deve ser distribuída.
              </p>
            </div>
          </section>

          {iPropose ? (
            <section className="lobby-actions">
              <button
                className="primary-button"
                disabled={available !== 0}
                onClick={() => {
                  setLocal(null)
                  send({ kind: 'csubmit' })
                }}
              >
                ENVIAR PROPOSTA
              </button>
            </section>
          ) : (
            <Wait>Aguardando a proposta de {nm(view, c.proposer)}.</Wait>
          )}
        </>
      )}

      {c.status === 'response' && (
        <section className="home-card">
          <div className="room-label">PROPOSTA DO COMITÊ</div>

          <div className="players-list">
            {view.players.map(
              (p) =>
                c.proposal[p.index] > 0 && (
                  <div className="player" key={p.index}>
                    <div className="player-name">
                      <strong>{p.name}</strong>
                    </div>
                    <span className="player-crown">+{c.proposal[p.index]}</span>
                  </div>
                )
            )}
          </div>

          {iRespond ? (
            <Buttons
              items={[
                {
                  label: 'REALIZAR DISTRIBUIÇÃO',
                  primary: true,
                  onClick: () => send({ kind: 'caccept' }),
                },
                { label: 'NÃO HÁ ACORDO', onClick: () => send({ kind: 'cnodeal' }) },
              ]}
            />
          ) : (
            <Wait>Aguardando a resposta de {nm(view, c.responder)}.</Wait>
          )}
        </section>
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------
// Roteador
// ---------------------------------------------------------------------

export default function OnlineMatch({ view, error, onAction, onLeave }: Props) {
  const p: ScreenProps = { view, error, send: onAction, onLeave }

  // Eleição/indicação no meio de uma fase tem prioridade
  if (view.sub) return <SubScreen {...p} />

  switch (view.phase) {
    case 'choice':
      return <ChoiceScreen {...p} />
    case 'election':
      return view.election ? <ElectionScreen {...p} /> : null
    case 'appoint':
      return <AppointScreen {...p} />
    case 'extension':
      return view.extension ? <ExtensionScreen {...p} /> : null
    case 'sovereign':
      return view.sovereign ? <SovereignScreen key={view.round} {...p} /> : null
    case 'committee':
      return view.committee ? <CommitteeScreen key={view.round} {...p} /> : null
    case 'turns':
      return <OnlineTurns {...p} />
    case 'power':
      return <OnlinePower {...p} />
    case 'parties':
      return <OnlineParties {...p} />
    case 'final':
      return <OnlineFinal {...p} />
    default:
      return null
  }
}

