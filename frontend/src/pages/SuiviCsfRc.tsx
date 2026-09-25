import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { SuppleanceButton } from '../components/suppleance/SuppleanceButton'
import { SuppleanceBanner } from '../components/suppleance/SuppleanceBanner'
import { useCertificatsServiceFaitPourRole, useSyntheseFacturation, type CertificatServiceFait } from '../hooks/useCertificatServiceFait'
import { CertificatServiceFaitCard } from '../components/certificatServiceFait/CertificatServiceFaitCard'
import { TraiterCsfRcModal, CertificatServiceFaitReadOnlyModal } from '../components/certificatServiceFait/modals'
import { HistoriqueStatutsCsfModal } from '../components/certificatServiceFait/HistoriqueStatutsCsfModal'
import { FacturationPanel } from '../components/certificatServiceFait/FacturationPanel'
import {
  STATUTS_CSF_A_TRAITER_RC_TAB,
  STATUTS_CSF_EN_COURS_RC_TAB,
  STATUTS_CSF_LIQUIDE_TAB,
  STATUT_CSF_A_TRAITER_RC,
  STATUT_CSF_A_COMPLETER_BUDGET,
} from '../components/certificatServiceFait/constants'
import '../styles/tableauDeBord.css'

const TABS: { key: 'A_TRAITER' | 'EN_COURS' | 'LIQUIDE'; label: string }[] = [
  { key: 'A_TRAITER', label: 'À traiter' },
  { key: 'EN_COURS', label: 'En cours' },
  { key: 'LIQUIDE', label: 'Liquidé' },
]

/**
 * Écran de suivi CSF — RC (décision du 24/09/2026, entrée de sidebar dédiée
 * "Accueil" > "CSF — <cellule>", à la demande explicite de l'utilisateur —
 * remplace la section embarquée initialement dans pages/SuiviRc.tsx).
 * File transverse : tous les CSF des FAD dont le demandeur relève de la
 * cellule du RC (titulaire ou suppléant), non groupés par FAD — voir
 * backend/src/services/certificatServiceFait.service.ts#listPourRc.
 */
export function SuiviCsfRc() {
  const { session } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const displayName = currentUser?.prenom && currentUser?.nom ? `${currentUser.prenom} ${currentUser.nom}` : session?.user.email
  const rcRole = currentUser?.roles.find((r) => r.typeRole === 'RC') ?? null

  const [activeTab, setActiveTab] = useState<'A_TRAITER' | 'EN_COURS' | 'LIQUIDE'>('A_TRAITER')
  const { data: certificats, loading, error, refetch } = useCertificatsServiceFaitPourRole('RC')
  const { data: syntheseFacturation, error: syntheseFacturationError } = useSyntheseFacturation('RC')

  const STATUTS_PAR_ONGLET = {
    A_TRAITER: STATUTS_CSF_A_TRAITER_RC_TAB,
    EN_COURS: STATUTS_CSF_EN_COURS_RC_TAB,
    LIQUIDE: STATUTS_CSF_LIQUIDE_TAB,
  }
  const tabCounts = {
    A_TRAITER: certificats.filter((c) => STATUTS_CSF_A_TRAITER_RC_TAB.includes(c.code_statut_csf)).length,
    EN_COURS: certificats.filter((c) => STATUTS_CSF_EN_COURS_RC_TAB.includes(c.code_statut_csf)).length,
    LIQUIDE: certificats.filter((c) => STATUTS_CSF_LIQUIDE_TAB.includes(c.code_statut_csf)).length,
  }
  const certificatsAffiches = certificats.filter((c) => STATUTS_PAR_ONGLET[activeTab].includes(c.code_statut_csf))

  const [traiterCsf, setTraiterCsf] = useState<CertificatServiceFait | null>(null)
  const [readOnlyCsf, setReadOnlyCsf] = useState<CertificatServiceFait | null>(null)
  const [historiqueCsf, setHistoriqueCsf] = useState<CertificatServiceFait | null>(null)

  return (
    <div className="stack tdb-page-fill">
      <div className="page-heading">
        <div>
          <h1>CSF{rcRole?.perimeterLabel ? ` — ${rcRole.perimeterLabel}` : ''}</h1>
          <p>Bienvenue, {displayName}. Certificats de service fait de votre cellule.</p>
        </div>
        <div className="page-actions">
          <SuppleanceButton />
        </div>
      </div>

      <SuppleanceBanner roles={currentUser?.roles ?? []} />

      <div className="demo-grid accueil-tiles-grid tdb-grid-fill">
      <div className="gp-panel tdb-panel-fill">
        <div className="gp-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="gp-tab"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label} <span className="gp-badge">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        <div className="stack tdb-body-fill" style={{ padding: '16px 0 0' }}>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="gp-btn gp-btn--neutral gp-btn--icon" aria-label="Actualiser la liste" onClick={() => void refetch()}>
              <svg className="ti">
                <use href="#i-refresh" />
              </svg>
            </button>
          </div>

          {error && <p className="gp-errmsg">{error}</p>}

          <div className="gp-scroll stack tdb-list-fill" style={{ gap: 10 }}>
            {loading && <p className="gp-help">Chargement…</p>}
            {!loading && certificatsAffiches.length === 0 && <p className="gp-help">Aucun certificat pour ce filtre.</p>}
            {certificatsAffiches.map((csf) => {
              const aTraiter = csf.code_statut_csf === STATUT_CSF_A_TRAITER_RC || csf.code_statut_csf === STATUT_CSF_A_COMPLETER_BUDGET
              return (
                <CertificatServiceFaitCard
                  key={csf.id_csf}
                  certificat={csf}
                  actions={
                    <>
                      {aTraiter ? (
                        <span className="gp-tip" data-tip="Traiter le certificat">
                          <button aria-label="Traiter le certificat" onClick={() => setTraiterCsf(csf)}>
                            <svg className="ti">
                              <use href="#i-circle-check" />
                            </svg>
                          </button>
                        </span>
                      ) : (
                        <span className="gp-tip" data-tip="Voir le certificat">
                          <button aria-label="Voir le certificat" onClick={() => setReadOnlyCsf(csf)}>
                            <svg className="ti">
                              <use href="#i-eye" />
                            </svg>
                          </button>
                        </span>
                      )}
                      <span className="gp-tip" data-tip="Historique des statuts">
                        <button aria-label="Historique des statuts" onClick={() => setHistoriqueCsf(csf)}>
                          <svg className="ti">
                            <use href="#i-calendar" />
                          </svg>
                        </button>
                      </span>
                    </>
                  }
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <FacturationPanel synthese={syntheseFacturation} error={syntheseFacturationError} />
      </div>
      </div>

      {traiterCsf && (
        <TraiterCsfRcModal
          certificat={traiterCsf}
          onClose={() => setTraiterCsf(null)}
          onSaved={() => {
            setTraiterCsf(null)
            void refetch()
          }}
        />
      )}

      {readOnlyCsf && <CertificatServiceFaitReadOnlyModal certificat={readOnlyCsf} onClose={() => setReadOnlyCsf(null)} />}

      {historiqueCsf && (
        <HistoriqueStatutsCsfModal idCsf={historiqueCsf.id_csf} numeroCsf={historiqueCsf.numero_csf} onClose={() => setHistoriqueCsf(null)} />
      )}
    </div>
  )
}
