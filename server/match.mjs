// Estado e regras completas da partida no servidor.
// Reaproveita a lógica de src/*.ts, convertida para JavaScript em
// server/lib/ pelo build-lib.mjs.

import {
  createInitialGame,
  applyInitialChoice,
  finishSetup,
  setCommittee,
} from './lib/setup.mjs'
import { tally, finalists, topTied } from './lib/election.mjs'
import {
  startGame,
  needsCommitteeApproval,
  applyDistribution,
  rejectDistribution,
  committeeRecipients,
  applyCommitteeDistribution,
  freezeCommittee,
} from './lib/game.mjs'
import {
  completeSovereignDistribution,
  checkEnd,
  startNextRound,
  evaluateObjectives,
  reasonText,
} from './lib/round.mjs'
import {
  eligiblePicks,
  accumulate,
  canBuyPower,
  buyPower,
  canGolpe,
  resolveGolpe,
  resolveConference,
  setCommitteeMembers,
} from './lib/turns.mjs'
import {
  startPowerResolution,
  stepPower,
  maxCards,
  NEEDS_TARGET,
} from './lib/power.mjs'
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
} from './lib/parties.mjs'

const NOT_NOW = 'Essa ação não está disponível agora.'
const isInt = Number.isInteger

export function createMatch(roomPlayers) {
  return {
    players: roomPlayers.map((p, i) => ({
      id: p.id,
      index: i,
      name: p.name,
      icon: p.icon,
    })),
    // choice -> election -> appoint -> (rodadas) -> final
    phase: 'choice',
    setup: createInitialGame(roomPlayers.map((p) => p.name)),
    game: null, // estado da partida a partir da Rodada 1
    choices: {},
    voters: [],
    election: null,
    elected: null,
    sub: null, // eleição/indicação/escolha de líder no meio de uma fase
    sov: null,
    com: null,
    turn: null,
    pow: null,
    par: null,
    ext: null,
    final: null,
    recap: null,
    private: {},
    connected: [],
  }
}

const nm = (match, i) => match.players[i].name

function setRecap(match, title, lines) {
  match.recap = { title, lines }
}

// ======================================================================
// Eleição (usada na preparação e nas trocas de Comitê durante a partida)
// ======================================================================

function countVotes(e, voters) {
  const t = tally(
    voters.map((v) => e.votes[v]),
    e.candidates
  )

  if (e.round === 1) {
    const fin = finalists(t, e.candidates)
    e.last = { round: 1, tally: t, advance: fin }
    if (fin.length === 1) return { winner: fin[0] }

    e.round = 2
    e.candidates = fin
    e.votes = {}
    return {}
  }

  const tied = topTied(t, e.candidates)
  e.last = { round: 2, tally: t, tied }
  if (tied.length === 1) return { winner: tied[0] }

  e.tied = tied
  return { tiebreak: true }
}

function newElection(voters) {
  return {
    round: 1,
    candidates: [...voters],
    votes: {},
    status: 'voting', // voting | tiebreak
    last: null,
    tied: [],
  }
}

// ---------- Preparação ----------

function startElection(match) {
  const soberano = match.setup.soberanoIndex
  match.voters = match.players.map((p) => p.index).filter((i) => i !== soberano)
  match.election = newElection(match.voters)
  match.phase = 'election'
}

function win(match, index) {
  match.elected = index
  match.phase = 'appoint'
}

// ---------- Trocas de Comitê durante a partida ----------

// mode: 'full' (eleição + indicação) | 'electOnly' | 'appointOnly'
function startSub(match, opts) {
  const g = match.game
  const sub = {
    kind: 'committee',
    mode: opts.mode,
    resume: opts.resume,
    title: opts.title,
    exclude: opts.exclude,
    status: 'voting',
    elected: null,
    voters: [],
    election: null,
  }

  if (opts.mode === 'appointOnly') {
    sub.elected = g.elected
    sub.status = 'appoint'
  } else {
    sub.voters = match.players
      .map((p) => p.index)
      .filter((i) => i !== g.soberanoIndex)
    sub.election = newElection(sub.voters)
  }

  match.sub = sub
}

// Depois de um Golpe bem-sucedido ou Golpe Supremo
function startSuccession(match, resume) {
  const g = match.game
  if (g.elected === g.soberanoIndex) {
    startSub(match, { mode: 'full', resume, title: 'Novo Comitê' })
  } else {
    startSub(match, { mode: 'appointOnly', resume, title: 'Novo Membro Indicado' })
  }
}

function startLeaderSub(match, needs, rest, resume) {
  match.sub = {
    kind: 'leader',
    resume,
    partyId: needs.partyId,
    candidates: needs.candidates,
    rest,
  }
}

// Quem o Soberano pode indicar. A exclusão (Troca de Gestão) só vale
// se sobrar alguém para escolher.
function appointOptions(match, sub) {
  const g = match.game
  const base = match.players
    .map((p) => p.index)
    .filter((i) => i !== g.soberanoIndex && i !== sub.elected)
  const filtered = base.filter((i) => i !== sub.exclude)
  return filtered.length > 0 ? filtered : base
}

function finishSub(match, elected, appointed) {
  match.game = setCommitteeMembers(match.game, elected, appointed)
  const resume = match.sub.resume
  match.sub = null
  resumeFlow(match, resume)
}

function resumeFlow(match, resume) {
  if (resume === 'turns') return advanceTurns(match)
  if (resume === 'power') return runPower(match)
  if (resume === 'parties') return partiesAfterSub(match)
}

