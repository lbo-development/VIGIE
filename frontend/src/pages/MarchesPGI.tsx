import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useMarches, type Marche } from '../hooks/useMarches'
import { useMarcheOptions } from '../hooks/useMarcheOptions'
import { useMarcheLastImport } from '../hooks/useMarcheLastImport'
import { Combobox } from '../components/Combobox'
import { SpinButton } from '../components/SpinButton'
import { PiecesMarcheModal } from '../components/PiecesMarcheModal'
import { AddPieceMarcheModal } from '../components/AddPieceMarcheModal'
import { api, ApiError } from '../services/api'
import '../styles/marche.css'

const TYPEDECOMPOPRIX_OPTIONS = [
  { value: 'FORFAIT', label: 'Forfait' },
  { value: 'BPU', label: 'BPU' },
]
const NATUREPRESTA_OPTIONS = [
  { value: 'TRAVAUX', label: 'Travaux' },
  { value: 'FOURNITURES', label: 'Fournitures' },
  { value: 'SERVICES', label: 'Services' },
]

function matchesSearch(marche: Marche, search: string): boolean {
  if (!search.trim()) return true
  const needle = search.trim().toLowerCase()
  return (
    marche.nummarche.toLowerCase().includes(needle) ||
    (marche.libpgi?.toLowerCase().includes(needle) ?? false) ||
    (marche.titulaire?.toLowerCase().includes(needle) ?? false)
  )
}

const CURRENCY_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** ISO 'YYYY-MM-DD' -> 'JJ/MM/AAAA' — même principe que DatePicker.tsx#isoToFr, dupliqué ici pour un simple libellé d'affichage (pas de composant partagé pour ça). */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Filtre à trois états (modale `FilterModal`, maquette utilisateur du
 * 02/09/2026, remplace les cases à cocher à deux états du 30/08/2026) :
 * `'tous'` = aucune contrainte sur ce critère, `'oui'`/`'non'` filtrent
 * explicitement sur la valeur booléenne du critère — voir `matchesTriEtat`.
 */
type TriEtat = 'oui' | 'non' | 'tous'

function matchesTriEtat(filtre: TriEtat, valeur: boolean): boolean {
  if (filtre === 'tous') return true
  return filtre === 'oui' ? valeur : !valeur
}

/** Seuil d'alerte "import PGI obsolète" du libellé de MarchesPGI.tsx — décision utilisateur du 01/09/2026. */
const IMPORT_STALE_JOURS = 15

/** Même texte que backend/src/services/marcheImport.service.ts#PARAMETRE_NON_INITIALISE — un seul message à faire évoluer des deux côtés. */
const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.marche.pgi" non initialisé.'

interface DureeInfo {
  totalJours: number
  joursRestants: number
  fraction: number
  isAlerte: boolean
}

/** Durée = DTEDEBUT → DTEFINMAX ; alerte (rouge) si les jours restants passent sous ALERTEDATE (nombre de jours). */
function computeDuree(dtedebut: string | null, dtefinmax: string | null, alertedate: number): DureeInfo | null {
  if (!dtedebut || !dtefinmax) return null
  const debut = new Date(dtedebut)
  const fin = new Date(dtefinmax)
  const totalJours = daysBetween(debut, fin)
  if (totalJours <= 0) return null
  const joursRestants = daysBetween(new Date(), fin)
  const fraction = Math.min(1, Math.max(0, (totalJours - joursRestants) / totalJours))
  return { totalJours, joursRestants, fraction, isAlerte: joursRestants < alertedate }
}

interface MontantInfo {
  mtmaxi: number
  solde: number
  fraction: number
  isAlerte: boolean
}

/** Montant = MTMAXI / MT_SOLDE ; alerte (rouge) si le solde restant tombe à/sous (1-ALERTEMT) × MTMAXI (ratio). */
function computeMontant(mtmaxi: number | null, solde: number | null, alertemt: number): MontantInfo | null {
  if (mtmaxi === null || solde === null || mtmaxi <= 0) return null
  const fraction = Math.min(1, Math.max(0, (mtmaxi - solde) / mtmaxi))
  return { mtmaxi, solde, fraction, isAlerte: solde <= (1 - alertemt) * mtmaxi }
}

