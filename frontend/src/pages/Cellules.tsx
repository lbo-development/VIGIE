import { useEffect, useState, type FormEvent } from 'react'
import { useCellules, type OrgCellule } from '../hooks/useCellules'
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
 * Administration du référentiel organisationnel CELLULE, montée sur
 * /parametres/cellules. Écriture réservée ADMIN_APP (contrôle réel côté
 * backend, requireRole('ADMIN_APP') sur POST/PUT /api/cellules — voir
 * backend/src/services/organisation.service.ts) ; cet écran n'essaie pas de
 * deviner les droits de l'utilisateur pour masquer les actions, seul le
 * backend fait foi (voir ForClaude/SECURITY.md §2) — l'entrée de menu qui y
 * mène est en revanche réservée à ADMIN_APP (voir config/navigation.ts).
 *
 * Liste plate filtrable par service (pas de vue maître-détail : CELLULE n'a
 * qu'un parent, pas d'enfant géré ici — ACTEUR, rattaché à CELLULE, n'est pas
 * dans le périmètre de cet écran). CODE_CELLULE est une clé métier UNIQUE
 * mutable (pas la PK — voir ForClaude/CDC/mld-phases-1-2.md §2.1), donc
 * éditable en modification, contrairement au code d'un SITE.
 *
 * Direction ET service obligatoires pour afficher la liste (décision
 * utilisateur, comme SeuilsValidationDs.tsx) : pas d'option "Toutes les
 * directions" ni "Tous les services" — la combo Service reste en cascade
 * (masquée tant qu'aucune direction n'est choisie, filtrée à celle-ci).
 */
export function Cellules() {
  const { directions } = useDirections()
  const { services } = useServices()
  const { cellules, loading, refetch } = useCellules()
  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [filterIdService, setFilterIdService] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; cellule: OrgCellule | null } | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))

  // Filtre en cascade : la combo Service ne propose que les services de la
  // direction sélectionnée (ou tous si aucune direction n'est choisie).
  const servicesForFilter =
    filterIdDirection === null
      ? services
      : services.filter((s) => s.id_direction === Number(filterIdDirection))
  const serviceOptions = servicesForFilter.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const serviceLabel = (idService: number) => services.find((s) => s.id_service === idService)?.libelle_service ?? '—'

  useEffect(() => {
    // "Toutes les directions" : pas de filtre Service possible (le champ est
    // masqué — voir JSX) — on efface toute sélection résiduelle. Changement
    // vers une direction précise : le service sélectionné peut ne plus lui
    // appartenir — on retombe sur "Tous les services" plutôt que de garder un
    // filtre incohérent.
    if (filterIdDirection === null) {
      setFilterIdService(null)
      return
    }
    if (filterIdService === null) return
    const stillValid = servicesForFilter.some((s) => s.id_service === Number(filterIdService))
    if (!stillValid) setFilterIdService(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterIdDirection])

  // Direction ET service obligatoires pour afficher la liste (décision
  // utilisateur, comme SeuilsValidationDs.tsx) : pas d'option "Toutes les
  // directions" ni "Tous les services".
  const displayedCellules =
    filterIdDirection === null || filterIdService === null
      ? []
      : cellules
          .filter((c) => c.id_service === Number(filterIdService))
          .filter((c) => matchesStatusFilter(c.actif, statusFilter))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Cellules</h1>
          <p>Référentiel organisationnel — rattachées à un service.</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', cellule: null })}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouvelle cellule
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
            ariaLabel="Filtrer les cellules par statut"
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
            {!loading && displayedCellules.length === 0 && (
              <tr>
                <td colSpan={5}>
                  {filterIdDirection === null || filterIdService === null
                    ? 'Sélectionne une direction et un service pour afficher les cellules.'
                    : 'Aucune cellule pour ce filtre.'}
                </td>
              </tr>
            )}
            {displayedCellules.map((cellule) => (
              <tr key={cellule.id_cellule}>
                <td className="mono">{cellule.code_cellule}</td>
                <td>{cellule.libelle_cellule}</td>
                <td>{serviceLabel(cellule.id_service)}</td>
                <td>
                  {cellule.actif ? (
                    <span className="gp-badge gp-badge--success">Actif</span>
                  ) : (
                    <span className="gp-badge gp-badge--danger">Inactif</span>
                  )}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Modifier la cellule">
                      <button aria-label="Modifier la cellule" onClick={() => setModal({ mode: 'edit', cellule })}>
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
        <CelluleFormModal
          mode={modal.mode}
          cellule={modal.cellule}
          directions={directions}
          services={services}
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

interface CelluleFormModalProps {
  mode: 'create' | 'edit'
  cellule: OrgCellule | null
  directions: OrgDirection[]
  services: OrgService[]
  onClose: () => void
  onSaved: () => void
}

/**
 * À la création, la Direction n'est pas un champ de la cellule (celle-ci ne
 * connaît que son SERVICE) — elle sert uniquement à filtrer la combo Service
 * en cascade, pour imposer l'ordre de sélection Direction → Service (décision
 * utilisateur). En modification, la cellule a déjà un service : pas de
 * cascade, la combo Service liste tout directement (comme avant).
 */
function CelluleFormModal({ mode, cellule, directions, services, onClose, onSaved }: CelluleFormModalProps) {
  const [codeCellule, setCodeCellule] = useState(cellule?.code_cellule ?? '')
  const [libelleCellule, setLibelleCellule] = useState(cellule?.libelle_cellule ?? '')
  const [idDirection, setIdDirection] = useState<string | null>(null)
  const [idService, setIdService] = useState<string | null>(
    cellule?.id_service != null ? String(cellule.id_service) : null,
  )
  const [actif, setActif] = useState(cellule?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))
  const servicesForDirection = idDirection === null ? [] : services.filter((s) => s.id_direction === Number(idDirection))
  const serviceOptions = (mode === 'create' ? servicesForDirection : services).map((s) => ({
    value: String(s.id_service),
    label: s.libelle_service,
  }))

  useEffect(() => {
    // Changement de direction (création) : le service déjà choisi peut ne
    // plus lui appartenir.
    if (mode !== 'create' || idService === null) return
    if (!servicesForDirection.some((s) => s.id_service === Number(idService))) setIdService(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDirection])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'create' && !idDirection) {
      setError('La direction est obligatoire.')
      return
    }
    if (!idService) {
      setError('Le service est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      const payload = { codeCellule, libelleCellule, idService: Number(idService), actif }
      if (mode === 'create') {
        await api.post('/cellules', payload)
      } else if (cellule) {
        await api.put(`/cellules/${cellule.id_cellule}`, payload)
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="celluleModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="celluleModalTitle">
            {mode === 'create' ? 'Nouvelle cellule' : 'Modifier la cellule'}
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
            {(mode === 'edit' || idDirection !== null) && (
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
            <div className="gp-field">
              <label className="gp-label" htmlFor="cellule-code">
                Code
              </label>
              <input
                id="cellule-code"
                className="gp-input"
                value={codeCellule}
                onChange={(e) => setCodeCellule(e.target.value)}
                required
                maxLength={20}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="cellule-lib">
                Libellé
              </label>
              <input
                id="cellule-lib"
                className="gp-input"
                value={libelleCellule}
                onChange={(e) => setLibelleCellule(e.target.value)}
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
