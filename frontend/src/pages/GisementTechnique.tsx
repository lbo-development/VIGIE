import { useEffect, useState, type FormEvent } from 'react'
import { useSecteurs, type Secteur, type SousSecteur } from '../hooks/useSecteurs'
import { useServices } from '../hooks/useServices'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDragReorder } from '../hooks/useDragReorder'
import { Combobox } from '../components/Combobox'
import { api, ApiError } from '../services/api'

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
 * §2.2) et la même règle d'habilitation — mêmes choix d'UX (vue
 * maître-détail, glisser-déposer, colonnes) que l'écran géographique.
 */
export function GisementTechnique() {
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
  const { secteurs, loading, error, refetch } = useSecteurs(idServiceFilter)

  useEffect(() => {
    // ADMIN_SERVICE : verrouille le filtre sur son propre service dès que
    // son périmètre est connu (évite qu'il passe par "Tous les services").
    if (isRestrictedToOwnService && filterIdService === null) {
      setFilterIdService(String(adminServiceIds[0]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestrictedToOwnService, adminServiceIds.join(',')])

  const [selectedCodeSecteur, setSelectedCodeSecteur] = useState<string | null>(null)
  const selectedSecteur = secteurs.find((s) => s.code_secteur === selectedCodeSecteur) ?? null

  const [secteurModal, setSecteurModal] = useState<{ mode: 'create' | 'edit'; secteur: Secteur | null } | null>(null)
  const [sousSecteurModal, setSousSecteurModal] = useState<{
    mode: 'create' | 'edit'
    codeSecteur: string
    sousSecteur: SousSecteur | null
  } | null>(null)

  const serviceOptions = visibleServices.map((s) => ({ value: String(s.id_service), label: s.libelle_service }))
  const serviceLabel = (idService: number | null) =>
    services.find((s) => s.id_service === idService)?.libelle_service ?? '—'

  // Glisser-déposer des secteurs : n'a de sens que sur un service précis (le
  // filtre "Tous les services" mélangerait des secteurs de services
  // différents, et ADMIN_SERVICE ne peut de toute façon réordonner que son
  // propre service — voir la décision utilisateur consignée pour l'écran
  // géographique, reprise à l'identique ici).
  const canReorderSecteurs = idServiceFilter !== null
  const [optimisticSecteurOrder, setOptimisticSecteurOrder] = useState<string[] | null>(null)
  const [secteurReorderError, setSecteurReorderError] = useState<string | null>(null)
  const displayedSecteurs = optimisticSecteurOrder
    ? optimisticSecteurOrder
        .map((code) => secteurs.find((s) => s.code_secteur === code))
        .filter((s): s is Secteur => Boolean(s))
    : secteurs

  async function handleSecteurReorder(newOrder: string[]) {
    if (idServiceFilter === null) return
    setOptimisticSecteurOrder(newOrder)
    setSecteurReorderError(null)
    try {
      await api.put('/secteurs/reorder', { idService: idServiceFilter, codeSecteurs: newOrder })
      await refetch()
    } catch (err) {
      setSecteurReorderError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticSecteurOrder(null)
    }
  }

  const secteursReorder = useDragReorder(
    displayedSecteurs.map((s) => s.code_secteur),
    handleSecteurReorder,
  )

  // Glisser-déposer des sous-secteurs : toujours scopé à un seul secteur
  // (celui sélectionné), pas d'ambiguïté de périmètre équivalente à celle
  // des secteurs.
  const [optimisticSousSecteurOrder, setOptimisticSousSecteurOrder] = useState<string[] | null>(null)
  const [sousSecteurReorderError, setSousSecteurReorderError] = useState<string | null>(null)

  useEffect(() => {
    // Change de secteur sélectionné : un ordre optimiste laissé par le
    // secteur précédent n'a plus de sens ici (les codes peuvent coïncider
    // par hasard entre deux secteurs).
    setOptimisticSousSecteurOrder(null)
    setSousSecteurReorderError(null)
  }, [selectedCodeSecteur])

  const displayedSousSecteurs = !selectedSecteur
    ? []
    : optimisticSousSecteurOrder
      ? optimisticSousSecteurOrder
          .map((code) => selectedSecteur.sous_secteurs.find((ss) => ss.code_sous_secteur === code))
          .filter((ss): ss is SousSecteur => Boolean(ss))
      : selectedSecteur.sous_secteurs

  async function handleSousSecteurReorder(newOrder: string[]) {
    if (!selectedSecteur) return
    setOptimisticSousSecteurOrder(newOrder)
    setSousSecteurReorderError(null)
    try {
      await api.put(`/secteurs/${selectedSecteur.code_secteur}/sous-secteurs/reorder`, { codeSousSecteurs: newOrder })
      await refetch()
    } catch (err) {
      setSousSecteurReorderError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le nouvel ordre.")
    } finally {
      setOptimisticSousSecteurOrder(null)
    }
  }

  const sousSecteursReorder = useDragReorder(
    displayedSousSecteurs.map((ss) => ss.code_sous_secteur),
    handleSousSecteurReorder,
  )

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
      {secteurReorderError && (
        <p className="gp-errmsg">
          <svg className="ti">
            <use href="#i-alert-circle" />
          </svg>
          {secteurReorderError}
        </p>
      )}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="gp-table-wrap gp-scroll" style={{ flex: '1 1 480px' }}>
          <table className="gp-table">
            <thead>
              <tr>
                {canReorderSecteurs && <th aria-label="Réordonner" style={{ width: 32 }} />}
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
                  <td colSpan={canReorderSecteurs ? 6 : 5}>Chargement…</td>
                </tr>
              )}
              {!loading && displayedSecteurs.length === 0 && (
                <tr>
                  <td colSpan={canReorderSecteurs ? 6 : 5}>Aucun secteur.</td>
                </tr>
              )}
              {displayedSecteurs.map((secteur) => (
                <tr
                  key={secteur.code_secteur}
                  {...(canReorderSecteurs ? secteursReorder.dragProps(secteur.code_secteur) : {})}
                  style={{
                    backgroundColor:
                      secteur.code_secteur === selectedCodeSecteur ? 'var(--gp-surface-sunken)' : undefined,
                    opacity: canReorderSecteurs && secteursReorder.draggedKey === secteur.code_secteur ? 0.5 : undefined,
                  }}
                >
                  {canReorderSecteurs && (
                    <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                      <svg className="ti">
                        <use href="#i-grip-vertical" />
                      </svg>
                    </td>
                  )}
                  <td className="mono">{secteur.code_secteur}</td>
                  <td>{secteur.lib_secteur}</td>
                  <td>{serviceLabel(secteur.id_service)}</td>
                  <td>
                    {secteur.actif ? (
                      <span className="gp-badge gp-badge--success">Actif</span>
                    ) : (
                      <span className="gp-badge gp-badge--danger">Inactif</span>
                    )}
                  </td>
                  <td>
                    <div className="gp-rowacts">
                      <button
                        aria-label="Voir les sous-secteurs"
                        aria-pressed={secteur.code_secteur === selectedCodeSecteur}
                        onClick={() => setSelectedCodeSecteur(secteur.code_secteur)}
                      >
                        <svg className="ti">
                          <use href="#i-eye" />
                        </svg>
                      </button>
                      <button aria-label="Modifier" onClick={() => setSecteurModal({ mode: 'edit', secteur })}>
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
          {!selectedSecteur ? (
            <p>Sélectionne un secteur (icône « œil ») pour voir et gérer ses sous-secteurs.</p>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="gp-label">Sous-secteurs</p>
                  <p className="mono">{selectedSecteur.lib_secteur}</p>
                </div>
                <button
                  type="button"
                  className="gp-btn gp-btn--ghost gp-btn--sm"
                  onClick={() =>
                    setSousSecteurModal({ mode: 'create', codeSecteur: selectedSecteur.code_secteur, sousSecteur: null })
                  }
                >
                  <svg className="ti">
                    <use href="#i-plus" />
                  </svg>
                  Nouveau sous-secteur
                </button>
              </div>
              {sousSecteurReorderError && (
                <p className="gp-errmsg">
                  <svg className="ti">
                    <use href="#i-alert-circle" />
                  </svg>
                  {sousSecteurReorderError}
                </p>
              )}
              {selectedSecteur.sous_secteurs.length === 0 ? (
                <p>Aucun sous-secteur.</p>
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
                      {displayedSousSecteurs.map((sousSecteur) => (
                        <tr
                          key={sousSecteur.code_sous_secteur}
                          {...sousSecteursReorder.dragProps(sousSecteur.code_sous_secteur)}
                          style={{
                            opacity: sousSecteursReorder.draggedKey === sousSecteur.code_sous_secteur ? 0.5 : undefined,
                          }}
                        >
                          <td className="mono" style={{ cursor: 'grab' }} aria-label="Glisser pour réordonner">
                            <svg className="ti">
                              <use href="#i-grip-vertical" />
                            </svg>
                          </td>
                          <td className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sousSecteur.code_sous_secteur}
                          </td>
                          <td>
                            {sousSecteur.actif ? (
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
                                  setSousSecteurModal({
                                    mode: 'edit',
                                    codeSecteur: selectedSecteur.code_secteur,
                                    sousSecteur,
                                  })
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

      {secteurModal && (
        <SecteurFormModal
          mode={secteurModal.mode}
          secteur={secteurModal.secteur}
          services={visibleServices}
          onClose={() => setSecteurModal(null)}
          onSaved={() => {
            setSecteurModal(null)
            void refetch()
          }}
        />
      )}

      {sousSecteurModal && (
        <SousSecteurFormModal
          mode={sousSecteurModal.mode}
          codeSecteur={sousSecteurModal.codeSecteur}
          sousSecteur={sousSecteurModal.sousSecteur}
          onClose={() => setSousSecteurModal(null)}
          onSaved={() => {
            setSousSecteurModal(null)
            void refetch()
          }}
        />
      )}
    </div>
  )
}

interface SecteurFormModalProps {
  mode: 'create' | 'edit'
  secteur: Secteur | null
  services: { id_service: number; libelle_service: string }[]
  onClose: () => void
  onSaved: () => void
}

function SecteurFormModal({ mode, secteur, services, onClose, onSaved }: SecteurFormModalProps) {
  const [codeSecteur, setCodeSecteur] = useState(secteur?.code_secteur ?? '')
  const [libSecteur, setLibSecteur] = useState(secteur?.lib_secteur ?? '')
  const [idService, setIdService] = useState<string | null>(
    secteur?.id_service != null ? String(secteur.id_service) : null,
  )
  const [actif, setActif] = useState(secteur?.actif ?? true)
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
        libSecteur,
        idService: Number(idService),
        actif,
      }
      if (mode === 'create') {
        await api.post('/secteurs', { codeSecteur, ...payload })
      } else if (secteur) {
        await api.put(`/secteurs/${secteur.code_secteur}`, payload)
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

interface SousSecteurFormModalProps {
  mode: 'create' | 'edit'
  codeSecteur: string
  sousSecteur: SousSecteur | null
  onClose: () => void
  onSaved: () => void
}

function SousSecteurFormModal({ mode, codeSecteur, sousSecteur, onClose, onSaved }: SousSecteurFormModalProps) {
  const [codeSousSecteur, setCodeSousSecteur] = useState(sousSecteur?.code_sous_secteur ?? '')
  const [actif, setActif] = useState(sousSecteur?.actif ?? true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { actif }
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
                  Libellé
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
