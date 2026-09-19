import { useEffect, useState } from 'react'
import { useAllActeurs, type AdminActeur } from '../hooks/useAllActeurs'
import { FileDropzone } from '../components/FileDropzone'
import { api, ApiError } from '../services/api'

const MAX_TAILLE_OCTETS = 2 * 1024 * 1024

function matchesSearch(acteur: AdminActeur, search: string): boolean {
  if (!search.trim()) return true
  const needle = search.trim().toLowerCase()
  return acteur.nom.toLowerCase().includes(needle) || acteur.prenom.toLowerCase().includes(needle) || acteur.matricule.toLowerCase().includes(needle)
}

/**
 * Administration des signatures (image PNG/JPEG) des acteurs, montée sur
 * /parametres/signatures — accessible à ADMIN_APP (transverse) et
 * ADMIN_SERVICE (scopé à son propre service, même périmètre que
 * RolesUtilisateurs.tsx : `GET /acteurs` est déjà scopé côté backend,
 * `assertManagesService` revérifie le service exact au dépôt/suppression).
 * Décision du 19/09/2026 — alimente la fiche FAD papier générée par la CB
 * (demandeAchat.service.ts#genererFadPdf) : une signature déposée ici est
 * réutilisée sur chaque FAD où cet acteur apparaît comme demandeur/RC/CDS.
 *
 * Pas de vérification de rôle côté écran (comme Utilisateurs.tsx/
 * RolesUtilisateurs.tsx) : seul le backend fait foi, l'entrée de menu qui
 * mène ici est déjà réservée ADMIN_APP/ADMIN_SERVICE (config/navigation.ts).
 */