function handleSub(match, idx, a) {
  const sub = match.sub
  const g = match.game
  const n = match.players.length

  if (sub.kind === 'leader') {
    if (a.kind !== 'sleader') return NOT_NOW
    if (idx !== g.soberanoIndex) return 'Só o Soberano escolhe o novo líder.'
    if (!sub.candidates.includes(a.candidate)) return 'Candidato inválido.'

    match.game = setLeader(g, sub.partyId, a.candidate)
    const { rest, resume } = sub
    match.sub = null
    match.par.log.push(`${nm(match, a.candidate)} é o novo líder do partido.`)

    if (resume === 'parties' && match.par.finishing) {
      processLeaves(match, rest)
    }
    return null
  }

  // ---- Comitê ----
  if (a.kind === 'svote') {
    if (sub.status !== 'voting') return NOT_NOW
    if (!sub.voters.includes(idx)) return 'O Soberano não participa da votação.'

    const e = sub.election
    const c = a.candidate
    if (!e.candidates.includes(c) || c === idx) return 'Voto inválido.'
    if (e.votes[idx] !== undefined) return 'Você já votou.'

    e.votes[idx] = c
    if (Object.keys(e.votes).length === sub.voters.length) {
      const r = countVotes(e, sub.voters)
      if (r.winner !== undefined) {
        sub.elected = r.winner
        if (sub.mode === 'electOnly' && r.winner !== g.appointed) {
          finishSub(match, r.winner, g.appointed)
        } else {
          sub.status = 'appoint'
        }
      } else if (r.tiebreak) {
        sub.status = 'tiebreak'
      }
    }
    return null
  }

  if (a.kind === 'stiebreak') {
    if (sub.status !== 'tiebreak') return NOT_NOW
    if (idx !== g.soberanoIndex) return 'Só o Soberano desempata.'
    if (!sub.election.tied.includes(a.candidate)) return 'Candidato inválido.'

    sub.elected = a.candidate
    if (sub.mode === 'electOnly' && a.candidate !== g.appointed) {
      finishSub(match, a.candidate, g.appointed)
    } else {
      sub.status = 'appoint'
    }
    return null
  }

  if (a.kind === 'sappoint') {
    if (sub.status !== 'appoint') return NOT_NOW
    if (idx !== g.soberanoIndex) return 'Só o Soberano indica.'

    const c = a.candidate
    if (!isInt(c) || !appointOptions(match, sub).includes(c)) {
      return 'Candidato inválido.'
    }

    finishSub(match, sub.elected, c)
    return null
  }

  return NOT_NOW
}

// ======================================================================
// Início de rodada
// ======================================================================

function canAskExtension(g) {
  return g.round === 19 && !g.extension && g.consecutive >= 6
}

function beginRound(match) {
  if (canAskExtension(match.game)) {
    match.phase = 'extension'
    match.ext = { status: 'ask', approvals: {}, ok: false }
  } else {
    startSovereign(match)
  }
}

function hExtension(match, idx, a) {
  const ext = match.ext
  const g = match.game

  if (a.kind === 'extask') {
    if (ext.status !== 'ask' || idx !== g.soberanoIndex) return NOT_NOW
    ext.status = 'approval'
    return null
  }

  if (a.kind === 'extskip') {
    if (ext.status !== 'ask' || idx !== g.soberanoIndex) return NOT_NOW
    startSovereign(match)
    return null
  }

  if (a.kind === 'extapprove' || a.kind === 'extreject') {
    if (ext.status !== 'approval') return NOT_NOW
    if (idx !== g.elected && idx !== g.appointed) return 'Só o Comitê decide.'
    if (ext.approvals[idx] !== undefined) return 'Você já decidiu.'

    ext.approvals[idx] = a.kind === 'extapprove'

    if (a.kind === 'extreject') {
      setRecap(match, 'Prorrogação de Mandato', ['A prorrogação foi rejeitada.'])
      startSovereign(match)
    } else if (ext.approvals[g.elected] && ext.approvals[g.appointed]) {
      match.game = { ...g, extension: true }
      setRecap(match, 'Prorrogação de Mandato', [
        'A prorrogação foi aprovada: a partida continua.',
      ])
      startSovereign(match)
    }
    return null
  }

  return NOT_NOW
}

// ======================================================================
// Fase do Soberano
// ======================================================================

function startSovereign(match) {
  match.phase = 'sovereign'
  match.sov = {
    status: 'proposing', // proposing | approval
    proposal: Array(match.players.length).fill(0),
    approvals: {},
  }
}

function finishSovereign(match, kind) {
  const sov = match.sov
  const n = match.players.length
  let g = match.game
  const lines = []

  if (kind === 'rejected') {
    g = rejectDistribution(g)
    lines.push('Distribuição reprovada pelo Comitê: toda a Influência foi para o Comitê.')
  } else {
    g = completeSovereignDistribution(applyDistribution(g, sov.proposal))
    lines.push(
      kind === 'approved'
        ? 'Distribuição aprovada pelo Comitê.'
        : 'Distribuição realizada.'
    )
    for (let i = 0; i < n; i++) {
      if (sov.proposal[i] > 0) lines.push(`${nm(match, i)} recebeu +${sov.proposal[i]}`)
    }
  }

  match.game = g
  setRecap(match, `Fase do Soberano — Rodada ${g.round}`, lines)
  startCommittee(match)
}

function hSovereign(match, idx, a) {
  const sov = match.sov
  const g = match.game
  const n = match.players.length

  if (a.kind === 'proposal') {
    if (sov.status !== 'proposing') return NOT_NOW
    if (idx !== g.soberanoIndex) return 'Só o Soberano propõe.'

    const v = a.values
    if (!Array.isArray(v) || v.length !== n) return 'Proposta inválida.'
    if (!v.every((x) => isInt(x) && x >= 0)) return 'Proposta inválida.'
    if (v.reduce((s, x) => s + x, 0) > n) {
      return 'Você não tem tanta Influência para distribuir.'
    }

    sov.proposal = v
    return null
  }

  if (a.kind === 'confirm') {
    if (sov.status !== 'proposing') return NOT_NOW
    if (idx !== g.soberanoIndex) return 'Só o Soberano confirma.'

    if (needsCommitteeApproval(sov.proposal, g.soberanoIndex, n)) {
      sov.status = 'approval'
    } else {
      finishSovereign(match, 'confirmed')
    }
    return null
  }

  if (a.kind === 'approve' || a.kind === 'reject') {
    if (sov.status !== 'approval') return NOT_NOW
    if (idx !== g.elected && idx !== g.appointed) return 'Só o Comitê decide.'
    if (sov.approvals[idx] !== undefined) return 'Você já decidiu.'

    sov.approvals[idx] = a.kind === 'approve'

    if (a.kind === 'reject') {
      finishSovereign(match, 'rejected')
    } else if (sov.approvals[g.elected] && sov.approvals[g.appointed]) {
      finishSovereign(match, 'approved')
    }
    return null
  }

  return NOT_NOW
}

