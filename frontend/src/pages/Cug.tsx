import { useEffect, useState, type FormEvent } from 'react'
import { useCug, type Cug } from '../hooks/useCug'
import { useServices, type OrgService } from '../hooks/useServices'
import { useDirections, type OrgDirection } from '../hooks/useDirections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
]

function matchesStatusFilter(actif: boolean, filter: string | null): boolean {
  if (filter === null) return true
  return filter === 'active' ? actif : !actif
}

/**
 * Administration du référentiel CUG (Compte Unitaire de Gestion,
 * analytique), montée sur /parametres/cug. Écart CDC signalé le 29/08/2026 :
 * le MOT ne documentait jusqu'ici CUG que via l'import PGI (OP3.1,
 * admin_service) — aucune tâche de gestion manuelle n'existait, contrairement
 * à FOURNISSEUR (import + création manuelle). Cet écran ajoute cette
 * seconde voie, décision actée avec l'utilisateur (à répercuter dans le
 * MOT).
 *
 * Écriture ouverte à ADMIN_APP (transverse) ou ADMIN_SERVICE scopé à son
 * service (`assertManagesService`, voir cug.service.ts) — **pas** de
 * périmètre Demandeur ici, contrairement à FOURNISSEUR : la lecture
 * elle-même est réservée à ces deux rôles (`resolveReadScope` rejette tout
 * autre appelant en 403, pas une simple liste vide).
 *
 * CODE_CUG est directement la clé primaire (clé naturelle, comme
 * SITE/SECTEUR — pas de clé technique séparée comme CELLULE) : non
 * modifiable après création, contrairement à CODE_CELLULE. Le filtre
 * Direction → Service en cascade et la mise en page reproduisent
 * Cellules.tsx ; l'auto-verrouillage ADMIN_SERVICE (filtre + création)
 * reproduit Fournisseurs.tsx.
 */
export function Cug() {
  const { directions } = useDirections()
  const { services } = useServices()
  const { data: currentUser } = useCurrentUser()
  const { cug, loading, refetch } = useCug()

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
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; cug: Cug | null } | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const servicesForFilter =
    filterIdDirection === null ? [] : visibleServices.filter((s) => s.id_direction === Number(filterIdDirection))
  const serviceOptions = servicesForFilter.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const serviceLabel = (idService: number) => services.find((s) => s.id_service === idService)?.libelle_service ?? '—'

  useEffect(() => {
    // ADMIN_SERVICE : verrouille les deux filtres sur son propre périmètre.
    // Fusionné avec la logique de cascade ci-dessous dans le MÊME effet (voir
    // GisementGeographique.tsx pour le pourquoi : les séparer cause une
    // régression où l'effet de cascade efface le service qui vient d'être
    // verrouillé, car il s'exécute avec le filterIdDirection encore null de
    // ce même rendu).
    if (isRestrictedToOwnService && filterIdDirection === null) {
      const ownService = services.find((s) => s.id_service === adminServiceIds[0])
      if (ownService) {
        setFilterIdDirection(String(ownService.id_direction))
        setFilterIdService(String(adminServiceIds[0]))
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
  }, [isRestrictedToOwnService, adminServiceIds.join(','), services, filterIdDirection])

  // Direction ET service obligatoires pour afficher la liste (même système
  // que Cellules.tsx) : pas d'option "Toutes les directions" ni "Tous les
  // services".
  const displayedCug =
    filterIdDirection === null || filterIdService === null
      ? []
      : cug.filter((c) => c.id_service === Number(filterIdService)).filter((c) => matchesStatusFilter(c.actif, statusFilter))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>CUG</h1>
          <p>Comptes unitaires de gestion (imputation analytique), rattachés à un service.</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', cug: null })}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouveau CUG
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
        <div className="gp-field" style={{ maxWidth: 404 }}>
          <label className="gp-label">Statut</label>
          <Combobox
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ maxWidth: 'none' }}
            placeholder="Tous"
            clearLabel="Tous"
            ariaLabel="Filtrer les CUG par statut"
          />
        </div>
      </div>

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
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
                <td colSpan={5}>Chargement…</td>
              </tr>
            )}
            {!loading && displayedCug.length === 0 && (
              <tr>
                <td colSpan={5}>
                  {filterIdDirection === null || filterIdService === null
                    ? 'Sélectionne une direction et un service pour afficher les CUG.'
                    : 'Aucun CUG pour ce filtre.'}
                </td>
              </tr>
            )}
            {displayedCug.map((c) => (
              <tr key={c.code_cug}>
                <td className="mono">{c.code_cug}</td>
                <td>{c.libelle_cug}</td>
                <td>{serviceLabel(c.id_service)}</td>
                <td>
                  {c.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Modifier le CUG">
                      <button aria-label="Modifier le CUG" onClick={() => setModal({ mode: 'edit', cug: c })}>
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

      {modal && (
        <CugFormModal
          mode={modal.mode}
          cug={modal.cug}
          directions={directions}
          services={visibleServices}
          defaultIdService={isRestrictedToOwnService ? (adminServiceIds[0] ?? null) : null}
          lockedToOwnService={isRestrictedToOwnService}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            void refetch()
          }}
        />
      )}
    </div>
  )
}