/**
 * États des marchés, montée sur /marches — page par défaut de la section
 * "Marchés" (voir config/navigation.ts, MARCHES_SIDEBAR_ITEMS). Ouverte à
 * tout utilisateur authentifié (aucune règle d'accès sur la consultation,
 * contrairement à l'import — voir navigation.ts).
 *
 * Filtre Direction → Service : même mécanisme que Fournisseurs.tsx et
 * ImportMarches.tsx (décision du 30/08/2026). Les deux comboboxes sont
 * TOUJOURS affichées, pour tout le monde ; tout acteur non ADMIN_APP voit sa
 * liste de services réduite à celui de sa propre cellule (`visibleServices`,
 * via `currentUser.idService` — résolu côté backend, ACTEUR.ID_CELLULE →
 * CELLULE.ID_SERVICE, indépendant de ses rôles éventuels, contrairement à
 * ImportMarches.tsx qui ne concernait que ADMIN_SERVICE/CB) et les deux
 * filtres se positionnent automatiquement dessus (effet fusionné — cf.
 * Fournisseurs.tsx pour la course entre effets si séparé). ADMIN_APP
 * (transverse, aucun service propre) garde le sélecteur complet.
 *
 * Liste (30/08/2026, maquette utilisateur) : une carte par marché — deux
 * pastilles (ACTIF, COMPLETUDE), deux barres de progression (durée,
 * montant), toujours affichées et calculées même si COMPLETUDE=FALSE
 * (ALERTEMT/ALERTEDATE ont toujours une valeur par défaut dès la création).
 * Seuls les marchés « enregistrés » (voir ci-dessous) sont affichés, filtrés
 * ensuite par la modale ci-dessous. Recherche texte (NUMMARCHE/LIBPGI/
 * TITULAIRE) reste un filtre client, comme Fournisseurs.tsx. Tri
 * alphabétique par NUMMARCHE. Pas d'action au clic sur une carte pour
 * l'instant (lecture seule).
 *
 * Modale de filtre (`FilterModal`, croquis `ListeMarche.pdf`, 30/08/2026,
 * remplace le bouton "Filtrer" qui appliquait directement la recherche) :
 * quatre cases à cocher, toutes décochées par défaut = aucune contrainte
 * (donc actifs ET archivés visibles tant que "Actif" n'est pas coché — la
 * page n'impose plus "toujours ACTIF=true" comme avant cette modale).
 * Statut (Actif, Complet) filtre sur ACTIF/COMPLETUDE directement. Alerte
 * (Sur date, Sur montant) filtre sur `computeDuree`/`computeMontant`
 * `.isAlerte` — **ET logique** si les deux sont cochées (doit être en alerte
 * sur les deux critères à la fois, pas l'un ou l'autre). La modale valide
 * aussi la recherche texte en attente ("Filtrer" = un seul geste pour tout
 * appliquer) ; "Retour" ferme sans rien appliquer (état brouillon local,
 * jamais synchronisé avec le filtre déjà actif). "Supprimer les filtres"
 * décoche les quatre cases du brouillon (reste dans la modale — il faut
 * encore cliquer "Filtrer" pour appliquer l'état vidé, ou "Retour" pour
 * annuler comme n'importe quel autre changement de case).
 *
 * Compteur (section figée, sous la ligne de filtres, décision du 30/08/2026) :
 * "X marchés sélectionnés sur X marchés enregistrés". Enregistrés = tous les
 * marchés du service dont `DTEFINMAX >= aujourd'hui` (indépendamment
 * d'ACTIF/COMPLETUDE) — le pool total (`enregistres`). Sélectionnés =
 * marchés actuellement affichés (`displayedMarches.length`), calculé en
 * filtrant CE POOL par ACTIF puis recherche — jamais depuis `marches` brut.
 * **Important** : `displayedMarches` doit toujours être un sous-ensemble
 * d'`enregistres`, sinon le ratio affiché peut devenir incohérent (ex. "45
 * sélectionnés sur 44 enregistrés" — bug corrigé le 30/08/2026, causé par un
 * marché ACTIF déjà échu compté comme sélectionné sans être enregistré).
 * Icônes d'action (ligne Montant, décision du 30/08/2026) : Visualiser
 * ouverte à tout le monde ; Modifier/Ajouter réservées à ADMIN_APP/
 * ADMIN_SERVICE/CB (`canManage`). Visualiser ouvre `ViewMarcheModal`
 * (lecture seule, maquette utilisateur du 02/09/2026) — câblée pour la
 * première fois ce jour-là (jusqu'ici purement visuelle).
 *
 * styles/marche.css : classes `.marche-*` propres à cette page, jamais dans
 * gpmm.css (réutilisé tel quel par d'autres applications GPMM) — voir l'en-tête
 * de ce fichier pour la convention.
 */
