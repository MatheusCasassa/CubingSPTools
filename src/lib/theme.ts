// Tema claro/escuro (escuro é o padrão, como no site da CubingSP).
export type Theme = 'light' | 'dark'
const KEY = 'ferramentas.theme'

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* armazenamento indisponível: só não lembra a escolha */
  }
}
