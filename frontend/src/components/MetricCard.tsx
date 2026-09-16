import type { ReactNode } from 'react'

/**
 * Carte indicateur (`.metric-card` de gpmm.css) et son sous-groupe
 * (`.tdb-subgroup`/`.metrics-grid`) — extrait de `pages/MarchesTdb.tsx` le
 * 15/09/2026 (chantier écran d'accueil) pour être partagé avec
 * `pages/Home.tsx` (tuiles "En transit"/"Mes demandes").
 */

export type MetricTone = 'info' | 'success' | 'warning' | 'danger'

/**
 * Le chiffre n'est teinté que pour `warning`/`danger` (un compteur "normal"
 * reste en texte neutre, même logique que `.metric-meta.success/.warning` du
 * gabarit, qui ne teinte jamais le cas "neutre"). `secondaryValue` (ex. un
 * montant déjà formaté) s'affiche sous la valeur principale via `.metric-meta`
 * — optionnel, absent sur les cartes qui n'affichent qu'un simple compte
 * (voir MarchesTdb.tsx).
 */
export function MetricCard({
  label,
  value,
  secondaryValue,
  tone = 'info',
}: {
  label: string
  value: number
  secondaryValue?: string
  tone?: MetricTone
}) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className={tone === 'warning' || tone === 'danger' ? `metric-value ${tone}` : 'metric-value'}>{value}</strong>
      {secondaryValue !== undefined && <span className="metric-meta">{secondaryValue}</span>}
    </article>
  )
}

/** Sous-groupe de cartes au sein d'un `.gp-panel` — `.metrics-grid` (4 colonnes fixes, gpmm.css) pour la rangée principale, `.grid` (auto-adaptatif, gpmm.css) pour les rangées plus courtes, afin d'éviter les colonnes vides d'une grille à 4 colonnes sous-remplie. */
export function MetricSubgroup({
  title,
  gridClassName = 'metrics-grid',
  children,
}: {
  title: string
  gridClassName?: 'metrics-grid' | 'grid'
  children: ReactNode
}) {
  return (
    <div className="tdb-subgroup">
      <span className="eyebrow">{title}</span>
      <div className={gridClassName} aria-label={`Indicateurs — ${title}`}>
        {children}
      </div>
    </div>
  )
}
