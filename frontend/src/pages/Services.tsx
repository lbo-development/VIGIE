import { useState, type FormEvent } from 'react'
import { useServices, type OrgService } from '../hooks/useServices'
import { useDirections, type OrgDirection } from '../hooks/useDirections'
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
 * Administration du référentiel organisationnel SERVICE, montée sur
 * /parametres/services. Écriture réservée ADMIN_APP (contrôle réel côté
 * backend, requireRole('ADMIN_APP') sur POST/PUT /api/services — voir
 * backend/src/services/organisation.service.ts) ; cet écran n'essaie pas de
 * deviner les droits de l'utilisateur pour masquer les actions, seul le
 * backend fait foi (voir ForClaude/SECURITY.md §2) — l'entrée de menu qui y
 * mène est en revanche réservée à ADMIN_APP (voir config/navigation.ts).
 *
 * Liste plate filtrable par direction (pas de vue maître-détail : SERVICE
 * n'a qu'un parent, pas d'enfant géré ici). CODE_SERVICE est une clé métier
 * UNIQUE mutable (pas la PK — voir ForClaude/CDC/mld-phases-1-2.md §2.1),
 * donc éditable en modification, contrairement au code d'un SITE.
 */
export function Services() {
  const { directions } = useDirections()
  const { services, loading, refetch } = useServices()
  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; service: OrgService | null } | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const directionLabel = (idDirection: number) =>
    directions.find((d) => d.id_direction === idDirection)?.libelle_direction ?? '—'

  // Direction obligatoire pour afficher la liste (décision utilisateur, comme
  // SeuilsValidationDs.tsx) : pas d'option "Toutes les directions".
  const displayedServices =
    filterIdDirection === null
      ? []
      : services
          .filter((s) => s.id_direction === Number(filterIdDirection))
          .filter((s) => matchesStatusFilter(s.actif, statusFilter))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Services</h1>
          <p>Référentiel organisationnel — rattachés à une direction.</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', service: null })}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouveau service
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
        <div className="gp-field" style={{ maxWidth: 404 }}>
          <label className="gp-label">Statut</label>
          <Combobox
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Tous"
            clearLabel="Tous"
            ariaLabel="Filtrer les services par statut"
            style={{ maxWidth: 'none' }}
          />
        </div>
      </div>

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Direction</th>
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
            {!loading && displayedServices.length === 0 && (
              <tr>
                <td colSpan={5}>
                  {filterIdDirection === null
                    ? 'Sélectionne une direction pour afficher les services.'
                    : 'Aucun service pour ce filtre.'}
                </td>
              </tr>
            )}
            {displayedServices.map((service) => (
              <tr key={service.id_service}>
                <td className="mono">{service.code_service}</td>
                <td>{service.libelle_service}</td>
                <td>{directionLabel(service.id_direction)}</td>
                <td>
                  {service.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Modifier le service">
                      <button aria-label="Modifier le service" onClick={() => setModal({ mode: 'edit', service })}>
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
        <ServiceFormModal
          mode={modal.mode}
          service={modal.service}
          directions={directions}
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

interface ServiceFormModalProps {
  mode: 'create' | 'edit'
  service: OrgService | null
  directions: OrgDirection[]
  onClose: () => void
  onSaved: () => void
}

function ServiceFormModal({ mode, service, directions, onClose, onSaved }: ServiceFormModalProps) {
  const [codeService, setCodeService] = useState(service?.code_service ?? '')
  const [libelleService, setLibelleService] = useState(service?.libelle_service ?? '')
  const [idDirection, setIdDirection] = useState<string | null>(
    service?.id_direction != null ? String(service.id_direction) : null,
  )
  const [actif, setActif] = useState(service?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'create' && !idDirection) {
      setError('La direction est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      const payload =
        mode === 'create'
          ? { codeService, libelleService, idDirection: Number(idDirection), actif }
          : { codeService, libelleService, actif }
      if (mode === 'create') {
        await api.post('/services', payload)
      } else if (service) {
        await api.put(`/services/${service.id_service}`, payload)
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="serviceModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="serviceModalTitle">
            {mode === 'create' ? 'Nouveau service' : 'Modifier le service'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="gp-field">
              <label className="gp-label" htmlFor="service-code">
                Code
              </label>
              <input
                id="service-code"
                className="gp-input"
                value={codeService}
                onChange={(e) => setCodeService(e.target.value)}
                required
                maxLength={20}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="service-lib">
                Libellé
              </label>
              <input
                id="service-lib"
                className="gp-input"
                value={libelleService}
                onChange={(e) => setLibelleService(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label">Direction</label>
                <Combobox
                  options={directionOptions}
                  value={idDirection}
                  onChange={setIdDirection}
                  placeholder="Choisir une direction…"
                  ariaLabel="Direction"
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
