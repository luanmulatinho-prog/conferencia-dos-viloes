import type { GameState } from './game'
import { shuffle, type PowerCard } from './setup'
import { applySoberanoChange } from './turns'

export type Play = { card: PowerCard; target?: number }
export type Choice = { player: number; plays: Play[] }
export type QueueItem = { player: number; play: Play }
export type LogEntry = { text: string; to: number | 'all' }
export type Need = 'succession' | 'appoint' | null

export const NEEDS_TARGET: PowerCard[] = [
  'Golpe Baixo',
  'Assalto',
  'Roubo',
  'Furto',
]

export const CARD_INFO: Record<PowerCard, string> = {
  'Golpe Supremo': 'Vira Soberano sem votação (só se o Comitê não distribuiu)',
  'Golpe Baixo': 'Rouba uma carta Golpe de outro jogador',
  'Ataque Triplo': 'Permite usar até 3 cartas adicionais',
  Assalto: 'Rouba 5 Influências (autor e vítima são públicos)',
  Roubo: 'Rouba 3 Influências (só a vítima sabe)',
  Furto: 'Rouba 1 Influência (a vítima não sabe quem fez)',
  'Troca de Gestão': 'Remove o Membro Indicado (autor público)',
}

const STEAL: Partial<Record<PowerCard, number>> = {
  Assalto: 5,
  Roubo: 3,
  Furto: 1,
}

// Sem Ataque Triplo: 1 carta. Com Ataque Triplo: ele + 3 adicionais.
export function maxCards(plays: Play[]): number {
  return plays.some((p) => p.card === 'Ataque Triplo') ? 4 : 1
}

// Consome as cartas usadas (voltam ao baralho, menos o Golpe Supremo)
// e monta a fila de efeitos.
export function startPowerResolution(
  game: GameState,
  choices: Choice[]
): { game: GameState; queue: QueueItem[] } {
  let deck = [...game.powerDeck]
  const players = game.players.map((p) => ({
    ...p,
    powerCards: [...p.powerCards],
  }))

  for (const ch of choices) {
    for (const play of ch.plays) {
      const hand = players[ch.player].powerCards
      const idx = hand.indexOf(play.card)
      if (idx >= 0) {
        hand.splice(idx, 1)
        if (play.card !== 'Golpe Supremo') deck.push(play.card)
      }
    }
  }
  deck = shuffle(deck)

  // Ordem: jogadores na ordem em que tiveram turno; quem ficou sem turno
  // resolve por último. Cada jogador resolve as cartas na ordem que escolheu.
  const order = [
    ...game.chosen,
    ...game.players.map((p) => p.id).filter((i) => !game.chosen.includes(i)),
  ]
  const queue: QueueItem[] = order.flatMap((pl) => {
    const ch = choices.find((c) => c.player === pl)
    return ch ? ch.plays.map((play) => ({ player: pl, play })) : []
  })

  // Troca de Gestão repetida pelo mesmo jogador: efeito só uma vez
  const seen = new Set<number>()
  const filtered = queue.filter((it) => {
    if (it.play.card !== 'Troca de Gestão') return true
    if (seen.has(it.player)) return false
    seen.add(it.player)
    return true
  })

  return { game: { ...game, players, powerDeck: deck }, queue: filtered }
}

export function stepPower(
  game: GameState,
  item: QueueItem
): { game: GameState; log: LogEntry[]; need: Need } {
  const { player, play } = item
  const t = play.target
  const log: LogEntry[] = []
  const name = (i: number) => game.players[i].name

  if (play.card === 'Golpe Supremo') {
    if (player === game.soberanoIndex) return { game, log, need: null }

    log.push({
      to: 'all',
      text: `${name(player)} usou o Golpe Supremo e é o novo Soberano.`,
    })
    return {
      game: applySoberanoChange(game, player),
      log,
      need: 'succession',
    }
  }

  if (play.card === 'Golpe Baixo' && t !== undefined) {
    if (game.golpes[t] > 0) {
      const golpes = [...game.golpes]
      golpes[t] -= 1
      golpes[player] += 1
      log.push({ to: player, text: `Você roubou uma carta Golpe de ${name(t)}.` })
      log.push({ to: t, text: 'Uma carta Golpe sua foi roubada.' })
      return { game: { ...game, golpes }, log, need: null }
    }
    log.push({
      to: player,
      text: `${name(t)} não tinha carta Golpe: sem efeito.`,
    })
    return { game, log, need: null }
  }

  const amount = STEAL[play.card]
  if (amount !== undefined && t !== undefined) {
    const actual = Math.min(amount, game.players[t].influence)

    const players = game.players.map((p) => {
      if (p.id === t) return { ...p, influence: p.influence - actual }
      if (p.id === player) return { ...p, influence: p.influence + actual }
      return p
    })

    log.push({ to: player, text: `Você roubou ${actual} de ${name(t)}.` })

    if (play.card === 'Assalto') {
      log.push({
        to: 'all',
        text: `${name(player)} usou Assalto contra ${name(t)} e roubou ${actual}.`,
      })
    } else if (play.card === 'Roubo') {
      log.push({
        to: t,
        text: `Você perdeu ${actual} Influência(s) para ${name(player)}.`,
      })
    } else {
      log.push({
        to: t,
        text: `Você foi roubado e perdeu ${actual} Influência(s). Não sabe por quem.`,
      })
    }

    const stolen = [...game.stolen]
    stolen[player] += actual

    return { game: { ...game, players, stolen }, log, need: null }
  }

  if (play.card === 'Troca de Gestão') {
    log.push({
      to: 'all',
      text: `${name(player)} usou Troca de Gestão: o Membro Indicado (${name(game.appointed)}) foi removido. O Soberano escolherá outro.`,
    })
    return { game, log, need: 'appoint' }
  }

  return { game, log, need: null }
}
