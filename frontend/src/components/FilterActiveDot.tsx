import './FilterActiveDot.css'

/**
 * Pastille superposée sur le bouton « Filtrer » quand au moins un critère de
 * la modale de filtre est actif (décision utilisateur, 11/09/2026) — même
 * principe de superposition que PieceCountBadge (bouton hôte en
 * `position:relative`, pastille en `position:absolute`), mais point plein
 * sans contenu (présence d'un filtre, pas un compte) et coloré en primaire
 * plutôt qu'en danger : le rouge de PieceCountBadge/`.gp-btn--danger` est
 * réservé aux états destructifs/d'erreur dans ce design system, un filtre
 * actif n'en est pas un — voir la convention déjà en place dans SortableTh
 * (indicateur de tri actif en `--gp-primary`).
 */
export function FilterActiveDot() {
  return <span className="filter-active-dot" aria-hidden="true" />
}
