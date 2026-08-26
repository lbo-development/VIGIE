import { useEffect, useState, type FormEvent } from 'react'
import { useSites, type Site, type SousSite } from '../hooks/useSites'
import { useServices } from '../hooks/useServices'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDragReorder } from '../hooks/useDragReorder'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

/**
 * Gestion du référentiel géographique (SITE/SOUS_SITE), montée sur
 * /parametres/gisement-geographique (voir App.tsx et config/navigation.ts).
 * Écriture réservée ADMIN_SERVICE (scopé à son service) et ADMIN_APP
 * (transverse) — contrôle réel côté backend (voir
 * backend/src/services/site.service.ts) ; cet écran n'essaie pas de deviner
 * les droits de l'utilisateur pour masquer les actions, seul le backend fait
 * foi (voir ForClaude/SECURITY.md §2).
 *
 * Vue maître-détail (liste des sites à gauche, sous-sites du site sélectionné
 * à droite) plutôt qu'un tableau imbriqué en accordéon — le premier essai
 * (sous-tableau qui s'ouvrait sous la ligne) déplaçait tout le reste de la
 * liste à chaque clic et n'avait pas de vrai équivalent dans le design
 * system GPMM (aucun composant "arbre" documenté). Composé des mêmes
 * primitives (.gp-table, .gp-panel), juste disposées différemment.
 */
