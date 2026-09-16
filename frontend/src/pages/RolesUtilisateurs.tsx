import { useState, type FormEvent } from 'react'
import { useRoleAttributions, type RoleAttribution, type TypeRole } from '../hooks/useRoleAttributions'
import { useAllActeurs } from '../hooks/useAllActeurs'
import { useCellules, type OrgCellule } from '../hooks/useCellules'
import { useServices, type OrgService } from '../hooks/useServices'
import { useDirections, type OrgDirection } from '../hooks/useDirections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useColumnSort, sortRows } from '../hooks/useColumnSort'
import { Combobox } from '../components/Combobox'
import { SortableTh } from '../components/SortableTh'
import { api, ApiError } from '../services/api'

type RoleColumn = 'utilisateur' | 'typeRole' | 'perimetre' | 'direction'

const TYPE_ROLE_LABELS: Record<TypeRole, string> = {
  RC: 'RC (cellule)',
  CDS: 'CDS (service)',
  CB: 'CB (service)',
  ADMIN_SERVICE: 'Administrateur du service',
  DS: 'DS (direction)',
  ADMIN_APP: 'Administrateur applicatif',
}

/** ADMIN_SERVICE ne peut attribuer que les rôles de son propre service — DS/ADMIN_APP réservés ADMIN_APP (décision du 10/09/2026, résout le point ouvert MOT §92). */
const SERVICE_SCOPED_ROLES: TypeRole[] = ['RC', 'CDS', 'CB', 'ADMIN_SERVICE']

/**
 * Direction rattachée à une attribution, quel que soit le niveau de son
 * périmètre — remonte via CELLULE → SERVICE → DIRECTION (RC) ou
 * SERVICE → DIRECTION (CDS/CB/ADMIN_SERVICE) ; directe pour DS ; '—' pour
 * ADMIN_APP (transverse, aucune direction). Distinct de `perimeterLabel`
 * (qui affiche le libellé du périmètre exact — cellule/service/direction —
 * pas nécessairement la direction elle-même).
 */
function resolveDirectionLabel(
  attribution: RoleAttribution,
  cellules: OrgCellule[],
  services: OrgService[],
  directions: OrgDirection[],
): string {
  let idDirection = attribution.idDirection

  if (idDirection === null && attribution.idService !== null) {
    idDirection = services.find((s) => s.id_service === attribution.idService)?.id_direction ?? null
  }

  if (idDirection === null && attribution.idCellule !== null) {
    const cellule = cellules.find((c) => c.id_cellule === attribution.idCellule)
    const service = cellule ? services.find((s) => s.id_service === cellule.id_service) : undefined
    idDirection = service?.id_direction ?? null
  }

  if (idDirection === null) return '—'
  return directions.find((d) => d.id_direction === idDirection)?.libelle_direction ?? '—'
}

/**
 * Attribution / clôture des rôles applicatifs (finances.role_attribution),
 * montée sur /parametres/roles — accessible à ADMIN_APP (transverse) et
 * ADMIN_SERVICE (scopé à son propre service, RC/CDS/CB/ADMIN_SERVICE
 * uniquement). Contrôle réel côté backend (roleAttribution.service.ts) ;
 * cet écran adapte seulement les options proposées selon le rôle courant,
 * comme Reglages.tsx pour ADMIN_APP.
 */
