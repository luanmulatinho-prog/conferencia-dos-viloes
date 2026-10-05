// Texto das cartas de Objetivo (iguais às regras do jogo)

export type ObjectiveInfo = {
  goal: string
  note?: string
}

export const OBJECTIVES: Record<string, ObjectiveInfo> = {
  Ditador: {
    goal: 'Permaneça 11 rodadas seguidas no poder como Soberano, desencadeando o fim da partida.',
    note: 'Se perder o poder, a contagem zera. Se sofrer um Golpe bem-sucedido, seu objetivo vira Traficante de Influência (permanente).',
  },
  'Traficante de Influência': {
    goal: 'Ao final do jogo, tenha a maior Influência.',
    note: 'Desempate: mais rodadas como Soberano, depois mais rodadas no Comitê. Se ainda empatar, todos os empatados cumprem o objetivo.',
  },
  Situação: {
    goal: 'Mantenha o primeiro Soberano no poder até que o jogo termine na Rodada 11.',
    note: 'Se o primeiro Soberano sofrer um Golpe bem-sucedido, seu objetivo vira Ditador (permanente).',
  },
  Oposição: {
    goal: 'Faça com que, ao longo da partida, ao menos 4 jogadores diferentes assumam o cargo de Soberano.',
    note: 'Cumprido assim que o quarto Soberano diferente assumir, mesmo que ele não complete uma rodada.',
  },
  Distribuidor: {
    goal: 'Seja membro do Comitê durante 10 rodadas acumuladas.',
    note: 'As rodadas não precisam ser seguidas. Participar da distribuição ou do congelamento conta. Se você for eleito Membro Eleito na Rodada 1, recebe um novo objetivo.',
  },
  'Carreira Partidária': {
    goal: 'Seja líder do partido mais influente ao final da partida.',
    note: 'Você precisa ser o líder do partido com maior Influência Partidária no momento em que a partida termina. Em caso de empate entre partidos, todos os líderes empatados cumprem.',
  },
}

export function objectiveInfo(name: string): ObjectiveInfo {
  return OBJECTIVES[name] ?? { goal: '' }
}