// ======================================================================
// Fase do Comitê
// ======================================================================

function startCommittee(match) {
  match.phase = 'committee'
  match.com = {
    status: 'proposing', // proposing | response
    proposal: Array(match.players.length).fill(0),
  }

  if (committeeRecipients(match.game).length === 0) {
    const g = match.game
    match.game = freezeCommittee(g)
    setRecap(match, `Fase do Comitê — Rodada ${g.round}`, [
      'Não há quem possa receber Influência do Comitê.',
      'Influências congeladas até a próxima rodada',
    ])
    startTurns(match)
  }
}

function comRoles(g) {
  // Rodadas ímpares: o Eleito propõe. Pares: o Indicado propõe.
  return g.round % 2 === 1
    ? { proposer: g.elected, responder: g.appointed }
    : { proposer: g.appointed, responder: g.elected }
}

function hCommittee(match, idx, a) {
  const com = match.com
  const g = match.game
  const n = match.players.length
  const { proposer, responder } = comRoles(g)
  const sum = (v) => v.reduce((s, x) => s + x, 0)

  if (a.kind === 'cproposal') {
    if (com.status !== 'proposing') return NOT_NOW
    if (idx !== proposer) return 'Só quem propõe nesta rodada pode montar a proposta.'

    const v = a.values
    if (!Array.isArray(v) || v.length !== n) return 'Proposta inválida.'
    if (!v.every((x) => isInt(x) && x >= 0)) return 'Proposta inválida.'

    const recipients = committeeRecipients(g)
    if (v.some((x, i) => x > 0 && !recipients.includes(i))) {
      return 'O Comitê não pode dar Influência ao Soberano nem aos membros do Comitê.'
    }
    if (sum(v) > g.committeeInfluence) return 'Influência insuficiente no Comitê.'

    com.proposal = v
    return null
  }

  if (a.kind === 'csubmit') {
    if (com.status !== 'proposing') return NOT_NOW
    if (idx !== proposer) return NOT_NOW
    if (sum(com.proposal) !== g.committeeInfluence) {
      return 'Toda a Influência do Comitê precisa ser distribuída.'
    }
    com.status = 'response'
    return null
  }

  if (a.kind === 'caccept' || a.kind === 'cnodeal') {
    if (com.status !== 'response') return NOT_NOW
    if (idx !== responder) return 'Só quem responde nesta rodada pode decidir.'

    const lines = []
    if (a.kind === 'caccept') {
      match.game = applyCommitteeDistribution(g, com.proposal)
      lines.push('Distribuição do Comitê realizada.')
      for (let i = 0; i < n; i++) {
        if (com.proposal[i] > 0) lines.push(`${nm(match, i)} recebeu +${com.proposal[i]}`)
      }
    } else {
      match.game = freezeCommittee(g)
      lines.push('Influências congeladas até a próxima rodada')
    }

    setRecap(match, `Fase do Comitê — Rodada ${g.round}`, lines)
    startTurns(match)
    return null
  }

  return NOT_NOW
}

// ======================================================================
// Fase de Turnos
// ======================================================================

function startTurns(match) {
  match.phase = 'turns'
  match.turn = {
    status: 'select', // select | action | golpe | golpeResult | conference
    current: null,
    contributors: [],
    contrib: {},
    golpeInfo: null,
    log: [],
  }
}

function advanceTurns(match) {
  const g = match.game
  const t = match.turn
  const n = match.players.length

  if (g.chosen.length >= n - 1) {
    const excluded = match.players.map((p) => p.index).filter((i) => !g.chosen.includes(i))
    match.game = { ...g, lastExcluded: excluded[0] ?? null }
    setRecap(match, `Fase de Turnos — Rodada ${g.round}`, [
      ...t.log,
      `Sem turno nesta rodada: ${excluded.map((i) => nm(match, i)).join(', ')}`,
    ])
    startPower(match)
  } else {
    t.status = 'select'
    t.current = null
    t.contributors = []
    t.contrib = {}
    t.golpeInfo = null
  }
}

