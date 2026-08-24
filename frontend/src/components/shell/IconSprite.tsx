import iconsSvg from '../../assets/icons.svg?raw'

/**
 * Sprite d'icônes GPMM (35 icônes, nomenclature #i-xxx), injecté une seule fois
 * dans le document pour que <use href="#i-xxx"> fonctionne partout dans l'app.
 * Contenu de icons.svg réutilisé tel quel, non modifié (voir INSTRUCTIONS_UX.md) —
 * l'injection inline (plutôt qu'un <img>/fetch externe) est requise pour que les
 * références <use href="#i-xxx"> résolvent de façon fiable dans tous les navigateurs.
 */
export function IconSprite() {
  // Contenu statique du bundle (pas une entrée utilisateur) ; le <svg class="svg-sprite">
  // racine du fichier porte déjà le masquage (gpmm.css : .svg-sprite).
  return <div dangerouslySetInnerHTML={{ __html: iconsSvg }} />
}
