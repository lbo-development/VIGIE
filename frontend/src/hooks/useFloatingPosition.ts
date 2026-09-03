import { useLayoutEffect, useState, type RefObject } from 'react'

export interface FloatingPosition {
  top: number
  left: number
  width: number
  /** Espace disponible jusqu'au bas du viewport — à utiliser comme `max-height` par un panneau au contenu potentiellement long (ex. liste d'options), pour qu'il reste scrollable plutôt que de déborder hors écran sans recours. */
  maxHeight: number
}

/**
 * Position (coordonnées viewport, à utiliser avec `position: fixed`) d'un
 * panneau flottant ancré sous `anchorRef`, recalculée tant qu'il est ouvert
 * (scroll de n'importe quel ancêtre, y compris capturé, + resize).
 *
 * Sert à faire sortir un panneau (`.gp-menu`, `.gp-dp__panel`) du flux via un
 * portail (`createPortal`) plutôt que de le laisser en `position: absolute`
 * dans son conteneur d'origine — un ancêtre en `overflow` non visible (ex. le
 * corps scrollable d'une modale, `.gp-modal__bd.gp-scroll`) le rognerait sinon
 * silencieusement dès qu'il dépasse. Voir `ForClaude/INSTRUCTIONS_UX.md`,
 * section « Spécificité VIGIE ».
 */
export function useFloatingPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>): FloatingPosition | null {
  const [position, setPosition] = useState<FloatingPosition | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    function update() {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const top = rect.bottom + 4
      setPosition({ top, left: rect.left, width: rect.width, maxHeight: Math.max(160, window.innerHeight - top - 16) })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  return position
}