function hTurns(match, idx, a) {
  const t = match.turn
  const g = match.game
  const n = match.players.length

  if (a.kind === 'pick') {
    if (t.status !== 'select') return NOT_NOW
    if (idx !== g.soberanoIndex) return 'Só o Soberano escolhe quem age.'
    if (!eligiblePicks(g).includes(a.player)) return 'Esse jogador não pode ser escolhido agora.'

    t.current = a.player
    t.status = 'action'
    return null
  }

  if (a.kind === 'act') {
    if (t.status !== 'action' || idx !== t.current) return NOT_NOW

    if (a.choice === 'accumulate') {
      match.game = accumulate(g, idx)
      advanceTurns(match)
      return null
    }
    if (a.choice === 'buy') {
      if (!canBuyPower(g, idx)) return 'Você não pode comprar Poder agora.'
      match.game = buyPower(g, idx)
      advanceTurns(match)
      return null
    }
    if (a.choice === 'golpe') {
      if (!canGolpe(g, idx)) return 'Você não pode iniciar um Golpe.'
      t.status = 'golpe'
      t.contributors = match.players.map((p) => p.index).filter((i) => i !== g.soberanoIndex)
      t.contrib = {}
      t.log.push(`${nm(match, idx)} iniciou um Golpe contra ${nm(match, g.soberanoIndex)}!`)
      return null
    }
    return 'Ação inválida.'
  }

  if (a.kind === 'contribute') {
    if (t.status !== 'golpe') return NOT_NOW
    if (!t.contributors.includes(idx)) return NOT_NOW
    if (t.contrib[idx] !== undefined) return 'Você já contribuiu.'

    const amount = a.amount
    if (!isInt(amount) || amount < 0 || amount > g.players[idx].influence) {
      return 'Valor inválido.'
    }
    t.contrib[idx] = amount

    if (Object.keys(t.contrib).length === t.contributors.length) {
      const amounts = Array(n).fill(0)
      for (const i of t.contributors) amounts[i] = t.contrib[i]

      const challenger = t.current
      const r = resolveGolpe(g, challenger, amounts)
      match.game = r.game
      t.golpeInfo = { success: r.success, total: r.total, challenger }
      t.log.push(
        r.success
          ? `Golpe bem-sucedido! Contribuição total: ${r.total}. ${nm(match, challenger)} é o novo Soberano.`
          : `O Golpe fracassou. Contribuição total: ${r.total}.`
      )

      if (r.success) {
        t.status = 'succession'
        startSuccession(match, 'turns')
      } else {
        t.status = 'golpeResult'
      }
    }
    return null
  }

  if (a.kind === 'convene' || a.kind === 'skipconf') {
    if (t.status !== 'golpeResult') return NOT_NOW
    if (idx !== g.soberanoIndex) return 'Só o Soberano decide.'

    if (a.kind === 'skipconf') {
      advanceTurns(match)
    } else {
      t.status = 'conference'
      t.contributors = match.players.map((p) => p.index).filter((i) => i !== g.soberanoIndex)
      t.contrib = {}
      t.log.push('O Soberano convocou uma Conferência de Soberania.')
    }
    return null
  }

  if (a.kind === 'donate') {
    if (t.status !== 'conference') return NOT_NOW
    if (!t.contributors.includes(idx)) return NOT_NOW
    if (t.contrib[idx] !== undefined) return 'Você já doou.'

    const amount = a.amount
    if (!isInt(amount) || amount < 0 || amount > g.players[idx].influence) {
      return 'Valor inválido.'
    }
    t.contrib[idx] = amount

    if (Object.keys(t.contrib).length === t.contributors.length) {
      const donations = Array(n).fill(0)
      for (const i of t.contributors) donations[i] = t.contrib[i]

      const r = resolveConference(g, donations)
      match.game = r.game
      t.log.push(
        r.success
          ? `Conferência de Soberania: ${r.total} doados (mínimo ${r.required}). Tudo foi para o Soberano.`
          : `Conferência de Soberania: ${r.total} doados (mínimo ${r.required}). Tudo foi para o Comitê.`
      )
      advanceTurns(match)
    }
    return null
  }

  return NOT_NOW
}

// ======================================================================
// Fase de Poder
// ======================================================================

function startPower(match) {
  const g = match.game
  match.phase = 'power'
  match.pow = { submitted: {}, queue: [], log: [], choices: [] }

  // Quem não tem cartas não precisa escolher nada
  for (const p of g.players) {
    if (p.powerCards.length === 0) match.pow.submitted[p.id] = []
  }
  if (Object.keys(match.pow.submitted).length === match.players.length) {
    beginPowerResolution(match)
  }
}

function validatePlays(match, idx, plays) {
  const g = match.game
  const n = match.players.length
  if (!Array.isArray(plays)) return 'Escolha inválida.'

  const hand = [...g.players[idx].powerCards]
  const clean = []

  for (const p of plays) {
    if (!p || typeof p.card !== 'string') return 'Escolha inválida.'

    const pos = hand.indexOf(p.card)
    if (pos < 0) return 'Você não tem essa carta.'
    hand.splice(pos, 1)

    if (p.card === 'Golpe Supremo' && g.committeeDistributed) {
      return 'O Golpe Supremo só pode ser usado se o Comitê não distribuiu Influência.'
    }

    const play = { card: p.card }
    if (NEEDS_TARGET.includes(p.card)) {
      if (!isInt(p.target) || p.target < 0 || p.target >= n || p.target === idx) {
        return 'Alvo inválido.'
      }
      play.target = p.target
    }
    clean.push(play)
  }

  if (clean.filter((p) => p.card === 'Ataque Triplo').length > 1) {
    return 'Não é possível combinar dois Ataques Triplos.'
  }
  if (clean.length > maxCards(clean)) {
    return 'Você usou mais cartas do que o permitido.'
  }
  return clean
}

function beginPowerResolution(match) {
  const pow = match.pow
  const choices = match.players.map((p) => ({
    player: p.index,
    plays: pow.submitted[p.index] ?? [],
  }))
  const s = startPowerResolution(match.game, choices)
  match.game = s.game
  pow.queue = s.queue
  pow.choices = choices
  runPower(match)
}

function runPower(match) {
  const pow = match.pow

  while (pow.queue.length > 0) {
    const item = pow.queue[0]
    const prevAppointed = match.game.appointed
    const r = stepPower(match.game, item)

    match.game = r.game
    pow.log.push(...r.log)
    pow.queue.shift()

    if (r.need === 'succession') {
      startSuccession(match, 'power')
      return
    }
    if (r.need === 'appoint') {
      startSub(match, {
        mode: 'appointOnly',
        resume: 'power',
        exclude: prevAppointed,
        title: 'Troca de Gestão',
      })
      return
    }
  }

  finishPower(match)
}

function finishPower(match) {
  const pow = match.pow
  const g = match.game

  match.game = { ...g, lastPower: { choices: pow.choices, log: pow.log } }

  const lines = pow.log.filter((l) => l.to === 'all').map((l) => l.text)
  setRecap(match, `Fase de Poder — Rodada ${g.round}`, lines.length ? lines : ['Nada de público aconteceu.'])

  match.private = {}
  for (const l of pow.log) {
    if (l.to !== 'all') {
      ;(match.private[l.to] ??= []).push(l.text)
    }
  }

  startParties(match)
}

