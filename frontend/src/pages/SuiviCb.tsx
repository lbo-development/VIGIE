import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useFournisseurs } from '../hooks/useFournisseurs'
import { useDemandeAchatList, useAccueilSynthese, downloadFadPdfBlob, type DemandeAchat as DemandeAchatRow, type AccueilScope } from '../hooks/useDemandeAchat'
import { Combobox } from '../components/Combobox'
import { MetricCard } from '../components/MetricCard'
import { DemandeAchatModal } from '../components/demandeAchat/modals'
import { HistoriqueStatutsModal } from '../components/demandeAchat/HistoriqueStatutsModal'
import { DemandeAchatCard } from '../components/demandeAchat/DemandeAchatCard'
import { ValiderCommandeCbModal } from '../components/demandeAchat/ValiderCommandeCbModal'
import { CompleterCbModal } from '../components/demandeAchat/CompleterCbModal'
import { CommanderCbModal } from '../components/demandeAchat/CommanderCbModal'
import { STATUT_LABELS, ACCUEIL_SCOPE_STATUTS, CURRENCY_FORMAT, triggerBlobDownload } from '../components/demandeAchat/constants'
import { ApiError } from '../services/api'
import '../styles/tableauDeBord.css'

const TABS: { key: 'A_TRAITER_CB' | 'EN_COURS_CB' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES'; label: string }[] = [
  { key: 'A_TRAITER_CB', label: 'À traiter' },
  { key: 'EN_COURS_CB', label: 'En cours' },
  { key: 'FAD_COMMANDEES', label: 'FAD commandées' },
  { key: 'REJETEES_ANNULEES', label: 'Rejetées / Annulées' },
]

// 3 compartiments seulement (pas de CB, même principe que pages/SuiviCds.tsx) : une FAD encore
// chez la CB elle-même n'est pas « en transit » de son point de vue, déjà visible dans ses propres
// onglets « À traiter »/« En cours » — voir demandeAchat.service.ts#getSynthese (roleCompteCb).
const EN_TRANSIT_LABELS_CB: { key: 'RC' | 'CDS' | 'DS'; label: string }[] = [
  { key: 'RC', label: 'N+1' },
  { key: 'CDS', label: 'N+2' },
  { key: 'DS', label: 'N+3' },
]

/**
 * Écran de suivi CB (décision du 18/09/2026, calqué sur pages/SuiviCds.tsx) :
 * toutes les FAD du service (rôle CB, titulaire ou suppléant — `role: 'CB'`
 * explicite sur chaque appel, cf. demandeAchat.service.ts#resolveAccessContext).
 * Un seul onglet « À traiter » (décision du 18/09/2026 — pas de split
 * « À traiter »/« À commander ») regroupant les 5 statuts où la CB est « pour
 * action » : statuer sur une FAD transmise (ValiderCommandeCbModal, décision
 * + transmission au DS/exemption de seuil combinées dans une seule modale),
 * répondre à un complément demandé par le DS (CompleterCbModal, seule
 * reprise qui ne remonte pas jusqu'au RC), et constater la commande
 * (CommanderCbModal). 2 tuiles de synthèse : « En transit » (3 compartiments
 * RC/CDS/DS, pas CB) et « FAD du service » (En cours/Commandée) — jamais
 * d'affichage de la valeur du seuil de validation DS sur cet écran (décision
 * du 18/09/2026).
 */
function estStatutValiderCommande(codeStatut: string): boolean {
  return codeStatut === 'FAD_TRANSMISE_CDS_CB' || codeStatut === 'FAD_MODIFIEE_TRANSMISE_RC_CB' || codeStatut === 'FAD_VALIDEE_CB'
}

function estStatutCompleter(codeStatut: string): boolean {
  return codeStatut === 'FAD_A_COMPLETER_CB'
}

function estStatutCommander(codeStatut: string): boolean {
  return codeStatut === 'FAD_A_COMMANDER'
}

