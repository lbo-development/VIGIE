import { useEffect, useState, type FormEvent } from 'react'
import { useInvestissementsPgi, type OperationInvestissement } from '../hooks/useInvestissementsPgi'
import { useInvestissementLastImport } from '../hooks/useInvestissementLastImport'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { Combobox } from '../components/Combobox'
import { PiecesInvestissementModal } from '../components/PiecesInvestissementModal'
import { AddPieceInvestissementModal } from '../components/AddPieceInvestissementModal'
import { api, ApiError } from '../services/api'
import '../styles/investissement.css'

const CURRENCY_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/** Même seuil que MarchesPGI.tsx#IMPORT_STALE_JOURS — bandeau "État des investissements au [date]" ci-dessous. */
const IMPORT_STALE_JOURS = 15

/** Même texte que backend/src/services/parametres.service.ts (clé last.import.investissement.pgi). */
const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.investissement.pgi" non initialisé.'

/** ISO 'YYYY-MM-DD' -> 'JJ/MM/AAAA' — même principe que MarchesPGI.tsx#formatDateFr. */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** Libellé affiché sur la carte : LIBELLE_SERVICE (propre au service) en priorité, repli sur LIBELLE (PGI) tant qu'il n'est pas renseigné (ex. opération pas encore réimportée depuis la migration). */
function displayLibelle(operation: OperationInvestissement): string {
  return operation.libelle_service?.trim() ? operation.libelle_service : operation.libelle
}

function matchesSearch(operation: OperationInvestissement, search: string): boolean {
  if (!search.trim()) return true
  const needle = search.trim().toLowerCase()
  return (
    operation.numero_operation.toLowerCase().includes(needle) ||
    operation.libelle.toLowerCase().includes(needle) ||
    (operation.libelle_service?.toLowerCase().includes(needle) ?? false)
  )
}

/** Filtre à trois états (modale FilterModal) — même principe que MarchesPGI.tsx#TriEtat. */
type TriEtat = 'oui' | 'non' | 'tous'

function matchesTriEtat(filtre: TriEtat, valeur: boolean): boolean {
  if (filtre === 'tous') return true
  return filtre === 'oui' ? valeur : !valeur
}

/** Filtre sur le statut PGI brut (A/F, seules valeurs stockées, §7 de la spec) — 'tous' = aucune contrainte. */
type StatutFiltre = 'A' | 'F' | 'tous'

function matchesStatutFiltre(filtre: StatutFiltre, statut: string): boolean {
  return filtre === 'tous' ? true : filtre === statut
}

/**
 * État des investissements PGI, montée sur /investissements — page par défaut de la section
 * "Investissements" (voir config/navigation.ts, INVESTISSEMENTS_SIDEBAR_ITEMS). Ouverte à tout
 * utilisateur authentifié, scopé à son service (ADMIN_APP libre) — voir
 * investissement.service.ts#listInvestissements.
 *
 * Représentation en cartes (une par opération), sur le modèle de MarchesPGI.tsx : filtre
 * Direction → Service + recherche texte sur la ligne principale, compteur "X sélectionnées sur Y"
 * + boutons "Filtrer" (modale, trois critères — Statut Activée/Future/Toutes sur A/F,
 * Utilisable et Actif en Oui/Non/Tous, maquette utilisateur du 04/09/2026) / "Supprimer les
 * filtres" au-dessus de la liste. Contrairement aux marchés, pas de barre de progression (aucune
 * notion de durée/montant maximum à seuil pour un investissement) : chaque carte affiche le
 * statut PGI (A/F), le numéro
 * d'opération, LIBELLE_SERVICE (repli sur LIBELLE tant qu'il n'est pas renseigné, voir
 * `displayLibelle`), deux points Actif/Inactif et Utilisable/Non utilisable (ajout du 04/09/2026
 * — champ manuel, sans second critère documenté comme COMPLETUDE pour un marché), les montants
 * Travaux et FESI, et un mini-tableau "Montant disponible" (MT_SOLDE_*) pour les 4 tranches
 * AP.1/AP.8/CP.1/CP.8.
 */