export function SignaturesActeurs() {
  const { acteurs, loading } = useAllActeurs()
  const [search, setSearch] = useState('')
  const [modalActeur, setModalActeur] = useState<AdminActeur | null>(null)
  // Statut par matricule (crayon vert/rouge) — un GET par acteur affiché, chacun déjà scopé
  // ADMIN_APP/ADMIN_SERVICE côté backend (assertManagesService) ; volumétrie d'un écran
  // d'administration interne, pas d'endpoint de liste dédié pour ce simple indicateur.
  const [signatureStatus, setSignatureStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (acteurs.length === 0) return
    let cancelled = false

    async function loadStatuses() {
      const entries = await Promise.all(
        acteurs.map(async (a): Promise<[string, boolean]> => {
          try {
            const current = await api.get<SignatureActeurView | null>(`/acteurs/${a.matricule}/signature`)
            return [a.matricule, current !== null]
          } catch {
            return [a.matricule, false]
          }
        }),
      )
      if (!cancelled) setSignatureStatus(Object.fromEntries(entries))
    }
    void loadStatuses()

    return () => {
      cancelled = true
    }
  }, [acteurs])

  const filtered = acteurs.filter((a) => matchesSearch(a, search))

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Signatures</h1>
          <p>Image de signature d'un acteur, réutilisée sur la fiche FAD papier générée par la CB.</p>
        </div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="gp-field" style={{ width: 260 }}>
          <label className="gp-label" htmlFor="signatures-search">
            Recherche
          </label>
          <div className="gp-inputgroup">
            <svg className="ti">
              <use href="#i-search" />
            </svg>
            <input
              id="signatures-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, prénom, matricule…"
              aria-label="Rechercher un utilisateur"
            />
          </div>
        </div>
      </div>

      <div className="gp-table-wrap gp-scroll">
        <table className="gp-table">
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Fonction</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>Chargement…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5}>{acteurs.length === 0 ? 'Aucun utilisateur.' : 'Aucun utilisateur pour cette recherche.'}</td>
              </tr>
            )}
            {filtered.map((acteur) => (
              <tr key={acteur.matricule}>
                <td className="mono">{acteur.matricule}</td>
                <td>{acteur.nom}</td>
                <td>{acteur.prenom}</td>
                <td>{acteur.fonction}</td>
                <td>
                  <div className="gp-rowacts">
                    <span className="gp-tip" data-tip={signatureStatus[acteur.matricule] ? 'Signature déposée' : 'Aucune signature déposée'}>
                      <button aria-label="Gérer la signature" onClick={() => setModalActeur(acteur)}>
                        <svg className="ti" style={{ color: signatureStatus[acteur.matricule] ? 'var(--gp-success)' : 'var(--gp-danger)' }}>
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

      {modalActeur && (
        <SignatureActeurModal
          acteur={modalActeur}
          onClose={() => setModalActeur(null)}
          onSignatureChanged={(hasSignature) => setSignatureStatus((prev) => ({ ...prev, [modalActeur.matricule]: hasSignature }))}
        />
      )}
    </div>
  )
}

interface SignatureActeurView {
  matricule: string
  nomFichierOriginal: string
  tailleOctets: number
}

interface SignatureActeurModalProps {
  acteur: AdminActeur
  onClose: () => void
  onSignatureChanged: (hasSignature: boolean) => void
}

function SignatureActeurModal({ acteur, onClose, onSignatureChanged }: SignatureActeurModalProps) {
  const [loading, setLoading] = useState(true)
  const [signature, setSignature] = useState<SignatureActeurView | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const current = await api.get<SignatureActeurView | null>(`/acteurs/${acteur.matricule}/signature`)
        if (cancelled) return
        setSignature(current)
        if (current) {
          const blob = await api.getBlob(`/acteurs/${acteur.matricule}/signature/fichier`)
          if (cancelled) return
          objectUrl = URL.createObjectURL(blob)
          setPreviewUrl(objectUrl)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Impossible de charger la signature.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [acteur.matricule])

  async function handleUpload() {
    if (!file) {
      setError('Choisissez un fichier.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('fichier', file)
      const updated = await api.putForm<SignatureActeurView>(`/acteurs/${acteur.matricule}/signature`, formData)
      setSignature(updated)
      setFile(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const blob = await api.getBlob(`/acteurs/${acteur.matricule}/signature/fichier`)
      setPreviewUrl(URL.createObjectURL(blob))
      onSignatureChanged(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de déposer la signature.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setSubmitting(true)
    try {
      await api.delete(`/acteurs/${acteur.matricule}/signature`)
      setSignature(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setConfirmDelete(false)
      onSignatureChanged(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de supprimer la signature.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="signatureActeurModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="signatureActeurModalTitle">
            Signature — {acteur.prenom} {acteur.nom}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          {loading ? (
            <p>Chargement…</p>
          ) : (
            <>
              {signature && previewUrl && (
                <div className="gp-field">
                  <label className="gp-label">Signature actuelle</label>
                  <img
                    src={previewUrl}
                    alt={`Signature de ${acteur.prenom} ${acteur.nom}`}
                    style={{ maxWidth: '100%', maxHeight: 140, border: '1px solid var(--gp-border)', borderRadius: 6, background: '#fff' }}
                  />
                  <p className="gp-help">{signature.nomFichierOriginal}</p>
                </div>
              )}
              {!signature && <p className="gp-help">Aucune signature déposée pour cet utilisateur.</p>}

              <div className="gp-field">
                <label className="gp-label">{signature ? 'Remplacer la signature' : 'Déposer une signature'} (PNG ou JPEG, 2 Mo max)</label>
                <FileDropzone
                  accept="image/png,image/jpeg"
                  maxSizeOctets={MAX_TAILLE_OCTETS}
                  file={file}
                  onFileSelected={setFile}
                  disabled={submitting}
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

              {confirmDelete && (
                <div className="gp-panel" style={{ padding: 12 }}>
                  <p>Supprimer définitivement cette signature ?</p>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setConfirmDelete(false)} disabled={submitting}>
                      Annuler
                    </button>
                    <button type="button" className="gp-btn gp-btn--danger" onClick={() => void handleDelete()} disabled={submitting}>
                      {submitting ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="gp-modal__ft">
          {signature && !confirmDelete && (
            <button type="button" className="gp-btn gp-btn--danger" onClick={() => setConfirmDelete(true)} disabled={submitting || loading}>
              Supprimer
            </button>
          )}
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="gp-btn gp-btn--primary" onClick={() => void handleUpload()} disabled={submitting || loading || !file}>
            {submitting ? 'Envoi…' : signature ? 'Remplacer' : 'Déposer'}
          </button>
        </div>
      </div>
    </div>
  )
}
