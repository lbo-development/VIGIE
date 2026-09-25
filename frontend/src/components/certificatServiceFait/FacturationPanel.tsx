import { MetricCard } from '../MetricCard'
import type { SyntheseFacturation } from '../../hooks/useCertificatServiceFait'
import { CURRENCY_FORMAT } from '../demandeAchat/constants'

export interface FacturationPanelProps {
  synthese: SyntheseFacturation | null
  error: string | null
}

/** Taux de certification en montant (décision du 24/09/2026) : somme des CSF validés/liquidés ÷ somme de MONTANT_COMMANDE — pas un taux en nombre de commandes. `'%'` seul (sans chiffre) tant qu'il n'y a aucune commande dans le périmètre, comme le montre la maquette à vide. */
function formatTauxCertification(synthese: SyntheseFacturation | null): string {
  if (!synthese || synthese.commandes.montant <= 0) return '%'
  return `${Math.round((synthese.csf.montant / synthese.commandes.montant) * 100)}%`
}

/**
 * Panneau « Suivi de la facturation » (maquette fournie le 24/09/2026, ajustée après relecture
 * du rendu réel le même jour) — pages/Home.tsx (vue Demandeur), pages/SuiviCsfRc.tsx et
 * pages/SuiviCsfCb.tsx. Même style que les panneaux « En transit »/« Mes demandes » déjà présents
 * sur ces écrans (`.gp-panel`/`.eyebrow`/`.metrics-grid`/`MetricCard`, tous déjà stylés par le
 * gabarit GPMM) — grille à 2 colonnes comme eux (une grille à 3 colonnes est trop serrée dans la
 * colonne étroite de droite). Une seule tuile « Certifiées » (la maquette d'origine la répétait
 * sur 2 lignes ; abandonné sur retour utilisateur après avoir vu le rendu réel).
 */
export function FacturationPanel({ synthese, error }: FacturationPanelProps) {
  const taux = formatTauxCertification(synthese)

  return (
    <div className="gp-panel">
      <div className="panel-header" style={{ marginBottom: 8 }}>
        <div>
          <span className="eyebrow">Suivi</span>
          <h2>Suivi de la facturation</h2>
        </div>
      </div>
      {error && <p className="gp-errmsg">{error}</p>}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} aria-label="Indicateurs — Suivi de la facturation">
        <MetricCard label="CSF" value={synthese?.csf.nombre ?? 0} secondaryValue={CURRENCY_FORMAT.format(synthese?.csf.montant ?? 0)} />
        <MetricCard
          label="Commandes"
          value={synthese?.commandes.nombre ?? 0}
          secondaryValue={CURRENCY_FORMAT.format(synthese?.commandes.montant ?? 0)}
        />
        <MetricCard label="Certifiées" value={taux} />
        <MetricCard
          label="Commandes sans CSF"
          value={synthese?.commandesSansCsf.nombre ?? 0}
          secondaryValue={CURRENCY_FORMAT.format(synthese?.commandesSansCsf.montant ?? 0)}
        />
      </div>
    </div>
  )
}
