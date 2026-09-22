import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Combobox } from '../Combobox'
import { DatePicker } from '../DatePicker'
import { ApiError } from '../../services/api'
import {
  createSuppleance,
  retireSuppleance,
  useSuppleantCandidats,
  type MesSuppleances,
  type SuppleanceStatut,
  type SuppleanceView,
} from '../../hooks/useSuppleance'

interface SuppleanceModalProps {
  data: MesSuppleances
  /** Appelé après une création ou un retrait réussi — l'appelant recharge la liste. */
  onChanged: () => Promise<unknown> | void
  onClose: () => void
}

const STATUT_LABEL: Record<SuppleanceStatut, string> = {
  A_VENIR: 'À venir',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  RETIREE: 'Retirée',
}

const STATUT_BADGE: Record<SuppleanceStatut, string> = {
  A_VENIR: 'gp-badge gp-badge--info',
  EN_COURS: 'gp-badge gp-badge--success',
  TERMINEE: 'gp-badge',
  RETIREE: 'gp-badge gp-badge--danger',
}

function isoToFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Date du jour AAAA-MM-JJ dans le fuseau local de l'utilisateur (Paris pour les agents GPMM). */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function roleLabel(typeRole: string | null, perimeterLabel: string | null): string {
  return `${typeRole ?? ''}${perimeterLabel ? ` — ${perimeterLabel}` : ''}`.trim()
}

/**
 * Déclaration et retrait de suppléance par le titulaire d'un rôle RC/CDS/DS (refonte du
 * 20/09/2026 — voir ForClaude/CDC/mot-phases-1-2.md, « Suppléance »). Ouverte depuis le bouton
 * « Suppléance » de l'en-tête des écrans d'accueil (SuppleanceButton.tsx).
 *
 * Le suppléant est choisi dans la liste renvoyée par le serveur (acteurs actifs du service pour un
 * RC/CDS, de la direction pour un DS) — le serveur revérifie à l'enregistrement. Une étape de
 * confirmation rappelle les conséquences (substitution complète, titulaire en lecture seule)
 * avant l'envoi. Les suppléances passées, en cours, à venir et retirées sont toutes listées ;
 * seules celles en cours ou à venir peuvent être retirées.
 */
