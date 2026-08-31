import { useEffect, useState } from 'react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useMarches, type Marche } from '../hooks/useMarches'
import { Combobox } from '../components/Combobox'
import '../styles/marche.css'

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
 * ADMIN_SERVICE/CB (`canManage`) — aucune n'est encore câblée (visuel
 * seulement, cohérent avec "pas d'action au clic" ci-dessus).
 *
 * styles/marche.css : classes `.marche-*` propres à cette page, jamais dans
 * gpmm.css (réutilisé tel quel par d'autres applications GPMM) — voir l'en-tête
 * de ce fichier pour la convention.
 */
export function Marches() {
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

  const { marches, loading } = useMarches(idService)
  // Recherche appliquée uniquement au clic sur "Filtrer" (modale) ou touche Entrée — pas de filtrage à chaque frappe.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Filtres de la modale (croquis ListeMarche.pdf, 30/08/2026) — décochée = aucune contrainte sur ce critère.
  // Statut : Actif/Complet remplacent l'ancien filtrage "toujours ACTIF=true" (décoché = actifs ET archivés).
  // Alerte : Sur date/Sur montant, ET logique si les deux sont cochées (marché en alerte sur les deux à la fois).
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [filterActif, setFilterActif] = useState(false)
  const [filterComplet, setFilterComplet] = useState(false)
  const [filterAlerteDate, setFilterAlerteDate] = useState(false)
  const [filterAlerteMontant, setFilterAlerteMontant] = useState(false)

  // "Enregistrés" = date de fin >= aujourd'hui (peu importe ACTIF/COMPLETUDE) — décision utilisateur du 30/08/2026.
  // "Sélectionnés" (displayedMarches) est un sous-ensemble d'"enregistrés" (jamais l'inverse) : filtrer
  // DEPUIS ce pool, pas depuis `marches` brut, sinon le ratio "X sur Y" peut devenir incohérent (X > Y).
  const today = new Date().toISOString().slice(0, 10)
  const enregistres = marches.filter((m) => m.dtefinmax !== null && m.dtefinmax >= today)
  const totalEnregistres = enregistres.length

  const displayedMarches = enregistres
    .filter((m) => !filterActif || m.actif)
    .filter((m) => !filterComplet || m.completude)
    .filter((m) => {
      if (!filterAlerteDate && !filterAlerteMontant) return true
      const duree = computeDuree(m.dtedebut, m.dtefinmax, m.alertedate)
      const montant = computeMontant(m.mtmaxi, m.mt_solde, m.alertemt)
      return (!filterAlerteDate || (duree?.isAlerte ?? false)) && (!filterAlerteMontant || (montant?.isAlerte ?? false))
    })
    .filter((m) => matchesSearch(m, search))
    .sort((a, b) => a.nummarche.localeCompare(b.nummarche))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>États des marchés</h1>
          <p>Référentiel des marchés publics, alimenté par l'import PGI.</p>
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
        {idService !== null && (
          <button
            className="gp-btn gp-btn--secondary"
            style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
            onClick={() => setFilterModalOpen(true)}
          >
            Filtrer
          </button>
        )}
      </div>

      {idService !== null && !loading && (
        <p className="gp-help">
          {displayedMarches.length} marchés sélectionnés sur {totalEnregistres} marchés enregistrés.
        </p>
      )}

      {(filterIdDirection === null || filterIdService === null) && (
        <p>Sélectionne une direction et un service pour afficher les marchés.</p>
      )}

      {idService !== null && loading && <p>Chargement…</p>}

      {idService !== null && !loading && displayedMarches.length === 0 && <p>Aucun marché pour ce filtre.</p>}

      {idService !== null && !loading && displayedMarches.length > 0 && (
        <div className="marche-list gp-scroll">
          {displayedMarches.map((marche) => (
            <MarcheCard key={marche.nummarche} marche={marche} canManage={canManage} />
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
    </div>
  )
}

interface FilterModalValues {
  actif: boolean
  complet: boolean
  alerteDate: boolean
  alerteMontant: boolean
}

interface FilterModalProps extends FilterModalValues {
  onClose: () => void
  onApply: (values: FilterModalValues) => void
}

/**
 * Modale de filtre (croquis ListeMarche.pdf, 30/08/2026) — état "brouillon"
 * local, initialisé une seule fois à l'ouverture (`useState(() => ...)`, pas
 * d'effet de synchronisation) : "Retour" abandonne les cases cochées dans la
 * modale sans toucher au filtre déjà appliqué ; "Filtrer" les valide (et
 * applique au passage la recherche texte en attente, cf. Marches.tsx).
 */
function FilterModal({ actif, complet, alerteDate, alerteMontant, onClose, onApply }: FilterModalProps) {
  const [draftActif, setDraftActif] = useState(actif)
  const [draftComplet, setDraftComplet] = useState(complet)
  const [draftAlerteDate, setDraftAlerteDate] = useState(alerteDate)
  const [draftAlerteMontant, setDraftAlerteMontant] = useState(alerteMontant)

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
          <div className="row" style={{ alignItems: 'flex-start', gap: 32 }}>
            <div className="stack" style={{ gap: 10 }}>
              <span className="gp-label">Statut</span>
              <label className="gp-choice">
                <input className="gp-check" type="checkbox" checked={draftActif} onChange={(e) => setDraftActif(e.target.checked)} />
                Actif
              </label>
              <label className="gp-choice">
                <input
                  className="gp-check"
                  type="checkbox"
                  checked={draftComplet}
                  onChange={(e) => setDraftComplet(e.target.checked)}
                />
                Complet
              </label>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <span className="gp-label">Alerte</span>
              <label className="gp-choice">
                <input
                  className="gp-check"
                  type="checkbox"
                  checked={draftAlerteDate}
                  onChange={(e) => setDraftAlerteDate(e.target.checked)}
                />
                Sur date
              </label>
              <label className="gp-choice">
                <input
                  className="gp-check"
                  type="checkbox"
                  checked={draftAlerteMontant}
                  onChange={(e) => setDraftAlerteMontant(e.target.checked)}
                />
                Sur montant
              </label>
            </div>
          </div>
        </div>
        <div className="gp-modal__ft" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="gp-btn gp-btn--ghost"
            onClick={() => {
              setDraftActif(false)
              setDraftComplet(false)
              setDraftAlerteDate(false)
              setDraftAlerteMontant(false)
            }}
          >
            Supprimer les filtres
          </button>
          <div className="row" style={{ gap: 10 }}>
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
    </div>
  )
}

function MarcheCard({ marche, canManage }: { marche: Marche; canManage: boolean }) {
  const duree = computeDuree(marche.dtedebut, marche.dtefinmax, marche.alertedate)
  const montant = computeMontant(marche.mtmaxi, marche.mt_solde, marche.alertemt)

  return (
    <div className="marche-card">
      <div className="marche-card__title">
        <span
          className={`marche-dot ${marche.actif ? 'marche-dot--on' : 'marche-dot--off'}`}
          title={marche.actif ? 'Actif' : 'Archivé'}
        />
        {marche.nummarche}
        {marche.fournisseur_raison_sociale ? ` — ${marche.fournisseur_raison_sociale}` : ''}
      </div>
      <div className="marche-card__subtitle">
        <span
          className={`marche-dot ${marche.completude ? 'marche-dot--on' : 'marche-dot--off'}`}
          title={marche.completude ? 'Fiche complète' : 'Fiche incomplète'}
        />
        {marche.libelle_service ?? '—'}
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
          <div className="gp-rowacts marche-card__actions">
            <span className="gp-tip" data-tip="Visualiser">
              <button aria-label="Visualiser">
                <svg className="ti">
                  <use href="#i-eye" />
                </svg>
              </button>
            </span>
            {canManage && (
              <span className="gp-tip" data-tip="Modifier">
                <button aria-label="Modifier">
                  <svg className="ti">
                    <use href="#i-pencil" />
                  </svg>
                </button>
              </span>
            )}
            {canManage && (
              <span className="gp-tip" data-tip="Ajouter">
                <button aria-label="Ajouter">
                  <svg className="ti">
                    <use href="#i-plus" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
