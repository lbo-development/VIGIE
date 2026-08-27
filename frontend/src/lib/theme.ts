// Applique le thème GPMM sur <html data-theme> avant le premier rendu React,
// pour éviter un flash de mauvais thème (localStorage 'gpmm-theme', sinon
// préférence système). Exécuté depuis main.tsx plutôt qu'en <script> inline
// dans index.html, pour rester compatible avec la CSP (script-src 'self').
export function applyStoredTheme() {
  try {
    const stored = localStorage.getItem('gpmm-theme')
    const theme =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    document.documentElement.dataset.theme = theme
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
}
