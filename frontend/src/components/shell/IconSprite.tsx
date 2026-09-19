import iconsSvg from '../../assets/icons.svg?raw'
import iconsVigieSvg from '../../assets/icons-vigie.svg?raw'

/**
 * Sprite d'icônes GPMM (41 icônes, nomenclature #i-xxx), injecté une seule fois
 * dans le document pour que <use href="#i-xxx"> fonctionne partout dans l'app.
 * Contenu de icons.svg réutilisé tel quel, non modifié (voir INSTRUCTIONS_UX.md) —
 * l'injection inline (plutôt qu'un <img>/fetch externe) est requise pour que les
 * références <use href="#i-xxx"> résolvent de façon fiable dans tous les navigateurs.
 *
 * icons-vigie.svg (nomenclature #iv-xxx) : exception documentée au sprite
 * partagé (décision du 17/09/2026, voir le commentaire en tête de ce
 * fichier) — icônes propres à VIGIE, jamais ajoutées au template GPMM,
 * injectées ici au même point pour que <use href="#iv-xxx"> résolve pareil.
 */
export function IconSprite() {
  // Contenu statique du bundle (pas une entrée utilisateur) ; le <svg class="svg-sprite">
  // racine de chaque fichier porte déjà le masquage (gpmm.css : .svg-sprite).
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: iconsSvg }} />
      <div dangerouslySetInnerHTML={{ __html: iconsVigieSvg }} />
    </>
  )
}
