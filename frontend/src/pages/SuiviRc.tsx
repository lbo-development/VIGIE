import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useFournisseurs } from '../hooks/useFournisseurs'
import { useCellules } from '../hooks/useCellules'
import { useDemandeAchatList, useAccueilSynthese, type DemandeAchat as DemandeAchatRow, type AccueilScope } from '../hooks/useDemandeAchat'
import { Combobox } from '../components/Combobox'
import { MetricCard } from '../components/MetricCard'
import { DemandeAchatModal, GestionDocumentaireModal } from '../components/demandeAchat/modals'
import { HistoriqueStatutsModal } from '../components/demandeAchat/HistoriqueStatutsModal'
import { DemandeAchatCard } from '../components/demandeAchat/DemandeAchatCard'
import { TraiterFadRcModal } from '../components/demandeAchat/TraiterFadRcModal'
import { STATUT_LABELS, ACCUEIL_SCOPE_STATUTS, CURRENCY_FORMAT } from '../components/demandeAchat/constants'
import '../styles/tableauDeBord.css'

const TABS: { key: 'A_TRAITER' | 'EN_COURS' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES'; label: string }[] = [
  { key: 'A_TRAITER', label: 'À traiter' },
  { key: 'EN_COURS', label: 'En cours' },
  { key: 'FAD_COMMANDEES', label: 'FAD commandées' },
  { key: 'REJETEES_ANNULEES', label: 'Rejetées / Annulées' },
]

// 3 compartiments seulement (pas de RC, contrairement à pages/Home.tsx) : une DA/FAD encore chez
// le RC lui-même n'est pas « en transit » de son point de vue, déjà visible dans ses propres
// onglets « À traiter »/« En cours » — voir demandeAchat.service.ts#getSynthese.
const EN_TRANSIT_LABELS_RC: { key: 'CDS' | 'DS' | 'CB'; label: string }[] = [
  { key: 'CDS', label: 'N+2' },
  { key: 'DS', label: 'N+3' },
  { key: 'CB', label: 'CB' },
]

/**
 * Écran de suivi RC (décision du 15/09/2026) — pendant de l'accueil Demandeur
 * (pages/Home.tsx) pour le RC : toutes les DA/FAD de sa cellule (titulaire ou
 * suppléant — voir demandeAchat.service.ts#resolveAccessContext), sans
 * matriculeDemandeur (la portée « sa cellule » est résolue côté serveur à
 * partir du rôle RC effectif). Pas de bouton « Nouvelle demande » (le RC ne
 * crée pas de DA, contrairement au Demandeur). 2 tuiles de synthèse (même
 * endpoint que pages/Home.tsx, useAccueilSynthese — la portée est résolue
 * côté serveur selon le rôle) : « En transit » (3 compartiments CDS/DS/CB,
 * pas RC — décision du 15/09/2026, second chantier) et « Demandes de la
 * cellule » (En cours/Commandée, périmètre cellule — DA_EN_PREPARATION
 * exclue). Accessible via l'entrée de sidebar « FAD — <cellule> »
 * (config/navigation.ts), masquée pour qui n'a pas de rôle RC actif.
 *
 * Gestion documentaire en modification (décision du 15/09/2026) : icône
 * dédiée, réservée à l'onglet « À traiter » (là où le RC est « pour action »
 * — même principe que l'onglet « A finaliser » du Demandeur) — « Voir » reste
 * en lecture seule sur tous les onglets, y compris « À traiter ».
 */