export function SuppleanceModal({ data, onChanged, onClose }: SuppleanceModalProps) {
  const [idRole, setIdRole] = useState<string | null>(data.roles.length === 1 ? String(data.roles[0].idRole) : null)
  const [matriculeSuppleant, setMatriculeSuppleant] = useState<string | null>(null)
  const [dateDebut, setDateDebut] = useState<string | null>(null)
  const [dateFin, setDateFin] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toRetire, setToRetire] = useState<SuppleanceView | null>(null)
  const [retireError, setRetireError] = useState<string | null>(null)
  const [retiring, setRetiring] = useState(false)
  // Verrous synchrones contre la double soumission (le re-rendu de `submitting` n'est pas garanti
  // avant un second évènement — même principe que ChangePasswordModal).
  const submittingRef = useRef(false)
  const retiringRef = useRef(false)

  const selectedRole = data.roles.find((r) => String(r.idRole) === idRole) ?? null
  const { candidats, loading: candidatsLoading, error: candidatsError } = useSuppleantCandidats(selectedRole?.idRole ?? null)
  const candidatOptions = useMemo(
    () => candidats.map((c) => ({ value: c.matricule, label: `${c.prenom} ${c.nom}${c.fonction ? ` — ${c.fonction}` : ''}` })),
    [candidats],
  )
  const candidat = candidats.find((c) => c.matricule === matriculeSuppleant) ?? null

  function handleRoleChange(value: string | null) {
    setIdRole(value)
    setMatriculeSuppleant(null) // la liste des suppléants dépend du rôle
  }

  function handleReview(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!selectedRole) return setError('Choisissez le rôle concerné.')
    if (!matriculeSuppleant) return setError('Choisissez le suppléant.')
    if (!dateDebut || !dateFin) return setError('Renseignez les dates de début et de fin.')
    if (dateDebut < todayIso()) return setError('Une suppléance ne peut pas commencer dans le passé.')
    if (dateFin < dateDebut) return setError('La date de fin doit être postérieure ou égale à la date de début.')
    setConfirming(true)
  }

  async function handleConfirm() {
    if (submittingRef.current || !selectedRole || !matriculeSuppleant || !dateDebut || !dateFin) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      await createSuppleance({ idRole: selectedRole.idRole, matriculeSuppleant, dateDebut, dateFin })
      await onChanged()
      setConfirming(false)
      setMatriculeSuppleant(null)
      setDateDebut(null)
      setDateFin(null)
    } catch (err) {
      setConfirming(false)
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function handleRetire() {
    if (retiringRef.current || !toRetire) return
    retiringRef.current = true
    setRetiring(true)
    setRetireError(null)
    try {
      await retireSuppleance(toRetire.idSuppleance)
      await onChanged()
      setToRetire(null)
    } catch (err) {
      setRetireError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      retiringRef.current = false
      setRetiring(false)
    }
  }

  const suppleantNom = candidat ? `${candidat.prenom} ${candidat.nom}` : ''

  return (
    <>
      <div className="gp-overlay is-open">
        <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="suppleanceModalTitle" style={{ maxWidth: 820 }}>
          <div className="gp-modal__hd">
            <h3 className="gp-modal__title" id="suppleanceModalTitle">
              {confirming ? 'Confirmer la suppléance' : 'Suppléance'}
            </h3>
            <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
              <svg className="ti">
                <use href="#i-x" />
              </svg>
            </button>
          </div>

          {confirming && selectedRole && dateDebut && dateFin ? (
            <>
              <div className="gp-modal__bd gp-scroll stack">
                <p>
                  Pendant la période du <strong>{isoToFr(dateDebut)}</strong> au <strong>{isoToFr(dateFin)}</strong> (inclus),{' '}
                  <strong>{suppleantNom}</strong> aura tous les droits de votre rôle{' '}
                  <strong>{roleLabel(selectedRole.typeRole, selectedRole.perimeterLabel)}</strong>.
                </p>
                <p>
                  Vous passerez en lecture seule sur ce rôle : vous pourrez consulter, mais plus modifier, transmettre, rejeter ni annuler une
                  DA/FAD. Vous pourrez retirer la suppléance à tout moment pour reprendre la main.
                </p>
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
                <button type="button" className="gp-btn gp-btn--secondary" disabled={submitting} onClick={() => setConfirming(false)}>
                  Retour
                </button>
                <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleConfirm()}>
                  {submitting ? 'Enregistrement…' : 'Confirmer la suppléance'}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleReview} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div className="gp-modal__bd gp-scroll stack">
                <p className="gp-help">
                  Désignez la personne qui exercera votre rôle pendant votre absence. Vous seul pouvez déclarer ou retirer une suppléance sur votre
                  rôle.
                </p>

                <div className="stack" style={{ gap: 14 }}>
                  {data.roles.length > 1 ? (
                    <div className="gp-field" style={{ width: 260 }}>
                      <label className="gp-label">Rôle</label>
                      <Combobox
                        options={data.roles.map((r) => ({ value: String(r.idRole), label: roleLabel(r.typeRole, r.perimeterLabel) }))}
                        value={idRole}
                        onChange={handleRoleChange}
                        placeholder="Choisir un rôle"
                        ariaLabel="Rôle"
                        style={{ maxWidth: 'none' }}
                      />
                    </div>
                  ) : (
                    <div className="gp-field" style={{ width: 260 }}>
                      <label className="gp-label">Rôle</label>
                      <p style={{ margin: 0 }}>{selectedRole ? roleLabel(selectedRole.typeRole, selectedRole.perimeterLabel) : '—'}</p>
                    </div>
                  )}
                  <div className="gp-field">
                    <label className="gp-label">Suppléant</label>
                    <Combobox
                      options={candidatOptions}
                      value={matriculeSuppleant}
                      onChange={setMatriculeSuppleant}
                      placeholder={candidatsLoading ? 'Chargement…' : selectedRole ? 'Choisir un suppléant' : "Choisir d'abord un rôle"}
                      ariaLabel="Suppléant"
                      style={{ maxWidth: 'none' }}
                    />
                    {candidatsError && <p className="gp-errmsg">{candidatsError}</p>}
                  </div>
                </div>

                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="gp-field" style={{ width: 200 }}>
                    <label className="gp-label" htmlFor="suppleance-date-debut">
                      Du
                    </label>
                    <DatePicker id="suppleance-date-debut" value={dateDebut} onChange={setDateDebut} ariaLabel="Date de début" />
                  </div>
                  <div className="gp-field" style={{ width: 200 }}>
                    <label className="gp-label" htmlFor="suppleance-date-fin">
                      Au (inclus)
                    </label>
                    <DatePicker id="suppleance-date-fin" value={dateFin} onChange={setDateFin} ariaLabel="Date de fin" />
                  </div>
                  <button type="submit" className="gp-btn gp-btn--primary">
                    Déclarer la suppléance
                  </button>
                </div>

                {error && (
                  <p className="gp-errmsg">
                    <svg className="ti">
                      <use href="#i-alert-circle" />
                    </svg>
                    {error}
                  </p>
                )}

                <div className="divider" />

                <h4 style={{ margin: 0 }}>Mes suppléances</h4>
                <div className="gp-table-wrap gp-scroll">
                  <table className="gp-table">
                    <thead>
                      <tr>
                        <th>Rôle</th>
                        <th>Suppléant</th>
                        <th>Du</th>
                        <th>Au</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.suppleances.length === 0 && (
                        <tr>
                          <td colSpan={6}>Aucune suppléance déclarée.</td>
                        </tr>
                      )}
                      {data.suppleances.map((s) => {
                        const retirable = s.statut === 'EN_COURS' || s.statut === 'A_VENIR'
                        return (
                          <tr key={s.idSuppleance}>
                            <td>{roleLabel(s.typeRole, s.perimeterLabel)}</td>
                            <td>{s.suppleantNomPrenom ?? s.matriculeSuppleant}</td>
                            <td>{isoToFr(s.dateDebut)}</td>
                            <td>{isoToFr(s.dateFin)}</td>
                            <td>
                              <span className={STATUT_BADGE[s.statut]}>{STATUT_LABEL[s.statut]}</span>
                            </td>
                            <td>
                              {retirable && (
                                <div className="gp-rowacts">
                                  <span className="gp-tip" data-tip="Retirer la suppléance">
                                    <button
                                      type="button"
                                      className="del"
                                      aria-label={`Retirer la suppléance du ${isoToFr(s.dateDebut)} au ${isoToFr(s.dateFin)}`}
                                      onClick={() => {
                                        setRetireError(null)
                                        setToRetire(s)
                                      }}
                                    >
                                      <svg className="ti">
                                        <use href="#i-trash" />
                                      </svg>
                                    </button>
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="gp-modal__ft">
                <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
                  Fermer
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {toRetire && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="retirerSuppleanceTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="retirerSuppleanceTitle">
                Retirer la suppléance
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setToRetire(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>
                Retirer la suppléance de <strong>{toRetire.suppleantNomPrenom ?? toRetire.matriculeSuppleant}</strong> du{' '}
                {isoToFr(toRetire.dateDebut)} au {isoToFr(toRetire.dateFin)} ?
              </p>
              <p>
                {toRetire.statut === 'EN_COURS'
                  ? 'Le suppléant perdra immédiatement les droits de votre rôle et vous en retrouverez la pleine main.'
                  : "La suppléance ne prendra jamais effet. Elle reste consultable dans l'historique."}
              </p>
              {retireError && (
                <p className="gp-errmsg">
                  <svg className="ti">
                    <use href="#i-alert-circle" />
                  </svg>
                  {retireError}
                </p>
              )}
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" disabled={retiring} onClick={() => setToRetire(null)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" disabled={retiring} onClick={() => void handleRetire()}>
                {retiring ? 'Retrait…' : 'Retirer la suppléance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
