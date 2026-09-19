import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useFournisseurs } from '../hooks/useFournisseurs'
import {
  useDemandeAchatList,
  useAccueilSynthese,
  createDemandeAchat,
  transmettreRc,
  type DemandeAchat as DemandeAchatRow,
  type AccueilScope,
} from '../hooks/useDemandeAchat'
import { Combobox } from '../components/Combobox'
import { MetricCard } from '../components/MetricCard'
import { DemandeAchatModal, DeleteDemandeAchatModal, GestionDocumentaireModal } from '../components/demandeAchat/modals'
import { HistoriqueStatutsModal } from '../components/demandeAchat/HistoriqueStatutsModal'
import { DemandeAchatCard } from '../components/demandeAchat/DemandeAchatCard'
import { STATUT_LABELS, ACCUEIL_SCOPE_STATUTS, CURRENCY_FORMAT } from '../components/demandeAchat/constants'
import { ApiError } from '../services/api'
import '../styles/tableauDeBord.css'

const TABS: { key: 'A_FINALISER' | 'SUIVI_FAD' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES'; label: string }[] = [
  { key: 'A_FINALISER', label: 'A finaliser' },
  { key: 'SUIVI_FAD', label: 'Suivre & gérer les FAD' },
  { key: 'FAD_COMMANDEES', label: 'FAD commandées' },
  { key: 'REJETEES_ANNULEES', label: 'Rejetées / Annulées' },
]

const EN_TRANSIT_LABELS: { key: 'RC' | 'CDS' | 'DS' | 'CB'; label: string }[] = [
  { key: 'RC', label: 'N+1' },
  { key: 'CDS', label: 'N+2' },
  { key: 'DS', label: 'N+3' },
  { key: 'CB', label: 'CB' },
]

/**
 * Écran d'accueil "Accueil Demandeur" (maquette `Acceuil Demandeur.pdf`,
 * chantier du 15/09/2026) — remplace la coquille minimale précédente et
 * absorbe le contenu de l'ancienne page /demandes-achat (retirée du menu,
 * voir config/navigation.ts). Vue strictement Demandeur : toutes les listes
 * sont figées sur le matricule du connecté (`matriculeDemandeur`), y compris
 * pour un utilisateur qui cumule aussi un rôle RC/CDS/CB/DS/ADMIN — la vue
 * "file de travail" de ces rôles est un écran séparé, hors périmètre ici
 * (décision explicite du 15/09/2026).
 *
 * 2 tuiles de synthèse (GET /demandes-achat/synthese) : "En transit" (DA/FAD
 * du demandeur actuellement détenues par RC/CDS/DS/CB) et "Mes demandes"
 * (En cours / Commande). 4 onglets, chacun scopé sur une liste fixe de
 * statuts (voir ACCUEIL_SCOPE_STATUTS) — filtres Fournisseur/Statut/Recherche
 * réinitialisés au changement d'onglet (portée volontairement propre à
 * chaque onglet, pas persistée). Compteurs de badge = 4 requêtes non
 * filtrées dédiées (même principe que l'ancienne page DemandeAchat.tsx, qui
 * faisait deux appels — filtré + total — pour afficher "X sur Y").
 */