export function SuiviRc() {
  const { session } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const displayName = currentUser?.prenom && currentUser?.nom ? `${currentUser.prenom} ${currentUser.nom}` : session?.user.email
  const rcRole = currentUser?.roles.find((r) => r.typeRole === 'RC') ?? null

  const { cellules } = useCellules()
  const idService = rcRole?.idCellule !== null && rcRole?.idCellule !== undefined ? (cellules.find((c) => c.id_cellule === rcRole.idCellule)?.id_service ?? null) : null

  const { data: synthese, error: syntheseError } = useAccueilSynthese()

  const [activeTab, setActiveTab] = useState<AccueilScope>('A_TRAITER')
  const [filterFournisseur, setFilterFournisseur] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Filtres propres à chaque onglet — réinitialisés au changement d'onglet (même principe que pages/Home.tsx).
  useEffect(() => {
    setFilterFournisseur(null)
    setFilterStatut(null)
    setSearch('')
  }, [activeTab])

  const { fournisseurs } = useFournisseurs(idService)
  const fournisseurOptions = fournisseurs.map((f) => ({ value: String(f.id_fournisseur), label: f.raison_sociale_service }))
  const fournisseurLabel = (idFournisseur: number | null) => {
    if (idFournisseur === null) return '—'
    return fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'
  }

  // Une liste non filtrée par onglet — sert uniquement au badge de comptage (même principe que pages/Home.tsx).
  const { demandesAchat: listATraiter, refetch: refetchATraiter } = useDemandeAchatList({ scope: 'A_TRAITER' })
  const { demandesAchat: listEnCours, refetch: refetchEnCours } = useDemandeAchatList({ scope: 'EN_COURS' })
  const { demandesAchat: listFadCommandees, refetch: refetchFadCommandees } = useDemandeAchatList({ scope: 'FAD_COMMANDEES' })
  const { demandesAchat: listRejeteesAnnulees, refetch: refetchRejeteesAnnulees } = useDemandeAchatList({ scope: 'REJETEES_ANNULEES' })
  const tabCounts: Record<'A_TRAITER' | 'EN_COURS' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES', number> = {
    A_TRAITER: listATraiter.length,
    EN_COURS: listEnCours.length,
    FAD_COMMANDEES: listFadCommandees.length,
    REJETEES_ANNULEES: listRejeteesAnnulees.length,
  }

  const {
    demandesAchat,
    loading: listLoading,
    error: listError,
    refetch: refetchActive,
  } = useDemandeAchatList({
    scope: activeTab,
    statut: filterStatut,
    idFournisseurRetenu: filterFournisseur !== null ? Number(filterFournisseur) : undefined,
    search,
  })

  function refetchAll() {
    void refetchATraiter()
    void refetchEnCours()
    void refetchFadCommandees()
    void refetchRejeteesAnnulees()
    void refetchActive()
  }

  const statutFilterOptions = ACCUEIL_SCOPE_STATUTS[activeTab].map((code) => ({ value: code, label: STATUT_LABELS[code] ?? code }))

  const [modalDa, setModalDa] = useState<DemandeAchatRow | null>(null)
  const [historiqueDa, setHistoriqueDa] = useState<DemandeAchatRow | null>(null)
  const [traiterDa, setTraiterDa] = useState<DemandeAchatRow | null>(null)
  const [gestionDocumentaireDa, setGestionDocumentaireDa] = useState<DemandeAchatRow | null>(null)

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Suivi RC{rcRole?.perimeterLabel ? ` — ${rcRole.perimeterLabel}` : ''}</h1>
          <p>Bienvenue, {displayName}. Demandes d'achat et fiches d'achat de votre cellule.</p>
        </div>
      </div>

      {/* accueil-tiles-grid : même mise en page que pages/Home.tsx (styles/tableauDeBord.css). */}
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
          <div className="row" style={{ flexWrap: 'wrap' }}>
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
              <label className="gp-label" htmlFor="suivirc-search">
                Recherche
              </label>
              <div className="gp-inputgroup">
                <svg className="ti">
                  <use href="#i-search" />
                </svg>
                <input
                  id="suivirc-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Numéro, objet, fournisseur…"
                  aria-label="Rechercher"
                />
              </div>
            </div>
          </div>

          {listError && <p className="gp-errmsg">{listError}</p>}

          <div className="gp-scroll stack" style={{ maxHeight: 'calc(70vh - 70px)', gap: 10 }}>
            {listLoading && <p className="gp-help">Chargement…</p>}
            {!listLoading && demandesAchat.length === 0 && <p className="gp-help">Aucune demande pour ce filtre.</p>}
            {demandesAchat.map((da) => (
              <DemandeAchatCard
                key={da.id_demande_achat}
                demandeAchat={da}
                fournisseurLabel={fournisseurLabel}
                actions={
                  <>
                    {activeTab === 'A_TRAITER' && (
                      <>
                        <span className="gp-tip" data-tip="Traiter la demande">
                          <button aria-label="Traiter la demande" onClick={() => setTraiterDa(da)}>
                            <svg className="ti">
                              <use href="#i-circle-check" />
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
                      </>
                    )}
                    <span className="gp-tip" data-tip="Voir les éléments de la demande">
                      <button aria-label="Voir les éléments de la demande" onClick={() => setModalDa(da)}>
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
            ))}
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
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} aria-label="Indicateurs — En transit">
            {EN_TRANSIT_LABELS_RC.map(({ key, label }) => (
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
              <h2>Demandes de la cellule</h2>
            </div>
          </div>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} aria-label="Indicateurs — Demandes de la cellule">
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
        <DemandeAchatModal demandeAchat={modalDa} procedureEditable={false} readOnly onClose={() => setModalDa(null)} onSaved={() => setModalDa(null)} />
      )}

      {historiqueDa && (
        <HistoriqueStatutsModal idDemandeAchat={historiqueDa.id_demande_achat} numero={historiqueDa.numero} onClose={() => setHistoriqueDa(null)} />
      )}

      {traiterDa && (
        <TraiterFadRcModal
          demandeAchat={traiterDa}
          onClose={() => setTraiterDa(null)}
          onSaved={() => {
            setTraiterDa(null)
            refetchAll()
          }}
        />
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
    </div>
  )
}
