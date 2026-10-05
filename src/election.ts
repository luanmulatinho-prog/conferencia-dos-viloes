// Conta os votos de cada candidato
export function tally(
  votes: number[],
  candidates: number[]
): Record<number, number> {
  const t: Record<number, number> = {}
  for (const c of candidates) t[c] = 0
  for (const v of votes) t[v] = (t[v] ?? 0) + 1
  return t
}

// Candidatos com o maior número de votos (todos os empatados)
export function topTied(
  t: Record<number, number>,
  candidates: number[]
): number[] {
  const max = Math.max(...candidates.map((c) => t[c]))
  return candidates.filter((c) => t[c] === max)
}

// Quem avança do primeiro turno:
// - se há empate no topo, todos os empatados avançam;
// - senão, os dois mais votados (empate em 2º lugar: todos avançam).
export function finalists(
  t: Record<number, number>,
  candidates: number[]
): number[] {
  const sorted = [...candidates].sort((a, b) => t[b] - t[a])
  const max = t[sorted[0]]
  const tiedTop = sorted.filter((c) => t[c] === max)

  if (tiedTop.length >= 2) return tiedTop

  const second = t[sorted[1]]
  return [sorted[0], ...sorted.filter((c, i) => i > 0 && t[c] === second)]
}
