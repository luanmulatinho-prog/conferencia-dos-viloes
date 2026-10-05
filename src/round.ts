import type { GameState } from './game'

export type EndReason = 'mandate11' | 'round19' | 'extension'

// Conta a rodada no mandato do Soberano (ele realizou a distribuição)
export function completeSovereignDistribution(g: GameState): GameState {
  const sovereignRounds = [...g.sovereignRounds]
  sovereignRounds[g.soberanoIndex] += 1
  return { ...g, sovereignRounds, consecutive: g.consecutive + 1 }
}

// Verificação de fim. A partida nunca termina na rodada de um Golpe bem-sucedido.
export function checkEnd(g: GameState): EndReason | null {
  if (g.golpeThisRound) return null
  if (g.consecutive >= 11) return 'mandate11'

  if (g.extension) {
    return g.finalRound !== null && g.round >= g.finalRound
      ? 'extension'
      : null
  }

  if (g.round >= 19) return 'round19'
  return null
}

export function startNextRound(g: GameState): GameState {
  return {
    ...g,
    round: g.round + 1,
    chosen: [],
    golpeThisRound: false,
    committeeDistributed: false,
    lastPower: null,
    committeeInfluence: g.committeeInfluence + g.players.length,
  }
}

export function reasonText(reason: EndReason): string {
  if (reason === 'mandate11') {
    return 'Um Soberano completou 11 rodadas consecutivas no poder.'
  }
  if (reason === 'extension') {
    return 'Fim da Prorrogação de Mandato.'
  }
  return 'A partida chegou ao fim da Rodada 19.'
}

// Quem cumpriu o objetivo (por id de jogador)
export function evaluateObjectives(
  g: GameState,
  reason: EndReason
): boolean[] {
  // Traficante: maior Influência; desempate por rodadas como Soberano,
  // depois por rodadas no Comitê; se ainda empatar, todos cumprem.
  const maxInf = Math.max(...g.players.map((p) => p.influence))
  let top = g.players.filter((p) => p.influence === maxInf).map((p) => p.id)

  const maxSov = Math.max(...top.map((i) => g.sovereignRounds[i]))
  top = top.filter((i) => g.sovereignRounds[i] === maxSov)

  const maxCom = Math.max(...top.map((i) => g.committeeRounds[i]))
  top = top.filter((i) => g.committeeRounds[i] === maxCom)

  // Carreira Partidária: líder do partido com maior Influência Partidária
  const maxParty = g.parties.length
    ? Math.max(...g.parties.map((p) => p.influence))
    : null
  const leaders =
    maxParty === null
      ? []
      : g.parties.filter((p) => p.influence === maxParty).map((p) => p.leaderId)

  const distinctSoberanos = new Set(g.soberanoHistory).size

  return g.players.map((p) => {
    switch (p.objective) {
      case 'Ditador':
        return reason === 'mandate11' && g.soberanoIndex === p.id
      case 'Situação':
        return (
          reason === 'mandate11' &&
          g.soberanoIndex === g.firstSoberano &&
          g.round === 11
        )
      case 'Traficante de Influência':
        return top.includes(p.id)
      case 'Oposição':
        return distinctSoberanos >= 4
      case 'Distribuidor':
        return g.committeeRounds[p.id] >= 10
      case 'Carreira Partidária':
        return leaders.includes(p.id)
      default:
        return false
    }
  })
}