function hPower(match, idx, a) {
  const pow = match.pow
  if (a.kind !== 'plays') return NOT_NOW
  if (pow.submitted[idx] !== undefined) return 'Você já confirmou sua escolha.'

  const clean = validatePlays(match, idx, a.plays)
  if (typeof clean === 'string') return clean

  pow.submitted[idx] = clean
  if (Object.keys(pow.submitted).length === match.players.length) {
    beginPowerResolution(match)
  }
  return null
}

// ======================================================================
// Fase dos Partidos
// ======================================================================

function startParties(match) {
  match.game = generateInfluence(match.game)
  match.phase = 'parties'
  match.par = {
    done: {},
    pendingLeaves: [],
    foundings: [],
    offers: [],
    cpi: null,
    log: [],
    nextId: 1,
    finishing: false,
  }
}

function partiesAfterSub(match) {
  // Eleições convocadas / indicação terminaram: a fase continua.
  maybeFinishParties(match)
}

// Convites e ofertas que deixaram de valer (alguém entrou em outro partido,
// o partido acabou...) são encerrados.
function sanitizeParties(match) {
  const par = match.par
  const g = match.game

  par.foundings = par.foundings.filter((f) => !partyOf(g, f.creator))

  for (const f of [...par.foundings]) {
    for (const s of f.invitees) {
      if (s.status === 'pending' && partyOf(match.game, s.player)) s.status = 'declined'
    }
    if (f.invitees.every((s) => s.status !== 'pending')) resolveFounding(match, f)
  }

  par.offers = par.offers.filter((o) => {
    const p = match.game.parties.find((x) => x.id === o.partyId)
    return p && !p.memberIds.includes(o.target)
  })
}

function maybeFinishParties(match) {
  const par = match.par
  if (match.sub) return
  sanitizeParties(match)
  if (par.finishing) return
  if (par.foundings.length > 0 || par.offers.length > 0) return
  if (!match.players.every((p) => par.done[p.index])) return

  par.finishing = true
  processLeaves(match, [...par.pendingLeaves])
}

function processLeaves(match, list) {
  let g = match.game

  for (let i = 0; i < list.length; i++) {
    const p = partyOf(g, list[i])
    if (!p) continue

    const r = removeMember(g, p.id, list[i])
    g = r.game
    match.par.log.push(`${nm(match, list[i])} saiu do partido ${p.name}.`)

    if (r.needsChoice) {
      match.game = g
      startLeaderSub(match, r.needsChoice, list.slice(i + 1), 'parties')
      return
    }
  }

  match.game = g
  endRound(match)
}

function endRound(match) {
  const g = match.game
  const par = match.par
  const reason = checkEnd(g)

  if (reason) {
    finishGame(match, reason)
    return
  }

  match.game = startNextRound(g)
  match.private = {}
  setRecap(match, `Fase dos Partidos — fim da Rodada ${g.round}`, par.log.length ? par.log : ['Nada aconteceu na Fase dos Partidos.'])
  beginRound(match)
}

function finishGame(match, reason) {
  const g = match.game
  match.phase = 'final'
  match.final = {
    reason,
    reasonText: reasonText(reason),
    done: evaluateObjectives(g, reason),
  }
}

function resolveFounding(match, f) {
  const par = match.par
  const g = match.game
  par.foundings = par.foundings.filter((x) => x !== f)

  const accepted = f.invitees
    .filter((s) => s.status === 'accepted')
    .map((s) => s.player)
    .filter((i) => !partyOf(g, i) && g.players[i].influence >= COFOUNDER_COST)

  const creatorOk =
    !partyOf(g, f.creator) && g.players[f.creator].influence >= CREATE_COST
  const nameFree = !g.parties.some((p) => p.name.toLowerCase() === f.name.toLowerCase())

  if (creatorOk && nameFree && accepted.length > 0) {
    match.game = createParty(g, f.creator, accepted, f.name)
    par.log.push(
      `${nm(match, f.creator)} criou o partido "${f.name}" com ${accepted.map((i) => nm(match, i)).join(', ')}.`
    )
  } else {
    par.log.push(`O partido "${f.name}" não foi criado. Nada foi cobrado.`)
  }
}

