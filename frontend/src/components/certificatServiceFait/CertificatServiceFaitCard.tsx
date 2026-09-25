import type { ReactNode } from 'react'
import type { CertificatServiceFait } from '../../hooks/useCertificatServiceFait'
import { STATUT_CSF_LABELS, STATUT_CSF_BADGE_CLASS } from './constants'
import { CURRENCY_FORMAT } from '../demandeAchat/constants'

export interface CertificatServiceFaitCardProps {
  certificat: CertificatServiceFait
  /** Icônes d'action par ligne (`.gp-rowacts`) — propres à chaque écran (modale par-FAD, pages/SuiviRc.tsx, pages/SuiviCb.tsx). */
  actions: ReactNode
}

/** Carte CSF à 2 lignes, même structure que DemandeAchatCard.tsx (numéro/statut/actions puis montant/date de service fait). */
export function CertificatServiceFaitCard({ certificat: csf, actions }: CertificatServiceFaitCardProps) {
  return (
    <article className="gp-panel accueil-da-card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <div className="row" style={{ gap: 12, flex: '1 1 auto', minWidth: 0, flexWrap: 'nowrap' }}>
          <span className="mono" style={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--gp-text)' }}>
            {csf.numero_csf}
          </span>
        </div>
        <div className="row" style={{ gap: 12, flex: 'none', alignItems: 'center' }}>
          <span className={`gp-badge ${STATUT_CSF_BADGE_CLASS[csf.code_statut_csf] ?? ''}`} style={{ flex: 'none' }}>
            {STATUT_CSF_LABELS[csf.code_statut_csf] ?? csf.code_statut_csf}
          </span>
          <div className="gp-rowacts">{actions}</div>
        </div>
      </div>
      <div className="row" style={{ gap: 12, marginTop: 6, flexWrap: 'nowrap' }}>
        <span style={{ whiteSpace: 'nowrap' }}>{csf.montant_csf !== null ? CURRENCY_FORMAT.format(csf.montant_csf) : '—'}</span>
        <span aria-hidden="true">·</span>
        <span style={{ whiteSpace: 'nowrap' }}>
          Service fait le {csf.date_service_fait ? new Date(csf.date_service_fait).toLocaleDateString('fr-FR') : '—'}
        </span>
        {csf.description && (
          <>
            <span aria-hidden="true">·</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{csf.description}</span>
          </>
        )}
      </div>
    </article>
  )
}