export function Home() {
  const { session } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const matricule = currentUser?.matricule ?? null
  const idService = currentUser?.idService ?? null
  const displayName = currentUser?.prenom && currentUser?.nom ? `${currentUser.prenom} ${currentUser.nom}` : session?.user.email

  const [activeTab, setActiveTab] = useState<AccueilScope>('A_FINALISER')
  const [filterFournisseur, setFilterFournisseur] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Filtres propres à chaque onglet — réinitialisés au changement d'onglet (pas de portée persistée entre onglets).
  useEffect(() => {
    setFilterFournisseur(null)
    setFilterStatut(null)
    setSearch('')
  }, [activeTab])

  const { data: synthese, loading: syntheseLoading, error: syntheseError, refetch: refetchSynthese } = useAccueilSynthese()

  const { fournisseurs } = useFournisseurs(idService)
  const fournisseurOptions = fournisseurs.map((f) => ({ value: String(f.id_fournisseur), label: f.raison_sociale_service }))
  const fournisseurLabel = (idFournisseur: number | null) => {
    if (idFournisseur === null) return '—'
    return fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'
  }

  // Une liste non filtrée par onglet — sert uniquement au badge de comptage (même principe que
  // "X sélectionnées sur Y enregistrées" de l'ancienne page DemandeAchat.tsx).
  const { demandesAchat: listAFinaliser, refetch: refetchAFinaliser } = useDemandeAchatList({ matriculeDemandeur: matricule, scope: 'A_FINALISER' })
  const { demandesAchat: listSuiviFad, refetch: refetchSuiviFad } = useDemandeAchatList({ matriculeDemandeur: matricule, scope: 'SUIVI_FAD' })
  const { demandesAchat: listFadCommandees, refetch: refetchFadCommandees } = useDemandeAchatList({ matriculeDemandeur: matricule, scope: 'FAD_COMMANDEES' })
  const { demandesAchat: listRejeteesAnnulees, refetch: refetchRejeteesAnnulees } = useDemandeAchatList({
    matriculeDemandeur: matricule,
    scope: 'REJETEES_ANNULEES',
  })
  const tabCounts: Record<'A_FINALISER' | 'SUIVI_FAD' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES', number> = {
    A_FINALISER: listAFinaliser.length,
    SUIVI_FAD: listSuiviFad.length,
    FAD_COMMANDEES: listFadCommandees.length,
    REJETEES_ANNULEES: listRejeteesAnnulees.length,
  }

  const {
    demandesAchat,
    loading: listLoading,
    error: listError,
    refetch: refetchActive,
  } = useDemandeAchatList({
    matriculeDemandeur: matricule,
    scope: activeTab,
    statut: filterStatut,
    idFournisseurRetenu: filterFournisseur !== null ? Number(filterFournisseur) : undefined,
    search,
  })

  function refetchAll() {
    void refetchAFinaliser()
    void refetchSuiviFad()
    void refetchFadCommandees()
    void refetchRejeteesAnnulees()
    void refetchActive()
    void refetchSynthese()
  }

  const statutFilterOptions = ACCUEIL_SCOPE_STATUTS[activeTab].map((code) => ({ value: code, label: STATUT_LABELS[code] ?? code }))

  const [creating, setCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [transmettingId, setTransmettingId] = useState<number | null>(null)

  const [modalDa, setModalDa] = useState<DemandeAchatRow | null>(null)
  const [modalDaIsNew, setModalDaIsNew] = useState(false)
  const [modalReadOnly, setModalReadOnly] = useState(false)
  const [daToDelete, setDaToDelete] = useState<DemandeAchatRow | null>(null)
  const [gestionDocumentaireDa, setGestionDocumentaireDa] = useState<DemandeAchatRow | null>(null)
  const [historiqueDa, setHistoriqueDa] = useState<DemandeAchatRow | null>(null)
  const [confirmTransmettreDa, setConfirmTransmettreDa] = useState<DemandeAchatRow | null>(null)

  async function handleNouvelleDemande() {
    if (!matricule) return
    setCreating(true)
    setActionError(null)
    try {
      const da = await createDemandeAchat()
      setModalDa(da)
      setModalDaIsNew(true)
      setModalReadOnly(false)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setCreating(false)
    }
  }

  async function handleTransmettreRc(da: DemandeAchatRow) {
    setActionError(null)
    setTransmettingId(da.id_demande_achat)
    try {
      await transmettreRc(da.id_demande_achat)
      setConfirmTransmettreDa(null)
      refetchAll()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setTransmettingId(null)
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Bienvenue, {displayName}</h1>
          <p>Suivi de vos demandes d'achat, de la préparation à la commande.</p>
        </div>
      </div>

      {!currentUser?.matricule && !syntheseLoading && (
        <div className="gp-errmsg">
          <svg className="ti">
            <use href="#i-alert-circle" />
          </svg>
          Ce compte n'est pas encore rattaché à un ACTEUR — aucune demande d'achat tant qu'un administrateur n'a pas renseigné le matricule
          correspondant.
        </div>
      )}

      {/* accueil-tiles-grid : réduit de 30% la colonne des tuiles par rapport au ratio par défaut de
          .demo-grid (gpmm.css, minmax(280px,.7fr)) — règle ajoutée dans styles/tableauDeBord.css,
          uniquement au-delà du même seuil que le repli mobile de .demo-grid (gpmm.css ne bouge pas). */}
      <div className="demo-grid accueil-tiles-grid">
      <div className="gp-panel">
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

        <div className="stack" style={{ padding: '16px 0 0' }}>
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="row" style={{ flexWrap: 'wrap', flex: 1 }}>
              <div className="gp-field" style={{ width: 260 }}>
                <label className="gp-label">Fournisseurs</label>
                <Combobox
                  options={fournisseurOptions}
                  value={filterFournisseur}
                  onChange={setFilterFournisseur}
                  placeholder="Tous"
                  clearLabel="Tous"
                  ariaLabel="Filtre fournisseur"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ width: 220 }}>
                <label className="gp-label">Statut</label>
                <Combobox
                  options={statutFilterOptions}
                  value={filterStatut}
                  onChange={setFilterStatut}
                  placeholder="Tous"
                  clearLabel="Tous"
                  ariaLabel="Filtre statut"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ width: 260 }}>
                <label className="gp-label" htmlFor="accueil-search">
                  Recherche
                </label>
                <div className="gp-inputgroup">
                  <svg className="ti">
                    <use href="#i-search" />
                  </svg>
                  <input
                    id="accueil-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Numéro, objet, fournisseur…"
                    aria-label="Rechercher"
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <button type="button" className="gp-btn gp-btn--neutral gp-btn--icon" aria-label="Actualiser la liste" onClick={() => refetchAll()}>
                <svg className="ti">
                  <use href="#i-refresh" />
                </svg>
              </button>
              {activeTab === 'A_FINALISER' && (
                <button type="button" className="gp-btn gp-btn--primary" disabled={!matricule || creating} onClick={() => void handleNouvelleDemande()}>
                  {creating ? 'Création…' : 'Nouvelle demande'}
                </button>
              )}
            </div>
          </div>

          {/* La confirmation de transmission (confirmTransmettreDa) affiche actionError elle-même — éviter le doublon ici. */}
          {actionError && !confirmTransmettreDa && (
            <p className="gp-errmsg">
              <svg className="ti">
                <use href="#i-alert-circle" />
              </svg>
              {actionError}
            </p>
          )}
          {listError && <p className="gp-errmsg">{listError}</p>}

          <div className="gp-scroll stack" style={{ maxHeight: 'calc(70vh - 70px)', gap: 10 }}>
            {listLoading && <p className="gp-help">Chargement…</p>}
            {!listLoading && demandesAchat.length === 0 && (
              <p className="gp-help">{!matricule ? 'Chargement du profil…' : 'Aucune demande pour ce filtre.'}</p>
            )}
            {demandesAchat.map((da) => {
              const canDelete = activeTab === 'A_FINALISER' && da.code_statut === 'DA_EN_PREPARATION'
              return (
                <DemandeAchatCard
                  key={da.id_demande_achat}
                  demandeAchat={da}
                  fournisseurLabel={fournisseurLabel}
                  actions={
                    <>
                      {activeTab === 'A_FINALISER' && (
                        <>
                          <span className="gp-tip" data-tip="Modifier la demande">
                            <button
                              aria-label="Modifier la demande"
                              onClick={() => {
                                setModalDa(da)
                                setModalDaIsNew(false)
                                setModalReadOnly(false)
                              }}
                            >
                              <svg className="ti">
                                <use href="#i-pencil" />
                              </svg>
                            </button>
                          </span>
                          <span className="gp-tip" data-tip={canDelete ? 'Supprimer la demande' : "Possible tant que la DA n'a pas été transmise au RC"}>
                            <button className="del" aria-label="Supprimer la demande" disabled={!canDelete} onClick={() => setDaToDelete(da)}>
                              <svg className="ti">
                                <use href="#i-trash" />
                              </svg>
                            </button>
                          </span>
                          <span
                            className="gp-tip"
                            data-tip={da.id_fournisseur_retenu === null ? "Identifiez d'abord un fournisseur" : 'Gérer les documents liés à la demande'}
                          >
                            <button
                              aria-label="Gérer les documents liés à la demande"
                              disabled={da.id_fournisseur_retenu === null}
                              onClick={() => setGestionDocumentaireDa(da)}
                            >
                              <svg className="ti">
                                <use href="#i-folder" />
                              </svg>
                            </button>
                          </span>
                          <span className="gp-tip" data-tip="Transmettre au RC">
                            <button aria-label="Transmettre au RC" onClick={() => setConfirmTransmettreDa(da)}>
                              <svg className="ti">
                                <use href="#i-log-out" />
                              </svg>
                            </button>
                          </span>
                        </>
                      )}
                      <span className="gp-tip" data-tip="Voir les éléments de la demande">
                        <button
                          aria-label="Voir les éléments de la demande"
                          onClick={() => {
                            setModalDa(da)
                            setModalDaIsNew(false)
                            setModalReadOnly(true)
                          }}
                        >
                          <svg className="ti">
                            <use href="#i-eye" />
                          </svg>
                        </button>
                      </span>
                      <span className="gp-tip" data-tip="Historique des statuts">
                        <button aria-label="Historique des statuts" onClick={() => setHistoriqueDa(da)}>
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
        <div className="gp-panel">
          <div className="panel-header" style={{ marginBottom: 8 }}>
            <div>
              <span className="eyebrow">Suivi</span>
              <h2>En transit</h2>
            </div>
          </div>
          {syntheseError && <p className="gp-errmsg">{syntheseError}</p>}
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} aria-label="Indicateurs — En transit">
            {EN_TRANSIT_LABELS.map(({ key, label }) => (
              <MetricCard
                key={key}
                label={label}
                value={synthese?.enTransit[key].nombre ?? 0}
                secondaryValue={CURRENCY_FORMAT.format(synthese?.enTransit[key].montant ?? 0)}
              />
            ))}
          </div>
        </div>

        <div className="gp-panel">
          <div className="panel-header" style={{ marginBottom: 8 }}>
            <div>
              <span className="eyebrow">Suivi</span>
              <h2>Mes demandes</h2>
            </div>
          </div>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} aria-label="Indicateurs — Mes demandes">
            <MetricCard
              label="En cours"
              value={synthese?.mesDemandes.enCours.nombre ?? 0}
              secondaryValue={CURRENCY_FORMAT.format(synthese?.mesDemandes.enCours.montant ?? 0)}
            />
            <MetricCard
              label="Commande"
              value={synthese?.mesDemandes.commande.nombre ?? 0}
              tone="success"
              secondaryValue={CURRENCY_FORMAT.format(synthese?.mesDemandes.commande.montant ?? 0)}
            />
          </div>
        </div>
      </div>
      </div>

      {modalDa && (
        <DemandeAchatModal
          demandeAchat={modalDa}
          procedureEditable={modalDaIsNew}
          readOnly={modalReadOnly}
          onClose={() => {
            setModalDa(null)
            refetchAll()
          }}
          onSaved={() => {
            setModalDa(null)
            refetchAll()
          }}
        />
      )}

      {daToDelete && (
        <DeleteDemandeAchatModal
          demandeAchat={daToDelete}
          onClose={() => setDaToDelete(null)}
          onDeleted={() => {
            setDaToDelete(null)
            refetchAll()
          }}
        />
      )}

      {confirmTransmettreDa && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="transmettreRcModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="transmettreRcModalTitle">
                Transmettre au RC
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setConfirmTransmettreDa(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>
                Transmettre la DA {confirmTransmettreDa.numero} ({confirmTransmettreDa.objet_rc || 'sans objet'}) au RC ?
                Vous ne pourrez plus la modifier tant qu'elle n'aura pas été renvoyée pour complément.
              </p>
              {actionError && (
                <p className="gp-errmsg">
                  <svg className="ti">
                    <use href="#i-alert-circle" />
                  </svg>
                  {actionError}
                </p>
              )}
            </div>
            <div className="gp-modal__ft">
              <button
                type="button"
                className="gp-btn gp-btn--secondary"
                onClick={() => setConfirmTransmettreDa(null)}
                disabled={transmettingId === confirmTransmettreDa.id_demande_achat}
              >
                Annuler
              </button>
              <button
                type="button"
                className="gp-btn gp-btn--primary"
                onClick={() => void handleTransmettreRc(confirmTransmettreDa)}
                disabled={transmettingId === confirmTransmettreDa.id_demande_achat}
              >
                {transmettingId === confirmTransmettreDa.id_demande_achat ? 'Transmission…' : 'Transmettre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {gestionDocumentaireDa && gestionDocumentaireDa.id_fournisseur_retenu !== null && (
        <GestionDocumentaireModal
          idDemandeAchat={gestionDocumentaireDa.id_demande_achat}
          idService={gestionDocumentaireDa.id_service}
          procedureAchat={gestionDocumentaireDa.procedure_achat}
          objetDa={gestionDocumentaireDa.objet_rc}
          idFournisseurRetenu={gestionDocumentaireDa.id_fournisseur_retenu}
          montantDemande={gestionDocumentaireDa.montant_demande}
          onClose={() => setGestionDocumentaireDa(null)}
        />
      )}

      {historiqueDa && (
        <HistoriqueStatutsModal idDemandeAchat={historiqueDa.id_demande_achat} numero={historiqueDa.numero} onClose={() => setHistoriqueDa(null)} />
      )}
    </div>
  )
}
