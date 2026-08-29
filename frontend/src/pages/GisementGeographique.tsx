import { useEffect, useState, type FormEvent } from 'react'
import { useSites, type Site, type SousSite } from '../hooks/useSites'
import { useServices } from '../hooks/useServices'
import { useDirections } from '../hooks/useDirections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDragReorder } from '../hooks/useDragReorder'
import { useColumnSort, sortRows } from '../hooks/useColumnSort'
import { Combobox } from '../components/Combobox'
import { SortableTh } from '../components/SortableTh'
import { api, ApiError } from '../services/api'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
]

function matchesStatusFilter(actif: boolean, filter: string | null): boolean {
  if (filter === null) return true
  return filter === 'active' ? actif : !actif
}

/**
 * Gestion du référentiel géographique (SITE/SOUS_SITE), montée sur
 * /parametres/gisement-geographique (voir App.tsx et config/navigation.ts).
 * Écriture réservée ADMIN_SERVICE (scopé à son service) et ADMIN_APP
 * (transverse) — contrôle réel côté backend (voir
 * backend/src/services/site.service.ts) ; cet écran n'essaie pas de deviner
 * les droits de l'utilisateur pour masquer les actions, seul le backend fait
 * foi (voir ForClaude/SECURITY.md §2).
 *
 * Un seul tableau de sites (Service, Libellé, Statut, Actions — toutes
 * colonnes triables), la gestion des sous-sites et le réordonnancement des
 * sites (par service — voir SiteReorderModal) se font via des modales
 * ouvertes depuis la colonne Actions. Remplace la vue maître-détail + le
 * glisser-déposer inline d'origine — décision utilisateur consignée dans
 * cette conversation.
 *
 * Filtre Direction → Service en cascade, tous deux obligatoires pour afficher
 * la liste (comme Cellules.tsx — design identique, décision utilisateur) :
 * SITE.ID_SERVICE est nullable en base (contrairement à CELLULE) mais tout
 * site doit en pratique être rattaché à un service (règle confirmée), donc
 * aucun site ne devrait rester inaccessible derrière ce filtre obligatoire.
 */