export function RolesUtilisateurs() {
  const { data: currentUser } = useCurrentUser()
  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const { attributions, loading, refetch } = useRoleAttributions()
  const { cellules } = useCellules()
  const { services } = useServices()
  const { directions } = useDirections()
  const { sort, toggleSort } = useColumnSort<RoleColumn>()
  const displayedAttributions = sortRows(attributions, sort, (a, column) => {
    if (column === 'utilisateur') return a.nom && a.prenom ? `${a.prenom} ${a.nom}` : a.matricule
    if (column === 'typeRole') return TYPE_ROLE_LABELS[a.typeRole]
    if (column === 'perimetre') return a.perimeterLabel ?? '—'
    return resolveDirectionLabel(a, cellules, services, directions)
  })
  const [modal, setModal] = useState(false)
  const [attributionToClose, setAttributionToClose] = useState<{ idRole: number; label: string } | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  async function confirmClose() {
    if (!attributionToClose) return
    setCloseError(null)
    setClosing(true)
    try {
      await api.put(`/role-attributions/${attributionToClose.idRole}/desactiver`, {})
      setAttributionToClose(null)
      await refetch()
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Rôles</h1>
          <p>Attribution des rôles applicatifs (RC, CDS, CB, DS, administrateurs).</p>
        </div>
        <div className="page-actions">
          <button className="gp-btn gp-btn--primary" onClick={() => setModal(true)}>
            <svg className="ti">
              <use href="#i-plus" />
            </svg>
            Nouvelle attribution
          </button>
        </div>
      </div>

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <SortableTh
                label="Utilisateur"
                column="utilisateur"
                sort={sort}
                onSort={toggleSort}
                style={{ width: '15%', overflow: 'hidden', textOverflow: 'ellipsis' }}
              />
              <SortableTh
                label="Rôle"
                column="typeRole"
                sort={sort}
                onSort={toggleSort}
                style={{ width: '14%', overflow: 'hidden', textOverflow: 'ellipsis' }}
              />
              <SortableTh label="Périmètre" column="perimetre" sort={sort} onSort={toggleSort} style={{ width: '24%' }} />
              <SortableTh label="Direction" column="direction" sort={sort} onSort={toggleSort} style={{ width: '24%' }} />
              <th style={{ width: '9%', overflow: 'hidden', textOverflow: 'ellipsis' }}>Depuis</th>
              <th style={{ width: 53 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>Chargement…</td>
              </tr>
            )}
            {!loading && attributions.length === 0 && (
              <tr>
                <td colSpan={6}>Aucune attribution active.</td>
              </tr>
            )}
            {displayedAttributions.map((a) => (
              <tr key={a.idRole}>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.nom && a.prenom ? `${a.prenom} ${a.nom}` : a.matricule} <span className="mono">({a.matricule})</span>
                </td>
                <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{TYPE_ROLE_LABELS[a.typeRole]}</td>
                <td>{a.perimeterLabel ?? '—'}</td>
                <td>{resolveDirectionLabel(a, cellules, services, directions)}</td>
                <td className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {new Date(a.dateDebut).toLocaleDateString('fr-FR')}
                </td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip="Clôturer l'attribution">
                      <button
                        aria-label="Clôturer l'attribution"
                        onClick={() =>
                          setAttributionToClose({
                            idRole: a.idRole,
                            label: `${TYPE_ROLE_LABELS[a.typeRole]} — ${a.nom ?? a.matricule}`,
                          })
                        }
                      >
                        <svg className="ti">
                          <use href="#i-x" />
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
        <RoleAttributionFormModal
          isAdminApp={isAdminApp}
          onClose={() => setModal(false)}
          onSaved={() => void refetch()}
        />
      )}

      {attributionToClose && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="closeRoleModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="closeRoleModalTitle">
                Clôturer l'attribution
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setAttributionToClose(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>Clôturer « {attributionToClose.label} » ? Le titulaire perd immédiatement ce rôle.</p>
              {closeError && (
                <p className="gp-errmsg">
                  <svg className="ti">
                    <use href="#i-alert-circle" />
                  </svg>
                  {closeError}
                </p>
              )}
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setAttributionToClose(null)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" onClick={confirmClose} disabled={closing}>
                {closing ? 'Clôture…' : 'Clôturer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface RoleAttributionFormModalProps {
  isAdminApp: boolean
  onClose: () => void
  onSaved: () => void
}

function RoleAttributionFormModal({ isAdminApp, onClose, onSaved }: RoleAttributionFormModalProps) {
  const { acteurs } = useAllActeurs()
  const { cellules } = useCellules()
  const { services } = useServices()
  const { directions } = useDirections()

  const availableRoles: TypeRole[] = isAdminApp
    ? ['RC', 'CDS', 'CB', 'ADMIN_SERVICE', 'DS', 'ADMIN_APP']
    : SERVICE_SCOPED_ROLES

  const [matricule, setMatricule] = useState<string | null>(null)
  const [typeRole, setTypeRole] = useState<TypeRole | null>(null)
  const [idCellule, setIdCellule] = useState<string | null>(null)
  const [idService, setIdService] = useState<string | null>(null)
  const [idDirection, setIdDirection] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!matricule || !typeRole) {
      setError('Choisissez un utilisateur et un rôle.')
      return
    }
    if (typeRole === 'RC' && !idCellule) {
      setError('Choisissez une cellule.')
      return
    }
    if ((typeRole === 'CDS' || typeRole === 'CB' || typeRole === 'ADMIN_SERVICE') && !idService) {
      setError('Choisissez un service.')
      return
    }
    if (typeRole === 'DS' && !idDirection) {
      setError('Choisissez une direction.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/role-attributions', {
        matricule,
        typeRole,
        idCellule: typeRole === 'RC' ? Number(idCellule) : undefined,
        idService: typeRole === 'CDS' || typeRole === 'CB' || typeRole === 'ADMIN_SERVICE' ? Number(idService) : undefined,
        idDirection: typeRole === 'DS' ? Number(idDirection) : undefined,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="roleModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="roleModalTitle">
            Nouvelle attribution
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="gp-field">
              <label className="gp-label">Utilisateur</label>
              <Combobox
                options={acteurs.map((a) => ({ value: a.matricule, label: `${a.prenom} ${a.nom} (${a.matricule})` }))}
                value={matricule}
                onChange={setMatricule}
                placeholder="Choisir un utilisateur…"
                ariaLabel="Utilisateur"
                style={{ maxWidth: 'none' }}
              />
            </div>
            <div className="gp-field">
              <label className="gp-label">Rôle</label>
              <Combobox
                options={availableRoles.map((r) => ({ value: r, label: TYPE_ROLE_LABELS[r] }))}
                value={typeRole}
                onChange={(v) => setTypeRole(v as TypeRole | null)}
                placeholder="Choisir un rôle…"
                ariaLabel="Rôle"
                style={{ maxWidth: 'none' }}
              />
            </div>
            {typeRole === 'RC' && (
              <div className="gp-field">
                <label className="gp-label">Cellule</label>
                <Combobox
                  options={cellules.map((c) => ({ value: String(c.id_cellule), label: c.libelle_cellule }))}
                  value={idCellule}
                  onChange={setIdCellule}
                  placeholder="Choisir une cellule…"
                  ariaLabel="Cellule"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            )}
            {(typeRole === 'CDS' || typeRole === 'CB' || typeRole === 'ADMIN_SERVICE') && (
              <div className="gp-field">
                <label className="gp-label">Service</label>
                <Combobox
                  options={services.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))}
                  value={idService}
                  onChange={setIdService}
                  placeholder="Choisir un service…"
                  ariaLabel="Service"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            )}
            {typeRole === 'DS' && (
              <div className="gp-field">
                <label className="gp-label">Direction</label>
                <Combobox
                  options={directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))}
                  value={idDirection}
                  onChange={setIdDirection}
                  placeholder="Choisir une direction…"
                  ariaLabel="Direction"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            )}
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