interface CugFormModalProps {
  mode: 'create' | 'edit'
  cug: Cug | null
  directions: OrgDirection[]
  services: OrgService[]
  defaultIdService: number | null
  /** ADMIN_SERVICE (pas ADMIN_APP) : pas de sélecteur en création, le CUG hérite du service de l'agent connecté. */
  lockedToOwnService: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Création (Direction → Service en cascade pour ADMIN_APP, coordonnées +
 * Actif) ou modification (Libellé + Actif uniquement — CODE_CUG est la clé
 * primaire, non modifiable, contrairement à CODE_CELLULE).
 */
function CugFormModal({
  mode,
  cug,
  directions,
  services,
  defaultIdService,
  lockedToOwnService,
  onClose,
  onSaved,
}: CugFormModalProps) {
  const [idDirection, setIdDirection] = useState<string | null>(null)
  const [idService, setIdService] = useState<string | null>(
    cug?.id_service != null ? String(cug.id_service) : defaultIdService != null ? String(defaultIdService) : null,
  )
  const [codeCug, setCodeCug] = useState(cug?.code_cug ?? '')
  const [libelleCug, setLibelleCug] = useState(cug?.libelle_cug ?? '')
  const [actif, setActif] = useState(cug?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const servicesForDirection = idDirection === null ? [] : services.filter((s) => s.id_direction === Number(idDirection))
  const serviceOptions = servicesForDirection.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const selectedService = idService !== null ? services.find((s) => s.id_service === Number(idService)) : undefined
  const selectedDirection = selectedService
    ? directions.find((d) => d.id_direction === selectedService.id_direction)
    : undefined

  useEffect(() => {
    // lockedToOwnService : idDirection n'est jamais renseigné (pas de combo
    // Direction) — idService reste fixé à defaultIdService pour toute la vie
    // de la modale, cet effet ne doit pas y toucher (voir Fournisseurs.tsx
    // pour le pourquoi : sinon il l'efface dès le montage).
    if (mode !== 'create' || lockedToOwnService || idService === null) return
    if (!servicesForDirection.some((s) => s.id_service === Number(idService))) setIdService(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDirection])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'create' && !lockedToOwnService && !idDirection) {
      setError('La direction est obligatoire.')
      return
    }
    if (!idService) {
      setError('Le service est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'create') {
        await api.post('/cug', { codeCug, libelleCug, idService: Number(idService), actif })
      } else if (cug) {
        await api.put(`/cug/${cug.code_cug}`, { libelleCug, actif })
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="cugModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="cugModalTitle">
            {mode === 'create' ? 'Nouveau CUG' : 'Modifier le CUG'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            {(mode === 'edit' || (mode === 'create' && lockedToOwnService)) && (
              <p className="gp-help">
                Direction : {selectedDirection?.libelle_direction ?? '—'}
                <br />
                Service : {selectedService?.libelle_service ?? '—'}
              </p>
            )}
            {mode === 'create' && !lockedToOwnService && (
              <div className="gp-field">
                <label className="gp-label">Direction</label>
                <Combobox
                  options={directionOptions}
                  value={idDirection}
                  onChange={setIdDirection}
                  placeholder="Choisir une direction…"
                  ariaLabel="Direction"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            )}
            {mode === 'create' && !lockedToOwnService && idDirection !== null && (
              <div className="gp-field">
                <label className="gp-label">Service</label>
                <Combobox
                  options={serviceOptions}
                  value={idService}
                  onChange={setIdService}
                  placeholder="Choisir un service…"
                  ariaLabel="Service"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            )}
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label" htmlFor="cug-code">
                  Code
                </label>
                <input
                  id="cug-code"
                  className="gp-input"
                  value={codeCug}
                  onChange={(e) => setCodeCug(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="cug-lib">
                Libellé
              </label>
              <input
                id="cug-lib"
                className="gp-input"
                value={libelleCug}
                onChange={(e) => setLibelleCug(e.target.value)}
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
