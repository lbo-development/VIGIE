import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useCertificatsServiceFaitPourRole, useSyntheseFacturation, type CertificatServiceFait } from '../hooks/useCertificatServiceFait'
import { CertificatServiceFaitCard } from '../components/certificatServiceFait/CertificatServiceFaitCard'
import { TraiterCsfBudgetModal, CertificatServiceFaitReadOnlyModal } from '../components/certificatServiceFait/modals'
import { HistoriqueStatutsCsfModal } from '../components/certificatServiceFait/HistoriqueStatutsCsfModal'
import { FacturationPanel } from '../components/certificatServiceFait/FacturationPanel'
import {
  STATUTS_CSF_A_TRAITER_CB_TAB,
  STATUTS_CSF_EN_COURS_CB_TAB,
  STATUTS_CSF_LIQUIDE_TAB,
  STATUT_CSF_A_TRAITER_BUDGET,
  STATUT_CSF_VALIDE_BUDGET,
} from '../components/certificatServiceFait/constants'
import '../styles/tableauDeBord.css'

const TABS: { key: 'A_TRAITER' | 'EN_COURS' | 'LIQUIDE'; label: string }[] = [
  { key: 'A_TRAITER', label: 'À traiter' },
  { key: 'EN_COURS', label: 'En cours' },
  { key: 'LIQUIDE', label: 'Liquidé' },
]

/**
 * Écran de suivi CSF — CB (décision du 24/09/2026, entrée de sidebar dédiée
 * "Accueil" > "CSF (CB) — <service>", à la demande explicite de l'utilisateur
 * — remplace la section embarquée initialement dans pages/SuiviCb.tsx). File
 * transverse : tous les CSF des FAD du service de la CB, non groupés par FAD
 * — voir backend/src/services/certificatServiceFait.service.ts#listPourCb.
 * Pas de suppléance (CB collective par service, jamais suppléable).
 */
export function SuiviCsfCb() {
  const { session } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const displayName = currentUser?.prenom && currentUser?.nom ? `${currentUser.prenom} ${currentUser.nom}` : session?.user.email
  const cbRole = currentUser?.roles.find((r) => r.typeRole === 'CB') ?? null

  const [activeTab, setActiveTab] = useState<'A_TRAITER' | 'EN_COURS' | 'LIQUIDE'>('A_TRAITER')
  const { data: certificats, loading, error, refetch } = useCertificatsServiceFaitPourRole('CB')
  const { data: syntheseFacturation, error: syntheseFacturationError } = useSyntheseFacturation('CB')

  const STATUTS_PAR_ONGLET = {
    A_TRAITER: STATUTS_CSF_A_TRAITER_CB_TAB,
    EN_COURS: STATUTS_CSF_EN_COURS_CB_TAB,
    LIQUIDE: STATUTS_CSF_LIQUIDE_TAB,
  }
  const tabCounts = {
    A_TRAITER: certificats.filter((c) => STATUTS_CSF_A_TRAITER_CB_TAB.includes(c.code_statut_csf)).length,
    EN_COURS: certificats.filter((c) => STATUTS_CSF_EN_COURS_CB_TAB.includes(c.code_statut_csf)).length,
    LIQUIDE: certificats.filter((c) => STATUTS_CSF_LIQUIDE_TAB.includes(c.code_statut_csf)).length,
  }
  const certificatsAffiches = certificats.filter((c) =>
    STATUTS_PAR_ONGLET[activeTab].includes(c.code_statut_csf),
  )

  const [traiterCsf, setTraiterCsf] = useState<CertificatServiceFait | null>(null)
  const [readOnlyCsf, setReadOnlyCsf] = useState<CertificatServiceFait | null>(null)
  const [historiqueCsf, setHistoriqueCsf] = useState<CertificatServiceFait | null>(null)

  return (
    <div className="stack tdb-page-fill">
      <div className="page-heading">
        <div>
          <h1>CSF (CB){cbRole?.perimeterLabel ? ` — ${cbRole.perimeterLabel}` : ''}</h1>
          <p>Bienvenue, {displayName}. Certificats de service fait de votre service.</p>
        </div>
      </div>

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
              const aTraiter = csf.code_statut_csf === STATUT_CSF_A_TRAITER_BUDGET || csf.code_statut_csf === STATUT_CSF_VALIDE_BUDGET
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
        <TraiterCsfBudgetModal
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
