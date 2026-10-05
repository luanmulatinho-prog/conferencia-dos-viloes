import type { GameState } from './game'

export const HAND_LIMIT = 5

// Quem o Soberano pode escolher agora
export function eligiblePicks(game: GameState): number[] {
  const n = game.players.length
  const remaining = game.players
    .map((p) => p.id)
    .filter((i) => !game.chosen.includes(i))

  // Na última escolha, quem ficou sem turno na rodada anterior
  // não pode ficar sem turno de novo.
  const isLastPick = game.chosen.length === n - 2
  if (
    isLastPick &&
    game.lastExcluded !== null &&
    remaining.includes(game.lastExcluded)
  ) {
    return [game.lastExcluded]
  }
  return remaining
}

export function accumulate(game: GameState, p: number): GameState {
  return {
    ...game,
    players: game.players.map((x) =>
      x.id === p ? { ...x, influence: x.influence + 3 } : x
    ),
    chosen: [...game.chosen, p],
  }
}

export function canBuyPower(game: GameState, p: number): boolean {
  return (
    game.players[p].powerCards.length < HAND_LIMIT &&
    game.powerDeck.length > 0
  )
}

export function buyPower(game: GameState, p: number): GameState {
  const deck = [...game.powerDeck]
  const card = deck.pop()
  if (!card) return game

  return {
    ...game,
    powerDeck: deck,
    players: game.players.map((x) =>
      x.id === p ? { ...x, powerCards: [...x.powerCards, card] } : x
    ),
    chosen: [...game.chosen, p],
  }
}

export function canGolpe(game: GameState, p: number): boolean {
  if (p === game.soberanoIndex || game.golpes[p] <= 0) return false

  // Membros do partido do Soberano não podem iniciar Golpes
  const sovParty = game.parties.find((pt) =>
    pt.memberIds.includes(game.soberanoIndex)
  )
  if (sovParty && sovParty.memberIds.includes(p)) return false

  return true
}

// Troca de Soberano (usada por Golpe bem-sucedido e Golpe Supremo).
// Ajusta os objetivos e o histórico. Comitê é tratado depois.
export function applySoberanoChange(
  game: GameState,
  newSoberano: number
): GameState {
  const deposed = game.soberanoIndex

  const players = game.players.map((p) => {
    let objective = p.objective

    if (p.id === deposed && objective === 'Ditador') {
      objective = 'Traficante de Influência'
    }
    if (deposed === game.firstSoberano && objective === 'Situação') {
      objective = 'Ditador'
    }
    return { ...p, objective }
  })

  return {
    ...game,
    players,
    soberanoIndex: newSoberano,
    soberanoHistory: [...game.soberanoHistory, newSoberano],
    consecutive: 0,
    golpeThisRound: true,
    finalRound:
      game.extension && game.finalRound === null
        ? game.round + 1
        : game.finalRound,
  }
}

// Golpe: toda a contribuição vai para quem iniciou o Golpe.
// Sucesso somente se total > Influência atual do Soberano.
export function resolveGolpe(
  game: GameState,
  challenger: number,
  amounts: number[]
): { game: GameState; success: boolean; total: number } {
  const total = amounts.reduce((a, b) => a + b, 0)

  // Influência atual do Soberano = saldo dele depois de contribuir (se contribuiu)
  const soberanoNow =
    game.players[game.soberanoIndex].influence - amounts[game.soberanoIndex]
  const success = total > soberanoNow

  const golpes = [...game.golpes]
  golpes[challenger] -= 1

  let next: GameState = {
    ...game,
    players: game.players.map((p, i) => ({
      ...p,
      influence: p.influence - amounts[i] + (i === challenger ? total : 0),
    })),
    golpes,
    chosen: [...game.chosen, challenger],
  }

  if (success) next = applySoberanoChange(next, challenger)

  return { game: next, success, total }
}

export function setCommitteeMembers(
  game: GameState,
  elected: number,
  appointed: number
): GameState {
  return { ...game, elected, appointed }
}

// Conferência de Soberania: mínimo r × n.
// Suficiente: tudo vai para o Soberano. Insuficiente: tudo vai para o Comitê.
export function resolveConference(
  game: GameState,
  donations: number[]
): { game: GameState; success: boolean; total: number; required: number } {
  const n = game.players.length
  const required = game.round * n
  const total = donations.reduce((a, b) => a + b, 0)
  const success = total >= required

  return {
    game: {
      ...game,
      players: game.players.map((p, i) => ({
        ...p,
        influence:
          p.influence -
          donations[i] +
          (success && i === game.soberanoIndex ? total : 0),
      })),
      committeeInfluence: game.committeeInfluence + (success ? 0 : total),
    },
    success,
    total,
    required,
  }
}