export function MarchesPGI() {
  const { data: currentUser } = useCurrentUser()
  const { directions } = useDirections()
  const { services } = useServices()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  // Ajouter/Modifier réservés à ADMIN_APP/ADMIN_SERVICE/CB (décision du 30/08/2026) — Visualiser reste ouvert à tous.
  const canManage = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP' || r.typeRole === 'ADMIN_SERVICE' || r.typeRole === 'CB') ?? false

  // Service propre (direction/service affecté à la cellule) — les filtres s'y positionnent automatiquement.
  const ownIdService = currentUser?.idService ?? null
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

  // "État des marchés au [date]" (décision du 01/09/2026) : dernière importation PGI pour le
  // service filtré, lue via GET /marches/last-import (portée service exacte du paramètre,
  // jamais l'héritage direction/global — voir marche.service.ts#getLastImportStatus). Distingue
  // trois cas : paramètre jamais initialisé pour ce service (`exists: false`, alerte dédiée) ;
  // initialisé mais aucun import encore effectué (`valeur: null`) ; date normale, obsolète
  // au-delà de IMPORT_STALE_JOURS jours.
  const lastImportInfo = useMarcheLastImport(idService)
  const isParametreNonInitialise = lastImportInfo !== null && !lastImportInfo.exists
  const isImportStale =
    lastImportInfo !== null &&
    lastImportInfo.exists &&
    (lastImportInfo.valeur === null || daysBetween(new Date(lastImportInfo.valeur), new Date()) >= IMPORT_STALE_JOURS)

  const { marches, loading, refetch } = useMarches(idService)
  // Recherche appliquée uniquement au clic sur "Filtrer" (modale) ou touche Entrée — pas de filtrage à chaque frappe.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [editModalMarche, setEditModalMarche] = useState<Marche | null>(null)
  const [viewModalMarche, setViewModalMarche] = useState<Marche | null>(null)
  const [piecesModalMarche, setPiecesModalMarche] = useState<Marche | null>(null)
  const [addPieceModalMarche, setAddPieceModalMarche] = useState<Marche | null>(null)

  // Filtres de la modale (maquette utilisateur du 02/09/2026, trois états par critère —
  // voir TriEtat ci-dessus) — 'tous' = aucune contrainte sur ce critère (comportement par défaut,
  // équivalent à l'ancienne case décochée du 30/08/2026).
  // Alerte : Date/Montant, ET logique si les deux sont contraints (marché en alerte sur les deux à la fois).
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [filterActif, setFilterActif] = useState<TriEtat>('tous')
  const [filterComplet, setFilterComplet] = useState<TriEtat>('tous')
  const [filterAlerteDate, setFilterAlerteDate] = useState<TriEtat>('tous')
  const [filterAlerteMontant, setFilterAlerteMontant] = useState<TriEtat>('tous')

  // Bouton "Supprimer les filtres" (page principale, à côté du compteur) : vide directement le
  // filtre déjà appliqué (statut, alerte, recherche) — contrairement à celui de la modale, qui ne
  // vide que le brouillon (voir FilterModal ci-dessous).
  function handleResetFilters() {
    setFilterActif('tous')
    setFilterComplet('tous')
    setFilterAlerteDate('tous')
    setFilterAlerteMontant('tous')
    setSearchInput('')
    setSearch('')
  }

  // "Enregistrés" = date de fin >= aujourd'hui (peu importe ACTIF/COMPLETUDE) — décision utilisateur du 30/08/2026.
  // "Sélectionnés" (displayedMarches) est un sous-ensemble d'"enregistrés" (jamais l'inverse) : filtrer
  // DEPUIS ce pool, pas depuis `marches` brut, sinon le ratio "X sur Y" peut devenir incohérent (X > Y).
  const today = new Date().toISOString().slice(0, 10)
  const enregistres = marches.filter((m) => m.dtefinmax !== null && m.dtefinmax >= today)
  const totalEnregistres = enregistres.length

  const displayedMarches = enregistres
    .filter((m) => matchesTriEtat(filterActif, m.actif))
    .filter((m) => matchesTriEtat(filterComplet, m.completude))
    .filter((m) => {
      if (filterAlerteDate === 'tous' && filterAlerteMontant === 'tous') return true
      const duree = computeDuree(m.dtedebut, m.dtefinmax, m.alertedate)
      const montant = computeMontant(m.mtmaxi, m.mt_solde, m.alertemt)
      return (
        matchesTriEtat(filterAlerteDate, duree?.isAlerte ?? false) && matchesTriEtat(filterAlerteMontant, montant?.isAlerte ?? false)
      )
    })
    .filter((m) => matchesSearch(m, search))
    .sort((a, b) => a.nummarche.localeCompare(b.nummarche))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>États des marchés</h1>
          {idService === null ? (
            <p>Référentiel des marchés publics, alimenté par l'import PGI.</p>
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
                    ? `État des marchés au ${formatDateFr(lastImportInfo.valeur)}`
                    : 'État des marchés — aucun import PGI effectué'}
                </p>
                {isImportStale && (
                  <p className="gp-errmsg" style={{ color: 'var(--gp-warning-text)' }}>
                    <svg className="ti">
                      <use href="#i-alert-triangle" />
                    </svg>
                    Pensez à importer les marchés récents
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
            ariaLabel="Direction"
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
              ariaLabel="Service"
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
                placeholder="Numéro de marché, libellé, titulaire…"
                aria-label="Rechercher un marché"
              />
            </div>
          </div>
        )}
      </div>

      {idService !== null && !loading && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="gp-help">
            {displayedMarches.length} marchés sélectionnés sur {totalEnregistres} marchés enregistrés.
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
        <p>Sélectionne une direction et un service pour afficher les marchés.</p>
      )}

      {idService !== null && loading && <p>Chargement…</p>}

      {idService !== null && !loading && displayedMarches.length === 0 && <p>Aucun marché pour ce filtre.</p>}

      {idService !== null && !loading && displayedMarches.length > 0 && (
        <div className="marche-list gp-scroll">
          {displayedMarches.map((marche) => (
            <MarcheCard
              key={marche.nummarche}
              marche={marche}
              canManage={canManage}
              onView={() => setViewModalMarche(marche)}
              onEdit={() => setEditModalMarche(marche)}
              onPieces={() => setPiecesModalMarche(marche)}
              onAddPiece={() => setAddPieceModalMarche(marche)}
            />
          ))}
        </div>
      )}

      {filterModalOpen && (
        <FilterModal
          actif={filterActif}
          complet={filterComplet}
          alerteDate={filterAlerteDate}
          alerteMontant={filterAlerteMontant}
          onClose={() => setFilterModalOpen(false)}
          onApply={(next) => {
            setFilterActif(next.actif)
            setFilterComplet(next.complet)
            setFilterAlerteDate(next.alerteDate)
            setFilterAlerteMontant(next.alerteMontant)
            setSearch(searchInput)
            setFilterModalOpen(false)
          }}
        />
      )}

      {editModalMarche && idService !== null && (
        <EditMarcheModal
          marche={editModalMarche}
          idService={idService}
          onClose={() => setEditModalMarche(null)}
          onSaved={() => {
            setEditModalMarche(null)
            void refetch()
          }}
        />
      )}

      {viewModalMarche && <ViewMarcheModal marche={viewModalMarche} onClose={() => setViewModalMarche(null)} />}

      {piecesModalMarche && (
        <PiecesMarcheModal
          marcheRef={{ typeMarche: 'SERVICE', nummarche: piecesModalMarche.nummarche }}
          label={piecesModalMarche.nummarche}
          canManage={canManage}
          onClose={() => setPiecesModalMarche(null)}
        />
      )}

      {addPieceModalMarche && (
        <AddPieceMarcheModal
          marcheRef={{ typeMarche: 'SERVICE', nummarche: addPieceModalMarche.nummarche }}
          label={addPieceModalMarche.nummarche}
          onClose={() => setAddPieceModalMarche(null)}
          onSaved={() => setAddPieceModalMarche(null)}
        />
      )}
    </div>
  )
}

