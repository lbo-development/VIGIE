import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useFournisseurs } from '../hooks/useFournisseurs'
import { useDemandeAchatList, useAccueilSynthese, type DemandeAchat as DemandeAchatRow, type AccueilScope } from '../hooks/useDemandeAchat'
import { SuppleanceButton } from '../components/suppleance/SuppleanceButton'
import { SuppleanceBanner } from '../components/suppleance/SuppleanceBanner'
import { Combobox } from '../components/Combobox'
import { MetricCard } from '../components/MetricCard'
import { DemandeAchatModal } from '../components/demandeAchat/modals'
import { HistoriqueStatutsModal } from '../components/demandeAchat/HistoriqueStatutsModal'
import { DemandeAchatCard } from '../components/demandeAchat/DemandeAchatCard'
import { ValiderCommandeDsModal } from '../components/demandeAchat/ValiderCommandeDsModal'
import { STATUT_LABELS, ACCUEIL_SCOPE_STATUTS, CURRENCY_FORMAT } from '../components/demandeAchat/constants'
import '../styles/tableauDeBord.css'

const TABS: { key: 'A_TRAITER_DS' | 'EN_COURS_DS' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES'; label: string }[] = [
  { key: 'A_TRAITER_DS', label: 'À traiter' },
  { key: 'EN_COURS_DS', label: 'En cours' },
  { key: 'FAD_COMMANDEES', label: 'FAD commandées' },
  { key: 'REJETEES_ANNULEES', label: 'Rejetées / Annulées' },
]

// 3 compartiments seulement (pas de DS, contrairement à pages/Home.tsx) : une FAD encore chez
// le DS lui-même n'est pas « en transit » de son point de vue, déjà visible dans ses propres
// onglets « À traiter »/« En cours » — voir demandeAchat.service.ts#getSynthese.
const EN_TRANSIT_LABELS_DS: { key: 'RC' | 'CDS' | 'CB'; label: string }[] = [
  { key: 'RC', label: 'N+1' },
  { key: 'CDS', label: 'N+2' },
  { key: 'CB', label: 'CB' },
]

/**
 * Écran de suivi DS (décision du 22/09/2026, calqué sur pages/SuiviCds.tsx —
 * même comportement, pas celui de la CB) : toutes les FAD de la direction
 * (rôle DS, titulaire ou suppléant — `role: 'DS'` explicite sur chaque
 * appel, cf. demandeAchat.service.ts#resolveAccessContext, un acteur pouvant
 * cumuler plusieurs rôles). Le périmètre DS est une direction, potentiellement
 * plusieurs services (contrairement à CDS/CB, un seul service) — résolu côté
 * serveur, jamais ici. Pas de bouton « Nouvelle demande » (le DS ne crée pas
 * de DA), pas de filtre "Fournisseurs" (pas d'équivalent multi-service, la
 * recherche texte couvre déjà le fournisseur retenu — décision du
 * 22/09/2026), pas de bouton "Fiche FAD papier" (réservé au rôle CB,
 * décision du 19/09/2026). 2 tuiles de synthèse (même endpoint que
 * pages/SuiviCds.tsx, useAccueilSynthese('DS')) : « En transit » (3
 * compartiments RC/CDS/CB, pas DS) et « FAD de la direction » (En
 * cours/Commandée).
 *
 * **Comme le CDS, le DS ne modifie jamais aucun champ** — pas d'écran
 * « Traiter » équivalent, pas d'icône dédiée : chaque ligne n'affiche que
 * « Valider les éléments de la commande » (ValiderCommandeDsModal, une seule
 * modale gérant à la fois la décision `FAD_TRANSMISE_CB_DS` et la
 * transmission `FAD_VALIDEE_DS`) ou « Voir » en lecture seule, selon le
 * statut, plus l'historique. Les FAD exemptées de seuil (jamais vues en
 * décision par le DS) restent visibles en lecture dans l'onglet « En cours »
 * (statut `FAD_A_COMMANDER`, badge « Seuil DS » de DemandeAchatCard.tsx).
 */
function estStatutADecider(codeStatut: string): boolean {
  return codeStatut === 'FAD_TRANSMISE_CB_DS' || codeStatut === 'FAD_VALIDEE_DS'
}