export function InvestissementsPGI() {
  const { data: currentUser } = useCurrentUser()
  const { directions } = useDirections()
  const { services } = useServices()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  // Modifier réservé à ADMIN_APP/ADMIN_SERVICE/CB (même triplet que l'import) — Visualiser reste ouvert à tous, comme MarchesPGI.tsx#canManage.
  const canManage = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP' || r.typeRole === 'ADMIN_SERVICE' || r.typeRole === 'CB') ?? false
  const adminServiceIds = (currentUser?.roles ?? [])
    .filter((r) => r.typeRole === 'ADMIN_SERVICE' && r.idService !== null)
    .map((r) => r.idService as number)
  const ownIdService = adminServiceIds[0] ?? currentUser?.idService ?? null
  const isRestrictedToOwnService = !isAdminApp && ownIdService != null
  const visibleServices = isRestrictedToOwnService
    ? services.filter((s) => s.id_service === ownIdService)
    : services

  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [filterIdService, setFilterIdService] = useState<string | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const servicesForFilter =
    filterIdDirection === null ? [] : visibleServices.filter((s) => s.id_direction === Number(filterIdDirection))

  useEffect(() => {
    if (isRestrictedToOwnService && filterIdDirection === null) {
      const ownService = services.find((s) => s.id_service === ownIdService)
      if (ownService) {
        setFilterIdDirection(String(ownService.id_direction))
        setFilterIdService(String(ownIdService))
      }
      return
    }
    if (filterIdDirection === null) {
      if (filterIdService !== null) setFilterIdService(null)
      return
    }
    if (filterIdService === null) return
    const stillValid = servicesForFilter.some((s) => s.id_service === Number(filterIdService))
    if (!stillValid) setFilterIdService(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestrictedToOwnService, ownIdService, services, filterIdDirection])

  const serviceOptions = servicesForFilter.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const idService = filterIdService !== null ? Number(filterIdService) : null

  const lastImportInfo = useInvestissementLastImport(idService)
  const isParametreNonInitialise = lastImportInfo !== null && !lastImportInfo.exists
  const isImportStale =
    lastImportInfo !== null &&
    lastImportInfo.exists &&
    (lastImportInfo.valeur === null || daysBetween(new Date(lastImportInfo.valeur), new Date()) >= IMPORT_STALE_JOURS)

  const { investissements, loading, refetch } = useInvestissementsPgi(idService)

  // Recherche appliquée uniquement au clic sur "Filtrer" (modale) ou touche Entrée — même principe que MarchesPGI.tsx.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [filterStatut, setFilterStatut] = useState<StatutFiltre>('tous')
  const [filterUtilisable, setFilterUtilisable] = useState<TriEtat>('tous')
  const [filterActif, setFilterActif] = useState<TriEtat>('tous')

  const [viewModalOperation, setViewModalOperation] = useState<OperationInvestissement | null>(null)
  const [editModalOperation, setEditModalOperation] = useState<OperationInvestissement | null>(null)
  const [piecesModalOperation, setPiecesModalOperation] = useState<OperationInvestissement | null>(null)
  const [addPieceModalOperation, setAddPieceModalOperation] = useState<OperationInvestissement | null>(null)

  function handleResetFilters() {
    setFilterStatut('tous')
    setFilterUtilisable('tous')
    setFilterActif('tous')
    setSearchInput('')
    setSearch('')
  }

  const totalInvestissements = investissements.length
  const displayedInvestissements = investissements
    .filter((i) => matchesStatutFiltre(filterStatut, i.statut))
    .filter((i) => matchesTriEtat(filterUtilisable, i.utilisable))
    .filter((i) => matchesTriEtat(filterActif, i.actif))
    .filter((i) => matchesSearch(i, search))
    .sort((a, b) => a.numero_operation.localeCompare(b.numero_operation, 'fr', { numeric: true }))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>État des investissements PGI</h1>
          {idService === null ? (
            <p>Opérations d'investissement et montants AP/CP, alimentés par l'import PGI.</p>
          ) : isParametreNonInitialise ? (
            <p className="gp-errmsg" style={{ color: 'var(--gp-warning-text)' }}>
              <svg className="ti">
                <use href="#i-alert-triangle" />
              </svg>
              {PARAMETRE_NON_INITIALISE}
            </p>
          ) : (
            lastImportInfo?.exists && (
              <div className="row" style={{ gap: 16 }}>
                <p className="gp-help">
                  {lastImportInfo.valeur
                    ? `État des investissements au ${formatDateFr(lastImportInfo.valeur)}`
                    : 'État des investissements — aucun import PGI effectué'}
                </p>
                {isImportStale && (
                  <p className="gp-errmsg" style={{ color: 'var(--gp-warning-text)' }}>
                    <svg className="ti">
                      <use href="#i-alert-triangle" />
                    </svg>
                    Pensez à importer les investissements récents
                  </p>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <div className="row">
        <div className="gp-field" style={{ width: 404 }}>
          <label className="gp-label">Direction</label>
          <Combobox
            options={directionOptions}
            value={filterIdDirection}
            onChange={(value) => {
              setFilterIdDirection(value)
              setFilterIdService(null)
            }}
            placeholder="Choisir une direction…"
            ariaLabel="Filtrer par direction"
            style={{ maxWidth: 'none' }}
          />
        </div>
        {filterIdDirection !== null && (
          <div className="gp-field" style={{ width: 404 }}>
            <label className="gp-label">Service</label>
            <Combobox
              options={serviceOptions}
              value={filterIdService}
              onChange={setFilterIdService}
              placeholder="Choisir un service…"
              ariaLabel="Filtrer par service"
              style={{ maxWidth: 'none' }}
            />
          </div>
        )}
        {idService !== null && (
          <div className="gp-field" style={{ width: 404 }}>
            <label className="gp-label">Recherche</label>
            <div className="gp-inputgroup">
              <svg className="ti">
                <use href="#i-search" />
              </svg>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSearch(searchInput)
                }}
                placeholder="Numéro d'opération, libellé…"
                aria-label="Rechercher un investissement"
              />
            </div>
          </div>
        )}
      </div>

      {idService !== null && !loading && (
        // width: 70% pour aligner le bord droit des boutons sur celui des cards (.investissement-card, même largeur réduite de 30%).
        <div className="row" style={{ width: '70%', justifyContent: 'space-between' }}>
          <p className="gp-help">
            {displayedInvestissements.length} investissements sélectionnés sur {totalInvestissements} enregistrés.
          </p>
          <div className="row" style={{ gap: 10 }}>
            <button className="gp-btn gp-btn--secondary" onClick={() => setFilterModalOpen(true)}>
              Filtrer
            </button>
            <button className="gp-btn gp-btn--ghost" onClick={handleResetFilters}>
              Supprimer les filtres
            </button>
          </div>
        </div>
      )}

      {(filterIdDirection === null || filterIdService === null) && (
        <p>Sélectionne une direction et un service pour afficher les investissements.</p>
      )}

      {idService !== null && loading && <p>Chargement…</p>}

      {idService !== null && !loading && displayedInvestissements.length === 0 && (
        <p>Aucun investissement pour ce filtre.</p>
      )}

      {idService !== null && !loading && displayedInvestissements.length > 0 && (
        <div className="investissement-list gp-scroll">
          {displayedInvestissements.map((operation) => (
            <InvestissementCard
              key={operation.numero_operation}
              operation={operation}
              canManage={canManage}
              onView={() => setViewModalOperation(operation)}
              onEdit={() => setEditModalOperation(operation)}
              onPieces={() => setPiecesModalOperation(operation)}
              onAddPiece={() => setAddPieceModalOperation(operation)}
            />
          ))}
        </div>
      )}

      {filterModalOpen && (
        <FilterModal
          statut={filterStatut}
          utilisable={filterUtilisable}
          actif={filterActif}
          onClose={() => setFilterModalOpen(false)}
          onApply={(next) => {
            setFilterStatut(next.statut)
            setFilterUtilisable(next.utilisable)
            setFilterActif(next.actif)
            setSearch(searchInput)
            setFilterModalOpen(false)
          }}
        />
      )}

      {viewModalOperation && (
        <ViewInvestissementModal operation={viewModalOperation} onClose={() => setViewModalOperation(null)} />
      )}

      {editModalOperation && (
        <EditInvestissementModal
          operation={editModalOperation}
          onClose={() => setEditModalOperation(null)}
          onSaved={() => {
            setEditModalOperation(null)
            void refetch()
          }}
        />
      )}

      {piecesModalOperation && (
        <PiecesInvestissementModal
          numeroOperation={piecesModalOperation.numero_operation}
          label={piecesModalOperation.numero_operation}
          canManage={canManage}
          onClose={() => setPiecesModalOperation(null)}
        />
      )}

      {addPieceModalOperation && (
        <AddPieceInvestissementModal
          numeroOperation={addPieceModalOperation.numero_operation}
          label={addPieceModalOperation.numero_operation}
          onClose={() => setAddPieceModalOperation(null)}
          onSaved={() => setAddPieceModalOperation(null)}
        />
      )}
    </div>
  )
}

interface FilterModalValues {
  statut: StatutFiltre
  utilisable: TriEtat
  actif: TriEtat
}

interface FilterModalProps extends FilterModalValues {
  onClose: () => void
  onApply: (values: FilterModalValues) => void
}

const TRI_ETAT_OPTIONS: { value: TriEtat; label: string }[] = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'tous', label: 'Tous' },
]

/** A = Activée, F = Future — seules valeurs stockées (§7 de la spec), 'tous' = aucune contrainte. */
const STATUT_FILTRE_OPTIONS: { value: StatutFiltre; label: string }[] = [
  { value: 'A', label: 'Activée' },
  { value: 'F', label: 'Future' },
  { value: 'tous', label: 'Toutes' },
]

/**
 * Une ligne de la modale de filtre : libellé + boutons radio — généralisé à un jeu d'options
 * arbitraire (au lieu du seul Oui/Non/Tous de MarchesPGI.tsx#FilterTriEtatRow) pour couvrir aussi
 * le filtre Statut (Activée/Future/Toutes, §7 de la spec).
 */
function FilterRadioRow<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (v: V) => void
}) {
  const name = `investissement-filter-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
      <span className="gp-label" style={{ minWidth: 90, flex: 'none' }}>
        {label}
      </span>
      {options.map((option) => (
        <label key={option.value} className="gp-choice" style={{ whiteSpace: 'nowrap' }}>
          <input
            className="gp-radio"
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            aria-label={`${label} : ${option.label}`}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

/**
 * Modale de filtre — même patron que MarchesPGI.tsx#FilterModal, trois critères (maquette
 * utilisateur du 04/09/2026) : Statut (Activée/Future/Toutes, sur le statut PGI brut A/F),
 * Utilisable et Actif (Oui/Non/Toutes) — pas d'alerte à seuil (pas de durée ni de montant
 * maximum sur une opération d'investissement, contrairement aux marchés). "Filtrer" valide aussi
 * la recherche texte en attente.
 */
function FilterModal({ statut, utilisable, actif, onClose, onApply }: FilterModalProps) {
  const [draftStatut, setDraftStatut] = useState<StatutFiltre>(statut)
  const [draftUtilisable, setDraftUtilisable] = useState<TriEtat>(utilisable)
  const [draftActif, setDraftActif] = useState<TriEtat>(actif)

  return (
    <div className="gp-overlay is-open">
      <div
        className="gp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="investissementFilterModalTitle"
        style={{ maxWidth: 520 }}
      >
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="investissementFilterModalTitle">
            Filtrer les investissements
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack" style={{ gap: 20 }}>
          <FilterRadioRow label="Statut" value={draftStatut} options={STATUT_FILTRE_OPTIONS} onChange={setDraftStatut} />
          <FilterRadioRow label="Utilisable" value={draftUtilisable} options={TRI_ETAT_OPTIONS} onChange={setDraftUtilisable} />
          <FilterRadioRow label="Actif" value={draftActif} options={TRI_ETAT_OPTIONS} onChange={setDraftActif} />
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Retour
          </button>
          <button
            type="button"
            className="gp-btn gp-btn--primary"
            onClick={() => onApply({ statut: draftStatut, utilisable: draftUtilisable, actif: draftActif })}
          >
            Filtrer
          </button>
        </div>
      </div>
    </div>
  )
}

function InvestissementCard({
  operation,
  canManage,
  onView,
  onEdit,
  onPieces,
  onAddPiece,
}: {
  operation: OperationInvestissement
  canManage: boolean
  onView: () => void
  onEdit: () => void
  onPieces: () => void
  onAddPiece: () => void
}) {
  return (
    <div className="investissement-card">
      <div className="investissement-card__header">
        <span className="investissement-card__statut">{operation.statut}</span>
        <span className="investissement-card__numop">{operation.numero_operation}</span>
        <span className="investissement-card__libservice">{displayLibelle(operation)}</span>
        <span className="investissement-card__dots">
          <span
            className={`investissement-card__dot ${operation.actif ? 'investissement-card__dot--on' : 'investissement-card__dot--off'}`}
            title={operation.actif ? 'Actif' : 'Inactif'}
          />
          <span
            className={`investissement-card__dot ${operation.utilisable ? 'investissement-card__dot--on' : 'investissement-card__dot--off'}`}
            title={operation.utilisable ? 'Utilisable' : 'Non utilisable'}
          />
        </span>
      </div>

      <div className="investissement-card__body">
        <div className="investissement-card__montants">
          <div className="investissement-card__field">
            <span className="investissement-card__field-label">Montant travaux</span>
            <span className="investissement-card__field-value">{CURRENCY_FORMAT.format(operation.mt_travaux)}</span>
          </div>
          <div className="investissement-card__field">
            <span className="investissement-card__field-label">Montant FESI</span>
            <span className="investissement-card__field-value">{CURRENCY_FORMAT.format(operation.mt_fesi)}</span>
          </div>
        </div>

        <div className="investissement-card__disponible">
          <p className="investissement-card__disponible-title">Montant disponible</p>
          <table className="investissement-disponible-table">
            <thead>
              <tr>
                <th aria-hidden="true" />
                <th>.1</th>
                <th>.8</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="investissement-disponible-table__row-label">AP</td>
                <td>{CURRENCY_FORMAT.format(operation.mt_solde_ap1)}</td>
                <td>{CURRENCY_FORMAT.format(operation.mt_solde_ap8)}</td>
              </tr>
              <tr>
                <td className="investissement-disponible-table__row-label">CP</td>
                <td>{CURRENCY_FORMAT.format(operation.mt_solde_cp1)}</td>
                <td>{CURRENCY_FORMAT.format(operation.mt_solde_cp8)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="gp-rowacts investissement-card__actions">
          <span className="gp-tip" data-tip="Visualiser">
            <button aria-label="Visualiser" onClick={onView}>
              <svg className="ti">
                <use href="#i-eye" />
              </svg>
            </button>
          </span>
          {canManage && (
            <span className="gp-tip" data-tip="Modifier">
              <button aria-label="Modifier" onClick={onEdit}>
                <svg className="ti">
                  <use href="#i-pencil" />
                </svg>
              </button>
            </span>
          )}
          <span className="gp-tip" data-tip="Visualiser les pièces">
            <button aria-label="Visualiser les pièces" onClick={onPieces}>
              <svg className="ti">
                <use href="#i-folder" />
              </svg>
            </button>
          </span>
          {canManage && (
            <span className="gp-tip" data-tip="Ajouter une pièce">
              <button aria-label="Ajouter une pièce" onClick={onAddPiece}>
                <svg className="ti">
                  <use href="#i-cloud" />
                </svg>
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Une ligne de la modale de visualisation : libellé + valeur en lecture seule — même composant que MarchesPGI.tsx#ViewField, dupliqué ici (pas de composant partagé entre pages). */
function ViewField({ label, value }: { label: string; value: string }) {
  const id = `investissement-view-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="gp-field">
      <label className="gp-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="gp-input" value={value} readOnly />
    </div>
  )
}

