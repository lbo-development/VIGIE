// Applique le thème GPMM sur <html data-theme> avant le premier rendu React,
// pour éviter un flash de mauvais thème (localStorage 'gpmm-theme', sinon
// sombre par défaut — décision du 20/09/2026, plus de repli sur la
// préférence système). Exécuté depuis main.tsx plutôt qu'en <script> inline
// dans index.html, pour rester compatible avec la CSP (script-src 'self').
export function applyStoredTheme() {
  try {
    const stored = localStorage.getItem('gpmm-theme')
    document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark'
  } catch {
    document.documentElement.dataset.theme = 'dark'
  }
}
