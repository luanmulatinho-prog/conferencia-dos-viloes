import type { GameState, Party } from './game'

export const CREATE_COST = 20
export const COFOUNDER_COST = 10
export const LEAVE_COST = 50
export const EXPEL_COST = 200
export const CPI_COST = 50
export const ELECTIONS_COST = 100
export const INDICATE_COST = 300

export type LeaderChoice = { partyId: number; candidates: number[] }

export function partyOf(g: GameState, id: number): Party | undefined {
  return g.parties.find((p) => p.memberIds.includes(id))
}

// Início da Fase dos Partidos: rodada × número de membros
export function generateInfluence(g: GameState): GameState {
  return {
    ...g,
    parties: g.parties.map((p) => ({
      ...p,
      influence: p.influence + g.round * p.memberIds.length,
    })),
  }
}

// Criação: só é cobrada se pelo menos um convidado aceitou
export function createParty(
  g: GameState,
  creator: number,
  accepted: number[],
  partyName?: string
): GameState {
  const id = Math.max(0, ...g.parties.map((p) => p.id)) + 1
  const total = CREATE_COST + COFOUNDER_COST * accepted.length

  const party: Party = {
    id,
    name: partyName || `Partido ${g.players[creator].name}`,
    leaderId: creator,
    memberIds: [creator, ...accepted],
    influence: total,
  }

  return {
    ...g,
    players: g.players.map((p) => {
      if (p.id === creator) return { ...p, influence: p.influence - CREATE_COST }
      if (accepted.includes(p.id)) {
        return { ...p, influence: p.influence - COFOUNDER_COST }
      }
      return p
    }),
    parties: [...g.parties, party],
  }
}

// Custo de saída (50i) pago pelo jogador ao cofre do partido que ele deixa
export function payLeave(g: GameState, player: number): GameState {
  const party = partyOf(g, player)
  if (!party) return g

  return {
    ...g,
    players: g.players.map((p) =>
      p.id === player ? { ...p, influence: p.influence - LEAVE_COST } : p
    ),
    parties: g.parties.map((p) =>
      p.id === party.id ? { ...p, influence: p.influence + LEAVE_COST } : p
    ),
  }
}

// Tira um jogador do partido.
// - Sobrando 1 membro: o partido é dissolvido e o cofre vai para o Comitê.
// - Líder que sai: assume quem tem mais Influência Individual
//   (empate: o Soberano escolhe, por isso devolve needsChoice).
export function removeMember(
  g: GameState,
  partyId: number,
  playerId: number
): { game: GameState; needsChoice: LeaderChoice | null } {
  const party = g.parties.find((p) => p.id === partyId)
  if (!party) return { game: g, needsChoice: null }

  const rest = party.memberIds.filter((i) => i !== playerId)

  if (rest.length <= 1) {
    return {
      game: {
        ...g,
        parties: g.parties.filter((p) => p.id !== partyId),
        committeeInfluence: g.committeeInfluence + party.influence,
      },
      needsChoice: null,
    }
  }

  let leaderId = party.leaderId
  let needsChoice: LeaderChoice | null = null

  if (party.leaderId === playerId) {
    const max = Math.max(...rest.map((i) => g.players[i].influence))
    const tied = rest.filter((i) => g.players[i].influence === max)

    if (tied.length === 1) {
      leaderId = tied[0]
    } else {
      leaderId = -1
      needsChoice = { partyId, candidates: tied }
    }
  }

  return {
    game: {
      ...g,
      parties: g.parties.map((p) =>
        p.id === partyId ? { ...p, memberIds: rest, leaderId } : p
      ),
    },
    needsChoice,
  }
}

export function setLeader(
  g: GameState,
  partyId: number,
  leader: number
): GameState {
  return {
    ...g,
    parties: g.parties.map((p) =>
      p.id === partyId ? { ...p, leaderId: leader } : p
    ),
  }
}

// Gasta Influência Partidária (CPI, Eleições, Indicar, Expulsar)
export function spend(g: GameState, partyId: number, cost: number): GameState {
  return {
    ...g,
    parties: g.parties.map((p) =>
      p.id === partyId ? { ...p, influence: p.influence - cost } : p
    ),
  }
}

// Se o alvo já está em um partido, o partido que recruta paga 50i ao partido dele
export function recruitFee(g: GameState, target: number): number {
  return partyOf(g, target) ? LEAVE_COST : 0
}

export function recruitMember(
  g: GameState,
  party: Party,
  target: number,
  offer: number
): { game: GameState; needsChoice: LeaderChoice | null } {
  const old = partyOf(g, target)
  const fee = old ? LEAVE_COST : 0

  let cur: GameState = {
    ...g,
    players: g.players.map((p) =>
      p.id === target ? { ...p, influence: p.influence + offer } : p
    ),
    parties: g.parties.map((p) => {
      if (p.id === party.id) return { ...p, influence: p.influence - offer - fee }
      if (old && p.id === old.id) return { ...p, influence: p.influence + fee }
      return p
    }),
  }

  let needsChoice: LeaderChoice | null = null
  if (old) {
    const r = removeMember(cur, old.id, target)
    cur = r.game
    needsChoice = r.needsChoice
  }

  cur = {
    ...cur,
    parties: cur.parties.map((p) =>
      p.id === party.id ? { ...p, memberIds: [...p.memberIds, target] } : p
    ),
  }

  return { game: cur, needsChoice }
}

export function expelMember(
  g: GameState,
  partyId: number,
  target: number
): { game: GameState; needsChoice: LeaderChoice | null } {
  return removeMember(spend(g, partyId, EXPEL_COST), partyId, target)
}

export function setAppointed(g: GameState, player: number): GameState {
  return { ...g, appointed: player }
}

export type DonateTarget = { type: 'player' | 'party'; id: number }

export function donate(
  g: GameState,
  fromParty: number,
  amount: number,
  to: DonateTarget
): GameState {
  const base = spend(g, fromParty, amount)

  if (to.type === 'player') {
    return {
      ...base,
      players: base.players.map((p) =>
        p.id === to.id ? { ...p, influence: p.influence + amount } : p
      ),
    }
  }

  return {
    ...base,
    parties: base.parties.map((p) =>
      p.id === to.id ? { ...p, influence: p.influence + amount } : p
    ),
  }
}
