export type Objective =
  | 'Ditador'
  | 'Traficante de Influência'
  | 'Situação'
  | 'Oposição'
  | 'Distribuidor'
  | 'Carreira Partidária'

export type PowerCard =
  | 'Golpe Supremo'
  | 'Golpe Baixo'
  | 'Ataque Triplo'
  | 'Assalto'
  | 'Roubo'
  | 'Furto'
  | 'Troca de Gestão'

export type Leadership = 'Soberano' | 'Golpe'
export type InitialChoice = 'A' | 'B'

export type PlayerState = {
  id: number
  name: string
  objective: Objective
  influence: number
  powerCards: PowerCard[]
  leadership: Leadership | null
}

export type SetupState = {
  players: PlayerState[]
  powerDeck: PowerCard[]
  soberanoIndex: number | null
  bonus: number
  elected: number | null
  appointed: number | null
  replacedObjective: {
    index: number
    from: Objective
    to: Objective
  } | null
}

const POWER_COUNTS: Record<PowerCard, number> = {
  'Golpe Supremo': 1,
  'Golpe Baixo': 5,
  'Ataque Triplo': 5,
  Assalto: 5,
  Roubo: 10,
  Furto: 15,
  'Troca de Gestão': 5,
}

const OBJECTIVES: Objective[] = [
  'Ditador',
  'Traficante de Influência',
  'Situação',
  'Oposição',
  'Distribuidor',
  'Carreira Partidária',
]

export function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildPowerDeck(): PowerCard[] {
  const deck: PowerCard[] = []
  for (const card of Object.keys(POWER_COUNTS) as PowerCard[]) {
    for (let i = 0; i < POWER_COUNTS[card]; i++) deck.push(card)
  }
  return shuffle(deck)
}

function count(list: Objective[], o: Objective) {
  return list.filter((x) => x === o).length
}

function isValidObjectives(list: Objective[], n: number) {
  if (count(list, 'Ditador') === 1) return false
  if (count(list, 'Traficante de Influência') === 1) return false
  if (count(list, 'Distribuidor') * 2 >= n) return false

  const limit = n <= 9 ? 1 : n <= 14 ? 2 : 3
  const diff = Math.abs(count(list, 'Situação') - count(list, 'Oposição'))
  return diff <= limit
}

export function assignObjectives(n: number): Objective[] {
  const deck: Objective[] = []
  for (const o of OBJECTIVES) for (let i = 0; i < 3; i++) deck.push(o)

  for (let tries = 0; tries < 20000; tries++) {
    const pick = shuffle(deck).slice(0, n)
    if (isValidObjectives(pick, n)) return pick
  }
  throw new Error('Não foi possível sortear objetivos válidos')
}

export function createInitialGame(names: string[]): SetupState {
  const objectives = assignObjectives(names.length)
  return {
    players: names.map((name, i) => ({
      id: i,
      name,
      objective: objectives[i],
      influence: 0,
      powerCards: [],
      leadership: null,
    })),
    powerDeck: buildPowerDeck(),
    soberanoIndex: null,
    bonus: 0,
    elected: null,
    appointed: null,
    replacedObjective: null,
  }
}

export function applyInitialChoice(
  state: SetupState,
  index: number,
  choice: InitialChoice
): SetupState {
  const deck = [...state.powerDeck]
  const players = state.players.map((p) => ({ ...p }))
  const player = players[index]

  if (choice === 'A') {
    player.influence = 5
  } else {
    player.influence = 2
    const card = deck.pop()
    if (card) player.powerCards = [card]
  }
  return { ...state, players, powerDeck: deck }
}

export function finishSetup(state: SetupState): SetupState {
  const n = state.players.length
  const roles: Leadership[] = shuffle<Leadership>([
    'Soberano',
    ...Array<Leadership>(n - 1).fill('Golpe'),
  ])
  const bonus = Math.floor((3 * n) / 2)
  const players = state.players.map((p, i) => ({
    ...p,
    leadership: roles[i],
    influence: roles[i] === 'Soberano' ? p.influence + bonus : p.influence,
  }))
  return {
    ...state,
    players,
    bonus,
    soberanoIndex: roles.indexOf('Soberano'),
  }
}

// Define o Comitê. Se o Membro Eleito for Distribuidor na Rodada 1,
// o objetivo dele é substituído por um novo objetivo aleatório.
export function setCommittee(
  state: SetupState,
  elected: number,
  appointed: number
): SetupState {
  const n = state.players.length
  const players = state.players.map((p) => ({ ...p }))
  let replacedObjective: SetupState['replacedObjective'] = null

  if (players[elected].objective === 'Distribuidor') {
    const options = OBJECTIVES.filter((o) => o !== 'Distribuidor')
    const others = players.map((p) => p.objective)

    const build = (o: Objective) =>
      others.map((x, i) => (i === elected ? o : x))

    const shuffled = shuffle(options)
    const chosen =
      shuffled.find((o) => {
        const list = build(o)
        return count(list, o) <= 3 && isValidObjectives(list, n)
      }) ??
      shuffled.find((o) => count(build(o), o) <= 3) ??
      'Distribuidor'

    replacedObjective = {
      index: elected,
      from: 'Distribuidor',
      to: chosen,
    }
    players[elected].objective = chosen
  }

  return { ...state, players, elected, appointed, replacedObjective }
}
