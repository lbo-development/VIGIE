import type { CSSProperties } from 'react'
import type { ColumnSort } from '../hooks/useColumnSort'

interface SortableThProps<C extends string> {
  label: string
  column: C
  sort: ColumnSort<C> | null
  onSort: (column: C) => void
  style?: CSSProperties
}

/**
 * En-tête de colonne triable — reprend le balisage `.gp-th`/`.gp-th__sort`/
 * `.gp-th__ind` documenté dans ForClaude/Template UX/GUIDELINES.md (section
 * tableau triable), sans la poignée de réordonnancement de colonne ni le
 * redimensionnement (non utilisés ici — voir useDragReorder pour le
 * réordonnancement de lignes, mécanique distincte).
 */
export function SortableTh<C extends string>({ label, column, sort, onSort, style }: SortableThProps<C>) {
  const direction = sort?.column === column ? sort.direction : null
  const iconHref = direction === 'asc' ? '#i-arrow-up' : direction === 'desc' ? '#i-arrow-down' : '#i-selector'
  const ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'

  return (
    <th style={style} aria-sort={ariaSort}>
      <span className="gp-th">
        <span
          className="gp-th__sort"
          role="button"
          tabIndex={0}
          onClick={() => onSort(column)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSort(column)
            }
          }}
        >
          <span>{label}</span>
          <svg className="ti gp-th__ind" aria-hidden="true" style={{ color: direction ? 'var(--gp-primary)' : undefined }}>
            <use href={iconHref} />
          </svg>
        </span>
      </span>
    </th>
  )
}
