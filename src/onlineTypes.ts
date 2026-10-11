export type ElectionLast = {
  round: 1 | 2
  tally: Record<number, number>
  advance?: number[]
  tied?: number[]
}

export type SubView =
  | { kind: 'leader'; partyName: string; candidates: number[] }
  | {
      kind: 'committee'
      mode: 'full' | 'electOnly' | 'appointOnly'
      title: string
      status: 'voting' | 'tiebreak' | 'appoint'
      round: number
      candidates: number[]
      voters: number[]
      hasVoted: boolean
      votedCount: number
      last: ElectionLast | null
      tied: number[]
      elected: number | null
      appointOptions: number[]
    }

export type PartyView = {
  id: number
  name: string
  leaderId: number
  memberIds: number[]
  influence: number
}

export type PowerPlay = { card: string; target?: number }

export type MatchView = {
  phase:
    | 'choice'
    | 'election'
    | 'appoint'
    | 'extension'
    | 'sovereign'
    | 'committee'
    | 'turns'
    | 'power'
    | 'parties'
    | 'final'
  you: number
  round: number
  committeeInfluence: number
  players: {
    index: number
    name: string
    icon: string
    color: string
    frame: string
  }[]
  me: {
    objective: string
    influence: number
    powerCards: string[]
    leadership: string | null
  }
  hasChosen: boolean
  chosenCount: number
  soberano: number | null
  bonus: number
  elected: number | null
  appointed: number | null
  notice: string | null
  golpes: number[]
  chosen: number[]
  stats: null | {
    sovereignRounds: number[]
    committeeRounds: number[]
    consecutive: number
    soberanoHistory: number[]
  }
  parties: PartyView[]
  memberInfluence: Record<number, number>
  recap: null | { title: string; lines: string[] }
  privateMsgs: string[]
  drawn: null | { id: string; card: string; source: 'buy' | 'start' }
  paused: string[]
  sub: SubView | null

  election: null | {
    round: 1 | 2
    candidates: number[]
    status: 'voting' | 'tiebreak'
    hasVoted: boolean
    votedCount: number
    voterCount: number
    last: ElectionLast | null
    tied: number[]
  }

  sovereign: null | {
    status: 'proposing' | 'approval'
    proposal: number[]
    budget: number
    canDecide: boolean
    decidedCount: number
  }

  extension: null | {
    status: 'ask' | 'approval'
    canDecide: boolean
    consecutive: number
  }

  committee: null | {
    status: 'proposing' | 'response'
    proposal: number[]
    proposer: number
    responder: number
    recipients: number[]
    available: number
  }

  turns: null | {
    status:
      | 'select'
      | 'action'
      | 'golpe'
      | 'succession'
      | 'golpeResult'
      | 'conference'
    current: number | null
    eligible: number[]
    forced: boolean
    canBuy: boolean
    canGolpe: boolean
    contributors: number[]
    contributedCount: number
    iContribute: boolean
    golpeInfo: null | { success: boolean; total: number; challenger: number }
    required: number
    log: string[]
  }

  power: null | {
    iSubmitted: boolean
    submittedCount: number
    supremeAllowed: boolean
  }

  par: null | {
    iDone: boolean
    doneCount: number
    pendingLeaves: number[]
    log: string[]
    cpi: null | {
      by: string
      choices: { player: number; plays: PowerPlay[] }[]
      log: { to: number | 'all'; text: string }[]
    }
    invites: { id: number; creator: number; name: string }[]
    myFounding: {
      id: number
      name: string
      invitees: { player: number; status: string }[]
    }[]
    offers: { id: number; partyId: number; partyName: string; offer: number }[]
    sentOffers: { id: number; target: number; offer: number }[]
  }

  final: null | {
    reasonText: string
    players: {
      index: number
      objective: string
      fulfilled: boolean
      influence: number
      sovereignRounds: number
      committeeRounds: number
      stolen: number
      partyId: number | null
    }[]
  }
}

export type Send = (action: Record<string, unknown>) => void