/**
 * Visualisation d'une opération (icône « Visualiser » des cartes, lecture seule, ouverte à tous)
 * — même patron que MarchesPGI.tsx#ViewMarcheModal : identification, puis le détail des 4
 * tranches (Budget/Engagé/Liquidé/Disponible × AP.1/AP.8/CP.1/CP.8) en tableau, comme sur la
 * carte mais complet (la carte ne montre que le Disponible).
 */
function ViewInvestissementModal({ operation, onClose }: { operation: OperationInvestissement; onClose: () => void }) {
  const tranches: { label: string; budget: number; engage: number; liquide: number; solde: number }[] = [
    { label: 'AP.1', budget: operation.mt_budget_ap1, engage: operation.mt_engage_ap1, liquide: operation.mt_liquide_ap1, solde: operation.mt_solde_ap1 },
    { label: 'AP.8', budget: operation.mt_budget_ap8, engage: operation.mt_engage_ap8, liquide: operation.mt_liquide_ap8, solde: operation.mt_solde_ap8 },
    { label: 'CP.1', budget: operation.mt_budget_cp1, engage: operation.mt_engage_cp1, liquide: operation.mt_liquide_cp1, solde: operation.mt_solde_cp1 },
    { label: 'CP.8', budget: operation.mt_budget_cp8, engage: operation.mt_engage_cp8, liquide: operation.mt_liquide_cp8, solde: operation.mt_solde_cp8 },
  ]

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="viewInvestissementModalTitle" style={{ maxWidth: 720 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="viewInvestissementModalTitle">
            Opération {operation.numero_operation}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="row">
            <ViewField label="Statut" value={operation.statut} />
            <ViewField label="CUG" value={operation.code_cug} />
            <ViewField label="Actif" value={operation.actif ? 'Oui' : 'Non'} />
            <ViewField label="Utilisable" value={operation.utilisable ? 'Oui' : 'Non'} />
          </div>
          <ViewField label="Libellé (PGI)" value={operation.libelle} />
          <ViewField label="Libellé (service)" value={operation.libelle_service?.trim() ? operation.libelle_service : '—'} />
          <div className="row">
            <ViewField label="Montant initial" value={CURRENCY_FORMAT.format(operation.mt_initial)} />
            <ViewField label="Montant travaux" value={CURRENCY_FORMAT.format(operation.mt_travaux)} />
            <ViewField label="Montant FESI" value={CURRENCY_FORMAT.format(operation.mt_fesi)} />
          </div>

          <div className="gp-table-wrap">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Tranche</th>
                  <th>Budget</th>
                  <th>Engagé</th>
                  <th>Liquidé</th>
                  <th>Disponible</th>
                </tr>
              </thead>
              <tbody>
                {tranches.map((t) => (
                  <tr key={t.label}>
                    <td className="mono">{t.label}</td>
                    <td>{CURRENCY_FORMAT.format(t.budget)}</td>
                    <td>{CURRENCY_FORMAT.format(t.engage)}</td>
                    <td>{CURRENCY_FORMAT.format(t.liquide)}</td>
                    <td>{CURRENCY_FORMAT.format(t.solde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Retour
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Modification manuelle des seuls champs éditables hors import — LIBELLE_SERVICE, ACTIF et
 * UTILISABLE (ACTIF rendu manuel le 04/09/2026 : l'import ne le pilote plus après création, voir
 * ForClaude/importation-investissementsPGI/import-investissements-pgi.md §11) — icône « Modifier »
 * des cartes, réservée ADMIN_APP/ADMIN_SERVICE/CB (`canManage`, contrôlé aussi côté backend par
 * `assertManagesServiceOrHasRoleCb`) — même patron que MarchesPGI.tsx#EditMarcheModal.
 */
function EditInvestissementModal({
  operation,
  onClose,
  onSaved,
}: {
  operation: OperationInvestissement
  onClose: () => void
  onSaved: () => void
}) {
  const [libelleService, setLibelleService] = useState(operation.libelle_service?.trim() ? operation.libelle_service : operation.libelle)
  const [actif, setActif] = useState(operation.actif)
  const [utilisable, setUtilisable] = useState(operation.utilisable)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!libelleService.trim()) {
      setError('Le libellé est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      await api.put(`/investissements/${operation.numero_operation}`, { libelleService: libelleService.trim(), actif, utilisable })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="editInvestissementModalTitle" style={{ maxWidth: 520 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="editInvestissementModalTitle">
            Modifier l'opération
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <p className="gp-help">
              Numéro : {operation.numero_operation}
              <br />
              Libellé PGI : {operation.libelle}
            </p>

            <div className="gp-field">
              <label className="gp-label" htmlFor="investissement-edit-libservice">
                Libellé (service)
              </label>
              <textarea
                id="investissement-edit-libservice"
                className="gp-textarea"
                value={libelleService}
                onChange={(e) => setLibelleService(e.target.value)}
                maxLength={500}
              />
            </div>

            <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
              <span>Actif</span>
              <span className="gp-switch">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
                <span className="track" />
              </span>
            </label>

            <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
              <span>Utilisable</span>
              <span className="gp-switch">
                <input type="checkbox" checked={utilisable} onChange={(e) => setUtilisable(e.target.checked)} />
                <span className="track" />
              </span>
            </label>

            {error && (
              <p className="gp-errmsg">
                <svg className="ti">
                  <use href="#i-alert-circle" />
                </svg>
                {error}
              </p>
            )}
          </div>
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="gp-btn gp-btn--primary" disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