export function GisementGeographique() {
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

  const [filterIdService, setFilterIdService] = useState<string | null>(null)
  const idServiceFilter = filterIdService !== null ? Number(filterIdService) : null
  const { sites, loading, error, refetch } = useSites(idServiceFilter)

  useEffect(() => {
    // ADMIN_SERVICE : verrouille le filtre sur son propre service dès que
    // son périmètre est connu (évite qu'il passe par "Tous les services").
    if (isRestrictedToOwnService && filterIdService === null) {
      setFilterIdService(String(adminServiceIds[0]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestrictedToOwnService, adminServiceIds.join(',')])

  const [selectedCodeSite, setSelectedCodeSite] = useState<string | null>(null)
  const selectedSite = sites.find((s) => s.code_site === selectedCodeSite) ?? null

  const [siteModal, setSiteModal] = useState<{ mode: 'create' | 'edit'; site: Site | null } | null>(null)
  const [sousSiteModal, setSousSiteModal] = useState<{
    mode: 'create' | 'edit'
    codeSite: string
    sousSite: SousSite | null
  } | null>(null)

  const serviceOptions = visibleServices.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const serviceLabel = (idService: number | null) =>
    services.find((s) => s.id_service === idService)?.libelle_service ?? '—'

  // Glisser-déposer des sites : n'a de sens que sur un service précis (le
  // filtre "Tous les services" mélangerait des sites de services différents,
  // et ADMIN_SERVICE ne peut de toute façon réordonner que son propre service —
  // voir la décision utilisateur consignée dans cette conversation).
  const canReorderSites = idServiceFilter !== null
  const [optimisticSiteOrder, setOptimisticSiteOrder] = useState<string[] | null>(null)
  const [siteReorderError, setSiteReorderError] = useState<string | null>(null)
  const displayedSites = optimisticSiteOrder
    ? optimisticSiteOrder
        .map((code) => sites.find((s) => s.code_site === code))
        .filter((s): s is Site => Boolean(s))
    : sites

  async function handleSiteReorder(newOrder: string[]) {
    if (idServiceFilter === null) return
    setOptimisticSiteOrder(newOrder)
    setSiteReorderError(null)
    try {
      await api.put('/sites/reorder', { idService: idServiceFilter, codeSites: newOrder })
      await refetch()
    } catch (err) {
      setSiteReorderError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticSiteOrder(null)
    }
  }

  const sitesReorder = useDragReorder(
    displayedSites.map((s) => s.code_site),
    handleSiteReorder,
  )

  // Glisser-déposer des sous-sites : toujours scopé à un seul site (celui
  // sélectionné), pas d'ambiguïté de périmètre équivalente à celle des sites.
  const [optimisticSousSiteOrder, setOptimisticSousSiteOrder] = useState<string[] | null>(null)
  const [sousSiteReorderError, setSousSiteReorderError] = useState<string | null>(null)

  useEffect(() => {
    // Change de site sélectionné : un ordre optimiste laissé par le site
    // précédent n'a plus de sens ici (les codes peuvent coïncider par hasard
    // entre deux sites, ex. deux "Gare Maritime" différents).
    setOptimisticSousSiteOrder(null)
    setSousSiteReorderError(null)
  }, [selectedCodeSite])

  const displayedSousSites = !selectedSite
    ? []
    : optimisticSousSiteOrder
      ? optimisticSousSiteOrder
          .map((code) => selectedSite.sous_sites.find((ss) => ss.code_sous_site === code))
          .filter((ss): ss is SousSite => Boolean(ss))
      : selectedSite.sous_sites

  async function handleSousSiteReorder(newOrder: string[]) {
    if (!selectedSite) return
    setOptimisticSousSiteOrder(newOrder)
    setSousSiteReorderError(null)
    try {
      await api.put(`/sites/${selectedSite.code_site}/sous-sites/reorder`, { codeSousSites: newOrder })
      await refetch()
    } catch (err) {
      setSousSiteReorderError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticSousSiteOrder(null)
    }
  }

  const sousSitesReorder = useDragReorder(
    displayedSousSites.map((ss) => ss.code_sous_site),
    handleSousSiteReorder,
  )

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

      <div className="gp-field" style={{ maxWidth: 340 }}>
        <label className="gp-label">Service</label>
        <Combobox
          options={serviceOptions}
          value={filterIdService}
          onChange={setFilterIdService}
          placeholder="Tous les services"
          clearLabel={isRestrictedToOwnService ? undefined : 'Tous les services'}
          ariaLabel="Filtrer par service"
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
      {siteReorderError && (
        <p className="gp-errmsg">
          <svg className="ti">
            <use href="#i-alert-circle" />
          </svg>
          {siteReorderError}
        </p>
      )}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="gp-table-wrap gp-scroll" style={{ flex: '1 1 480px' }}>
          <table className="gp-table">
            <thead>
              <tr>
                {canReorderSites && <th aria-label="Réordonner" style={{ width: 32 }} />}
                <th>Code</th>
                <th>Libellé</th>
                <th>Service</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={canReorderSites ? 6 : 5}>Chargement…</td>
                </tr>
              )}
              {!loading && displayedSites.length === 0 && (
                <tr>
                  <td colSpan={canReorderSites ? 6 : 5}>Aucun site.</td>
                </tr>
              )}
              {displayedSites.map((site) => (
                <tr
                  key={site.code_site}
                  {...(canReorderSites ? sitesReorder.dragProps(site.code_site) : {})}
                  style={{
                    backgroundColor: site.code_site === selectedCodeSite ? 'var(--gp-surface-sunken)' : undefined,
                    opacity: canReorderSites && sitesReorder.draggedKey === site.code_site ? 0.5 : undefined,
                  }}
                >
                  {canReorderSites && (
                    <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                      <svg className="ti">
                        <use href="#i-grip-vertical" />
                      </svg>
                    </td>
                  )}
                  <td className="mono">{site.code_site}</td>
                  <td>{site.lib_site}</td>
                  <td>{serviceLabel(site.id_service)}</td>
                  <td>
                    {site.actif ? (
                      <span className="gp-badge gp-badge--success">Actif</span>
                    ) : (
                      <span className="gp-badge gp-badge--danger">Inactif</span>
                    )}
                  </td>
                  <td>
                    <div className="gp-rowacts">
                      <button
                        aria-label="Voir les sous-sites"
                        aria-pressed={site.code_site === selectedCodeSite}
                        onClick={() => setSelectedCodeSite(site.code_site)}
                      >
                        <svg className="ti">
                          <use href="#i-eye" />
                        </svg>
                      </button>
                      <button aria-label="Modifier" onClick={() => setSiteModal({ mode: 'edit', site })}>
                        <svg className="ti">
                          <use href="#i-pencil" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="gp-panel stack" style={{ flex: '0 1 420px', maxWidth: 420 }}>
          {!selectedSite ? (
            <p>Sélectionne un site (icône « œil ») pour voir et gérer ses sous-sites.</p>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="gp-label">Sous-sites</p>
                  <p className="mono">{selectedSite.lib_site}</p>
                </div>
                <button
                  type="button"
                  className="gp-btn gp-btn--ghost gp-btn--sm"
                  onClick={() => setSousSiteModal({ mode: 'create', codeSite: selectedSite.code_site, sousSite: null })}
                >
                  <svg className="ti">
                    <use href="#i-plus" />
                  </svg>
                  Nouveau sous-site
                </button>
              </div>
              {sousSiteReorderError && (
                <p className="gp-errmsg">
                  <svg className="ti">
                    <use href="#i-alert-circle" />
                  </svg>
                  {sousSiteReorderError}
                </p>
              )}
              {selectedSite.sous_sites.length === 0 ? (
                <p>Aucun sous-site.</p>
              ) : (
                <div className="gp-table-wrap gp-scroll">
                  <table className="gp-table" style={{ tableLayout: 'fixed', width: 'auto', minWidth: 0 }}>
                    <thead>
                      <tr>
                        <th aria-label="Réordonner" style={{ width: 32 }} />
                        <th style={{ width: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>Code</th>
                        <th style={{ width: 85 }}>Statut</th>
                        <th style={{ width: 55 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedSousSites.map((sousSite) => (
                        <tr
                          key={sousSite.code_sous_site}
                          {...sousSitesReorder.dragProps(sousSite.code_sous_site)}
                          style={{
                            opacity: sousSitesReorder.draggedKey === sousSite.code_sous_site ? 0.5 : undefined,
                          }}
                        >
                          <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                            <svg className="ti">
                              <use href="#i-grip-vertical" />
                            </svg>
                          </td>
                          <td className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sousSite.code_sous_site}
                          </td>
                          <td>
                            {sousSite.actif ? (
                              <span className="gp-badge gp-badge--success">Actif</span>
                            ) : (
                              <span className="gp-badge gp-badge--danger">Inactif</span>
                            )}
                          </td>
                          <td>
                            <div className="gp-rowacts">
                              <button
                                aria-label="Modifier"
                                onClick={() =>
                                  setSousSiteModal({ mode: 'edit', codeSite: selectedSite.code_site, sousSite })
                                }
                              >
                                <svg className="ti">
                                  <use href="#i-pencil" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {siteModal && (
        <SiteFormModal
          mode={siteModal.mode}
          site={siteModal.site}
          services={visibleServices}
          onClose={() => setSiteModal(null)}
          onSaved={() => {
            setSiteModal(null)
            void refetch()
          }}
        />
      )}

      {sousSiteModal && (
        <SousSiteFormModal
          mode={sousSiteModal.mode}
          codeSite={sousSiteModal.codeSite}
          sousSite={sousSiteModal.sousSite}
          onClose={() => setSousSiteModal(null)}
          onSaved={() => {
            setSousSiteModal(null)
            void refetch()
          }}
        />
      )}
    </div>
  )
}

interface SiteFormModalProps {
  mode: 'create' | 'edit'
  site: Site | null
  services: { id_service: number; libelle_service: string }[]
  onClose: () => void
  onSaved: () => void
}

function SiteFormModal({ mode, site, services, onClose, onSaved }: SiteFormModalProps) {
  const [codeSite, setCodeSite] = useState(site?.code_site ?? '')
  const [libSite, setLibSite] = useState(site?.lib_site ?? '')
  const [idService, setIdService] = useState<string | null>(site?.id_service != null ? String(site.id_service) : null)
  const [actif, setActif] = useState(site?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceOptions = services.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!idService) {
      setError('Le service est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        libSite,
        idService: Number(idService),
        actif,
      }
      if (mode === 'create') {
        await api.post('/sites', { codeSite, ...payload })
      } else if (site) {
        await api.put(`/sites/${site.code_site}`, payload)
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

interface SousSiteFormModalProps {
  mode: 'create' | 'edit'
  codeSite: string
  sousSite: SousSite | null
  onClose: () => void
  onSaved: () => void
}

function SousSiteFormModal({ mode, codeSite, sousSite, onClose, onSaved }: SousSiteFormModalProps) {
  const [codeSousSite, setCodeSousSite] = useState(sousSite?.code_sous_site ?? '')
  const [actif, setActif] = useState(sousSite?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { actif }
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
                  Libellé
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
