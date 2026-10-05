// Texto das cartas de Poder (iguais às regras do jogo)

export type PowerCardInfo = {
  desc: string
  note: string
}

export const POWER_CARDS: Record<string, PowerCardInfo> = {
  'Golpe Supremo': {
    desc: 'Em uma rodada na qual o Comitê não distribuiu Influência, torna você Soberano, sem votação.',
    note: 'Só existe 1 na partida e é descartada para sempre depois do uso. O Comitê é refeito como em um Golpe bem-sucedido.',
  },
  'Golpe Baixo': {
    desc: 'Rouba uma carta Golpe de outro jogador.',
    note: 'Se o alvo não tiver carta Golpe, não acontece nada. Depois de usada, a carta volta ao baralho.',
  },
  'Ataque Triplo': {
    desc: 'Permite usar até 3 cartas de Poder adicionais na mesma Fase de Poder.',
    note: 'Pode ser usada sozinha, mas sem efeito. Não combina com outro Ataque Triplo. As cartas adicionais seguem a ordem que você escolher.',
  },
  Assalto: {
    desc: 'Rouba até 5 Influências de outro jogador.',
    note: 'A ação é pública: todos sabem quem roubou e de quem. Se o alvo tiver menos de 5, você leva o que ele tiver.',
  },
  Roubo: {
    desc: 'Rouba até 3 Influências de outro jogador.',
    note: 'Só a vítima sabe quanto perdeu e quem foi. Se o alvo tiver menos de 3, você leva o que ele tiver.',
  },
  Furto: {
    desc: 'Rouba até 1 Influência de outro jogador.',
    note: 'A vítima sabe que foi roubada, mas não sabe por quem.',
  },
  'Troca de Gestão': {
    desc: 'Remove o Membro Indicado, e o Soberano precisa escolher outro.',
    note: 'O autor da carta é público. O Membro Eleito não pode ser removido.',
  },
}

export function powerCardInfo(name: string): PowerCardInfo {
  return POWER_CARDS[name] ?? { desc: '', note: '' }
}