function hParties(match, idx, a) {
  const par = match.par
  const g = match.game
  const n = match.players.length
  const myParty = partyOf(g, idx)
  const isLeader = !!myParty && myParty.leaderId === idx
  const needLeader = () => (isLeader ? null : 'Só o líder do partido faz isso.')

  switch (a.kind) {
    case 'pdone':
      par.done[idx] = true
      maybeFinishParties(match)
      return null

    case 'pundone':
      delete par.done[idx]
      return null

    case 'pcreate': {
      if (myParty) return 'Você já está em um partido.'
      if (par.foundings.some((f) => f.creator === idx)) {
        return 'Você já tem uma fundação em andamento.'
      }
      if (g.players[idx].influence < CREATE_COST) return 'Influência insuficiente.'

      const name = String(a.name ?? '').trim().slice(0, 24)
      if (!name) return 'Dê um nome ao partido.'
      const lower = name.toLowerCase()
      if (
        g.parties.some((p) => p.name.toLowerCase() === lower) ||
        par.foundings.some((f) => f.name.toLowerCase() === lower)
      ) {
        return 'Já existe um partido com esse nome.'
      }

      const inv = Array.isArray(a.invitees) ? [...new Set(a.invitees)] : []
      if (inv.length === 0) return 'Convide pelo menos um jogador.'
      if (!inv.every((i) => isInt(i) && i >= 0 && i < n && i !== idx && !partyOf(g, i))) {
        return 'Convidado inválido.'
      }

      par.foundings.push({
        id: par.nextId++,
        creator: idx,
        name,
        invitees: inv.map((p) => ({ player: p, status: 'pending' })),
      })
      return null
    }

    case 'pfound': {
      const f = par.foundings.find((x) => x.id === a.id)
      const slot = f?.invitees.find((s) => s.player === idx && s.status === 'pending')
      if (!f || !slot) return 'Convite não encontrado.'

      if (a.accept) {
        if (myParty) return 'Você já está em um partido.'
        if (g.players[idx].influence < COFOUNDER_COST) return 'Influência insuficiente.'
        slot.status = 'accepted'
      } else {
        slot.status = 'declined'
      }

      if (f.invitees.every((s) => s.status !== 'pending')) {
        resolveFounding(match, f)
        maybeFinishParties(match)
      }
      return null
    }

    case 'pcancelfound': {
      const f = par.foundings.find((x) => x.id === a.id && x.creator === idx)
      if (!f) return 'Fundação não encontrada.'
      par.foundings = par.foundings.filter((x) => x !== f)
      maybeFinishParties(match)
      return null
    }

    case 'pleave': {
      if (!myParty) return 'Você não está em um partido.'
      if (par.pendingLeaves.includes(idx)) return 'Você já pediu para sair.'
      if (g.players[idx].influence < LEAVE_COST) return 'Influência insuficiente.'

      match.game = payLeave(g, idx)
      par.pendingLeaves.push(idx)
      par.log.push(`${nm(match, idx)} pediu para sair do partido ${myParty.name} (vale na próxima rodada).`)
      return null
    }

    case 'pcpi': {
      const err = needLeader()
      if (err) return err
      if (myParty.influence < CPI_COST) return 'O cofre do partido não tem Influência suficiente.'

      match.game = spend(g, myParty.id, CPI_COST)
      par.cpi = {
        by: myParty.name,
        choices: g.lastPower?.choices ?? [],
        log: g.lastPower?.log ?? [],
      }
      par.log.push(`${myParty.name} abriu uma CPI.`)
      return null
    }

    case 'pelections': {
      const err = needLeader()
      if (err) return err
      if (myParty.influence < ELECTIONS_COST) return 'O cofre do partido não tem Influência suficiente.'

      match.game = spend(g, myParty.id, ELECTIONS_COST)
      par.log.push(`${myParty.name} convocou novas eleições para Membro Eleito.`)
      startSub(match, { mode: 'electOnly', resume: 'parties', title: 'Eleições convocadas' })
      return null
    }

    case 'pindicate': {
      const err = needLeader()
      if (err) return err
      if (myParty.influence < INDICATE_COST) return 'O cofre do partido não tem Influência suficiente.'

      const c = a.player
      if (
        !isInt(c) ||
        !myParty.memberIds.includes(c) ||
        c === idx ||
        c === g.soberanoIndex ||
        c === g.elected
      ) {
        return 'Jogador inválido.'
      }

      match.game = setAppointed(spend(g, myParty.id, INDICATE_COST), c)
      par.log.push(`${myParty.name} indicou ${nm(match, c)} como Membro Indicado.`)
      return null
    }

    case 'precruit': {
      const err = needLeader()
      if (err) return err

      const t = a.target
      if (!isInt(t) || t < 0 || t >= n || t === idx) return 'Alvo inválido.'
      if (myParty.memberIds.includes(t)) return 'Esse jogador já é do seu partido.'
      if (par.pendingLeaves.includes(t)) return 'Esse jogador está de saída do partido.'

      const offer = a.offer
      if (!isInt(offer) || offer < 0) return 'Valor inválido.'
      if (offer + recruitFee(g, t) > myParty.influence) {
        return 'O cofre do partido não cobre a oferta e a taxa de saída.'
      }
      if (par.offers.some((o) => o.partyId === myParty.id && o.target === t)) {
        return 'Já existe uma oferta pendente para esse jogador.'
      }

      par.offers.push({ id: par.nextId++, partyId: myParty.id, target: t, offer })
      return null
    }

    case 'precruitrespond': {
      const o = par.offers.find((x) => x.id === a.id && x.target === idx)
      if (!o) return 'Oferta não encontrada.'
      par.offers = par.offers.filter((x) => x !== o)

      if (a.accept) {
        const party = g.parties.find((p) => p.id === o.partyId)
        if (!party || party.memberIds.includes(idx)) return 'Essa oferta não vale mais.'

        const fee = recruitFee(g, idx)
        if (party.influence < o.offer + fee) {
          return 'O partido não tem mais Influência suficiente para essa oferta.'
        }

        const r = recruitMember(g, party, idx, o.offer)
        match.game = r.game
        par.offers = par.offers.filter((x) => x.target !== idx)
        par.log.push(`${nm(match, idx)} entrou no partido ${party.name}.`)

        if (r.needsChoice) {
          startLeaderSub(match, r.needsChoice, [], 'parties')
          return null
        }
      }
      maybeFinishParties(match)
      return null
    }

    case 'pcancelrecruit': {
      const err = needLeader()
      if (err) return err
      par.offers = par.offers.filter((o) => !(o.id === a.id && o.partyId === myParty.id))
      maybeFinishParties(match)
      return null
    }

    case 'pexpel': {
      const err = needLeader()
      if (err) return err
      if (myParty.influence < EXPEL_COST) return 'O cofre do partido não tem Influência suficiente.'

      const t = a.target
      if (!isInt(t) || t === idx || !myParty.memberIds.includes(t)) return 'Jogador inválido.'

      const r = expelMember(g, myParty.id, t)
      match.game = r.game
      par.log.push(`${nm(match, t)} foi expulso do partido ${myParty.name}.`)
      return null
    }

    case 'pdonate': {
      const err = needLeader()
      if (err) return err

      const amount = a.amount
      if (!isInt(amount) || amount <= 0 || amount > myParty.influence) return 'Valor inválido.'

      const to = a.to
      if (!to || (to.type !== 'player' && to.type !== 'party')) return 'Destino inválido.'

      if (to.type === 'player') {
        if (!isInt(to.id) || to.id < 0 || to.id >= n) return 'Destino inválido.'
      } else if (!g.parties.some((p) => p.id === to.id) || to.id === myParty.id) {
        return 'Destino inválido.'
      }

      match.game = donate(g, myParty.id, amount, to)
      par.log.push(`${myParty.name} fez uma doação.`)
      return null
    }

    default:
      return NOT_NOW
  }
}

