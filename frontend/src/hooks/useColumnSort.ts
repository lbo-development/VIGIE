import { useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface ColumnSort<C extends string> {
  column: C
  direction: SortDirection
}

/**
 * Tri de colonne à cycle tri-état (clic sur l'en-tête — voir SortableTh) :
 * neutre → asc → desc → neutre. Le retour à "neutre" correspond à l'ordre
 * personnalisé (glisser-déposer) plutôt qu'à un tri — voir GisementGeographique/
 * GisementTechnique, où le glisser-déposer est désactivé tant qu'un tri est actif.
 */
export function useColumnSort<C extends string>() {
  const [sort, setSort] = useState<ColumnSort<C> | null>(null)

  function toggleSort(column: C) {
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: 'asc' }
      if (current.direction === 'asc') return { column, direction: 'desc' }
      return null
    })
  }

  return { sort, toggleSort }
}

/**
 * Applique un ColumnSort à une liste, via un accesseur de valeur par colonne.
 * Texte : comparaison localisée fr (accents/casse), comme le tri du template
 * GPMM (voir gpmm-style-guide.html). Booléen (ex: actif) : false avant true
 * en ordre ascendant.
 */
export function sortRows<T, C extends string>(
  rows: T[],
  sort: ColumnSort<C> | null,
  getValue: (row: T, column: C) => string | boolean,
): T[] {
  if (!sort) return rows
  const factor = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = getValue(a, sort.column)
    const vb = getValue(b, sort.column)
    if (typeof va === 'boolean' && typeof vb === 'boolean') return factor * (Number(va) - Number(vb))
    return factor * String(va).localeCompare(String(vb), 'fr', { numeric: true })
  })
}
