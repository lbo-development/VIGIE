import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'gpmm-theme'

function readInitialTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/**
 * Thème clair/sombre GPMM — miroir React de `applyTheme` (app.js).
 * La valeur initiale est déjà posée sur <html data-theme> par le script inline
 * de index.html (lecture localStorage puis repli sur la préférence système),
 * pour éviter un flash de mauvais thème avant l'hydratation React.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // stockage indisponible (navigation privée...) : le thème reste actif pour la session en cours
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