/**
 * Fiche FAD papier (PDF), bouton réservé au rôle CB (décision du 19/09/2026) — actif juste
 * après que la CB a transmis la FAD au DS (FAD_TRANSMISE_CB_DS, onglet « En cours »), ou
 * l'a exemptée du seuil DS (FAD_A_COMMANDER avec VALIDEE_SUR_SEUIL_DS=true, onglet
 * « À traiter » — FAD_VALIDEE_DS_SEUIL n'est jamais un statut stable, voir
 * demandeAchat.service.ts#transmettreDsOuSeuil). Indépendant des boutons de décision
 * ci-dessus : peut s'afficher en plus du bouton « Commander ».
 */
function estStatutGenererPdf(da: DemandeAchatRow): boolean {
  return da.code_statut === 'FAD_TRANSMISE_CB_DS' || (da.code_statut === 'FAD_A_COMMANDER' && da.validee_sur_seuil_ds)
}

export function SuiviCb() {
  const { session } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const displayName = currentUser?.prenom && currentUser?.nom ? `${currentUser.prenom} ${currentUser.nom}` : session?.user.email
  const cbRole = currentUser?.roles.find((r) => r.typeRole === 'CB') ?? null
  const idService = cbRole?.idService ?? null

  const { data: synthese, error: syntheseError } = useAccueilSynthese('CB')

  const [activeTab, setActiveTab] = useState<AccueilScope>('A_TRAITER_CB')
  const [filterFournisseur, setFilterFournisseur] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Filtres propres à chaque onglet — réinitialisés au changement d'onglet (même principe que pages/SuiviCds.tsx).
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

  // Une liste non filtrée par onglet — sert uniquement au badge de comptage (même principe que pages/SuiviCds.tsx).
  const { demandesAchat: listATraiter, refetch: refetchATraiter } = useDemandeAchatList({ scope: 'A_TRAITER_CB', role: 'CB' })
  const { demandesAchat: listEnCours, refetch: refetchEnCours } = useDemandeAchatList({ scope: 'EN_COURS_CB', role: 'CB' })
  const { demandesAchat: listFadCommandees, refetch: refetchFadCommandees } = useDemandeAchatList({ scope: 'FAD_COMMANDEES', role: 'CB' })
  const { demandesAchat: listRejeteesAnnulees, refetch: refetchRejeteesAnnulees } = useDemandeAchatList({ scope: 'REJETEES_ANNULEES', role: 'CB' })
  const tabCounts: Record<'A_TRAITER_CB' | 'EN_COURS_CB' | 'FAD_COMMANDEES' | 'REJETEES_ANNULEES', number> = {
    A_TRAITER_CB: listATraiter.length,
    EN_COURS_CB: listEnCours.length,
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
    role: 'CB',
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
  const [completerDa, setCompleterDa] = useState<DemandeAchatRow | null>(null)
  const [commanderDa, setCommanderDa] = useState<DemandeAchatRow | null>(null)
  const [historiqueDa, setHistoriqueDa] = useState<DemandeAchatRow | null>(null)
  const [pdfPendingId, setPdfPendingId] = useState<number | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  async function handleGenererPdf(da: DemandeAchatRow) {
    if (pdfPendingId !== null) return
    setPdfError(null)
    setPdfPendingId(da.id_demande_achat)
    try {
      const blob = await downloadFadPdfBlob(da.id_demande_achat)
      triggerBlobDownload(blob, `FAD-${da.numero}.pdf`)
    } catch (err) {
      // Message serveur affiché tel quel (décision du 19/09/2026) : il porte l'information utile
      // sur les éléments manquants (délai/signatures) — pas de message générique ici.
      setPdfError(err instanceof ApiError ? err.message : 'Impossible de générer la fiche FAD.')
    } finally {
      setPdfPendingId(null)
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Suivi CB{cbRole?.perimeterLabel ? ` — ${cbRole.perimeterLabel}` : ''}</h1>
          <p>Bienvenue, {displayName}. Fiches d'achat de votre service.</p>
        </div>
      </div>

      {/* accueil-tiles-grid : même mise en page que pages/SuiviCds.tsx (styles/tableauDeBord.css). */}
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
                <label className="gp-label" htmlFor="suivicb-search">
                  Recherche
                </label>
                <div className="gp-inputgroup">
                  <svg className="ti">
                    <use href="#i-search" />
                  </svg>
                  <input
                    id="suivicb-search"
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
          {pdfError && <p className="gp-errmsg">{pdfError}</p>}
          {pdfPendingId !== null && (
            <div>
              <p className="gp-help" style={{ marginBottom: 6 }}>
                Génération de la fiche FAD…
              </p>
              <div className="gp-progress gp-progress--indeterminate">
                <div className="gp-progress__bar" />
              </div>
            </div>
          )}

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
                    {estStatutValiderCommande(da.code_statut) && (
                      <span className="gp-tip" data-tip="Valider les éléments de la commande">
                        <button aria-label="Valider les éléments de la commande" onClick={() => setValiderCommandeDa(da)}>
                          <svg className="ti">
                            <use href="#i-eye" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {estStatutCompleter(da.code_statut) && (
                      <span className="gp-tip" data-tip="Répondre au DS">
                        <button aria-label="Répondre au DS" onClick={() => setCompleterDa(da)}>
                          <svg className="ti">
                            <use href="#i-circle-check" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {estStatutCommander(da.code_statut) && (
                      <span className="gp-tip" data-tip="Commander">
                        <button aria-label="Commander" onClick={() => setCommanderDa(da)}>
                          <svg className="ti">
                            <use href="#i-circle-check" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {!estStatutValiderCommande(da.code_statut) && !estStatutCompleter(da.code_statut) && !estStatutCommander(da.code_statut) && (
                      <span className="gp-tip" data-tip="Voir les éléments de la demande">
                        <button aria-label="Voir les éléments de la demande" onClick={() => setModalDa(da)}>
                          <svg className="ti">
                            <use href="#i-eye" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {estStatutGenererPdf(da) && (
                      <span className="gp-tip" data-tip="Générer la fiche FAD (PDF)">
                        <button
                          aria-label="Générer la fiche FAD (PDF)"
                          disabled={pdfPendingId !== null}
                          onClick={() => void handleGenererPdf(da)}
                        >
                          <svg className="ti">
                            <use href="#i-download" />
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
            {EN_TRANSIT_LABELS_CB.map(({ key, label }) => (
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
              <h2>FAD du service</h2>
            </div>
          </div>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} aria-label="Indicateurs — FAD du service">
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
          roleHint="CB"
          onClose={() => setModalDa(null)}
          onSaved={() => setModalDa(null)}
        />
      )}

      {validerCommandeDa && (
        <ValiderCommandeCbModal
          demandeAchat={validerCommandeDa}
          onClose={() => setValiderCommandeDa(null)}
          onSaved={() => {
            setValiderCommandeDa(null)
            refetchAll()
          }}
        />
      )}

      {completerDa && (
        <CompleterCbModal
          demandeAchat={completerDa}
          onClose={() => setCompleterDa(null)}
          onSaved={() => {
            setCompleterDa(null)
            refetchAll()
          }}
        />
      )}

      {commanderDa && (
        <CommanderCbModal
          demandeAchat={commanderDa}
          onClose={() => setCommanderDa(null)}
          onSaved={() => {
            setCommanderDa(null)
            refetchAll()
          }}
        />
      )}

      {historiqueDa && (
        <HistoriqueStatutsModal idDemandeAchat={historiqueDa.id_demande_achat} numero={historiqueDa.numero} onClose={() => setHistoriqueDa(null)} role="CB" />
      )}
    </div>
  )
}
