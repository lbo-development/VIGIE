import { useEffect, useState, type FormEvent } from 'react'
import { useSecteurs, type Secteur, type SousSecteur } from '../hooks/useSecteurs'
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
 * Gestion du référentiel technique (SECTEUR/SOUS_SECTEUR), montée sur
 * /parametres/gisement-technique (voir App.tsx et config/navigation.ts).
 * Écriture réservée ADMIN_SERVICE (scopé à son service) et ADMIN_APP
 * (transverse) — contrôle réel côté backend (voir
 * backend/src/services/secteur.service.ts) ; cet écran n'essaie pas de
 * deviner les droits de l'utilisateur pour masquer les actions, seul le
 * backend fait foi (voir ForClaude/SECURITY.md §2).
 *
 * Miroir de GisementGeographique.tsx (SITE/SOUS_SITE) : SECTEUR/SOUS_SECTEUR
 * ont exactement la même forme dans le MLD (ForClaude/CDC/mld-phases-1-2.md
 * §2.2) et la même règle d'habilitation. Un seul tableau de secteurs
 * (Service, Libellé, Statut, Actions — toutes colonnes triables), la gestion
 * des sous-secteurs et le réordonnancement des secteurs (par service) se
 * font via des modales ouvertes depuis la colonne Actions — décision
 * utilisateur reprise à l'identique de l'écran géographique.
 *
 * Filtre Direction → Service en cascade, tous deux obligatoires pour afficher
 * la liste (comme Cellules.tsx — design identique, décision utilisateur) :
 * SECTEUR.ID_SERVICE est nullable en base (contrairement à CELLULE) mais tout
 * secteur doit en pratique être rattaché à un service (règle confirmée), donc
 * aucun secteur ne devrait rester inaccessible derrière ce filtre obligatoire.
 */
