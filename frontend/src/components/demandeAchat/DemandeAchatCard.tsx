import type { ReactNode } from 'react'
import type { DemandeAchat as DemandeAchatRow } from '../../hooks/useDemandeAchat'
import { STATUT_LABELS, STATUT_BADGE_CLASS, CURRENCY_FORMAT } from './constants'

export interface DemandeAchatCardProps {
  demandeAchat: DemandeAchatRow
  /** Libellé du fournisseur retenu — dérive de `useFournisseurs(idService)`, fourni par le parent (portée du service différente entre l'accueil Demandeur et l'écran de suivi RC). */
  fournisseurLabel: (idFournisseur: number | null) => string
  /** Icônes d'action par ligne (`.gp-rowacts`) — propres à chaque écran (pages/Home.tsx, pages/SuiviRc.tsx), fournies par le parent. */
  actions: ReactNode
}

/**
 * Carte DA/FAD à 2 lignes (numéro/objet/statut/actions puis montant/
 * procédure/fournisseur), extraite de pages/Home.tsx le 15/09/2026 (écran de
 * suivi RC) pour être partagée avec pages/SuiviRc.tsx — même contenu/
 * alignement dans les deux écrans, seules les actions par ligne diffèrent.
 * Statut et actions sur la ligne du numéro/objet (décision du 16/09/2026,
 * auparavant sur la seconde ligne avec montant/procédure/fournisseur).
 */
export function DemandeAchatCard({ demandeAchat: da, fournisseurLabel, actions }: DemandeAchatCardProps) {
  return (
    <article className="gp-panel accueil-da-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <div className="row" style={{ gap: 12, flex: '1 1 auto', minWidth: 0, flexWrap: 'nowrap' }}>
          <span className="mono" style={{ flex: '0 0 140px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--gp-text)' }}>
            {da.numero}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{da.objet_rc || '—'}</span>
        </div>
        <div className="row" style={{ gap: 12, flex: 'none', alignItems: 'center' }}>
          <span className={`gp-badge ${STATUT_BADGE_CLASS[da.code_statut] ?? ''}`} style={{ flex: 'none' }}>
            {STATUT_LABELS[da.code_statut] ?? da.code_statut}
          </span>
          {da.validee_sur_seuil_ds && (
            <span
              className="gp-tip gp-badge gp-badge--warning"
              style={{ flex: 'none' }}
              data-tip="Validée automatiquement sous le seuil de validation DS, sans intervention du Directeur de Service"
            >
              Seuil DS
            </span>
          )}
          <div className="gp-rowacts">{actions}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 12, marginTop: 6, flexWrap: 'nowrap' }}>
        <span style={{ flex: '0 0 140px', textAlign: 'right', whiteSpace: 'nowrap' }}>{CURRENCY_FORMAT.format(da.montant_demande)}</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {da.procedure_achat === 'MARCHE'
            ? (da.nummarche ?? (da.id_marche_tiers !== null ? `Marché tiers #${da.id_marche_tiers}` : 'Marché'))
            : 'Hors marché'}
        </span>
        <span aria-hidden="true">-</span>
        <span>{fournisseurLabel(da.id_fournisseur_retenu)}</span>
      </div>
    </article>
  )
}
