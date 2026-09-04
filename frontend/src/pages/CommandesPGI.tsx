import { useEffect, useState } from 'react'
import { useCommandesPgi, type CommandePgi } from '../hooks/useCommandesPgi'
import { useCommandeLastImport } from '../hooks/useCommandeLastImport'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDirections } from '../hooks/useDirections'
import { useServices } from '../hooks/useServices'
import { useColumnSort, type ColumnSort } from '../hooks/useColumnSort'
import { Combobox } from '../components/Combobox'
import { SortableTh } from '../components/SortableTh'

const CURRENCY_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const PERCENT_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })

/** Même seuil que MarchesPGI.tsx#IMPORT_STALE_JOURS — bandeau "État des commandes au [date]" ci-dessous. */
const IMPORT_STALE_JOURS = 15

/** Même texte que backend/src/services/commandePgiImport.service.ts#PARAMETRE_NON_INITIALISE. */
const PARAMETRE_NON_INITIALISE = 'Paramètre "last.import.commande.pgi" non initialisé.'

/** ISO 'YYYY-MM-DD' -> 'JJ/MM/AAAA' — même principe que MarchesPGI.tsx#formatDateFr. */
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** Ratio engagé/liquidé par rapport au Montant total (mtactuel) — null si le total est nul (pas de division par zéro). */
function ratioOfTotal(value: number, total: number): number | null {
  return total === 0 ? null : value / total
}

function formatPercent(ratio: number | null): string {
  return ratio === null ? '—' : PERCENT_FORMAT.format(ratio)
}

function matchesSearch(commande: CommandePgi, search: string): boolean {
  if (!search.trim()) return true
  const needle = search.trim().toLowerCase()
  return (
    commande.numcmd.toLowerCase().includes(needle) ||
    commande.libfournisseur.toLowerCase().includes(needle) ||
    // Défensif : la migration rendant `marche` NOT NULL peut ne pas avoir encore été exécutée
    // sur des lignes déjà importées avant ce correctif — voir 20260903100000_commande_pgi_marche_hors_marche.sql.
    (commande.marche?.toLowerCase().includes(needle) ?? false)
  )
}

type CommandeColumn =
  | 'numcmd'
  | 'dtecmd'
  | 'libfournisseur'
  | 'mtactuel'
  | 'mtengage'
  | 'pctEngage'
  | 'mtliquide'
  | 'pctLiquide'
  | 'resteALiquider'
  | 'marche'
  | 'catop'
  | 'compte_budgetaire'
  | 'code_cug'
  | 'acheteur'
  | 'dtelastimport'

/** null en dernier quel que soit le sens du tri (ex. % engagé indéterminé, Compte budgétaire absent). */
function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a - b
}

/**
 * Tri spécifique à cette page plutôt que le générique `sortRows` (qui compare
 * les valeurs converties en texte, via localeCompare) : les colonnes
 * monétaires ont des décimales (ex. 1949.71) que la comparaison textuelle
 * `numeric:true` ordonnerait mal (compare "71" et "5" comme des entiers,
 * pas comme des centièmes alignés) — comparaison numérique directe ici.
 */
function sortCommandes(rows: CommandePgi[], sort: ColumnSort<CommandeColumn> | null): CommandePgi[] {
  const effectiveSort = sort ?? { column: 'numcmd' as const, direction: 'asc' as const }
  const factor = effectiveSort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    switch (effectiveSort.column) {
      case 'mtactuel':
        return factor * (a.mtactuel - b.mtactuel)
      case 'mtengage':
        return factor * (a.mtengage - b.mtengage)
      case 'mtliquide':
        return factor * (a.mtliquide - b.mtliquide)
      case 'resteALiquider':
        return factor * (a.mtactuel - a.mtliquide - (b.mtactuel - b.mtliquide))
      case 'pctEngage':
        return factor * compareNullableNumber(ratioOfTotal(a.mtengage, a.mtactuel), ratioOfTotal(b.mtengage, b.mtactuel))
      case 'pctLiquide':
        return factor * compareNullableNumber(ratioOfTotal(a.mtliquide, a.mtactuel), ratioOfTotal(b.mtliquide, b.mtactuel))
      case 'compte_budgetaire':
        return factor * compareNullableNumber(a.compte_budgetaire, b.compte_budgetaire)
      case 'dtecmd':
        return factor * a.dtecmd.localeCompare(b.dtecmd)
      case 'dtelastimport':
        return factor * a.dtelastimport.localeCompare(b.dtelastimport)
      case 'numcmd':
        return factor * a.numcmd.localeCompare(b.numcmd, 'fr', { numeric: true })
      case 'code_cug':
        return factor * a.code_cug.localeCompare(b.code_cug, 'fr', { numeric: true })
      case 'libfournisseur':
        return factor * a.libfournisseur.localeCompare(b.libfournisseur, 'fr')
      case 'acheteur':
        return factor * a.acheteur.localeCompare(b.acheteur, 'fr')
      case 'marche':
        return factor * (a.marche ?? '').localeCompare(b.marche ?? '', 'fr')
      case 'catop':
        return factor * (a.catop ?? '').localeCompare(b.catop ?? '', 'fr')
      default:
        return 0
    }
  })
}

/**
 * Consultation de finances.commande_pgi (référentiel alimenté uniquement par
 * l'import, voir ImportCommandes.tsx), montée sur /commandes (voir
 * config/navigation.ts, COMMANDES_SIDEBAR_ITEMS) — même patron que
 * Fournisseurs.tsx pour la structure (filtre Direction → Service en cascade,
 * tous deux obligatoires pour afficher la liste, recherche texte libre), mais
 * en lecture seule : aucune création/modification/suppression manuelle
 * n'existe pour cette table.
 *
 * Lecture ouverte à tout utilisateur authentifié pour son propre service
 * (ADMIN_APP libre du service consulté) — même périmètre que "États des
 * marchés du service", pas le modèle plus restreint de l'import.
 */