export function GisementTechnique() {
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
  const { secteurs, loading, error, refetch } = useSecteurs(idServiceFilter)

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

  const [secteurStatusFilter, setSecteurStatusFilter] = useState<string | null>(null)
  const { sort: secteurSort, toggleSort: toggleSecteurSort } = useColumnSort<'service' | 'lib_secteur' | 'actif'>()
  // Direction ET service obligatoires pour afficher la liste (décision
  // utilisateur, comme Cellules.tsx) : pas d'option "Toutes les directions"
  // ni "Tous les services".
  const filteredSecteurs =
    filterIdDirection === null || filterIdService === null
      ? []
      : secteurs.filter((s) => matchesStatusFilter(s.actif, secteurStatusFilter))
  const displayedSecteurs = sortRows(filteredSecteurs, secteurSort, (secteur, column) =>
    column === 'service'
      ? serviceLabel(secteur.id_service)
      : column === 'lib_secteur'
        ? secteur.lib_secteur
        : secteur.actif,
  )

  const [secteurModal, setSecteurModal] = useState<{ mode: 'create' | 'edit'; secteur: Secteur | null } | null>(null)
  const [sousSecteursModalCodeSecteur, setSousSecteursModalCodeSecteur] = useState<string | null>(null)
  const sousSecteursModalSecteur = secteurs.find((s) => s.code_secteur === sousSecteursModalCodeSecteur) ?? null
  const [reorderModalIdService, setReorderModalIdService] = useState<number | null>(null)

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Gisement technique</h1>
          <p>Secteurs et sous-secteurs utilisés pour classer techniquement les demandes d'achat.</p>
        </div>
        <div className="page-actions">
          <button
            className="gp-btn gp-btn--primary"
            onClick={() => setSecteurModal({ mode: 'create', secteur: null })}
          >
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouveau secteur
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
            value={secteurStatusFilter}
            onChange={setSecteurStatusFilter}
            placeholder="Tous"
            clearLabel="Tous"
            ariaLabel="Filtrer les secteurs par statut"
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
              <SortableTh label="Service" column="service" sort={secteurSort} onSort={toggleSecteurSort} />
              <SortableTh label="Libellé" column="lib_secteur" sort={secteurSort} onSort={toggleSecteurSort} />
              <SortableTh label="Statut" column="actif" sort={secteurSort} onSort={toggleSecteurSort} />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>Chargement…</td>
              </tr>
            )}
            {!loading && displayedSecteurs.length === 0 && (
              <tr>
                <td colSpan={4}>
                  {filterIdDirection === null || filterIdService === null
                    ? 'Sélectionne une direction et un service pour afficher les secteurs.'
                    : 'Aucun secteur pour ce filtre.'}
                </td>
              </tr>
            )}
            {displayedSecteurs.map((secteur) => (
              <tr key={secteur.code_secteur}>
                <td>{serviceLabel(secteur.id_service)}</td>
                <td>{secteur.lib_secteur}</td>
                <td>
                  {secteur.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Voir les sous-secteurs">
                      <button
                        aria-label="Voir les sous-secteurs"
                        onClick={() => setSousSecteursModalCodeSecteur(secteur.code_secteur)}
                      >
                        <svg className="ti">
                          <use href="#i-eye" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Modifier le secteur">
                      <button
                        aria-label="Modifier le secteur"
                        onClick={() => setSecteurModal({ mode: 'edit', secteur })}
                      >
                        <svg className="ti">
                          <use href="#i-pencil" />
                        </svg>
                      </button>
                    </span>
                    <span className="gp-tip" data-tip="Réordonner les secteurs">
                      <button
                        aria-label="Réordonner les secteurs"
                        onClick={() => {
                          if (secteur.id_service !== null) setReorderModalIdService(secteur.id_service)
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

      {secteurModal && (
        <SecteurFormModal
          mode={secteurModal.mode}
          secteur={secteurModal.secteur}
          services={visibleServices}
          directions={directions}
          defaultIdService={isRestrictedToOwnService ? (adminServiceIds[0] ?? null) : null}
          onClose={() => setSecteurModal(null)}
          onSaved={() => {
            setSecteurModal(null)
            void refetch()
          }}
        />
      )}

      {sousSecteursModalSecteur && (
        <SousSecteursModal
          secteur={sousSecteursModalSecteur}
          onClose={() => setSousSecteursModalCodeSecteur(null)}
          onChanged={refetch}
        />
      )}

      {reorderModalIdService !== null && (
        <SecteurReorderModal
          idService={reorderModalIdService}
          secteurs={secteurs.filter((s) => s.id_service === reorderModalIdService)}
          serviceLabel={serviceLabel(reorderModalIdService)}
          onClose={() => setReorderModalIdService(null)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}

interface SecteurFormModalProps {
  mode: 'create' | 'edit'
  secteur: Secteur | null
  services: { id_service: number; libelle_service: string; id_direction: number }[]
  directions: { id_direction: number; libelle_direction: string }[]
  /** Service de l'ADMIN_SERVICE connecté, pré-sélectionné en création pour lui éviter un choix inutile (il n'a qu'un service visible de toute façon). */
  defaultIdService: number | null
  onClose: () => void
  onSaved: () => void
}

/** Création (Code + Libellé + Service + Actif) ou modification (Libellé + Actif uniquement — le service d'un secteur ne se réassigne pas depuis l'UI, décision utilisateur). Le libellé de la direction du service sélectionné est rappelé en lecture seule sous le titre (en création comme en modification) — la direction n'est pas un champ propre à SECTEUR, uniquement dérivée du service. */
function SecteurFormModal({
  mode,
  secteur,
  services,
  directions,
  defaultIdService,
  onClose,
  onSaved,
}: SecteurFormModalProps) {
  const [codeSecteur, setCodeSecteur] = useState(secteur?.code_secteur ?? '')
  const [libSecteur, setLibSecteur] = useState(secteur?.lib_secteur ?? '')
  const [idService, setIdService] = useState<string | null>(
    secteur?.id_service != null
      ? String(secteur.id_service)
      : defaultIdService != null
        ? String(defaultIdService)
        : null,
  )
  const [actif, setActif] = useState(secteur?.actif ?? true)
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
        await api.post('/secteurs', { codeSecteur, libSecteur, idService: Number(idService), actif })
      } else if (secteur) {
        await api.put(`/secteurs/${secteur.code_secteur}`, { libSecteur, actif })
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="secteurModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="secteurModalTitle">
            {mode === 'create' ? 'Nouveau secteur' : 'Modifier le secteur'}
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
                <label className="gp-label" htmlFor="secteur-code">
                  Code
                </label>
                <input
                  id="secteur-code"
                  className="gp-input"
                  value={codeSecteur}
                  onChange={(e) => setCodeSecteur(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="secteur-lib">
                Libellé
              </label>
              <input
                id="secteur-lib"
                className="gp-input"
                value={libSecteur}
                onChange={(e) => setLibSecteur(e.target.value)}
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

interface SousSecteursModalProps {
  secteur: Secteur
  onClose: () => void
  onChanged: () => void
}

/**
 * Modale ouverte depuis l'icône « œil » d'une ligne SECTEUR : liste des
 * sous-secteurs (libellé + statut), réordonnable par glisser-déposer, avec
 * création/modification (bouton "+" / icône crayon) — décision utilisateur.
 */
function SousSecteursModal({ secteur, onClose, onChanged }: SousSecteursModalProps) {
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; sousSecteur: SousSecteur | null } | null>(
    null,
  )

  const displayed = optimisticOrder
    ? optimisticOrder
        .map((code) => secteur.sous_secteurs.find((ss) => ss.code_sous_secteur === code))
        .filter((ss): ss is SousSecteur => Boolean(ss))
    : secteur.sous_secteurs

  async function handleReorder(newOrder: string[]) {
    setOptimisticOrder(newOrder)
    setReorderError(null)
    try {
      await api.put(`/secteurs/${secteur.code_secteur}/sous-secteurs/reorder`, { codeSousSecteurs: newOrder })
      onChanged()
    } catch (err) {
      setReorderError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticOrder(null)
    }
  }

  const reorder = useDragReorder(
    displayed.map((ss) => ss.code_sous_secteur),
    handleReorder,
  )

  return (
    <>
      <div className="gp-overlay is-open">
        <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="sousSecteursModalTitle">
          <div className="gp-modal__hd">
            <h3 className="gp-modal__title" id="sousSecteursModalTitle">
              Sous-secteurs — {secteur.lib_secteur}
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
                onClick={() => setFormModal({ mode: 'create', sousSecteur: null })}
              >
                <svg className="ti">
                  <use href="#i-plus" />
                </svg>
                Nouveau sous-secteur
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
              <p>Aucun sous-secteur.</p>
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
                    {displayed.map((sousSecteur) => (
                      <tr
                        key={sousSecteur.code_sous_secteur}
                        {...reorder.dragProps(sousSecteur.code_sous_secteur)}
                        style={{ opacity: reorder.draggedKey === sousSecteur.code_sous_secteur ? 0.5 : undefined }}
                      >
                        <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                          <svg className="ti">
                            <use href="#i-grip-vertical" />
                          </svg>
                        </td>
                        <td>{sousSecteur.lib_sous_secteur}</td>
                        <td>
                          {sousSecteur.actif ? (
                            <span className="gp-badge gp-badge--success">Actif</span>
                          ) : (
                            <span className="gp-badge gp-badge--danger">Inactif</span>
                          )}
                        </td>
                        <td>
                          <div className="gp-rowacts">
                            <span className="gp-tip" data-tip="Modifier le sous-secteur">
                              <button
                                aria-label="Modifier le sous-secteur"
                                onClick={() => setFormModal({ mode: 'edit', sousSecteur })}
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
        <SousSecteurFormModal
          mode={formModal.mode}
          codeSecteur={secteur.code_secteur}
          sousSecteur={formModal.sousSecteur}
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

interface SecteurReorderModalProps {
  idService: number
  secteurs: Secteur[]
  serviceLabel: string
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale de réordonnancement global des secteurs d'UN service (scopé par
 * service côté backend — voir backend/src/services/secteur.service.ts —
 * un même écran ne peut pas mélanger l'ordre de secteurs de services
 * différents). Accessible depuis l'icône « poignée » de n'importe quelle
 * ligne : ouvre toujours la liste du service auquel appartient cette ligne.
 */
function SecteurReorderModal({ idService, secteurs, serviceLabel, onClose, onSaved }: SecteurReorderModalProps) {
  const sorted = [...secteurs].sort((a, b) => a.ordre_secteur - b.ordre_secteur)
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const displayed = optimisticOrder
    ? optimisticOrder.map((code) => sorted.find((s) => s.code_secteur === code)).filter((s): s is Secteur => Boolean(s))
    : sorted

  async function handleReorder(newOrder: string[]) {
    setOptimisticOrder(newOrder)
    setError(null)
    try {
      await api.put('/secteurs/reorder', { idService, codeSecteurs: newOrder })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticOrder(null)
    }
  }

  const reorder = useDragReorder(
    displayed.map((s) => s.code_secteur),
    handleReorder,
  )

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="secteurReorderModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="secteurReorderModalTitle">
            Réordonner les secteurs — {serviceLabel}
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
                {displayed.map((secteur) => (
                  <tr
                    key={secteur.code_secteur}
                    {...reorder.dragProps(secteur.code_secteur)}
                    style={{ opacity: reorder.draggedKey === secteur.code_secteur ? 0.5 : undefined }}
                  >
                    <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                      <svg className="ti">
                        <use href="#i-grip-vertical" />
                      </svg>
                    </td>
                    <td>{secteur.lib_secteur}</td>
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

interface SousSecteurFormModalProps {
  mode: 'create' | 'edit'
  codeSecteur: string
  sousSecteur: SousSecteur | null
  onClose: () => void
  onSaved: () => void
}

function SousSecteurFormModal({ mode, codeSecteur, sousSecteur, onClose, onSaved }: SousSecteurFormModalProps) {
  const [codeSousSecteur, setCodeSousSecteur] = useState(sousSecteur?.code_sous_secteur ?? '')
  const [libSousSecteur, setLibSousSecteur] = useState(sousSecteur?.lib_sous_secteur ?? '')
  const [actif, setActif] = useState(sousSecteur?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { libSousSecteur, actif }
      if (mode === 'create') {
        await api.post(`/secteurs/${codeSecteur}/sous-secteurs`, { codeSousSecteur, ...payload })
      } else if (sousSecteur) {
        await api.put(`/secteurs/${codeSecteur}/sous-secteurs/${sousSecteur.code_sous_secteur}`, payload)
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="sousSecteurModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="sousSecteurModalTitle">
            {mode === 'create' ? 'Nouveau sous-secteur' : 'Modifier le sous-secteur'}
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
                <label className="gp-label" htmlFor="sous-secteur-code">
                  Code
                </label>
                <input
                  id="sous-secteur-code"
                  className="gp-input"
                  value={codeSousSecteur}
                  onChange={(e) => setCodeSousSecteur(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="sous-secteur-lib">
                Libellé
              </label>
              <input
                id="sous-secteur-lib"
                className="gp-input"
                value={libSousSecteur}
                onChange={(e) => setLibSousSecteur(e.target.value)}
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