interface FilterModalValues {
  actif: TriEtat
  complet: TriEtat
  alerteDate: TriEtat
  alerteMontant: TriEtat
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

/** Une ligne de la modale de filtre : libellé + trois boutons radio Oui/Non/Tous (voir TriEtat). */
function FilterTriEtatRow({ label, value, onChange }: { label: string; value: TriEtat; onChange: (v: TriEtat) => void }) {
  const name = `marche-filter-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="row" style={{ gap: 24 }}>
      <span className="gp-label" style={{ minWidth: 140 }}>
        {label}
      </span>
      {TRI_ETAT_OPTIONS.map((option) => (
        <label key={option.value} className="gp-choice">
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
 * Modale de filtre (maquette utilisateur du 02/09/2026, remplace les cases à
 * cocher à deux états du 30/08/2026 par un choix à trois états Oui/Non/Tous
 * par critère — voir TriEtat) — état "brouillon" local, initialisé une seule
 * fois à l'ouverture (`useState(() => ...)`, pas d'effet de synchronisation) :
 * "Retour" abandonne les choix faits dans la modale sans toucher au filtre
 * déjà appliqué ; "Filtrer" les valide (et applique au passage la recherche
 * texte en attente, cf. MarchesPGI.tsx). Plus de bouton "Supprimer les
 * filtres" ici (retiré, maquette du 02/09/2026) : ce geste vit désormais sur
 * la page principale, à côté du compteur, et vide directement le filtre
 * appliqué plutôt que le brouillon.
 */
function FilterModal({ actif, complet, alerteDate, alerteMontant, onClose, onApply }: FilterModalProps) {
  const [draftActif, setDraftActif] = useState<TriEtat>(actif)
  const [draftComplet, setDraftComplet] = useState<TriEtat>(complet)
  const [draftAlerteDate, setDraftAlerteDate] = useState<TriEtat>(alerteDate)
  const [draftAlerteMontant, setDraftAlerteMontant] = useState<TriEtat>(alerteMontant)

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="marcheFilterModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="marcheFilterModalTitle">
            Filtrer les marchés
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll">
          <div className="stack" style={{ gap: 20 }}>
            <FilterTriEtatRow label="Actif" value={draftActif} onChange={setDraftActif} />
            <FilterTriEtatRow label="Complet" value={draftComplet} onChange={setDraftComplet} />
            <div className="stack" style={{ gap: 20, marginTop: 10 }}>
              <FilterTriEtatRow label="Alerte date" value={draftAlerteDate} onChange={setDraftAlerteDate} />
              <FilterTriEtatRow label="Alerte montant" value={draftAlerteMontant} onChange={setDraftAlerteMontant} />
            </div>
          </div>
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Retour
          </button>
          <button
            type="button"
            className="gp-btn gp-btn--primary"
            onClick={() =>
              onApply({ actif: draftActif, complet: draftComplet, alerteDate: draftAlerteDate, alerteMontant: draftAlerteMontant })
            }
          >
            Filtrer
          </button>
        </div>
      </div>
    </div>
  )
}

function MarcheCard({
  marche,
  canManage,
  onView,
  onEdit,
  onPieces,
  onAddPiece,
}: {
  marche: Marche
  canManage: boolean
  onView: () => void
  onEdit: () => void
  onPieces: () => void
  onAddPiece: () => void
}) {
  const duree = computeDuree(marche.dtedebut, marche.dtefinmax, marche.alertedate)
  const montant = computeMontant(marche.mtmaxi, marche.mt_solde, marche.alertemt)

  // Alignées sur l'axe de la barre "Montant" (décision utilisateur, 01/09/2026) — repli sur l'axe
  // "Durée" puis sur une ligne dédiée si l'une ou l'autre barre est absente (MTMAXI/MT_SOLDE ou
  // DTEDEBUT/DTEFINMAX non renseignés), pour rester toujours accessibles (voir note du 01/09/2026
  // plus haut sur le bug corrigé).
  const actions = (
    <div className="gp-rowacts marche-card__actions">
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
  )

  return (
    <div className="marche-card">
      <div className="marche-card__header">
        <div className="marche-card__heading">
          <div className="marche-card__title">
            {marche.nummarche}
            {marche.fournisseur_raison_sociale ? ` — ${marche.fournisseur_raison_sociale}` : ''}
          </div>
          <div className="marche-card__subtitle">{marche.libelle_service ?? '—'}</div>
        </div>
        <div className="marche-card__dots">
          <span
            className={`marche-dot ${marche.actif ? 'marche-dot--on' : 'marche-dot--off'}`}
            title={marche.actif ? 'Actif' : 'Archivé'}
          />
          <span
            className={`marche-dot ${marche.completude ? 'marche-dot--on' : 'marche-dot--off'}`}
            title={marche.completude ? 'Fiche complète' : 'Fiche incomplète'}
          />
        </div>
      </div>

      {duree && (
        <div className="marche-metric">
          <div className="marche-metric__bar gp-progress">
            <div
              className="gp-progress__bar"
              style={{ width: `${duree.fraction * 100}%`, backgroundColor: duree.isAlerte ? 'var(--gp-danger)' : 'var(--gp-success)' }}
            />
          </div>
          <span className="marche-metric__label">
            {duree.totalJours} j / {duree.joursRestants >= 0 ? `${duree.joursRestants} j restants` : 'échu'}
          </span>
          {!montant && actions}
        </div>
      )}

      {montant && (
        <div className="marche-metric">
          <div className="marche-metric__bar gp-progress">
            <div
              className="gp-progress__bar"
              style={{
                width: `${montant.fraction * 100}%`,
                backgroundColor: montant.isAlerte ? 'var(--gp-danger)' : 'var(--gp-success)',
              }}
            />
          </div>
          <span className="marche-metric__label">
            {CURRENCY_FORMAT.format(montant.mtmaxi)} / {CURRENCY_FORMAT.format(montant.solde)} restant
          </span>
          {actions}
        </div>
      )}

      {!duree && !montant && <div className="marche-metric marche-metric--actions-only">{actions}</div>}
    </div>
  )
}

/** Une ligne de la modale de visualisation : libellé + valeur en lecture seule (croquis utilisateur du 02/09/2026). */
function ViewField({ label, value, style }: { label: string; value: string; style?: CSSProperties }) {
  const id = `marche-view-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="gp-field" style={style}>
      <label className="gp-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="gp-input" value={value} readOnly />
    </div>
  )
}

