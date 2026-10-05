import { useState, type ReactNode } from 'react'
import type { GameState } from './game'
import { setCommitteeMembers } from './turns'
import Election from './Election'
import {
  partyOf,
  generateInfluence,
  createParty,
  payLeave,
  removeMember,
  setLeader,
  spend,
  recruitFee,
  recruitMember,
  expelMember,
  setAppointed,
  donate,
  CREATE_COST,
  COFOUNDER_COST,
  LEAVE_COST,
  EXPEL_COST,
  CPI_COST,
  ELECTIONS_COST,
  INDICATE_COST,
  type LeaderChoice,
  type DonateTarget,
} from './parties'

type Props = {
  game: GameState
  onNext: (game: GameState) => void
}

type Phase =
  | 'hub'
  | 'menu'
  | 'createPick'
  | 'createAsk'
  | 'recruitPick'
  | 'recruitOffer'
  | 'recruitAsk'
  | 'expelPick'
  | 'indicatePick'
  | 'donateTo'
  | 'donateAmount'
  | 'cpi'
  | 'election'
  | 'leaderChoice'

type Item = {
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}

function Shell({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <main className="app">
      <div className="corner-decoration top-left">✦</div>
      <div className="corner-decoration top-right">✦</div>
      <div className="corner-decoration bottom-left">✦</div>
      <div className="corner-decoration bottom-right">✦</div>

      <section className="lobby">
        <header className="lobby-title">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </header>
        {children}
      </section>
    </main>
  )
}

