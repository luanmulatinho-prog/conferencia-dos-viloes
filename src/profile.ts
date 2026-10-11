// Identidade visual do jogador: símbolo, cor e moldura.
// Usado pelo servidor (via build-lib.mjs) e pelas telas.

export const SYMBOLS = [
  '♚', '♛', '♜', '♝', '♞',
  '♟', '♠', '♣', '♥', '♦',
  '⚔', '☠', '⚜', '✠', '♔',
]

// Todas as cores têm contraste mínimo de 4.5:1 com o fundo escuro do jogo
// e ficam bem distintas entre si.
export const COLORS = [
  { id: 'carmesim', name: 'Carmesim', hex: '#e0524a' },
  { id: 'laranja', name: 'Laranja', hex: '#e8893a' },
  { id: 'ouro', name: 'Ouro', hex: '#e6c04a' },
  { id: 'lima', name: 'Lima', hex: '#a6d04f' },
  { id: 'esmeralda', name: 'Esmeralda', hex: '#3fbf7f' },
  { id: 'turquesa', name: 'Turquesa', hex: '#38c4c0' },
  { id: 'azul', name: 'Azul', hex: '#5b9be8' },
  { id: 'violeta', name: 'Violeta', hex: '#9a86ec' },
  { id: 'purpura', name: 'Púrpura', hex: '#c76ee0' },
  { id: 'rosa', name: 'Rosa', hex: '#ee7fb0' },
  { id: 'prata', name: 'Prata', hex: '#c3c8cf' },
  { id: 'cobre', name: 'Cobre', hex: '#b8744a' },
]

export const FRAMES = [
  { id: 'none', name: 'Nenhuma' },
  { id: 'line', name: 'Linha' },
  { id: 'double', name: 'Dupla' },
  { id: 'dotted', name: 'Pontilhada' },
  { id: 'round', name: 'Arredondada' },
  { id: 'corners', name: 'Cantos' },
  { id: 'glow', name: 'Brilho' },
  { id: 'royal', name: 'Real' },
  { id: 'dark', name: 'Sombria' },
]

export type Profile = { icon: string; color: string; frame: string }

export function colorHex(id: string): string {
  return (COLORS.find((c) => c.id === id) ?? COLORS[0]).hex
}

export function isValidProfile(p: Partial<Profile> | null | undefined): boolean {
  return (
    !!p &&
    typeof p.icon === 'string' &&
    SYMBOLS.includes(p.icon) &&
    typeof p.color === 'string' &&
    COLORS.some((c) => c.id === p.color) &&
    typeof p.frame === 'string' &&
    FRAMES.some((f) => f.id === p.frame)
  )
}

// Regra: o mesmo símbolo pode se repetir, mas nunca com a mesma cor.
export function isTaken(
  others: { icon: string; color: string }[],
  icon: string,
  color: string
): boolean {
  return others.some((o) => o.icon === icon && o.color === color)
}

// Completa/corrige um perfil pedido e resolve conflitos com os outros
// jogadores: mantém o símbolo e troca a cor; se não der, qualquer combinação livre.
export function pickFree(
  others: { icon: string; color: string }[],
  wanted: Partial<Profile> | null | undefined
): Profile {
  const w = wanted ?? {}
  const icon =
    typeof w.icon === 'string' && SYMBOLS.includes(w.icon)
      ? w.icon
      : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
  const color =
    typeof w.color === 'string' && COLORS.some((c) => c.id === w.color)
      ? w.color
      : COLORS[Math.floor(Math.random() * COLORS.length)].id
  const frame =
    typeof w.frame === 'string' && FRAMES.some((f) => f.id === w.frame)
      ? w.frame
      : 'line'

  if (!isTaken(others, icon, color)) return { icon, color, frame }

  for (const c of COLORS) {
    if (!isTaken(others, icon, c.id)) return { icon, color: c.id, frame }
  }
  for (const s of SYMBOLS) {
    for (const c of COLORS) {
      if (!isTaken(others, s, c.id)) return { icon: s, color: c.id, frame }
    }
  }
  return { icon, color, frame }
}
