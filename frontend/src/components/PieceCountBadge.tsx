import './PieceCountBadge.css'

interface PieceCountBadgeProps {
  count: number
}

/**
 * Pastille de notification (nombre de pièces déposées), superposée sur l'icône
 * « Visualiser les pièces » des cartes marché/investissement (MarchesPGI.tsx,
 * MarchesTiers.tsx, InvestissementsPGI.tsx). Aucun composant équivalent dans
 * gpmm-style-guide.html (voir ForClaude/INSTRUCTIONS_UX.md, règle « jamais de
 * composant improvisé ») — nouveau composant, dérivé exclusivement des jetons
 * --gp-* existants (danger/on-danger, police, surface), approuvé
 * explicitement par l'utilisateur le 05/09/2026 après signalement de ce
 * manque au design system.
 *
 * `aria-hidden` : purement décoratif — le compte est déjà porté par
 * l'aria-label du bouton parent (voir son utilisation dans MarchesPGI.tsx
 * etc.), pas doublement annoncé aux lecteurs d'écran. À poser à l'intérieur
 * d'un `.gp-tip` (déjà `position:relative` dans gpmm.css), jamais seul.
 */
export function PieceCountBadge({ count }: PieceCountBadgeProps) {
  if (count <= 0) return null
  return (
    <span className="piece-count-badge" aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>
  )
}