function Buttons({ items }: { items: Item[] }) {
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

function Stepper({
  value,
  max,
  onChange,
}: {
  value: number
  max: number
  onChange: (v: number) => void
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
          gap: 8,
          marginBottom: 18,
        }}
      >
        {[-10, -5, -1, 1, 5, 10].map((d) => (
          <button key={d} className="copy-button" onClick={() => step(d)}>
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </>
  )
}

export default function PartiesPhase({ game, onNext }: Props) {
  // A Fase dos Partidos começa gerando Influência Partidária
  const [g, setG] = useState<GameState>(() => generateInfluence(game))
  const [phase, setPhase] = useState<Phase>('hub')
  const [actor, setActor] = useState(0)
  const [notice, setNotice] = useState('')
  const [pendingLeaves, setPendingLeaves] = useState<number[]>([])

  const [invitees, setInvitees] = useState<number[]>([])
  const [inviteQueue, setInviteQueue] = useState<number[]>([])
  const [accepted, setAccepted] = useState<number[]>([])
  const [partyName, setPartyName] = useState('')

  const [target, setTarget] = useState(0)
  const [value, setValue] = useState(0)
  const [donateTo, setDonateTo] = useState<DonateTarget | null>(null)

  const [choice, setChoice] = useState<LeaderChoice | null>(null)
  const [afterChoice, setAfterChoice] = useState<'hub' | 'finish'>('hub')
  const [rest, setRest] = useState<number[]>([])

  const name = (i: number) => g.players[i].name
  const eyebrow = `RODADA ${g.round} — FASE DOS PARTIDOS`

  const me = g.players[actor]
  const myParty = partyOf(g, actor)
  const isLeader = !!myParty && myParty.leaderId === actor

  function toHub(msg: string) {
    setNotice(msg)
    setPhase('hub')
  }

  // Líder saiu e houve empate: o Soberano escolhe o novo líder
  function afterRemove(
    next: GameState,
    needs: LeaderChoice | null,
    then: 'hub' | 'finish',
    restList: number[],
    msg: string
  ) {
    setG(next)
    if (needs) {
      setChoice(needs)
      setAfterChoice(then)
      setRest(restList)
      setPhase('leaderChoice')
    } else if (then === 'hub') {
      toHub(msg)
    } else {
      processLeaves(next, restList)
    }
  }

  // Saídas voluntárias valem ao final da fase (na próxima Fase do Soberano)
  function processLeaves(cur: GameState, list: number[]) {
    let c = cur
    for (let i = 0; i < list.length; i++) {
      const p = partyOf(c, list[i])
      if (!p) continue
      const r = removeMember(c, p.id, list[i])
      c = r.game
      if (r.needsChoice) {
        afterRemove(c, r.needsChoice, 'finish', list.slice(i + 1), '')
        return
      }
    }
    onNext(c)
  }

  // ---------- Eleições convocadas pelo líder ----------
  if (phase === 'election') {
    return (
      <Election
        players={g.players}
        soberanoIndex={g.soberanoIndex}
        keepAppointed={g.appointed}
        onDone={(elected, appointed) => {
          setG(setCommitteeMembers(g, elected, appointed))
          toHub('Nova eleição realizada.')
        }}
      />
    )
  }

  // ---------- Escolha de líder em caso de empate ----------
  if (phase === 'leaderChoice' && choice) {
    const party = g.parties.find((p) => p.id === choice.partyId)
    return (
      <Shell eyebrow={eyebrow} title="Empate na liderança">
        <section className="home-card">
          <p className="preparation-text">
            {party?.name}: empate entre os membros com mais Influência.{' '}
            <strong>{name(g.soberanoIndex)}</strong> (Soberano) escolhe o novo
            líder.
          </p>
          <Buttons
            items={choice.candidates.map((c) => ({
              label: name(c),
              onClick: () => {
                const next = setLeader(g, choice.partyId, c)
                setG(next)
                if (afterChoice === 'finish') {
                  processLeaves(next, rest)
                } else {
                  toHub(`${name(c)} é o novo líder.`)
                }
              },
            }))}
          />
        </section>
      </Shell>
    )
  }

  // ---------- Hub ----------
  if (phase === 'hub') {
    return (
      <Shell
        eyebrow={eyebrow}
        title="Partidos"
        sub="Cada partido recebeu rodada × membros em Influência Partidária."
      >
        {notice && (
          <p className="preparation-text" style={{ textAlign: 'center' }}>
            {notice}
          </p>
        )}

        <section className="players-card">
          <span className="section-label">PARTIDOS (PÚBLICO)</span>
          <div className="players-list">
            {g.parties.length === 0 && (
              <p className="preparation-text">Nenhum partido existe.</p>
            )}
            {g.parties.map((p) => (
              <div className="player" key={p.id}>
                <div className="player-name">
                  <strong>{p.name}</strong>
                  <span>
                    Líder: {p.leaderId >= 0 ? name(p.leaderId) : '—'} ·
                    Cofre: {p.influence} ·{' '}
                    {p.memberIds.map(name).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="players-card">
          <span className="section-label">QUEM VAI AGIR?</span>
          <div className="players-list">
            {g.players.map((p) => (
              <div className="player" key={p.id}>
                <div className="avatar">{p.name.charAt(0)}</div>
                <div className="player-name">
                  <strong>{p.name}</strong>
                  <span>
                    {partyOf(g, p.id)?.name ?? 'sem partido'}
                    {pendingLeaves.includes(p.id) ? ' · saindo' : ''}
                  </span>
                </div>
                <button
                  className="copy-button"
                  onClick={() => {
                    setActor(p.id)
                    setNotice('')
                    setPhase('menu')
                  }}
                >
                  AGIR
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="lobby-actions">
          <button
            className="primary-button"
            onClick={() => processLeaves(g, pendingLeaves)}
          >
            ENCERRAR FASE DOS PARTIDOS
          </button>
        </section>
      </Shell>
    )
  }

  // ---------- Menu do jogador ----------
  if (phase === 'menu') {
    const partyless = g.players.filter(
      (p) => p.id !== actor && !partyOf(g, p.id)
    )
    const recruitTargets = myParty
      ? g.players.filter(
          (p) =>
            p.id !== actor &&
            !myParty.memberIds.includes(p.id) &&
            !pendingLeaves.includes(p.id) &&
            recruitFee(g, p.id) <= myParty.influence
        )
      : []
    const expellable = myParty
      ? myParty.memberIds.filter((i) => i !== actor)
      : []
    const indicatable = myParty
      ? myParty.memberIds.filter(
          (i) => i !== actor && i !== g.soberanoIndex && i !== g.elected
        )
      : []
    const coffer = myParty?.influence ?? 0

    const items: Item[] = []

    if (!myParty) {
      items.push({
        label: `CRIAR PARTIDO (${CREATE_COST})`,
        disabled: me.influence < CREATE_COST || partyless.length === 0,
        onClick: () => {
          setInvitees([])
          setPartyName(`Partido ${me.name}`)
          setPhase('createPick')
        },
      })
    } else {
      items.push({
        label: `SAIR DO PARTIDO (${LEAVE_COST})`,
        disabled:
          me.influence < LEAVE_COST || pendingLeaves.includes(actor),
        onClick: () => {
          setG(payLeave(g, actor))
          setPendingLeaves([...pendingLeaves, actor])
          toHub(`${name(actor)} sairá do partido ao final desta fase.`)
        },
      })
    }

    if (isLeader && myParty) {
      items.push(
        {
          label: `ABRIR CPI (${CPI_COST})`,
          disabled: coffer < CPI_COST,
          onClick: () => {
            setG(spend(g, myParty.id, CPI_COST))
            setPhase('cpi')
          },
        },
        {
          label: `CONVOCAR ELEIÇÕES (${ELECTIONS_COST})`,
          disabled: coffer < ELECTIONS_COST,
          onClick: () => {
            setG(spend(g, myParty.id, ELECTIONS_COST))
            setPhase('election')
          },
        },
        {
          label: `INDICAR MEMBRO (${INDICATE_COST})`,
          disabled: coffer < INDICATE_COST || indicatable.length === 0,
          onClick: () => setPhase('indicatePick'),
        },
        {
          label: 'RECRUTAR MEMBRO',
          disabled: recruitTargets.length === 0,
          onClick: () => setPhase('recruitPick'),
        },
        {
          label: `EXPULSAR MEMBRO (${EXPEL_COST})`,
          disabled: coffer < EXPEL_COST || expellable.length === 0,
          onClick: () => setPhase('expelPick'),
        },
        {
          label: 'DOAR INFLUÊNCIA',
          disabled: coffer <= 0,
          onClick: () => {
            setDonateTo(null)
            setValue(0)
            setPhase('donateTo')
          },
        }
      )
    }

    items.push({ label: 'VOLTAR', onClick: () => setPhase('hub') })

    return (
      <Shell
        eyebrow={eyebrow}
        title={`Vez de ${me.name}`}
        sub={`Seu saldo: ${me.influence}`}
      >
        <section className="home-card">
          {myParty && (
            <>
              <div className="room-label">
                {myParty.name} · cofre {myParty.influence}
                {isLeader ? ' · você é o líder' : ''}
              </div>
              {myParty.memberIds.map((i) => (
                <p
                  className="preparation-text"
                  style={{ margin: '2px 0' }}
                  key={i}
                >
                  {name(i)}: {g.players[i].influence}
                </p>
              ))}
            </>
          )}
          <Buttons items={items} />
        </section>
      </Shell>
    )
  }

  // ---------- Criar partido ----------
  if (phase === 'createPick') {
    const options = g.players.filter(
      (p) => p.id !== actor && !partyOf(g, p.id)
    )
    const cleanName = partyName.trim()
    const nameTaken = g.parties.some(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase()
    )
    const nameOk = cleanName.length > 0 && !nameTaken

    return (
      <Shell eyebrow={eyebrow} title="Criar partido" sub="Convide ao menos 1 jogador sem partido">
        <section className="home-card">
          <div className="room-label">NOME DO PARTIDO</div>
          <input
            className="room-input"
            style={{ fontSize: 16, letterSpacing: 1, textTransform: 'none' }}
            value={partyName}
            maxLength={24}
            placeholder="Nome do partido"
            onChange={(e) => setPartyName(e.target.value)}
          />
          {nameTaken && (
            <p className="preparation-text">Já existe um partido com esse nome.</p>
          )}
          <Buttons
            items={[
              ...options.map((p) => ({
                label: `${invitees.includes(p.id) ? '✓ ' : ''}${p.name}`,
                onClick: () =>
                  setInvitees(
                    invitees.includes(p.id)
                      ? invitees.filter((i) => i !== p.id)
                      : [...invitees, p.id]
                  ),
              })),
              {
                label: 'ENVIAR CONVITES',
                primary: true,
                disabled: invitees.length === 0 || !nameOk,
                onClick: () => {
                  setInviteQueue(invitees)
                  setAccepted([])
                  setPhase('createAsk')
                },
              },
              { label: 'CANCELAR', onClick: () => setPhase('menu') },
            ]}
          />
        </section>
      </Shell>
    )
  }

  if (phase === 'createAsk' && inviteQueue.length > 0) {
    const guest = g.players[inviteQueue[0]]

    function answer(yes: boolean) {
      const nextAccepted = yes ? [...accepted, guest.id] : accepted
      const left = inviteQueue.slice(1)

      if (left.length > 0) {
        setAccepted(nextAccepted)
        setInviteQueue(left)
      } else if (nextAccepted.length > 0) {
        setG(createParty(g, actor, nextAccepted, partyName.trim()))
        setInviteQueue([])
        toHub(`${name(actor)} criou o partido ${partyName.trim()}.`)
      } else {
        setInviteQueue([])
        toHub('Ninguém aceitou: o partido não foi criado e nada foi cobrado.')
      }
    }

    return (
      <Shell eyebrow={eyebrow} title="Convite">
        <section className="home-card">
          <p className="preparation-text">
            Passe o tablet para <strong>{guest.name}</strong>.{' '}
            {name(actor)} convida você para fundar o partido “{partyName.trim()}”. Custo para
            você: {COFOUNDER_COST} Influências. Seu saldo: {guest.influence}.
          </p>
          <Buttons
            items={[
              {
                label: 'ACEITAR',
                primary: true,
                disabled: guest.influence < COFOUNDER_COST,
                onClick: () => answer(true),
              },
              { label: 'RECUSAR', onClick: () => answer(false) },
            ]}
          />
        </section>
      </Shell>
    )
  }

  // ---------- Recrutar ----------
  if (phase === 'recruitPick' && myParty) {
    const targets = g.players.filter(
      (p) =>
        p.id !== actor &&
        !myParty.memberIds.includes(p.id) &&
        !pendingLeaves.includes(p.id) &&
        recruitFee(g, p.id) <= myParty.influence
    )
    return (
      <Shell eyebrow={eyebrow} title="Recrutar membro" sub={`Cofre: ${myParty.influence}`}>
        <section className="home-card">
          <Buttons
            items={[
              ...targets.map((p) => ({
                label: `${p.name}${
                  partyOf(g, p.id)
                    ? ` (de ${partyOf(g, p.id)!.name}, +${LEAVE_COST} ao partido dele)`
                    : ''
                }`,
                onClick: () => {
                  setTarget(p.id)
                  setValue(0)
                  setPhase('recruitOffer')
                },
              })),
              { label: 'CANCELAR', onClick: () => setPhase('menu') },
            ]}
          />
        </section>
      </Shell>
    )
  }

  if (phase === 'recruitOffer' && myParty) {
    const fee = recruitFee(g, target)
    const max = myParty.influence - fee

    return (
      <Shell eyebrow={eyebrow} title={`Oferta para ${name(target)}`}>
        <section className="home-card">
          <div className="room-label">
            VALOR DA OFERTA (MÁXIMO {max}
            {fee > 0 ? `, JÁ DESCONTADOS ${fee} DA SAÍDA` : ''})
          </div>
          <Stepper value={value} max={max} onChange={setValue} />
          <Buttons
            items={[
              {
                label: 'ENVIAR OFERTA',
                primary: true,
                onClick: () => setPhase('recruitAsk'),
              },
              { label: 'CANCELAR', onClick: () => setPhase('menu') },
            ]}
          />
        </section>
      </Shell>
    )
  }

  if (phase === 'recruitAsk' && myParty) {
    const guest = g.players[target]
    const old = partyOf(g, target)

    return (
      <Shell eyebrow={eyebrow} title="Proposta de recrutamento">
        <section className="home-card">
          <p className="preparation-text">
            Passe o tablet para <strong>{guest.name}</strong>.{' '}
            {myParty.name} oferece <strong>{value}</strong> Influências para
            você entrar.
            {old ? ` Você deixaria o partido ${old.name}.` : ''}
          </p>
          <Buttons
            items={[
              {
                label: 'ACEITAR',
                primary: true,
                onClick: () => {
                  const r = recruitMember(g, myParty, target, value)
                  afterRemove(
                    r.game,
                    r.needsChoice,
                    'hub',
                    [],
                    `${guest.name} entrou em ${myParty.name}.`
                  )
                },
              },
              {
                label: 'RECUSAR',
                onClick: () => toHub(`${guest.name} recusou a oferta.`),
              },
            ]}
          />
        </section>
      </Shell>
    )
  }

  // ---------- Expulsar ----------
  if (phase === 'expelPick' && myParty) {
    return (
      <Shell eyebrow={eyebrow} title="Expulsar membro" sub={`Custo: ${EXPEL_COST}`}>
        <section className="home-card">
          <Buttons
            items={[
              ...myParty.memberIds
                .filter((i) => i !== actor)
                .map((i) => ({
                  label: name(i),
                  onClick: () => {
                    const r = expelMember(g, myParty.id, i)
                    afterRemove(
                      r.game,
                      r.needsChoice,
                      'hub',
                      [],
                      `${name(i)} foi expulso de ${myParty.name}.`
                    )
                  },
                })),
              { label: 'CANCELAR', onClick: () => setPhase('menu') },
            ]}
          />
        </section>
      </Shell>
    )
  }

  // ---------- Indicar membro ----------
  if (phase === 'indicatePick' && myParty) {
    const options = myParty.memberIds.filter(
      (i) => i !== actor && i !== g.soberanoIndex && i !== g.elected
    )
    return (
      <Shell eyebrow={eyebrow} title="Indicar membro" sub={`Custo: ${INDICATE_COST}`}>
        <section className="home-card">
          <Buttons
            items={[
              ...options.map((i) => ({
                label: name(i),
                onClick: () => {
                  setG(setAppointed(spend(g, myParty.id, INDICATE_COST), i))
                  toHub(`${name(i)} é o novo Membro Indicado.`)
                },
              })),
              { label: 'CANCELAR', onClick: () => setPhase('menu') },
            ]}
          />
        </section>
      </Shell>
    )
  }

  // ---------- Doar ----------
  if (phase === 'donateTo' && myParty) {
    return (
      <Shell eyebrow={eyebrow} title="Doar Influência" sub={`Cofre: ${myParty.influence}`}>
        <section className="home-card">
          <div className="room-label">PARA QUEM?</div>
          <Buttons
            items={[
              ...g.players.map((p) => ({
                label: p.name,
                onClick: () => {
                  setDonateTo({ type: 'player', id: p.id })
                  setValue(0)
                  setPhase('donateAmount')
                },
              })),
              ...g.parties
                .filter((p) => p.id !== myParty.id)
                .map((p) => ({
                  label: `Cofre de ${p.name}`,
                  onClick: () => {
                    setDonateTo({ type: 'party', id: p.id })
                    setValue(0)
                    setPhase('donateAmount')
                  },
                })),
              { label: 'CANCELAR', onClick: () => setPhase('menu') },
            ]}
          />
        </section>
      </Shell>
    )
  }

  if (phase === 'donateAmount' && myParty && donateTo) {
    return (
      <Shell eyebrow={eyebrow} title="Quanto doar?">
        <section className="home-card">
          <Stepper value={value} max={myParty.influence} onChange={setValue} />
          <Buttons
            items={[
              {
                label: 'CONFIRMAR DOAÇÃO',
                primary: true,
                disabled: value <= 0,
                onClick: () => {
                  setG(donate(g, myParty.id, value, donateTo))
                  toHub(`${myParty.name} fez uma doação.`)
                },
              },
              { label: 'CANCELAR', onClick: () => setPhase('menu') },
            ]}
          />
        </section>
      </Shell>
    )
  }

  // ---------- CPI: revela os segredos da Fase de Poder desta rodada ----------
  if (phase === 'cpi') {
    const lp = g.lastPower
    return (
      <Shell eyebrow={eyebrow} title="CPI" sub="Dados secretos da Fase de Poder desta rodada">
        <section className="players-card">
          <span className="section-label">CARTAS USADAS</span>
          <div className="players-list">
            {(!lp || lp.choices.every((c) => c.plays.length === 0)) && (
              <p className="preparation-text">Ninguém usou cartas de Poder.</p>
            )}
            {lp?.choices.map(
              (c) =>
                c.plays.length > 0 && (
                  <div className="player" key={c.player}>
                    <div className="player-name">
                      <strong>{name(c.player)}</strong>
                      <span>
                        {c.plays
                          .map(
                            (p) =>
                              `${p.card}${
                                p.target !== undefined
                                  ? ` → ${name(p.target)}`
                                  : ''
                              }`
                          )
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                )
            )}
          </div>
        </section>

        <section className="players-card">
          <span className="section-label">MENSAGENS DA FASE</span>
          <div className="players-list">
            {lp?.log.map((l, i) => (
              <p className="preparation-text" style={{ margin: '4px 0' }} key={i}>
                {l.to === 'all' ? '[público]' : `[${name(l.to)}]`} {l.text}
              </p>
            ))}
          </div>
        </section>

        <section className="lobby-actions">
          <button className="primary-button" onClick={() => toHub('CPI realizada.')}>
            FECHAR
          </button>
        </section>
      </Shell>
    )
  }

  return null
}