export function GisementGeographique() {
  const { directions } = useDirections()
  const { services } = useServices()
  const { data: currentUser } = useCurrentUser()

  // ADMIN_APP voit tous les services (périmètre transverse). ADMIN_SERVICE
  // n'a de droits d'écriture que sur son propre service (voir
  // backend/src/services/authorization.service.ts) — la combobox ne lui
  // propose donc que celui-ci, pour éviter de laisser croire qu'il pourrait
  // gérer les autres. Un utilisateur sans l'un ou l'autre rôle (lecture
  // seule, ouverte à tout authentifié rattaché) garde la liste complète.
  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const adminServiceIds = (currentUser?.roles ?? [])
    .filter((r) => r.typeRole === 'ADMIN_SERVICE' && r.idService !== null)
    .map((r) => r.idService as number)
  const isRestrictedToOwnService = !isAdminApp && adminServiceIds.length > 0
  const visibleServices = isRestrictedToOwnService
    ? services.filter((s) => adminServiceIds.includes(s.id_service))
    : services

  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [filterIdService, setFilterIdService] = useState<string | null>(null)
  const idServiceFilter = filterIdService !== null ? Number(filterIdService) : null
  const { sites, loading, error, refetch } = useSites(idServiceFilter)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  // Cascade : la combo Service ne propose que les services de la direction
  // choisie (parmi ceux visibles pour cet utilisateur).
  const servicesForFilter =
    filterIdDirection === null ? [] : visibleServices.filter((s) => s.id_direction === Number(filterIdDirection))

  useEffect(() => {
    // ADMIN_SERVICE : verrouille les deux filtres (direction ET service) sur
    // son propre périmètre dès qu'il est connu — évite qu'il passe par un
    // état "aucun filtre" qui viderait la liste (voir plus bas : direction +
    // service sont désormais tous deux obligatoires pour afficher la liste).
    // Fusionné avec la logique de cascade ci-dessous dans le MÊME effet :
    // les séparer causait une régression (l'effet de cascade s'exécutait
    // avec le filterIdDirection encore null de ce même rendu et effaçait le
    // service qui venait tout juste d'être verrouillé).
    if (isRestrictedToOwnService && filterIdDirection === null) {
      const ownService = services.find((s) => s.id_service === adminServiceIds[0])
      if (ownService) {
        setFilterIdDirection(String(ownService.id_direction))
        setFilterIdService(String(adminServiceIds[0]))
      }
      return
    }
    // "Aucune direction" : pas de filtre Service possible (le champ est
    // masqué — voir JSX) — on efface toute sélection résiduelle. Changement
    // vers une direction précise : le service sélectionné peut ne plus lui
    // appartenir — on l'efface plutôt que de garder un filtre incohérent.
    if (filterIdDirection === null) {
      if (filterIdService !== null) setFilterIdService(null)
      return
    }
    if (filterIdService === null) return
    const stillValid = servicesForFilter.some((s) => s.id_service === Number(filterIdService))
    if (!stillValid) setFilterIdService(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestrictedToOwnService, adminServiceIds.join(','), services, filterIdDirection])

  const serviceOptions = servicesForFilter.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const serviceLabel = (idService: number | null) =>
    services.find((s) => s.id_service === idService)?.libelle_service ?? '—'

  const [siteStatusFilter, setSiteStatusFilter] = useState<string | null>(null)
  const { sort: siteSort, toggleSort: toggleSiteSort } = useColumnSort<'service' | 'lib_site' | 'actif'>()
  // Direction ET service obligatoires pour afficher la liste (décision
  // utilisateur, comme Cellules.tsx) : pas d'option "Toutes les directions"
  // ni "Tous les services".
  const filteredSites =
    filterIdDirection === null || filterIdService === null
      ? []
      : sites.filter((s) => matchesStatusFilter(s.actif, siteStatusFilter))
  const displayedSites = sortRows(filteredSites, siteSort, (site, column) =>
    column === 'service' ? serviceLabel(site.id_service) : column === 'lib_site' ? site.lib_site : site.actif,
  )

  const [siteModal, setSiteModal] = useState<{ mode: 'create' | 'edit'; site: Site | null } | null>(null)
  const [sousSitesModalCodeSite, setSousSitesModalCodeSite] = useState<string | null>(null)
  const sousSitesModalSite = sites.find((s) => s.code_site === sousSitesModalCodeSite) ?? null
  const [reorderModalIdService, setReorderModalIdService] = useState<number | null>(null)

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Gisement géographique</h1>
          <p>Sites et sous-sites (postes, quais…) utilisés pour localiser les demandes d'achat.</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setSiteModal({ mode: 'create', site: null })}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouveau site
          </button>
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
        <div className="gp-field" style={{ maxWidth: 200 }}>
          <label className="gp-label">Statut</label>
          <Combobox
            options={STATUS_OPTIONS}
            value={siteStatusFilter}
            onChange={setSiteStatusFilter}
            placeholder="Tous"
            clearLabel="Tous"
            ariaLabel="Filtrer les sites par statut"
          />
        </div>
      </div>

      {error && (
        <p className="gp-errmsg">
          <svg className="ti">
            <use href="#i-alert-circle" />
          </svg>
          {error}
        </p>
      )}

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <SortableTh label="Service" column="service" sort={siteSort} onSort={toggleSiteSort} />
              <SortableTh label="Libellé" column="lib_site" sort={siteSort} onSort={toggleSiteSort} />
              <SortableTh label="Statut" column="actif" sort={siteSort} onSort={toggleSiteSort} />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>Chargement…</td>
              </tr>
            )}
            {!loading && displayedSites.length === 0 && (
              <tr>
                <td colSpan={4}>
                  {filterIdDirection === null || filterIdService === null
                    ? 'Sélectionne une direction et un service pour afficher les sites.'
                    : 'Aucun site pour ce filtre.'}
                </td>
              </tr>
            )}
            {displayedSites.map((site) => (
              <tr key={site.code_site}>
                <td>{serviceLabel(site.id_service)}</td>
                <td>{site.lib_site}</td>
                <td>
                  {site.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Voir les sous-sites">
                      <button
                        aria-label="Voir les sous-sites"
                        onClick={() => setSousSitesModalCodeSite(site.code_site)}
                      >
                        <svg className="ti">
                          <use href="#i-eye" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Modifier le site">
                      <button aria-label="Modifier le site" onClick={() => setSiteModal({ mode: 'edit', site })}>
                        <svg className="ti">
                          <use href="#i-pencil" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Réordonner les sites">
                      <button
                        aria-label="Réordonner les sites"
                        onClick={() => {
                          if (site.id_service !== null) setReorderModalIdService(site.id_service)
                        }}
                      >
                        <svg className="ti">
                          <use href="#i-grip-vertical" />
                        </svg>
                      </button>
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {siteModal && (
        <SiteFormModal
          mode={siteModal.mode}
          site={siteModal.site}
          services={visibleServices}
          directions={directions}
          defaultIdService={isRestrictedToOwnService ? (adminServiceIds[0] ?? null) : null}
          onClose={() => setSiteModal(null)}
          onSaved={() => {
            setSiteModal(null)
            void refetch()
          }}
        />
      )}

      {sousSitesModalSite && (
        <SousSitesModal site={sousSitesModalSite} onClose={() => setSousSitesModalCodeSite(null)} onChanged={refetch} />
      )}

      {reorderModalIdService !== null && (
        <SiteReorderModal
          idService={reorderModalIdService}
          sites={sites.filter((s) => s.id_service === reorderModalIdService)}
          serviceLabel={serviceLabel(reorderModalIdService)}
          onClose={() => setReorderModalIdService(null)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}

interface SiteFormModalProps {
  mode: 'create' | 'edit'
  site: Site | null
  services: { id_service: number; libelle_service: string; id_direction: number }[]
  directions: { id_direction: number; libelle_direction: string }[]
  /** Service de l'ADMIN_SERVICE connecté, pré-sélectionné en création pour lui éviter un choix inutile (il n'a qu'un service visible de toute façon). */
  defaultIdService: number | null
  onClose: () => void
  onSaved: () => void
}

/** Création (Code + Libellé + Service + Actif) ou modification (Libellé + Actif uniquement — le service d'un site ne se réassigne pas depuis l'UI, décision utilisateur). Le libellé de la direction du service sélectionné est rappelé en lecture seule sous le titre (en création comme en modification) — la direction n'est pas un champ propre à SITE, uniquement dérivée du service. */
function SiteFormModal({ mode, site, services, directions, defaultIdService, onClose, onSaved }: SiteFormModalProps) {
  const [codeSite, setCodeSite] = useState(site?.code_site ?? '')
  const [libSite, setLibSite] = useState(site?.lib_site ?? '')
  const [idService, setIdService] = useState<string | null>(
    site?.id_service != null ? String(site.id_service) : defaultIdService != null ? String(defaultIdService) : null,
  )
  const [actif, setActif] = useState(site?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceOptions = services.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const selectedService = idService !== null ? services.find((s) => s.id_service === Number(idService)) : undefined
  const selectedDirection = selectedService
    ? directions.find((d) => d.id_direction === selectedService.id_direction)
    : undefined

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'create' && !idService) {
      setError('Le service est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'create') {
        await api.post('/sites', { codeSite, libSite, idService: Number(idService), actif })
      } else if (site) {
        await api.put(`/sites/${site.code_site}`, { libSite, actif })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="siteModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="siteModalTitle">
            {mode === 'create' ? 'Nouveau site' : 'Modifier le site'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gp-modal__bd gp-scroll stack">
            {mode === 'edit' && (
              <p className="gp-help">
                Direction : {selectedDirection?.libelle_direction ?? '—'}
                <br />
                Service : {selectedService?.libelle_service ?? '—'}
              </p>
            )}
            {mode === 'create' && <p className="gp-help">Direction : {selectedDirection?.libelle_direction ?? '—'}</p>}
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label" htmlFor="site-code">
                  Code
                </label>
                <input
                  id="site-code"
                  className="gp-input"
                  value={codeSite}
                  onChange={(e) => setCodeSite(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="site-lib">
                Libellé
              </label>
              <input
                id="site-lib"
                className="gp-input"
                value={libSite}
                onChange={(e) => setLibSite(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label">Service</label>
                <Combobox
                  options={serviceOptions}
                  value={idService}
                  onChange={setIdService}
                  placeholder="Choisir un service…"
                  ariaLabel="Service"
                />
              </div>
            )}
            <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
              <span>Actif</span>
              <span className="gp-switch">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
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

interface SousSitesModalProps {
  site: Site
  onClose: () => void
  onChanged: () => void
}

/**
 * Modale ouverte depuis l'icône « œil » d'une ligne SITE : liste des
 * sous-sites (libellé + statut), réordonnable par glisser-déposer, avec
 * création/modification (bouton "+" / icône crayon) — décision utilisateur.
 */
function SousSitesModal({ site, onClose, onChanged }: SousSitesModalProps) {
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; sousSite: SousSite | null } | null>(null)

  const displayed = optimisticOrder
    ? optimisticOrder
        .map((code) => site.sous_sites.find((ss) => ss.code_sous_site === code))
        .filter((ss): ss is SousSite => Boolean(ss))
    : site.sous_sites

  async function handleReorder(newOrder: string[]) {
    setOptimisticOrder(newOrder)
    setReorderError(null)
    try {
      await api.put(`/sites/${site.code_site}/sous-sites/reorder`, { codeSousSites: newOrder })
      onChanged()
    } catch (err) {
      setReorderError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticOrder(null)
    }
  }

  const reorder = useDragReorder(
    displayed.map((ss) => ss.code_sous_site),
    handleReorder,
  )

  return (
    <>
      <div className="gp-overlay is-open">
        <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="sousSitesModalTitle">
          <div className="gp-modal__hd">
            <h3 className="gp-modal__title" id="sousSitesModalTitle">
              Sous-sites — {site.lib_site}
            </h3>
            <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
              <svg className="ti">
                <use href="#i-x" />
              </svg>
            </button>
          </div>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="gp-btn gp-btn--ghost gp-btn--sm"
                onClick={() => setFormModal({ mode: 'create', sousSite: null })}
              >
                <svg className="ti">
                  <use href="#i-plus" />
                </svg>
                Nouveau sous-site
              </button>
            </div>
            {reorderError && (
              <p className="gp-errmsg">
                <svg className="ti">
                  <use href="#i-alert-circle" />
                </svg>
                {reorderError}
              </p>
            )}
            {displayed.length === 0 ? (
              <p>Aucun sous-site.</p>
            ) : (
              <div className="gp-table-wrap gp-scroll">
                <table className="gp-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th aria-label="Réordonner" style={{ width: 32 }} />
                      <th>Libellé</th>
                      <th style={{ width: 90 }}>Statut</th>
                      <th style={{ width: 55 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((sousSite) => (
                      <tr
                        key={sousSite.code_sous_site}
                        {...reorder.dragProps(sousSite.code_sous_site)}
                        style={{ opacity: reorder.draggedKey === sousSite.code_sous_site ? 0.5 : undefined }}
                      >
                        <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                          <svg className="ti">
                            <use href="#i-grip-vertical" />
                          </svg>
                        </td>
                        <td>{sousSite.lib_sous_site}</td>
                        <td>
                          {sousSite.actif ? (
                            <span className="gp-badge gp-badge--success">Actif</span>
                          ) : (
                            <span className="gp-badge gp-badge--danger">Inactif</span>
                          )}
                        </td>
                        <td>
                          <div className="gp-rowacts">
                            <span className="gp-tip" data-tip="Modifier le sous-site">
                              <button
                                aria-label="Modifier le sous-site"
                                onClick={() => setFormModal({ mode: 'edit', sousSite })}
                              >
                                <svg className="ti">
                                  <use href="#i-pencil" />
                                </svg>
                              </button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="gp-modal__ft">
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
      </div>

      {formModal && (
        <SousSiteFormModal
          mode={formModal.mode}
          codeSite={site.code_site}
          sousSite={formModal.sousSite}
          onClose={() => setFormModal(null)}
          onSaved={() => {
            setFormModal(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}

interface SiteReorderModalProps {
  idService: number
  sites: Site[]
  serviceLabel: string
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale de réordonnancement global des sites d'UN service (le
 * réordonnancement est scopé par service côté backend — voir
 * backend/src/services/site.service.ts#reorderSites — un même écran ne peut
 * pas mélanger l'ordre de sites de services différents). Accessible depuis
 * l'icône « poignée » de n'importe quelle ligne : ouvre toujours la liste du
 * service auquel appartient cette ligne.
 */
function SiteReorderModal({ idService, sites, serviceLabel, onClose, onSaved }: SiteReorderModalProps) {
  const sorted = [...sites].sort((a, b) => a.ordre_site - b.ordre_site)
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayed = optimisticOrder
    ? optimisticOrder.map((code) => sorted.find((s) => s.code_site === code)).filter((s): s is Site => Boolean(s))
    : sorted

  async function handleReorder(newOrder: string[]) {
    setOptimisticOrder(newOrder)
    setError(null)
    try {
      await api.put('/sites/reorder', { idService, codeSites: newOrder })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticOrder(null)
    }
  }

  const reorder = useDragReorder(
    displayed.map((s) => s.code_site),
    handleReorder,
  )

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="siteReorderModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="siteReorderModalTitle">
            Réordonner les sites — {serviceLabel}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {error && (
            <p className="gp-errmsg">
              <svg className="ti">
                <use href="#i-alert-circle" />
              </svg>
              {error}
            </p>
          )}
          <div className="gp-table-wrap gp-scroll">
            <table className="gp-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th aria-label="Réordonner" style={{ width: 32 }} />
                  <th>Libellé</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((site) => (
                  <tr
                    key={site.code_site}
                    {...reorder.dragProps(site.code_site)}
                    style={{ opacity: reorder.draggedKey === site.code_site ? 0.5 : undefined }}
                  >
                    <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                      <svg className="ti">
                        <use href="#i-grip-vertical" />
                      </svg>
                    </td>
                    <td>{site.lib_site}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

interface SousSiteFormModalProps {
  mode: 'create' | 'edit'
  codeSite: string
  sousSite: SousSite | null
  onClose: () => void
  onSaved: () => void
}

function SousSiteFormModal({ mode, codeSite, sousSite, onClose, onSaved }: SousSiteFormModalProps) {
  const [codeSousSite, setCodeSousSite] = useState(sousSite?.code_sous_site ?? '')
  const [libSousSite, setLibSousSite] = useState(sousSite?.lib_sous_site ?? '')
  const [actif, setActif] = useState(sousSite?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { libSousSite, actif }
      if (mode === 'create') {
        await api.post(`/sites/${codeSite}/sous-sites`, { codeSousSite, ...payload })
      } else if (sousSite) {
        await api.put(`/sites/${codeSite}/sous-sites/${sousSite.code_sous_site}`, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="sousSiteModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="sousSiteModalTitle">
            {mode === 'create' ? 'Nouveau sous-site' : 'Modifier le sous-site'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gp-modal__bd gp-scroll stack">
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label" htmlFor="sous-site-code">
                  Code
                </label>
                <input
                  id="sous-site-code"
                  className="gp-input"
                  value={codeSousSite}
                  onChange={(e) => setCodeSousSite(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="sous-site-lib">
                Libellé
              </label>
              <input
                id="sous-site-lib"
                className="gp-input"
                value={libSousSite}
                onChange={(e) => setLibSousSite(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <label className="gp-choice" style={{ justifyContent: 'space-between' }}>
              <span>Actif</span>
              <span className="gp-switch">
                <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
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
