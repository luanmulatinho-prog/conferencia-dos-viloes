import { useState } from 'react'
import type { MatchView, Send } from './onlineTypes'
import { Buttons, Frame, Stepper, Wait, nm, tag } from './onlineUi'
import { PAvatar } from './profileUi'

type Props = {
  view: MatchView
  error: string
  send: Send
  onLeave: () => void
}

// Contribuição secreta (Golpe) ou doação (Conferência de Soberania)
function SecretAmount({
  view,
  send,
  kind,
  label,
  note,
}: {
  view: MatchView
  send: Send
  kind: 'contribute' | 'donate'
  label: string
  note?: string
}) {
  const [value, setValue] = useState(0)
  const max = view.me.influence

  return (
    <>
      <div className="room-label">
        {label} — seu saldo: {max}
      </div>
      {note && <p className="preparation-text">{note}</p>}
      <Stepper value={value} max={max} onChange={setValue} />
      <button
        className="primary-button"
        onClick={() => send({ kind, amount: value })}
      >
        CONFIRMAR (SECRETO)
      </button>
    </>
  )
}

export default function OnlineTurns({ view, error, send, onLeave }: Props) {
  const t = view.turns!
  const n = view.players.length
  const iAmSoberano = view.soberano === view.you
  const iAmCurrent = t.current === view.you

  const sub = `Turnos realizados: ${view.chosen.length} de ${n - 1}`

  return (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow={`RODADA ${view.round} — FASE DE TURNOS`}
      title={`Soberano: ${nm(view, view.soberano)} ♛`}
      sub={sub}
    >
      {t.status === 'select' && (
        <section className="players-card">
          <span className="section-label">
            {iAmSoberano
              ? 'ESCOLHA QUEM FARÁ O PRÓXIMO TURNO'
              : 'AGUARDANDO ORDENS DO SOBERANO'}
          </span>

          <div className="players-list">
            {view.players.map((p) => {
              const done = view.chosen.includes(p.index)
              return (
                <div
                  className="player"
                  key={p.index}
                  style={
                    done ? { filter: 'grayscale(1)', opacity: 0.5 } : undefined
                  }
                >
                  <PAvatar p={p} />
                  <div className="player-name">
                    <strong>
                      {tag(view, p.index, p.index === view.you ? ' (você)' : '')}
                    </strong>
                    {p.index === view.soberano && <span>SOBERANO</span>}
                    {done && <span>JÁ TEVE SEU TURNO</span>}
                  </div>
                  {t.eligible.includes(p.index) && (
                    <button
                      className="copy-button"
                      onClick={() => send({ kind: 'pick', player: p.index })}
                    >
                      ESCOLHER
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {t.forced && (
            <div className="waiting">
              <p>
                Um dos dois jogadores restantes ficou sem turno na rodada
                anterior e precisa ser escolhido.
              </p>
            </div>
          )}
        </section>
      )}

      {t.status === 'action' && (
        <section className="home-card">
          {iAmCurrent ? (
            <>
              <div className="room-label">ESCOLHA SUA AÇÃO</div>
              <Buttons
                items={[
                  {
                    label: 'ACUMULAR (+3 INFLUÊNCIA)',
                    primary: true,
                    onClick: () => send({ kind: 'act', choice: 'accumulate' }),
                  },
                  {
                    label: 'COMPRAR PODER',
                    disabled: !t.canBuy,
                    onClick: () => send({ kind: 'act', choice: 'buy' }),
                  },
                  {
                    label: 'GOLPE',
                    disabled: !t.canGolpe,
                    onClick: () => send({ kind: 'act', choice: 'golpe' }),
                  },
                ]}
              />
              <p className="preparation-text">
                Cartas de Poder na sua mão: {view.me.powerCards.length} de 5.
              </p>
              {!t.canGolpe && (
                <p className="preparation-text">
                  Golpe indisponível: você precisa de uma carta Golpe e não
                  pode ser o Soberano nem do partido dele.
                </p>
              )}
            </>
          ) : (
            <Wait>Vez de {nm(view, t.current)}. Aguardando a ação.</Wait>
          )}
        </section>
      )}

      {t.status === 'golpe' && (
        <section className="home-card">
          <h2 className="preparation-title" style={{ fontSize: 22 }}>
            Golpe de {nm(view, t.current)}!
          </h2>
          {t.iContribute ? (
            <SecretAmount
              view={view}
              send={send}
              kind="contribute"
              label="SUA CONTRIBUIÇÃO"
              note="Toda a Influência contribuída vai para quem iniciou o Golpe. O Golpe só vence se o total for maior que a Influência do Soberano."
            />
          ) : (
            <Wait>
              Contribuições recebidas: {t.contributedCount} de{' '}
              {t.contributors.length}. O total será revelado no fim.
            </Wait>
          )}
        </section>
      )}

      {t.status === 'succession' && (
        <section className="home-card">
          <Wait>O Golpe deu certo. Definindo o novo Comitê...</Wait>
        </section>
      )}

      {t.status === 'golpeResult' && t.golpeInfo && (
        <section className="home-card">
          <div className="room-label">CONTRIBUIÇÃO TOTAL</div>
          <h2 className="preparation-title" style={{ fontSize: 40 }}>
            {t.golpeInfo.total}
          </h2>
          <p className="preparation-text">
            O Golpe fracassou. {nm(view, view.soberano)} permanece Soberano.
          </p>

          {iAmSoberano ? (
            <Buttons
              items={[
                {
                  label: 'CONVOCAR CONFERÊNCIA DE SOBERANIA',
                  primary: true,
                  onClick: () => send({ kind: 'convene' }),
                },
                {
                  label: 'NÃO CONVOCAR',
                  onClick: () => send({ kind: 'skipconf' }),
                },
              ]}
            />
          ) : (
            <Wait>O Soberano decide se convoca a Conferência de Soberania.</Wait>
          )}
        </section>
      )}

      {t.status === 'conference' && (
        <section className="home-card">
          <h2 className="preparation-title" style={{ fontSize: 22 }}>
            Conferência de Soberania
          </h2>
          {t.iContribute ? (
            <SecretAmount
              view={view}
              send={send}
              kind="donate"
              label="SUA DOAÇÃO"
              note={`Mínimo total: ${t.required} (rodada × jogadores). Se o total chegar lá, tudo vai para o Soberano. Senão, tudo vai para o Comitê.`}
            />
          ) : (
            <Wait>
              Doações recebidas: {t.contributedCount} de {t.contributors.length}.
            </Wait>
          )}
        </section>
      )}

      {t.log.length > 0 && (
        <section className="players-card" style={{ marginTop: 14 }}>
          <span className="section-label">O QUE ACONTECEU NESTA FASE</span>
          <div style={{ marginTop: 8 }}>
            {t.log.map((l, i) => (
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
    </Frame>
  )
}
