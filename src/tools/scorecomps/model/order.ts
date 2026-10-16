// Ordem "corte e empilhe" (cut-and-stack) para folhas com 4 súmulas:
// imprime, corta o maço inteiro em 4 pilhas e, colocando uma pilha sobre a
// outra, as súmulas ficam na ordem natural (por grupo/nome).
// Mesmo algoritmo do CompPrint/Groupifier — índice de saída = (entrada anterior + 4),
// com o quadrante avançando quando estoura.

/** Completa a lista com `null` até múltiplo de `perPage`. */
export function padToPage<T>(items: T[], perPage: number): (T | null)[] {
  const out: (T | null)[] = [...items]
  while (out.length % perPage !== 0) out.push(null)
  return out
}

/** Reordena para corte e empilhe. `items.length` deve ser múltiplo de `perPage`. */
export function cutAndStack<T>(items: T[], perPage = 4): T[] {
  const n = items.length
  if (n === 0 || perPage <= 1) return [...items]
  const pages = n / perPage
  const out = new Array<T>(n)
  // Súmula i (ordem natural) vai para a página (i mod pages), posição floor(i / pages).
  for (let i = 0; i < n; i++) {
    const page = i % pages
    const slot = Math.floor(i / pages)
    out[page * perPage + slot] = items[i]
  }
  return out
}
