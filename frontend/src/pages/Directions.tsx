import { useState, type FormEvent } from 'react'
import { useDirections, type OrgDirection } from '../hooks/useDirections'
import { api, ApiError } from '../services/api'

/**
 * Administration du référentiel organisationnel DIRECTION, montée sur
 * /parametres/directions. Écriture réservée ADMIN_APP (contrôle réel côté
 * backend, requireRole('ADMIN_APP') sur POST/PUT /api/directions — voir
 * backend/src/services/organisation.service.ts) ; cet écran n'essaie pas de
 * deviner les droits de l'utilisateur pour masquer les actions, seul le
 * backend fait foi (voir ForClaude/SECURITY.md §2) — l'entrée de menu qui y
 * mène est en revanche réservée à ADMIN_APP (voir config/navigation.ts).
 *
 * Pas de filtre ni de vue maître-détail ici (contrairement à
 * GisementGeographique/Technique) : DIRECTION est le sommet de la hiérarchie
 * organisationnelle, une simple liste plate suffit. CODE_DIRECTION est une
 * clé métier UNIQUE mutable (pas la PK — voir
 * ForClaude/CDC/mld-phases-1-2.md §2.1), donc éditable en modification,
 * contrairement au code d'un SITE.
 */
export function Directions() {
  const { directions, loading, refetch } = useDirections()
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; direction: OrgDirection | null } | null>(null)

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Directions</h1>
          <p>Référentiel organisationnel — sommet de la hiérarchie Direction / Service / Cellule.</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', direction: null })}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouvelle direction
          </button>
        </div>
      </div>

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3}>Chargement…</td>
              </tr>
            )}
            {!loading && directions.length === 0 && (
              <tr>
                <td colSpan={3}>Aucune direction.</td>
              </tr>
            )}
            {directions.map((direction) => (
              <tr key={direction.id_direction}>
                <td className="mono">{direction.code_direction}</td>
                <td>{direction.libelle_direction}</td>
                <td>
                  <div className="gp-rowacts">
                    <button aria-label="Modifier" onClick={() => setModal({ mode: 'edit', direction })}>
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
        <DirectionFormModal
          mode={modal.mode}
          direction={modal.direction}
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

interface DirectionFormModalProps {
  mode: 'create' | 'edit'
  direction: OrgDirection | null
  onClose: () => void
  onSaved: () => void
}

function DirectionFormModal({ mode, direction, onClose, onSaved }: DirectionFormModalProps) {
  const [codeDirection, setCodeDirection] = useState(direction?.code_direction ?? '')
  const [libelleDirection, setLibelleDirection] = useState(direction?.libelle_direction ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { codeDirection, libelleDirection }
      if (mode === 'create') {
        await api.post('/directions', payload)
      } else if (direction) {
        await api.put(`/directions/${direction.id_direction}`, payload)
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="directionModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="directionModalTitle">
            {mode === 'create' ? 'Nouvelle direction' : 'Modifier la direction'}
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
              <label className="gp-label" htmlFor="direction-code">
                Code
              </label>
              <input
                id="direction-code"
                className="gp-input"
                value={codeDirection}
                onChange={(e) => setCodeDirection(e.target.value)}
                required
                maxLength={20}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="direction-lib">
                Libellé
              </label>
              <input
                id="direction-lib"
                className="gp-input"
                value={libelleDirection}
                onChange={(e) => setLibelleDirection(e.target.value)}
                required
                maxLength={200}
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