export function CommandesPGI() {
  const { data: currentUser } = useCurrentUser()
  const { directions } = useDirections()
  const { services } = useServices()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
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

  // "État des commandes au [date]" (voir MarchesPGI.tsx pour le même bandeau) : dernière
  // importation PGI pour le service filtré, lue via GET /commandes/last-import (portée
  // service exacte du paramètre, jamais l'héritage direction/global).
  const lastImportInfo = useCommandeLastImport(idService)
  const isParametreNonInitialise = lastImportInfo !== null && !lastImportInfo.exists
  const isImportStale =
    lastImportInfo !== null &&
    lastImportInfo.exists &&
    (lastImportInfo.valeur === null || daysBetween(new Date(lastImportInfo.valeur), new Date()) >= IMPORT_STALE_JOURS)

  const { commandes, loading } = useCommandesPgi(idService)

  const [search, setSearch] = useState('')
  const { sort, toggleSort } = useColumnSort<CommandeColumn>()
  const displayedCommandes =
    filterIdDirection === null || filterIdService === null
      ? []
      : sortCommandes(
          commandes.filter((c) => matchesSearch(c, search)),
          sort,
        )

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>État des commandes PGI</h1>
          {idService === null ? (
            <p>Commandes et montants engagés/liquidés, alimentés par l'import PGI.</p>
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
                    ? `État des commandes au ${formatDateFr(lastImportInfo.valeur)}`
                    : 'État des commandes — aucun import PGI effectué'}
                </p>
                {isImportStale && (
                  <p className="gp-errmsg" style={{ color: 'var(--gp-warning-text)' }}>
                    <svg className="ti">
                      <use href="#i-alert-triangle" />
                    </svg>
                    Pensez à importer les commandes récentes
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
            onChange={setFilterIdDirection}
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
        {filterIdDirection !== null && filterIdService !== null && (
          <div className="gp-field" style={{ flex: 1, minWidth: 220 }}>
            <label className="gp-label" htmlFor="commandes-pgi-search">
              Recherche
            </label>
            <input
              id="commandes-pgi-search"
              className="gp-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Commande, fournisseur, marché…"
            />
          </div>
        )}
      </div>

      {/* max-height du gabarit (360px, gpmm.css) trop faible pour cette liste, souvent longue — agrandi localement comme ContactsModal.tsx élargit .gp-modal, sans toucher au gabarit partagé. */}
      <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 'calc(70vh - 70px)' }}>
        <table className="gp-table">
          <thead>
            <tr>
              <SortableTh label="Numéro commande" column="numcmd" sort={sort} onSort={toggleSort} />
              <SortableTh label="Date commande" column="dtecmd" sort={sort} onSort={toggleSort} />
              <SortableTh label="Fournisseur" column="libfournisseur" sort={sort} onSort={toggleSort} />
              <SortableTh label="Montant total" column="mtactuel" sort={sort} onSort={toggleSort} />
              <SortableTh label="Montant engagé" column="mtengage" sort={sort} onSort={toggleSort} />
              <SortableTh label="% engagé" column="pctEngage" sort={sort} onSort={toggleSort} />
              <SortableTh label="Montant liquidé" column="mtliquide" sort={sort} onSort={toggleSort} />
              <SortableTh label="% liquidé" column="pctLiquide" sort={sort} onSort={toggleSort} />
              <SortableTh label="Reste à liquider" column="resteALiquider" sort={sort} onSort={toggleSort} />
              <SortableTh label="Marché" column="marche" sort={sort} onSort={toggleSort} />
              <SortableTh label="Catégorie opération" column="catop" sort={sort} onSort={toggleSort} />
              <SortableTh label="Compte budgétaire" column="compte_budgetaire" sort={sort} onSort={toggleSort} />
              <SortableTh label="CUG" column="code_cug" sort={sort} onSort={toggleSort} />
              <SortableTh label="Acheteur" column="acheteur" sort={sort} onSort={toggleSort} />
              <SortableTh label="Dernière importation" column="dtelastimport" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={15}>Chargement…</td>
              </tr>
            )}
            {!loading && displayedCommandes.length === 0 && (
              <tr>
                <td colSpan={15}>
                  {filterIdDirection === null || filterIdService === null
                    ? 'Sélectionne une direction et un service pour afficher les commandes.'
                    : 'Aucune commande pour ce filtre.'}
                </td>
              </tr>
            )}
            {displayedCommandes.map((commande) => (
              <tr key={commande.numcmd}>
                <td className="mono">{commande.numcmd}</td>
                <td>{formatDateFr(commande.dtecmd)}</td>
                <td>{commande.libfournisseur}</td>
                <td>{CURRENCY_FORMAT.format(commande.mtactuel)}</td>
                <td>{CURRENCY_FORMAT.format(commande.mtengage)}</td>
                <td>{formatPercent(ratioOfTotal(commande.mtengage, commande.mtactuel))}</td>
                <td>{CURRENCY_FORMAT.format(commande.mtliquide)}</td>
                <td>{formatPercent(ratioOfTotal(commande.mtliquide, commande.mtactuel))}</td>
                <td>{CURRENCY_FORMAT.format(commande.mtactuel - commande.mtliquide)}</td>
                <td>{commande.marche}</td>
                <td>{commande.catop ?? '—'}</td>
                <td>{commande.compte_budgetaire ?? '—'}</td>
                <td>{commande.code_cug}</td>
                <td>{commande.acheteur}</td>
                <td>{formatDateFr(commande.dtelastimport)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
