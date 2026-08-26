import { useState, type FormEvent } from 'react'
import { useCellules, type OrgCellule } from '../hooks/useCellules'
import { useServices, type OrgService } from '../hooks/useServices'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

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
 */
export function Cellules() {
  const { services } = useServices()
  const { cellules, loading, refetch } = useCellules()
  const [filterIdService, setFilterIdService] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; cellule: OrgCellule | null } | null>(null)

  const serviceOptions = services.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const serviceLabel = (idService: number) => services.find((s) => s.id_service === idService)?.libelle_service ?? '—'

  const displayedCellules =
    filterIdService === null ? cellules : cellules.filter((c) => c.id_service === Number(filterIdService))

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

      <div className="gp-field" style={{ maxWidth: 340 }}>
        <label className="gp-label">Service</label>
        <Combobox
          options={serviceOptions}
          value={filterIdService}
          onChange={setFilterIdService}
          placeholder="Tous les services"
          clearLabel="Tous les services"
          ariaLabel="Filtrer par service"
        />
      </div>

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Service</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>Chargement…</td>
              </tr>
            )}
            {!loading && displayedCellules.length === 0 && (
              <tr>
                <td colSpan={4}>Aucune cellule.</td>
              </tr>
            )}
            {displayedCellules.map((cellule) => (
              <tr key={cellule.id_cellule}>
                <td className="mono">{cellule.code_cellule}</td>
                <td>{cellule.libelle_cellule}</td>
                <td>{serviceLabel(cellule.id_service)}</td>
                <td>
                  <div className="gp-rowacts">
                    <button aria-label="Modifier" onClick={() => setModal({ mode: 'edit', cellule })}>
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

      {modal && (
        <CelluleFormModal
          mode={modal.mode}
          cellule={modal.cellule}
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
  services: OrgService[]
  onClose: () => void
  onSaved: () => void
}

function CelluleFormModal({ mode, cellule, services, onClose, onSaved }: CelluleFormModalProps) {
  const [codeCellule, setCodeCellule] = useState(cellule?.code_cellule ?? '')
  const [libelleCellule, setLibelleCellule] = useState(cellule?.libelle_cellule ?? '')
  const [idService, setIdService] = useState<string | null>(
    cellule?.id_service != null ? String(cellule.id_service) : null,
  )
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
      const payload = { codeCellule, libelleCellule, idService: Number(idService) }
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
