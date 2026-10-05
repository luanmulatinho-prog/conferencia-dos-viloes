import type { PlayerState, PowerCard, SetupState } from './setup'
import type { Choice, LogEntry } from './power'

export type Party = {
  id: number
  name: string
  leaderId: number
  memberIds: number[]
  influence: number
}

export type GameState = {
  players: PlayerState[]
  soberanoIndex: number
  elected: number
  appointed: number
  round: number
  committeeInfluence: number
  committeeRounds: number[]
  powerDeck: PowerCard[]
  golpes: number[]
  chosen: number[]
  lastExcluded: number | null
  firstSoberano: number
  soberanoHistory: number[]
  committeeDistributed: boolean
  consecutive: number
  sovereignRounds: number[]
  stolen: number[]
  golpeThisRound: boolean
  extension: boolean
  finalRound: number | null
  parties: Party[]
  lastPower: { choices: Choice[]; log: LogEntry[] } | null
}

// Transforma o resultado da preparação no estado da Rodada 1.
// O Comitê recebe n Influências no início de cada rodada.
export function startGame(setup: SetupState): GameState | null {
  if (
    setup.soberanoIndex === null ||
    setup.elected === null ||
    setup.appointed === null
  ) {
    return null
  }

  return {
    players: setup.players.map((p) => ({ ...p })),
    soberanoIndex: setup.soberanoIndex,
    elected: setup.elected,
    appointed: setup.appointed,
    round: 1,
    committeeInfluence: setup.players.length,
    committeeRounds: Array(setup.players.length).fill(0),
    powerDeck: [...setup.powerDeck],
    golpes: setup.players.map((p) => (p.leadership === 'Golpe' ? 1 : 0)),
    chosen: [],
    lastExcluded: null,
    firstSoberano: setup.soberanoIndex,
    soberanoHistory: [setup.soberanoIndex],
    committeeDistributed: false,
    consecutive: 0,
    sovereignRounds: Array(setup.players.length).fill(0),
    stolen: Array(setup.players.length).fill(0),
    golpeThisRound: false,
    extension: false,
    finalRound: null,
    parties: [],
    lastPower: null,
  }
}

// Precisa de aprovação se OUTRO jogador (não o Soberano) receber mais de n/2
export function needsCommitteeApproval(
  proposal: number[],
  soberanoIndex: number,
  n: number
): boolean {
  return proposal.some((v, i) => i !== soberanoIndex && v * 2 > n)
}

// Executa a proposta. O que sobrar vai para o Comitê.
export function applyDistribution(
  game: GameState,
  proposal: number[]
): GameState {
  const n = game.players.length
  const total = proposal.reduce((a, b) => a + b, 0)

  return {
    ...game,
    players: game.players.map((p, i) => ({
      ...p,
      influence: p.influence + proposal[i],
    })),
    committeeInfluence: game.committeeInfluence + (n - total),
  }
}

// Reprovada: toda a Influência do Soberano vai para o Comitê
export function rejectDistribution(game: GameState): GameState {
  return {
    ...game,
    committeeInfluence: game.committeeInfluence + game.players.length,
  }
}

// Jogadores que podem receber Influência do Comitê:
// qualquer um, exceto Soberano, Membro Eleito e Membro Indicado
export function committeeRecipients(game: GameState): number[] {
  return game.players
    .map((p) => p.id)
    .filter(
      (i) =>
        i !== game.soberanoIndex &&
        i !== game.elected &&
        i !== game.appointed
    )
}

function countCommitteeRound(game: GameState): number[] {
  const rounds = [...game.committeeRounds]
  rounds[game.elected] += 1
  rounds[game.appointed] += 1
  return rounds
}

// Acordo: a Influência do Comitê é distribuída conforme a proposta
export function applyCommitteeDistribution(
  game: GameState,
  proposal: number[]
): GameState {
  const total = proposal.reduce((a, b) => a + b, 0)

  return {
    ...game,
    players: game.players.map((p, i) => ({
      ...p,
      influence: p.influence + proposal[i],
    })),
    committeeInfluence: game.committeeInfluence - total,
    committeeRounds: countCommitteeRound(game),
    committeeDistributed: true,
  }
}

// Sem acordo: a Influência fica congelada para uma rodada futura
export function freezeCommittee(game: GameState): GameState {
  return {
    ...game,
    committeeRounds: countCommitteeRound(game),
    committeeDistributed: false,
  }
}
