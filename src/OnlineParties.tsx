import { useState, type ReactNode } from 'react'
import type { MatchView, Send } from './onlineTypes'
import { Buttons, Frame, Stepper, Wait, nm, tag } from './onlineUi'

type Props = {
  view: MatchView
  error: string
  send: Send
  onLeave: () => void
}

type Mode =
  | 'hub'
  | 'create'
  | 'recruitPick'
  | 'recruitOffer'
  | 'expel'
  | 'indicate'
  | 'donateTo'
  | 'donateAmount'

const CREATE_COST = 20
const COFOUNDER_COST = 10
const LEAVE_COST = 50
const EXPEL_COST = 200
const CPI_COST = 50
const ELECTIONS_COST = 100
const INDICATE_COST = 300

export default function OnlineParties({ view, error, send, onLeave }: Props) {
  const par = view.par!
  const me = view.you
  const n = view.players.length

  const [mode, setMode] = useState<Mode>('hub')
  const [partyName, setPartyName] = useState('')
  const [invitees, setInvitees] = useState<number[]>([])
  const [target, setTarget] = useState(0)
  const [value, setValue] = useState(0)
  const [dest, setDest] = useState<{ type: 'player' | 'party'; id: number } | null>(
    null
  )

  const myParty = view.parties.find((p) => p.memberIds.includes(me))
  const isLeader = !!myParty && myParty.leaderId === me
  const partyOf = (i: number) => view.parties.find((p) => p.memberIds.includes(i))
  const leaving = par.pendingLeaves.includes(me)
  const coffer = myParty?.influence ?? 0

  const partyless = view.players.filter((p) => p.index !== me && !partyOf(p.index))
  const recruitFee = (t: number) => (partyOf(t) ? LEAVE_COST : 0)
  const recruitTargets = myParty
    ? view.players.filter(
        (p) =>
          p.index !== me &&
          !myParty.memberIds.includes(p.index) &&
          !par.pendingLeaves.includes(p.index) &&
          recruitFee(p.index) <= coffer
      )
    : []
  const expellable = myParty ? myParty.memberIds.filter((i) => i !== me) : []
  const indicatable = myParty
    ? myParty.memberIds.filter(
        (i) => i !== me && i !== view.soberano && i !== view.elected
      )
    : []

  function back() {
    setMode('hub')
  }

  const eyebrow = `RODADA ${view.round} — FASE DOS PARTIDOS`
  const frame = (title: string, children: ReactNode, sub?: string) => (
    <Frame
      view={view}
      error={error}
      onLeave={onLeave}
      eyebrow={eyebrow}
      title={title}
      sub={sub}
    >
      {children}
    </Frame>
  )

  // ---------------- Formulários ----------------

  if (mode === 'create') {
    const cleanName = partyName.trim()
    const taken = view.parties.some(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase()
    )
    const ok =
      cleanName.length > 0 &&
      !taken &&
      invitees.length > 0 &&
      view.me.influence >= CREATE_COST

    return frame(
      'Criar partido',
      <section className="home-card">
        <p className="preparation-text">
          Custo: {CREATE_COST} Influências (você) + {COFOUNDER_COST} de cada
          convidado que aceitar. Só é cobrado se o partido for criado.
        </p>

        <div className="room-label">NOME DO PARTIDO</div>
        <input
          className="room-input"
          style={{ fontSize: 16, letterSpacing: 1, textTransform: 'none' }}
          value={partyName}
          maxLength={24}
          placeholder="Nome do partido"
          onChange={(e) => setPartyName(e.target.value)}
        />
        {taken && <p className="preparation-text">Já existe um partido com esse nome.</p>}

        <div className="room-label" style={{ marginTop: 16 }}>
          CONVIDAR (SÓ QUEM NÃO TEM PARTIDO)
        </div>
        <Buttons
          items={[
            ...partyless.map((p) => ({
              label: `${invitees.includes(p.index) ? '✓ ' : ''}${p.name}`,
              onClick: () =>
                setInvitees(
                  invitees.includes(p.index)
                    ? invitees.filter((i) => i !== p.index)
                    : [...invitees, p.index]
                ),
            })),
            {
              label: 'ENVIAR CONVITES',
              primary: true,
              disabled: !ok,
              onClick: () => {
                send({ kind: 'pcreate', name: cleanName, invitees })
                back()
              },
            },
            { label: 'CANCELAR', onClick: back },
          ]}
        />
      </section>
    )
  }

  if (mode === 'recruitPick') {
    return frame(
      'Recrutar membro',
      <section className="home-card">
        <p className="preparation-text">Cofre do partido: {coffer}</p>
        <Buttons
          items={[
            ...recruitTargets.map((p) => ({
              label: `${p.name}${
                partyOf(p.index)
                  ? ` (de ${partyOf(p.index)!.name}: +${LEAVE_COST} ao partido dele)`
                  : ''
              }`,
              onClick: () => {
                setTarget(p.index)
                setValue(0)
                setMode('recruitOffer')
              },
            })),
            { label: 'CANCELAR', onClick: back },
          ]}
        />
      </section>
    )
  }

  if (mode === 'recruitOffer') {
    const fee = recruitFee(target)
    const max = Math.max(0, coffer - fee)

    return frame(
      `Oferta para ${nm(view, target)}`,
      <section className="home-card">
        <div className="room-label">
          VALOR DA OFERTA (MÁXIMO {max}
          {fee > 0 ? `, JÁ DESCONTADA A TAXA DE ${fee}` : ''})
        </div>
        <Stepper value={value} max={max} onChange={setValue} />
        <Buttons
          items={[
            {
              label: 'ENVIAR OFERTA',
              primary: true,
              onClick: () => {
                send({ kind: 'precruit', target, offer: value })
                back()
              },
            },
            { label: 'CANCELAR', onClick: back },
          ]}
        />
      </section>
    )
  }

  if (mode === 'expel') {
    return frame(
      'Expulsar membro',
      <section className="home-card">
        <p className="preparation-text">Custo: {EXPEL_COST} do cofre.</p>
        <Buttons
          items={[
            ...expellable.map((i) => ({
              label: tag(view, i),
              onClick: () => {
                send({ kind: 'pexpel', target: i })
                back()
              },
            })),
            { label: 'CANCELAR', onClick: back },
          ]}
        />
      </section>
    )
  }

  if (mode === 'indicate') {
    return frame(
      'Indicar membro',
      <section className="home-card">
        <p className="preparation-text">Custo: {INDICATE_COST} do cofre.</p>
        <Buttons
          items={[
            ...indicatable.map((i) => ({
              label: tag(view, i),
              onClick: () => {
                send({ kind: 'pindicate', player: i })
                back()
              },
            })),
            { label: 'CANCELAR', onClick: back },
          ]}
        />
      </section>
    )
  }

  if (mode === 'donateTo') {
    return frame(
      'Doar Influência',
      <section className="home-card">
        <p className="preparation-text">Cofre do partido: {coffer}</p>
        <div className="room-label">PARA QUEM?</div>
        <Buttons
          items={[
            ...view.players.map((p) => ({
              label: p.name,
              onClick: () => {
                setDest({ type: 'player', id: p.index })
                setValue(0)
                setMode('donateAmount')
              },
            })),
            ...view.parties
              .filter((p) => p.id !== myParty?.id)
              .map((p) => ({
                label: `Cofre de ${p.name}`,
                onClick: () => {
                  setDest({ type: 'party', id: p.id })
                  setValue(0)
                  setMode('donateAmount')
                },
              })),
            { label: 'CANCELAR', onClick: back },
          ]}
        />
      </section>
    )
  }

  if (mode === 'donateAmount' && dest) {
    return frame(
      'Quanto doar?',
      <section className="home-card">
        <Stepper value={value} max={coffer} onChange={setValue} />
        <Buttons
          items={[
            {
              label: 'CONFIRMAR DOAÇÃO',
              primary: true,
              disabled: value <= 0,
              onClick: () => {
                send({ kind: 'pdonate', to: dest, amount: value })
                back()
              },
            },
            { label: 'CANCELAR', onClick: back },
          ]}
        />
      </section>
    )
  }

  // ---------------- Tela principal da fase ----------------

  return frame(
    'Partidos',
    <>
      {par.invites.length > 0 && (
        <section className="home-card" style={{ marginBottom: 14 }}>
          <div className="room-label">CONVITES PARA FUNDAR PARTIDO</div>
          {par.invites.map((inv) => (
            <div key={inv.id}>
              <p className="preparation-text">
                {nm(view, inv.creator)} convida você para fundar o partido “
                {inv.name}”. Custo para você: {COFOUNDER_COST} (seu saldo:{' '}
                {view.me.influence}).
              </p>
              <Buttons
                items={[
                  {
                    label: 'ACEITAR',
                    primary: true,
                    disabled: view.me.influence < COFOUNDER_COST || !!myParty,
                    onClick: () => send({ kind: 'pfound', id: inv.id, accept: true }),
                  },
                  {
                    label: 'RECUSAR',
                    onClick: () => send({ kind: 'pfound', id: inv.id, accept: false }),
                  },
                ]}
              />
            </div>
          ))}
        </section>
      )}

      {par.offers.length > 0 && (
        <section className="home-card" style={{ marginBottom: 14 }}>
          <div className="room-label">OFERTAS DE RECRUTAMENTO</div>
          {par.offers.map((o) => (
            <div key={o.id}>
              <p className="preparation-text">
                {o.partyName} oferece <strong>{o.offer}</strong> Influências para
                você entrar.
                {myParty ? ` Você deixaria o partido ${myParty.name}.` : ''}
              </p>
              <Buttons
                items={[
                  {
                    label: 'ACEITAR',
                    primary: true,
                    onClick: () =>
                      send({ kind: 'precruitrespond', id: o.id, accept: true }),
                  },
                  {
                    label: 'RECUSAR',
                    onClick: () =>
                      send({ kind: 'precruitrespond', id: o.id, accept: false }),
                  },
                ]}
              />
            </div>
          ))}
        </section>
      )}

      {par.myFounding.length > 0 && (
        <section className="players-card" style={{ marginBottom: 14 }}>
          <span className="section-label">SUA FUNDAÇÃO EM ANDAMENTO</span>
          {par.myFounding.map((f) => (
            <div key={f.id} style={{ marginTop: 8 }}>
              <p className="preparation-text" style={{ margin: '3px 0' }}>
                “{f.name}”:{' '}
                {f.invitees
                  .map(
                    (s) =>
                      `${nm(view, s.player)} (${
                        s.status === 'pending'
                          ? 'aguardando'
                          : s.status === 'accepted'
                            ? 'aceitou'
                            : 'recusou'
                      })`
                  )
                  .join(', ')}
              </p>
              <button
                className="copy-button"
                onClick={() => send({ kind: 'pcancelfound', id: f.id })}
              >
                CANCELAR
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="players-card">
        <span className="section-label">PARTIDOS (PÚBLICO)</span>
        <div className="players-list">
          {view.parties.length === 0 && (
            <p className="preparation-text">Nenhum partido existe.</p>
          )}
          {view.parties.map((p) => (
            <div className="player" key={p.id}>
              <div className="player-name">
                <strong>{p.name}</strong>
                <span>
                  Líder: {nm(view, p.leaderId)} · Cofre: {p.influence}
                </span>
                <span>
                  {p.memberIds.map((i) => (
                    <span key={i} style={{ marginRight: 6 }}>
                      {tag(view, i, par.pendingLeaves.includes(i) ? ' (saindo)' : '')}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-card" style={{ marginTop: 14 }}>
        <div className="room-label">
          {myParty
            ? `VOCÊ ESTÁ EM ${myParty.name.toUpperCase()}${isLeader ? ' (LÍDER)' : ''}`
            : 'VOCÊ NÃO TEM PARTIDO'}
        </div>
        {myParty && (
          <p className="preparation-text">Cofre do partido: {coffer}</p>
        )}

        <Buttons
          items={[
            ...(!myParty
              ? [
                  {
                    label: `CRIAR PARTIDO (${CREATE_COST})`,
                    disabled:
                      view.me.influence < CREATE_COST ||
                      partyless.length === 0 ||
                      par.myFounding.length > 0,
                    onClick: () => {
                      setInvitees([])
                      setPartyName(`Partido ${nm(view, me)}`)
                      setMode('create')
                    },
                  },
                ]
              : [
                  {
                    label: leaving
                      ? 'VOCÊ SAIRÁ AO FIM DA FASE'
                      : `SAIR DO PARTIDO (${LEAVE_COST})`,
                    disabled: view.me.influence < LEAVE_COST || leaving,
                    onClick: () => send({ kind: 'pleave' }),
                  },
                ]),
            ...(isLeader
              ? [
                  {
                    label: `ABRIR CPI (${CPI_COST})`,
                    disabled: coffer < CPI_COST,
                    onClick: () => send({ kind: 'pcpi' }),
                  },
                  {
                    label: `CONVOCAR ELEIÇÕES (${ELECTIONS_COST})`,
                    disabled: coffer < ELECTIONS_COST,
                    onClick: () => send({ kind: 'pelections' }),
                  },
                  {
                    label: `INDICAR MEMBRO (${INDICATE_COST})`,
                    disabled: coffer < INDICATE_COST || indicatable.length === 0,
                    onClick: () => setMode('indicate'),
                  },
                  {
                    label: 'RECRUTAR MEMBRO',
                    disabled: recruitTargets.length === 0,
                    onClick: () => setMode('recruitPick'),
                  },
                  {
                    label: `EXPULSAR MEMBRO (${EXPEL_COST})`,
                    disabled: coffer < EXPEL_COST || expellable.length === 0,
                    onClick: () => setMode('expel'),
                  },
                  {
                    label: 'DOAR INFLUÊNCIA',
                    disabled: coffer <= 0,
                    onClick: () => {
                      setDest(null)
                      setMode('donateTo')
                    },
                  },
                ]
              : []),
          ]}
        />

        {isLeader && par.sentOffers.length > 0 && (
          <>
            <div className="room-label" style={{ marginTop: 14 }}>
              OFERTAS ENVIADAS PELO SEU PARTIDO
            </div>
            {par.sentOffers.map((o) => (
              <div className="player" key={o.id} style={{ marginTop: 6 }}>
                <div className="player-name">
                  <strong>{tag(view, o.target)}</strong>
                  <span>oferta de {o.offer} · aguardando resposta</span>
                </div>
                <button
                  className="copy-button"
                  onClick={() => send({ kind: 'pcancelrecruit', id: o.id })}
                >
                  CANCELAR
                </button>
              </div>
            ))}
          </>
        )}
      </section>

      {par.cpi && (
        <section className="players-card" style={{ marginTop: 14, borderColor: '#d3ad67' }}>
          <span className="section-label">CPI ABERTA POR {par.cpi.by.toUpperCase()}</span>

          <div className="room-label" style={{ marginTop: 10 }}>
            CARTAS USADAS NA FASE DE PODER
          </div>
          {par.cpi.choices.every((c) => c.plays.length === 0) && (
            <p className="preparation-text">Ninguém usou cartas de Poder.</p>
          )}
          {par.cpi.choices.map(
            (c) =>
              c.plays.length > 0 && (
                <p
                  className="preparation-text"
                  style={{ margin: '3px 0', textAlign: 'left' }}
                  key={c.player}
                >
                  <strong>{tag(view, c.player)}</strong>:{' '}
                  {c.plays
                    .map(
                      (p) =>
                        `${p.card}${
                          p.target !== undefined ? ` → ${nm(view, p.target)}` : ''
                        }`
                    )
                    .join(' · ')}
                </p>
              )
          )}

          <div className="room-label" style={{ marginTop: 10 }}>
            MENSAGENS DA FASE
          </div>
          {par.cpi.log.map((l, i) => (
            <p
              className="preparation-text"
              style={{ margin: '3px 0', textAlign: 'left' }}
              key={i}
            >
              {l.to === 'all' ? '[público]' : `[${nm(view, l.to)}]`} {l.text}
            </p>
          ))}
        </section>
      )}

      {par.log.length > 0 && (
        <section className="players-card" style={{ marginTop: 14 }}>
          <span className="section-label">O QUE ACONTECEU NESTA FASE</span>
          <div style={{ marginTop: 8 }}>
            {par.log.map((l, i) => (
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

      <section className="lobby-actions" style={{ marginTop: 14 }}>
        {par.iDone ? (
          <>
            <Wait>
              Você concluiu suas ações. Prontos: {par.doneCount} de {n}.
            </Wait>
            <button
              className="secondary-button"
              onClick={() => send({ kind: 'pundone' })}
            >
              VOLTAR A AGIR
            </button>
          </>
        ) : (
          <button
            className="primary-button"
            onClick={() => send({ kind: 'pdone' })}
          >
            CONCLUIR MINHAS AÇÕES
          </button>
        )}
      </section>
    </>,
    'Quando todos concluírem e não houver ofertas pendentes, a rodada termina.'
  )
}
