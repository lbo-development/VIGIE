import { useState, type FormEvent } from 'react'
import { useParametreKeys, useParametreRows, type ParametreKey, type ParametreRow } from '../hooks/useParametreAdmin'
import { useServices, type OrgService } from '../hooks/useServices'
import { useDirections, type OrgDirection } from '../hooks/useDirections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

/** Le seul paramètre enregistré à ce jour est un entier : filtre tout caractère non chiffre, y compris virgule/point/signe — jamais de `type="number"` natif (spin buttons non désirés ici, voir GUIDELINES.md sur les composants à ne pas réinventer). */
function sanitizeInteger(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

/**
 * Administration des paramètres applicatifs (finances.parametre_application),
 * montée sur /parametres/reglages — voir docs/ARCHITECTURE.md "Paramétrage
 * applicatif". Écriture réservée ADMIN_APP (contrôle réel côté backend,
 * requireRole('ADMIN_APP') sur PUT /api/parametres/:cle et GET .../rows) —
 * "Nouvelle valeur" et la colonne "Actions" (modifier une ligne existante)
 * ne s'affichent donc que pour ADMIN_APP côté écran, en plus de ce contrôle
 * serveur (décision du 29/08/2026 : mieux vaut ne pas montrer une action
 * inopérante que la montrer désactivée).
 *
 * Limite connue : le champ "Valeur" est un simple input numérique — le seul
 * paramètre enregistré à ce jour (auth.inactivite_delai_minutes) est un
 * entier. Si un paramètre non numérique est ajouté au registre
 * (backend/src/services/parametres.service.ts), ce formulaire devra évoluer
 * (type de champ dépendant du paramètre choisi).
 */
export function Reglages() {
  const { keys } = useParametreKeys()
  const { services } = useServices()
  const { directions } = useDirections()
  const { data: currentUser } = useCurrentUser()
  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const [selectedCle, setSelectedCle] = useState<string | null>(null)
  const { rows, loading, error, refetch } = useParametreRows(selectedCle)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: ParametreRow | null } | null>(null)

  const selectedKey = keys.find((k) => k.cle === selectedCle) ?? null

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Réglages</h1>
          <p>Paramètres applicatifs modifiables sans déploiement, portée globale, par direction ou par service.</p>
        </div>
      </div>

      <div className="gp-field" style={{ maxWidth: 600 }}>
        <label className="gp-label">Paramètre</label>
        <Combobox
          options={keys.map((k) => ({ value: k.cle, label: k.libelle }))}
          value={selectedCle}
          onChange={setSelectedCle}
          style={{ maxWidth: 'none' }}
          placeholder="Choisir un paramètre…"
          ariaLabel="Paramètre"
        />
      </div>

      {selectedKey && (
        <>
          {isAdminApp && (
            <div className="page-actions">
              <button className="gp-btn gp-btn--primary" onClick={() => setModal({ mode: 'create', row: null })}>
                <svg className="ti">
                  <use href="#i-plus" />
                </svg>
                Nouvelle valeur
              </button>
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

          <div className="gp-table-wrap gp-scroll">
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Portée</th>
                  <th>Valeur</th>
                  <th>Dernière mise à jour</th>
                  <th>Par</th>
                  {isAdminApp && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={isAdminApp ? 5 : 4}>Chargement…</td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={isAdminApp ? 5 : 4}>
                      Aucune valeur définie — valeur par défaut ({JSON.stringify(selectedKey.defaut)}) appliquée
                      partout.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id_parametre}>
                    <td>{scopeLabel(row, services, directions)}</td>
                    <td className="mono">{JSON.stringify(row.valeur)}</td>
                    <td className="mono">{new Date(row.date_maj).toLocaleString('fr-FR')}</td>
                    <td className="mono">{row.matricule_maj ?? '—'}</td>
                    {isAdminApp && (
                      <td>
                        <div className="gp-rowacts">
                          <span className="gp-tip" data-tip="Modifier la valeur">
                            <button aria-label="Modifier la valeur" onClick={() => setModal({ mode: 'edit', row })}>
                              <svg className="ti">
                                <use href="#i-pencil" />
                              </svg>
                            </button>
                          </span>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && selectedKey && (
        <ParametreFormModal
          mode={modal.mode}
          row={modal.row}
          parametreKey={selectedKey}
          services={services}
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

function scopeLabel(row: ParametreRow, services: OrgService[], directions: OrgDirection[]) {
  if (row.id_service != null) {
    const service = services.find((s) => s.id_service === row.id_service)
    return `Service — ${service?.libelle_service ?? row.id_service}`
  }
  if (row.id_direction != null) {
    const direction = directions.find((d) => d.id_direction === row.id_direction)
    return `Direction — ${direction?.libelle_direction ?? row.id_direction}`
  }
  return 'Global'
}

interface ParametreFormModalProps {
  mode: 'create' | 'edit'
  row: ParametreRow | null
  parametreKey: ParametreKey
  services: OrgService[]
  directions: OrgDirection[]
  onClose: () => void
  onSaved: () => void
}

/**
 * Création (sélecteur de portée Global/Direction/Service) ou modification
 * d'une ligne existante (portée fixe, reprise de `row` — on ne change pas la
 * portée d'une valeur existante, seulement sa valeur).
 */
function ParametreFormModal({ mode, row, parametreKey, services, directions, onClose, onSaved }: ParametreFormModalProps) {
  const [scope, setScope] = useState<string | null>('global')
  const [idDirection, setIdDirection] = useState<string | null>(null)
  const [idService, setIdService] = useState<string | null>(null)
  const [valeur, setValeur] = useState(String(row ? row.valeur : parametreKey.defaut))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scopeOptions = [
    { value: 'global', label: 'Global' },
    { value: 'direction', label: 'Par direction' },
    { value: 'service', label: 'Par service' },
  ]

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'create' && scope === 'direction' && !idDirection) {
      setError('Choisis une direction.')
      return
    }
    if (mode === 'create' && scope === 'service' && !idService) {
      setError('Choisis un service.')
      return
    }

    setSubmitting(true)
    try {
      await api.put(`/parametres/${encodeURIComponent(parametreKey.cle)}`, {
        valeur: Number(valeur),
        idDirection: mode === 'edit' ? row?.id_direction ?? null : scope === 'direction' ? Number(idDirection) : null,
        idService: mode === 'edit' ? row?.id_service ?? null : scope === 'service' ? Number(idService) : null,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="parametreModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="parametreModalTitle">
            {mode === 'create' ? 'Nouvelle valeur' : 'Modifier la valeur'} — {parametreKey.libelle}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            {mode === 'edit' && row && (
              <p className="gp-help">Portée : {scopeLabel(row, services, directions)}</p>
            )}
            {mode === 'create' && (
              <div className="gp-field">
                <label className="gp-label">Portée</label>
                <Combobox options={scopeOptions} value={scope} onChange={setScope} placeholder="Choisir…" ariaLabel="Portée" />
              </div>
            )}
            {mode === 'create' && scope === 'direction' && (
              <div className="gp-field">
                <label className="gp-label">Direction</label>
                <Combobox
                  options={directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))}
                  value={idDirection}
                  onChange={setIdDirection}
                  placeholder="Choisir une direction…"
                  ariaLabel="Direction"
                />
              </div>
            )}
            {mode === 'create' && scope === 'service' && (
              <div className="gp-field">
                <label className="gp-label">Service</label>
                <Combobox
                  options={services.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))}
                  value={idService}
                  onChange={setIdService}
                  placeholder="Choisir un service…"
                  ariaLabel="Service"
                />
              </div>
            )}
            <div className="gp-field">
              <label className="gp-label" htmlFor="parametre-valeur">
                Valeur
              </label>
              <input
                id="parametre-valeur"
                className="gp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={valeur}
                onChange={(e) => setValeur(sanitizeInteger(e.target.value))}
                required
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
