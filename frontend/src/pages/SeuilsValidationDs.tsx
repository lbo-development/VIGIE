import { useEffect, useState, type FormEvent } from 'react'
import { useSeuilsValidationDs } from '../hooks/useSeuilsValidationDs'
import { useServices, type OrgService } from '../hooks/useServices'
import { useDirections } from '../hooks/useDirections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

function formatMontant(montant: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)
}

/** Seuils saisis en nombre entier uniquement (décision utilisateur) : filtre tout caractère non chiffre, y compris virgule/point/signe — jamais de `type="number"` natif (spin buttons non désirés ici, voir GUIDELINES.md sur les composants à ne pas réinventer). */
function sanitizeInteger(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

/**
 * Administration de finances.seuil_validation_ds, montée sur
 * /parametres/seuils-validation-ds. Écriture ouverte à ADMIN_APP (transverse)
 * ou ADMIN_SERVICE scopé à son propre service — même règle que
 * SITE/SOUS_SITE et SECTEUR/SOUS_SECTEUR (décision du 29/08/2026, qui
 * remplace la restriction ADMIN_APP seul du 28/08/2026 ; contrôle réel côté
 * backend via assertManagesService — voir
 * backend/src/services/seuilValidationDs.service.ts). Cet écran restreint la
 * liste visible au périmètre d'ADMIN_SERVICE pour cohérence avec les pages
 * Gisement géographique/technique, mais seul le backend fait foi pour les
 * droits d'écriture (voir ForClaude/SECURITY.md §2).
 *
 * Plus d'historisation (décision du 28/08/2026, annule la version précédente
 * de cet écran) : un service a au plus une ligne (FONCTIONNEMENT +
 * INVESTISSEMENT en colonnes) ; un service absent de la table est affiché
 * avec des seuils à 0, jamais comme une ligne manquante. Plus de notion de
 * "seuil en vigueur" (plus de date à comparer).
 *
 * Direction obligatoire pour afficher la liste (décision utilisateur) : pas
 * d'option "Toutes les directions", la liste reste vide tant qu'aucune
 * direction précise n'est choisie. ADMIN_SERVICE : la direction se
 * positionne automatiquement sur son propre périmètre (comme Gisement
 * géographique/technique).
 */
export function SeuilsValidationDs() {
  const { directions } = useDirections()
  const { services } = useServices()
  const { seuils, loading, refetch } = useSeuilsValidationDs()
  const { data: currentUser } = useCurrentUser()

  const isAdminApp = currentUser?.roles.some((r) => r.typeRole === 'ADMIN_APP') ?? false
  const adminServiceIds = (currentUser?.roles ?? [])
    .filter((r) => r.typeRole === 'ADMIN_SERVICE' && r.idService !== null)
    .map((r) => r.idService as number)
  const isRestrictedToOwnService = !isAdminApp && adminServiceIds.length > 0
  const visibleServices = isRestrictedToOwnService
    ? services.filter((s) => adminServiceIds.includes(s.id_service))
    : services

  const [filterIdDirection, setFilterIdDirection] = useState<string | null>(null)
  const [modal, setModal] = useState<OrgService | null>(null)

  const directionOptions = directions.map((d) => ({ value: String(d.id_direction), label: d.libelle_direction }))

  useEffect(() => {
    if (isRestrictedToOwnService && filterIdDirection === null) {
      const ownService = services.find((s) => s.id_service === adminServiceIds[0])
      if (ownService) setFilterIdDirection(String(ownService.id_direction))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestrictedToOwnService, adminServiceIds.join(','), services])

  const seuilByService = new Map(seuils.map((s) => [s.id_service, s]))
  const displayedServices =
    filterIdDirection === null
      ? []
      : visibleServices.filter((s) => s.id_direction === Number(filterIdDirection))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Seuils de validation DS</h1>
          <p>Seuil de dispense de validation DS par service — FONCTIONNEMENT et INVESTISSEMENT.</p>
        </div>
      </div>

      <div className="gp-field" style={{ maxWidth: 404 }}>
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

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Seuil fonctionnement</th>
              <th>Seuil investissement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>Chargement…</td>
              </tr>
            )}
            {!loading && displayedServices.length === 0 && (
              <tr>
                <td colSpan={4}>
                  {filterIdDirection === null ? 'Sélectionne une direction pour afficher les seuils.' : 'Aucun service.'}
                </td>
              </tr>
            )}
            {displayedServices.map((service) => {
              const seuil = seuilByService.get(service.id_service)
              return (
                <tr key={service.id_service}>
                  <td>{service.libelle_service}</td>
                  <td className="mono">{formatMontant(seuil?.seuil_fonctionnement ?? 0)}</td>
                  <td className="mono">{formatMontant(seuil?.seuil_investissement ?? 0)}</td>
                  <td>
                    <div className="gp-rowacts">
                      <span className="gp-tip" data-tip="Modifier les seuils">
                        <button aria-label="Modifier les seuils" onClick={() => setModal(service)}>
                          <svg className="ti">
                            <use href="#i-pencil" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <SeuilFormModal
          service={modal}
          directions={directions}
          seuil={seuilByService.get(modal.id_service) ?? null}
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

interface SeuilFormModalProps {
  service: OrgService
  directions: { id_direction: number; libelle_direction: string }[]
  seuil: { seuil_fonctionnement: number; seuil_investissement: number } | null
  onClose: () => void
  onSaved: () => void
}

/** Un seul formulaire par service (upsert) : pas de distinction création/modification côté utilisateur. Direction/Service rappelés en lecture seule sous le titre (comme les modales de modification de Gisement géographique/technique — pas de champ éditable, seuls les deux montants le sont). */
function SeuilFormModal({ service, directions, seuil, onClose, onSaved }: SeuilFormModalProps) {
  const direction = directions.find((d) => d.id_direction === service.id_direction)
  const [seuilFonctionnement, setSeuilFonctionnement] = useState(String(seuil?.seuil_fonctionnement ?? 0))
  const [seuilInvestissement, setSeuilInvestissement] = useState(String(seuil?.seuil_investissement ?? 0))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.put(`/seuils-validation-ds/${service.id_service}`, {
        seuilFonctionnement: Number(seuilFonctionnement),
        seuilInvestissement: Number(seuilInvestissement),
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
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="seuilModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="seuilModalTitle">
            Seuil de validation
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <p className="gp-help">
              Direction : {direction?.libelle_direction ?? '—'}
              <br />
              Service : {service.libelle_service}
            </p>
            <div className="gp-field">
              <label className="gp-label" htmlFor="seuil-fonctionnement">
                Seuil fonctionnement (€)
              </label>
              <input
                id="seuil-fonctionnement"
                className="gp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={seuilFonctionnement}
                onChange={(e) => setSeuilFonctionnement(sanitizeInteger(e.target.value))}
                required
              />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="seuil-investissement">
                Seuil investissement (€)
              </label>
              <input
                id="seuil-investissement"
                className="gp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={seuilInvestissement}
                onChange={(e) => setSeuilInvestissement(sanitizeInteger(e.target.value))}
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
