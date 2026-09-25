import { MetricCard } from '../MetricCard'
import type { SyntheseFacturation } from '../../hooks/useCertificatServiceFait'
import { CURRENCY_FORMAT } from '../demandeAchat/constants'

export interface FacturationPanelProps {
  synthese: SyntheseFacturation | null
  error: string | null
}

/**
 * Panneau « Suivi de la facturation » (maquette fournie le 24/09/2026, ajustée après relecture
 * du rendu réel le même jour) — pages/Home.tsx (vue Demandeur), pages/SuiviCsfRc.tsx et
 * pages/SuiviCsfCb.tsx. Même style que les panneaux « En transit »/« Mes demandes » déjà présents
 * sur ces écrans (`.gp-panel`/`.eyebrow`/`.metrics-grid`/`MetricCard`, tous déjà stylés par le
 * gabarit GPMM) — grille à 2 colonnes comme eux (une grille à 3 colonnes est trop serrée dans la
 * colonne étroite de droite). Tuiles redéfinies le 25/09/2026 : CSF (tous les CSF existants, hors
 * CSF_EN_PREPARATION) / Commandes (inchangée) / Certifié (CSF_VALIDE_BUDGET uniquement, remplace
 * l'ancien taux en % « Certifiées ») / Liquidé (nouveau, CSF_LIQUIDE) / Commandes sans CSF
 * (inchangée) — 5 tuiles, la dernière seule sur sa ligne dans la grille à 2 colonnes.
 */
export function FacturationPanel({ synthese, error }: FacturationPanelProps) {
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
        <MetricCard
          label="Certifié"
          value={synthese?.certifie.nombre ?? 0}
          secondaryValue={CURRENCY_FORMAT.format(synthese?.certifie.montant ?? 0)}
        />
        <MetricCard
          label="Liquidé"
          value={synthese?.liquide.nombre ?? 0}
          secondaryValue={CURRENCY_FORMAT.format(synthese?.liquide.montant ?? 0)}
        />
        <MetricCard
          label="Commandes sans CSF"
          value={synthese?.commandesSansCsf.nombre ?? 0}
          secondaryValue={CURRENCY_FORMAT.format(synthese?.commandesSansCsf.montant ?? 0)}
        />
      </div>
    </div>
  )
}
