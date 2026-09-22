import type { MeRole } from '../../hooks/useCurrentUser'

interface SuppleanceBannerProps {
  /** `currentUser.roles` — déjà chargé par la page, évite un second appel à /me. */
  roles: MeRole[]
}

function isoToFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function roleLabel(role: MeRole): string {
  return `${role.typeRole}${role.perimeterLabel ? ` — ${role.perimeterLabel}` : ''}`
}

/**
 * Bandeaux de suppléance sous l'en-tête des écrans d'accueil (décision du 20/09/2026) :
 *   - suppléant : « Vous suppléez X jusqu'au… » (une ligne par rôle suppléé) ;
 *   - titulaire suppléé : rôle en lecture seule, avec le nom du suppléant et la date de fin.
 *
 * Le gabarit GPMM n'a pas de composant « bandeau » : c'est le composant `.gp-toast` (variante
 * info/warning) posé en flux normal — il est `position:relative` hors de `.gp-toast-region`. À
 * remonter au template partagé si un vrai bandeau devient nécessaire ailleurs.
 */
export function SuppleanceBanner({ roles }: SuppleanceBannerProps) {
  const suppleant = roles.filter((r) => Boolean(r.enSuppleanceDe))
  const lectureSeule = roles.filter((r) => r.lectureSeule === true)
  if (suppleant.length === 0 && lectureSeule.length === 0) return null

  return (
    <div className="stack" style={{ gap: 10 }}>
      {suppleant.map((r) => (
        <div key={`s-${r.typeRole}-${r.idCellule ?? r.idService ?? r.perimeterLabel}`} className="gp-toast gp-toast--info" role="status">
          <svg className="ti gp-toast__icon">
            <use href="#i-info-circle" />
          </svg>
          <div style={{ flex: 1 }}>
            <p className="gp-toast__title">Suppléance en cours</p>
            <p className="gp-toast__text">
              Vous suppléez {r.enSuppleanceDe} ({roleLabel(r)}){r.suppleanceDateFin ? ` jusqu'au ${isoToFr(r.suppleanceDateFin)} inclus` : ''}.
            </p>
          </div>
        </div>
      ))}
      {lectureSeule.map((r) => (
        <div key={`l-${r.typeRole}-${r.idCellule ?? r.idService ?? r.perimeterLabel}`} className="gp-toast gp-toast--warning" role="status">
          <svg className="ti gp-toast__icon">
            <use href="#i-alert-triangle" />
          </svg>
          <div style={{ flex: 1 }}>
            <p className="gp-toast__title">Rôle en lecture seule</p>
            <p className="gp-toast__text">
              {r.suppleantNomPrenom ?? 'Un suppléant'} vous supplée sur votre rôle {roleLabel(r)}
              {r.suppleanceDateFin ? ` jusqu'au ${isoToFr(r.suppleanceDateFin)} inclus` : ''} : vous pouvez consulter, mais plus modifier,
              transmettre, rejeter ni annuler. Retirez la suppléance (bouton « Suppléance ») pour reprendre la main.
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
