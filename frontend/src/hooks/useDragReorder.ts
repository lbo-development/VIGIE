import { useState, type DragEvent } from 'react'

/**
 * Réordonnancement par glisser-déposer HTML5 natif, sur une liste identifiée
 * par des clés (ex: code_site). Pas de composant "arbre"/drag documenté dans
 * le template GPMM (seul .gp-th__grip existe, pour réordonner des colonnes,
 * pas des lignes) — même vocabulaire d'icône (#i-grip-vertical) réutilisé,
 * mécanique de drag assemblée avec les événements HTML5 standards.
 *
 * order : ordre affiché actuellement (ex: sites.map(s => s.code_site)).
 * onReorder : appelé avec le nouvel ordre une fois un drop valide effectué —
 * à l'appelant de persister (API) et de rafraîchir les données.
 */
export function useDragReorder(order: string[], onReorder: (newOrder: string[]) => void) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null)

  function dragProps(key: string) {
    return {
      draggable: true,
      onDragStart: () => setDraggedKey(key),
      onDragEnd: () => setDraggedKey(null),
      onDragOver: (event: DragEvent) => event.preventDefault(), // nécessaire pour autoriser le drop
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        const from = draggedKey
        setDraggedKey(null)
        if (!from || from === key) return

        const fromIndex = order.indexOf(from)
        const toIndex = order.indexOf(key)
        if (fromIndex === -1 || toIndex === -1) return

        const next = [...order]
        next.splice(fromIndex, 1)
        next.splice(toIndex, 0, from)
        onReorder(next)
      },
    }
  }

  return { dragProps, draggedKey }
}