// ======================================================================
// Preparação (escolha inicial, eleição, indicação)
// ======================================================================

function hPrep(match, idx, a) {
  const n = match.players.length

  if (match.phase === 'choice') {
    if (a.kind !== 'choose') return NOT_NOW
    if (a.choice !== 'A' && a.choice !== 'B') return 'Escolha inválida.'
    if (match.choices[idx]) return 'Você já fez sua escolha.'

    match.choices[idx] = a.choice

    if (Object.keys(match.choices).length === n) {
      let s = match.setup
      for (let i = 0; i < n; i++) s = applyInitialChoice(s, i, match.choices[i])
      match.setup = finishSetup(s)
      startElection(match)
    }
    return null
  }

  if (match.phase === 'election') {
    const e = match.election

    if (a.kind === 'vote') {
      if (e.status !== 'voting') return NOT_NOW
      if (!match.voters.includes(idx)) return 'O Soberano não participa da votação.'

      const c = a.candidate
      if (!e.candidates.includes(c) || c === idx) return 'Voto inválido.'
      if (e.votes[idx] !== undefined) return 'Você já votou.'

      e.votes[idx] = c
      if (Object.keys(e.votes).length === match.voters.length) {
        const r = countVotes(e, match.voters)
        if (r.winner !== undefined) win(match, r.winner)
        else if (r.tiebreak) e.status = 'tiebreak'
      }
      return null
    }

    if (a.kind === 'tiebreak') {
      if (e.status !== 'tiebreak') return NOT_NOW
      if (idx !== match.setup.soberanoIndex) return 'Só o Soberano desempata.'
      if (!e.tied.includes(a.candidate)) return 'Candidato inválido.'

      win(match, a.candidate)
      return null
    }
    return NOT_NOW
  }

  if (match.phase === 'appoint') {
    if (a.kind !== 'appoint') return NOT_NOW
    if (idx !== match.setup.soberanoIndex) return 'Só o Soberano indica.'

    const c = a.candidate
    if (!isInt(c) || c < 0 || c >= n || c === match.setup.soberanoIndex || c === match.elected) {
      return 'Candidato inválido.'
    }

    match.setup = setCommittee(match.setup, match.elected, c)
    match.game = startGame(match.setup)
    startSovereign(match)
    return null
  }

  return NOT_NOW
}

// ======================================================================
// Entrada principal
// ======================================================================

// Retorna uma mensagem de erro (texto) ou null se deu certo.
export function handleAction(match, playerId, a) {
  const idx = match.players.findIndex((p) => p.id === playerId)
  if (idx < 0) return 'Jogador não encontrado.'

  const absent = match.players.filter((p, i) => match.connected[i] === false)
  if (absent.length > 0) {
    return `Partida pausada: aguardando ${absent.map((p) => p.name).join(', ')} voltar.`
  }

  if (match.phase === 'final') return NOT_NOW
  if (match.sub) return handleSub(match, idx, a)

  switch (match.phase) {
    case 'choice':
    case 'election':
    case 'appoint':
      return hPrep(match, idx, a)
    case 'extension':
      return hExtension(match, idx, a)
    case 'sovereign':
      return hSovereign(match, idx, a)
    case 'committee':
      return hCommittee(match, idx, a)
    case 'turns':
      return hTurns(match, idx, a)
    case 'power':
      return hPower(match, idx, a)
    case 'parties': {
      const result = hParties(match, idx, a)
      if (match.phase === 'parties' && !match.sub) maybeFinishParties(match)
      return result
    }
    default:
      return NOT_NOW
  }
}

// ======================================================================
// O que cada jogador pode ver
// ======================================================================

function subView(match, idx) {
  const sub = match.sub
  if (!sub) return null
  const g = match.game

  if (sub.kind === 'leader') {
    return {
      kind: 'leader',
      partyName: g.parties.find((p) => p.id === sub.partyId)?.name ?? '',
      candidates: sub.candidates,
    }
  }

  const e = sub.election
  return {
    kind: 'committee',
    mode: sub.mode,
    title: sub.title,
    status: sub.status,
    round: e ? e.round : 0,
    candidates: e ? e.candidates : [],
    voters: sub.voters,
    hasVoted: e ? e.votes[idx] !== undefined : false,
    votedCount: e ? Object.keys(e.votes).length : 0,
    last: e ? e.last : null,
    tied: e ? e.tied : [],
    elected: sub.elected,
    appointOptions: sub.status === 'appoint' ? appointOptions(match, sub) : [],
  }
}