export function SuiviDs() {
  const { session } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const displayName = currentUser?.prenom && currentUser?.nom ? `${currentUser.prenom} ${currentUser.nom}` : session?.user.email
  const dsRole = currentUser?.roles.find((r) => r.typeRole === 'DS') ?? null

  const { data: synthese, error: syntheseError } = useAccueilSynthese('DS')

  const [activeTab, setActiveTab] = useState<AccueilScope>('A_TRAITER_DS')
  const [filterStatut, setFilterStatut] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Filtres propres à chaque onglet — réinitialisés au changement d'onglet (même principe que pages/SuiviCds.tsx).
  useEffect(() => {
    setFilterStatut(null)
    setSearch('')
  }, [activeTab])

  // Pas de filtre "Fournisseurs" à l'écran (décision du 22/09/2026) — appelé uniquement pour
  // résoudre le nom du fournisseur retenu affiché sur chaque carte (voir fournisseurLabel
  // ci-dessous), le DS n'ayant pas d'idService unique.
  const { fournisseurs } = useFournisseurs(null, 'DS')
  const fournisseurLabel = (idFournisseur: number | null) => {
    if (idFournisseur === null) return '—'
    return fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'
  }

  // Une liste non filtrée par onglet — sert uniquement au badge de comptage (même principe que pages/SuiviCds.tsx).
  const { demandesAchat: listATraiter, refetch: refetchATraiter } = useDemandeAchatList({ scope: 'A_TRAITER_DS', role: 'DS' })
  const { demandesAchat: listEnCours, refetch: refetchEnCours } = useDemandeAchatList({ scope: 'EN_COURS_DS', role: 'DS' })
  const { demandesAchat: listFadCommandees, refetch: refetchFadCommandees } = useDemandeAchatList({ scope: 'FAD_COMMANDEES', role: 'DS' })
  const { demandesAchat: listRejeteesAnnulees, refetch: refetchRejeteesAnnulees } = useDemandeAchatList({ scope: 'REJETEES_ANNULEES', role: 'DS' })
  const tabCounts: Record<'A_TRAITER_DS' | 'EN_COURS_DS' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES', number> = {
    A_TRAITER_DS: listATraiter.length,
    EN_COURS_DS: listEnCours.length,
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
    search,
    role: 'DS',
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
  const [validerCommandeDa, setValiderCommandeDa] = useState<DemandeAchatRow | null>(null)
  const [historiqueDa, setHistoriqueDa] = useState<DemandeAchatRow | null>(null)

  return (
    <div className="stack tdb-page-fill">
      <div className="page-heading">
        <div>
          <h1>Suivi DS{dsRole?.perimeterLabel ? ` — ${dsRole.perimeterLabel}` : ''}</h1>
          <p>Bienvenue, {displayName}. Fiches d'achat de votre direction.</p>
        </div>
        <div className="page-actions">
          <SuppleanceButton />
        </div>
      </div>

      <SuppleanceBanner roles={currentUser?.roles ?? []} />

      {/* accueil-tiles-grid : même mise en page que pages/SuiviCds.tsx (styles/tableauDeBord.css). */}
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
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="row" style={{ flexWrap: 'wrap', flex: 1 }}>
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
                <label className="gp-label" htmlFor="suivids-search">
                  Recherche
                </label>
                <div className="gp-inputgroup">
                  <svg className="ti">
                    <use href="#i-search" />
                  </svg>
                  <input
                    id="suivids-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Numéro, objet, fournisseur…"
                    aria-label="Rechercher"
                  />
                </div>
              </div>
            </div>

            <button type="button" className="gp-btn gp-btn--neutral gp-btn--icon" aria-label="Actualiser la liste" onClick={() => refetchAll()}>
              <svg className="ti">
                <use href="#i-refresh" />
              </svg>
            </button>
          </div>

          {listError && <p className="gp-errmsg">{listError}</p>}

          <div className="gp-scroll stack tdb-list-fill" style={{ gap: 10 }}>
            {listLoading && <p className="gp-help">Chargement…</p>}
            {!listLoading && demandesAchat.length === 0 && <p className="gp-help">Aucune demande pour ce filtre.</p>}
            {demandesAchat.map((da) => (
              <DemandeAchatCard
                key={da.id_demande_achat}
                demandeAchat={da}
                fournisseurLabel={fournisseurLabel}
                actions={
                  <>
                    {estStatutADecider(da.code_statut) ? (
                      <span className="gp-tip" data-tip="Valider les éléments de la commande">
                        <button aria-label="Valider les éléments de la commande" onClick={() => setValiderCommandeDa(da)}>
                          <svg className="ti">
                            <use href="#i-eye" />
                          </svg>
                        </button>
                      </span>
                    ) : (
                      <span className="gp-tip" data-tip="Voir les éléments de la demande">
                        <button aria-label="Voir les éléments de la demande" onClick={() => setModalDa(da)}>
                          <svg className="ti">
                            <use href="#i-eye" />
                          </svg>
                        </button>
                      </span>
                    )}
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
            {EN_TRANSIT_LABELS_DS.map(({ key, label }) => (
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
              <h2>FAD de la direction</h2>
            </div>
          </div>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} aria-label="Indicateurs — FAD de la direction">
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
          procedureEditable={false}
          readOnly
          roleHint="DS"
          onClose={() => setModalDa(null)}
          onSaved={() => setModalDa(null)}
        />
      )}

      {validerCommandeDa && (
        <ValiderCommandeDsModal
          demandeAchat={validerCommandeDa}
          onClose={() => setValiderCommandeDa(null)}
          onSaved={() => {
            setValiderCommandeDa(null)
            refetchAll()
          }}
        />
      )}

      {historiqueDa && (
        <HistoriqueStatutsModal idDemandeAchat={historiqueDa.id_demande_achat} numero={historiqueDa.numero} onClose={() => setHistoriqueDa(null)} role="DS" />
      )}
    </div>
  )
}