const TYPEDECOMPOPRIX_LABELS: Record<string, string> = { FORFAIT: 'Forfait', BPU: 'BPU' }
const NATUREPRESTA_LABELS: Record<string, string> = { TRAVAUX: 'Travaux', FOURNITURES: 'Fournitures', SERVICES: 'Services' }

/** '—' si non renseigné, sinon la date au format JJ/MM/AAAA (voir formatDateFr). */
function formatDateOrDash(iso: string | null): string {
  return iso ? formatDateFr(iso) : '—'
}

/**
 * Visualisation d'un marché (icône « Visualiser » des cartes, lecture seule,
 * ouverte à tout le monde) — croquis utilisateur du 02/09/2026 : trois
 * groupes de champs (Caractéristiques / Dates significatives / Gestion du
 * marché) sous un bloc Identification, plus les deux seuils d'alerte
 * (ALERTEDATE en jours, ALERTEMT en %, mêmes conversions d'affichage que les
 * barres de progression de MarcheCard). Aucune saisie, aucun bouton
 * "Enregistrer" — un seul bouton "Retour" referme la modale.
 */
function ViewMarcheModal({ marche, onClose }: { marche: Marche; onClose: () => void }) {
  const duree = computeDuree(marche.dtedebut, marche.dtefinmax, marche.alertedate)

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="viewMarcheModalTitle" style={{ maxWidth: 860 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="viewMarcheModalTitle">
            Marché {marche.nummarche}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="stack" style={{ gap: 10 }}>
            <p className="marche-view__section">Identification</p>
            <div className="row">
              <ViewField label="Numéro du marché" value={marche.nummarche} style={{ flex: 1 }} />
              <ViewField label="Titulaire" value={marche.fournisseur_raison_sociale ?? '—'} style={{ flex: 1 }} />
            </div>
            <ViewField label="Libellé" value={marche.libelle_service ?? '—'} />
          </div>

          <div className="grid">
            <div className="stack" style={{ gap: 10 }}>
              <p className="marche-view__section">Caractéristiques</p>
              <ViewField label="Type de procédure" value={marche.typeproc} />
              <ViewField label="Décomposition du prix" value={marche.typedecompoprix ? TYPEDECOMPOPRIX_LABELS[marche.typedecompoprix] : '—'} />
              <ViewField label="Nature de la prestation" value={marche.naturepresta ? NATUREPRESTA_LABELS[marche.naturepresta] : '—'} />
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <p className="marche-view__section">Dates significatives</p>
              <ViewField label="Validation" value={formatDateOrDash(marche.dtevalid)} />
              <ViewField label="Notification" value={formatDateOrDash(marche.dtenotif)} />
              <ViewField label="Début" value={formatDateOrDash(marche.dtedebut)} />
              <ViewField label="Fin max" value={formatDateOrDash(marche.dtefinmax)} />
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <p className="marche-view__section">Gestion du marché</p>
              <ViewField label="Agent gestionnaire" value={marche.agentgestion ?? '—'} />
              <ViewField label="CUG" value={marche.code_cug ?? '—'} />
              <ViewField label="Solde restant" value={marche.mt_solde !== null ? CURRENCY_FORMAT.format(marche.mt_solde) : '—'} />
              <ViewField label="Temps restant" value={duree ? `${duree.joursRestants} j` : '—'} />
            </div>
          </div>

          <div className="row">
            <ViewField label="Alerte sur date" value={`${marche.alertedate} j`} style={{ flex: 1 }} />
            <ViewField label="Alerte sur montant" value={`${Math.round(marche.alertemt * 100)} %`} style={{ flex: 1 }} />
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

interface EditMarcheModalProps {
  marche: Marche
  idService: number
  onClose: () => void
  onSaved: () => void
}

/**
 * Modification d'un marché existant, icône « Modifier » des cartes —
 * réservée ADMIN_APP/ADMIN_SERVICE/CB (`assertManagesServiceOrHasRoleCb`).
 * Décision du 01/09/2026 : **aucune création manuelle** de marché n'est
 * possible dans cette application (retirée le même jour, la modale
 * `CreateMarcheModal` existait depuis le 30/08/2026) — seul l'import PGI crée
 * des lignes dans `finances.marche` — et aucune suppression ni désactivation
 * manuelle non plus (`ACTIF` n'est réécrit que par l'archivage de l'import).
 * Seuls ces sept champs sont modifiables ici, jamais NUMMARCHE/le
 * titulaire/le CUG ni les dates/montants (réécrits uniquement par l'import) —
 * **ni `typeproc`** (retiré le 01/09/2026, quelques heures après son ajout à
 * cette liste : renseigné à l'import, jamais modifiable ensuite) :
 * `typedecompoprix`, `naturepresta`, `libelle_service`, `agentgestion`,
 * `alertedate`, `alertemt`, `planpreventionactif`.
 *
 * `Agent gestionnaire` (AGENTGESTION) reste un champ texte libre en base —
 * `useMarcheOptions` sert seulement à pré-remplir "NOM Prénom" ; si la valeur
 * actuelle ne correspond à aucun acteur du service (agent parti, texte libre
 * historique...), la combobox démarre simplement sur "Non renseigné" plutôt
 * que de forcer une correspondance.
 *
 * `COMPLETUDE` recalculée côté backend à chaque modification (voir
 * marche.service.ts#updateMarcheManagedFields) — rien à faire ici.
 */
function EditMarcheModal({ marche, idService, onClose, onSaved }: EditMarcheModalProps) {
  const { options } = useMarcheOptions(idService)
  const agentOptions = (options?.acteurs ?? []).map((a) => ({ value: a.matricule, label: `${a.nom} ${a.prenom}` }))

  const [typedecompoprix, setTypedecompoprix] = useState<string | null>(marche.typedecompoprix)
  const [naturepresta, setNaturepresta] = useState<string | null>(marche.naturepresta)
  const [libelleService, setLibelleService] = useState(marche.libelle_service ?? '')
  const [agentMatricule, setAgentMatricule] = useState<string | null>(null)
  const [alertedateJours, setAlertedateJours] = useState(String(marche.alertedate))
  const [alertemtPourcent, setAlertemtPourcent] = useState(String(Math.round(marche.alertemt * 100)))
  const [planpreventionactif, setPlanpreventionactif] = useState(marche.planpreventionactif ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (agentMatricule !== null) return
    const match = agentOptions.find((a) => a.label === marche.agentgestion)
    if (match) setAgentMatricule(match.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!libelleService.trim()) {
      setError('Le libellé est obligatoire.')
      return
    }

    const agent = agentOptions.find((a) => a.value === agentMatricule)

    setSubmitting(true)
    try {
      await api.put(`/marches/${marche.nummarche}`, {
        typedecompoprix: typedecompoprix || null,
        naturepresta: naturepresta || null,
        libelleService: libelleService.trim(),
        agentgestion: agent?.label ?? null,
        alertedate: alertedateJours.trim() ? Number(alertedateJours) : undefined,
        alertemt: alertemtPourcent.trim() ? Number(alertemtPourcent) / 100 : undefined,
        planpreventionactif: planpreventionactif.trim() ? planpreventionactif.trim() : null,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="editMarcheModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="editMarcheModalTitle">
            Modifier le marché
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
              Numéro : {marche.nummarche}
              {marche.fournisseur_raison_sociale ? ` — Titulaire : ${marche.fournisseur_raison_sociale}` : ''}
            </p>

            <div className="gp-field">
              <label className="gp-label" htmlFor="marche-edit-libelle">
                Libellé
              </label>
              <input
                id="marche-edit-libelle"
                className="gp-input"
                value={libelleService}
                onChange={(e) => setLibelleService(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="row">
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Décomposition du prix</label>
                <Combobox
                  options={TYPEDECOMPOPRIX_OPTIONS}
                  value={typedecompoprix}
                  onChange={setTypedecompoprix}
                  placeholder="Non renseigné"
                  clearLabel="Non renseigné"
                  ariaLabel="Décomposition du prix"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Nature de la prestation</label>
                <Combobox
                  options={NATUREPRESTA_OPTIONS}
                  value={naturepresta}
                  onChange={setNaturepresta}
                  placeholder="Non renseigné"
                  clearLabel="Non renseigné"
                  ariaLabel="Nature de la prestation"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            </div>

            <div className="gp-field">
              <label className="gp-label">Agent gestionnaire</label>
              <Combobox
                options={agentOptions}
                value={agentMatricule}
                onChange={setAgentMatricule}
                placeholder="Non renseigné"
                clearLabel="Non renseigné"
                ariaLabel="Agent gestionnaire"
                style={{ maxWidth: 'none' }}
              />
            </div>

            <div className="row">
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="marche-edit-alertedate">
                  Alerte sur date (jours)
                </label>
                <SpinButton
                  id="marche-edit-alertedate"
                  ariaLabel="Alerte sur date"
                  min={0}
                  step={1}
                  value={alertedateJours}
                  onChange={setAlertedateJours}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label" htmlFor="marche-edit-alertemt">
                  Alerte sur montant (%)
                </label>
                <SpinButton
                  id="marche-edit-alertemt"
                  ariaLabel="Alerte sur montant"
                  min={0}
                  max={100}
                  step={1}
                  value={alertemtPourcent}
                  onChange={setAlertemtPourcent}
                />
              </div>
            </div>

            <div className="gp-field">
              <label className="gp-label" htmlFor="marche-edit-plan">
                Plan de prévention actif
              </label>
              <input
                id="marche-edit-plan"
                className="gp-input"
                value={planpreventionactif}
                onChange={(e) => setPlanpreventionactif(e.target.value)}
                maxLength={500}
              />
            </div>

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