export function viewFor(match, playerId) {
  const idx = match.players.findIndex((p) => p.id === playerId)
  const s = match.setup
  const g = match.game
  const n = match.players.length
  const players = g ? g.players : s.players
  const me = players[idx]
  const dealt = s.soberanoIndex !== null
  const e = match.election
  const replaced = s.replacedObjective

  const view = {
    phase: match.phase,
    you: idx,
    round: g ? g.round : 0,
    committeeInfluence: g ? g.committeeInfluence : 0,
    players: match.players.map((p) => ({ index: p.index, name: p.name, icon: p.icon })),
    me: {
      objective: me.objective,
      influence: me.influence,
      powerCards: me.powerCards,
      leadership: dealt ? me.leadership : null,
    },
    hasChosen: match.choices[idx] !== undefined,
    chosenCount: Object.keys(match.choices).length,
    soberano: g ? g.soberanoIndex : dealt ? s.soberanoIndex : null,
    bonus: dealt ? s.bonus : 0,
    elected: g ? g.elected : match.elected,
    appointed: g ? g.appointed : s.appointed,
    notice:
      replaced && replaced.index === idx
        ? `Você foi eleito na Rodada 1 sendo Distribuidor. Seu novo objetivo: ${replaced.to}.`
        : null,
    golpes: g ? g.golpes : [],
    chosen: g ? g.chosen : [],
    stats: g
      ? {
          sovereignRounds: g.sovereignRounds,
          committeeRounds: g.committeeRounds,
          consecutive: g.consecutive,
          soberanoHistory: g.soberanoHistory,
        }
      : null,
    parties: g
      ? g.parties.map((p) => ({
          id: p.id,
          name: p.name,
          leaderId: p.leaderId,
          memberIds: p.memberIds,
          influence: p.influence,
        }))
      : [],
    memberInfluence: {},
    recap: match.recap,
    privateMsgs: match.private[idx] ?? [],
    paused: match.players.filter((p, i) => match.connected[i] === false).map((p) => p.name),
    sub: subView(match, idx),
    election: null,
    sovereign: null,
    committee: null,
    turns: null,
    power: null,
    par: null,
    extension: null,
    final: null,
  }

  // Membros do mesmo partido veem a Influência Individual uns dos outros
  if (g) {
    const mine = partyOf(g, idx)
    if (mine) {
      for (const i of mine.memberIds) view.memberInfluence[i] = g.players[i].influence
    }
  }

  if (match.phase === 'election' && e) {
    view.election = {
      round: e.round,
      candidates: e.candidates,
      status: e.status,
      hasVoted: e.votes[idx] !== undefined,
      votedCount: Object.keys(e.votes).length,
      voterCount: match.voters.length,
      last: e.last,
      tied: e.tied,
    }
  }

  if (match.phase === 'sovereign' && match.sov && g) {
    const sov = match.sov
    view.sovereign = {
      status: sov.status,
      proposal: sov.proposal,
      budget: n,
      canDecide:
        sov.status === 'approval' &&
        (idx === g.elected || idx === g.appointed) &&
        sov.approvals[idx] === undefined,
      decidedCount: Object.keys(sov.approvals).length,
    }
  }

  if (match.phase === 'extension' && match.ext && g) {
    view.extension = {
      status: match.ext.status,
      canDecide:
        match.ext.status === 'approval' &&
        (idx === g.elected || idx === g.appointed) &&
        match.ext.approvals[idx] === undefined,
      consecutive: g.consecutive + 1,
    }
  }

  if (match.phase === 'committee' && match.com && g) {
    const { proposer, responder } = comRoles(g)
    const total = match.com.proposal.reduce((s2, x) => s2 + x, 0)
    view.committee = {
      status: match.com.status,
      proposal: match.com.proposal,
      proposer,
      responder,
      recipients: committeeRecipients(g),
      available: g.committeeInfluence - total,
    }
  }

  if (match.phase === 'turns' && match.turn && g) {
    const t = match.turn
    view.turns = {
      status: t.status,
      current: t.current,
      eligible: t.status === 'select' && idx === g.soberanoIndex ? eligiblePicks(g) : [],
      forced: t.status === 'select' ? eligiblePicks(g).length === 1 : false,
      canBuy: t.status === 'action' && t.current === idx ? canBuyPower(g, idx) : false,
      canGolpe: t.status === 'action' && t.current === idx ? canGolpe(g, idx) : false,
      contributors: t.contributors,
      contributedCount: Object.keys(t.contrib).length,
      iContribute: t.contributors.includes(idx) && t.contrib[idx] === undefined,
      golpeInfo: t.golpeInfo,
      required: g.round * n,
      log: t.log,
    }
  }

  if (match.phase === 'power' && match.pow && g) {
    view.power = {
      iSubmitted: match.pow.submitted[idx] !== undefined,
      submittedCount: Object.keys(match.pow.submitted).length,
      supremeAllowed: !g.committeeDistributed,
    }
  }

  if (match.phase === 'parties' && match.par && g) {
    const par = match.par
    view.par = {
      iDone: !!par.done[idx],
      doneCount: Object.keys(par.done).length,
      pendingLeaves: par.pendingLeaves,
      log: par.log,
      cpi: par.cpi,
      // convites de fundação para mim
      invites: par.foundings
        .filter((f) => f.invitees.some((s) => s.player === idx && s.status === 'pending'))
        .map((f) => ({ id: f.id, creator: f.creator, name: f.name })),
      // minha fundação em andamento
      myFounding: par.foundings
        .filter((f) => f.creator === idx)
        .map((f) => ({ id: f.id, name: f.name, invitees: f.invitees })),
      // ofertas de recrutamento para mim
      offers: par.offers
        .filter((o) => o.target === idx)
        .map((o) => ({
          id: o.id,
          partyId: o.partyId,
          partyName: g.parties.find((p) => p.id === o.partyId)?.name ?? '',
          offer: o.offer,
        })),
      // ofertas enviadas pelo meu partido (se eu for líder)
      sentOffers: (() => {
        const mine = partyOf(g, idx)
        if (!mine || mine.leaderId !== idx) return []
        return par.offers
          .filter((o) => o.partyId === mine.id)
          .map((o) => ({ id: o.id, target: o.target, offer: o.offer }))
      })(),
    }
  }

  if (match.phase === 'final' && match.final && g) {
    view.final = {
      reasonText: match.final.reasonText,
      players: g.players.map((p, i) => ({
        index: i,
        objective: p.objective,
        fulfilled: match.final.done[i],
        influence: p.influence,
        sovereignRounds: g.sovereignRounds[i],
        committeeRounds: g.committeeRounds[i],
        stolen: g.stolen[i],
        partyId: partyOf(g, i)?.id ?? null,
      })),
    }
  }

  return view
}
