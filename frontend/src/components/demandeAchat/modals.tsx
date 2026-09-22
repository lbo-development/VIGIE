import { useEffect, useState, type FormEvent } from 'react'
import { DatePicker } from '../DatePicker'
import { useServices } from '../../hooks/useServices'
import { useFournisseurs } from '../../hooks/useFournisseurs'
import { useMarches } from '../../hooks/useMarches'
import { useMarcheTiers } from '../../hooks/useMarcheTiers'
import { useLibelleReferentiel } from '../../hooks/useLibelleReferentiel'
import type { OperationInvestissement } from '../../hooks/useInvestissementsPgi'
import {
  updateDemandeAchat,
  selectMarcheDemandeAchat,
  getConsultationDemandeAchat,
  addConsultationCandidat,
  removeConsultationCandidat,
  saveConsultationDemandeAchat,
  getOrCreateMarcheDevis,
  uploadDevisFile,
  downloadDevisFileBlob,
  deleteDevisFile,
  getPiecesDemandeAchat,
  addPieceDemandeAchat,
  removePieceDemandeAchat,
  downloadPieceDemandeAchatBlob,
  deleteDemandeAchat,
  type DemandeAchat as DemandeAchatRow,
  type ProcedureAchat,
  type MotifChoix,
  type ConsultationCandidat,
  type PieceJointe,
} from '../../hooks/useDemandeAchat'
import { Combobox } from '../Combobox'
import { FileDropzone } from '../FileDropzone'
import { PieceCountBadge } from '../PieceCountBadge'
import { SortableTh } from '../SortableTh'
import { useDragReorder } from '../../hooks/useDragReorder'
import { useColumnSort, sortRows } from '../../hooks/useColumnSort'
import { ApiError } from '../../services/api'
import { CURRENCY_FORMAT, CURRENCY_FORMAT_ROUND, MAX_FICHIER_TAILLE_OCTETS, sanitizeDecimal, formatMontantDecimal, triggerBlobDownload } from './constants'
import '../../styles/demandeachat.css'

const PROCEDURE_ACHAT_OPTIONS = [
  { value: 'MARCHE', label: 'Marché' },
  { value: 'HORS_MARCHE', label: 'Hors marché' },
]

export interface DemandeAchatModalProps {
  demandeAchat: DemandeAchatRow
  /** Faux dès la réouverture via « Modifier une DA » — décision du 09/09/2026 : la procédure d'achat ne se choisit qu'à la création, jamais ensuite. */
  procedureEditable: boolean
  /**
   * Mode consultation (icône loupe « Voir les éléments de la demande », onglets
   * 2/3/4 de l'écran d'accueil et onglet « En cours » de SuiviRc/SuiviCds —
   * décision du 15/09/2026) : champs figés en lecture seule, pied de modale
   * réduit à « Fermer », aucun accès à Montant & marché / Éléments de
   * consultation (la DA/FAD n'est de toute façon plus éditable à ce stade).
   * Gestion documentaire reste accessible mais bascule elle-même en pure
   * consultation (décision du 17/09/2026 — RC doit pouvoir télécharger devis
   * et pièces complémentaires d'une DA/FAD « en cours », sans les modifier ;
   * avant cette date, le bouton était entièrement désactivé). Faux par
   * défaut (comportement inchangé pour l'onglet « A finaliser »).
   */
  readOnly?: boolean
  /**
   * Écrans de suivi CDS/CB (bug corrigé le 22/09/2026) : « Voir les éléments de la demande »
   * (icône loupe, `readOnly`) passe par cette même modale générique pour toute FAD qui n'est pas
   * au statut « à décider » — sans ce paramètre, la Gestion documentaire imbriquée
   * (GestionDocumentaireModal) interroge le backend sans indice de rôle, qui retombe alors sur la
   * résolution RC/Demandeur par défaut (resolveAccessContext, demandeAchat.service.ts) : un CDS ou
   * une CB pur (sans rôle RC) se voyait refuser l'accès à sa propre FAD en 403 (« Un demandeur ne
   * peut créer une DA que pour lui-même. », message trompeur car réutilisé hors contexte de
   * création). RC n'a jamais besoin de ce paramètre, résolu par défaut — voir SuiviRc.tsx.
   */
  roleHint?: 'CDS' | 'CB'
  onClose: () => void
  onSaved: () => void
}

/**
 * Modale CreationDA (croquis DA.pdf) — sert aussi bien à la finalisation
 * d'un brouillon tout juste créé qu'à la réouverture via « Modifier une
 * DA ». « Marché concerné » ouvre MarcheDaModal (procédure MARCHE
 * uniquement, décision du 08/09/2026) : NUMMARCHE/ID_MARCHE_TIERS et le
 * fournisseur retenu qui en découle sont tenus en état local (pas dans le
 * formulaire principal, mis à jour immédiatement par MarcheDaModal — pas de
 * « Enregistrer » à part pour ce choix, contrairement à Objet/Description/
 * Montant). « Fournisseurs consultés » reste désactivé : DEVIS_CONSULTE n'a
 * pas encore de backend.
 */
export function DemandeAchatModal({ demandeAchat, procedureEditable, readOnly = false, roleHint, onClose, onSaved }: DemandeAchatModalProps) {
  // OBJET_RC/DESCRIPTION_RC (pas *_DEMANDEUR) : synchronisés tant que la DA est éditable par le
  // demandeur, font foi ensuite (décision du 15/09/2026 — voir MLD §2.4). updateDemandeAchat
  // (OP1.1) recopie la valeur saisie ici dans les deux colonnes côté serveur.
  const [objet, setObjet] = useState(demandeAchat.objet_rc)
  const [description, setDescription] = useState(demandeAchat.description_rc ?? '')
  const [montant, setMontant] = useState(String(demandeAchat.montant_demande || ''))
  const [procedureAchat, setProcedureAchat] = useState<ProcedureAchat>(demandeAchat.procedure_achat)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nummarche, setNummarche] = useState(demandeAchat.nummarche)
  const [idMarcheTiers, setIdMarcheTiers] = useState(demandeAchat.id_marche_tiers)
  const [idFournisseurRetenu, setIdFournisseurRetenu] = useState(demandeAchat.id_fournisseur_retenu)
  const [motifChoix, setMotifChoix] = useState(demandeAchat.motif_choix)
  const [libelleMotifChoix, setLibelleMotifChoix] = useState(demandeAchat.libelle_motif_choix)
  const [marcheModalOpen, setMarcheModalOpen] = useState(false)
  const [fournisseurModalOpen, setFournisseurModalOpen] = useState(false)
  const [gestionDocumentaireOpen, setGestionDocumentaireOpen] = useState(false)
  // Nombre d'entreprises consultées (résumé Hors marché, « Nom fournisseur — n entreprise(s) consultée(s) »
  // sur la même ligne) — connu immédiatement par FournisseurDaModal.onSaved (voir ci-dessous), mais
  // inconnu à l'ouverture d'une DA Hors marché déjà consultée lors d'une session précédente : chargé une
  // fois au montage dans ce cas (id_fournisseur_retenu déjà renseigné signifie qu'un « Enregistrer » a
  // déjà eu lieu, donc des candidats existent).
  const [candidatsCount, setCandidatsCount] = useState<number | null>(null)

  const { fournisseurs } = useFournisseurs(demandeAchat.id_service)
  const fournisseurRetenuLabel = fournisseurs.find((f) => f.id_fournisseur === idFournisseurRetenu)?.raison_sociale_service ?? null

  useEffect(() => {
    if (demandeAchat.procedure_achat !== 'HORS_MARCHE' || demandeAchat.id_fournisseur_retenu === null) return
    let cancelled = false
    getConsultationDemandeAchat(demandeAchat.id_demande_achat)
      .then((rows) => {
        if (!cancelled) setCandidatsCount(rows.length)
      })
      .catch(() => {
        // Best effort — le résumé se contente alors du nom du fournisseur, sans le compte.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeAchat.id_demande_achat])

  /**
   * Fermeture (✕/Retour) sans jamais être passé par « Enregistrer » : si le
   * brouillon est resté vierge (encore DA_EN_PREPARATION, objet toujours
   * vide en base — donc jamais sauvegardé, y compris pour un brouillon
   * fraîchement créé par « Nouvelle demande »), on le supprime pour éviter
   * qu'il ne traîne indéfiniment dans la liste. Best effort : un échec de
   * suppression ne bloque pas la fermeture.
   */
  async function handleClose() {
    if (readOnly) {
      onClose()
      return
    }
    if (demandeAchat.code_statut === 'DA_EN_PREPARATION' && !demandeAchat.objet_demandeur) {
      try {
        await deleteDemandeAchat(demandeAchat.id_demande_achat)
      } catch {
        // Best effort — le brouillon vide restera visible, sans conséquence bloquante.
      }
    }
    onClose()
  }

  /**
   * Persiste immédiatement le changement de procédure (au lieu d'attendre
   * « Enregistrer ») — bug corrigé le 09/09/2026 : « Sélectionner un
   * marché »/« Éléments de consultation » agissent sur PROCEDURE_ACHAT tel
   * qu'enregistré en base, pas sur l'état local de ce formulaire. Sans cette
   * sauvegarde immédiate, changer la procédure puis ouvrir aussitôt l'un de
   * ces sous-écrans échouait (409, la DA restait en base sur l'ancienne
   * procédure). Optimiste avec retour en arrière si l'appel échoue.
   */
  async function handleProcedureChange(v: ProcedureAchat) {
    const previous = procedureAchat
    setProcedureAchat(v)
    try {
      const da = await updateDemandeAchat(demandeAchat.id_demande_achat, { procedureAchat: v })
      // Bug corrigé le 09/09/2026 : le backend efface NUMMARCHE/ID_MARCHE_TIERS/
      // ID_FOURNISSEUR_RETENU/MOTIF_CHOIX/LIBELLE_MOTIF_CHOIX/MONTANT_DEMANDE au
      // changement de procédure — sans ce resync, le résumé (marché/fournisseur/
      // motif) affiché dans cette modale restait celui de l'ancienne procédure
      // tant qu'elle n'était pas rouverte.
      setNummarche(da.nummarche)
      setIdMarcheTiers(da.id_marche_tiers)
      setIdFournisseurRetenu(da.id_fournisseur_retenu)
      setMotifChoix(da.motif_choix)
      setLibelleMotifChoix(da.libelle_motif_choix)
      setMontant(String(da.montant_demande || ''))
      setCandidatsCount(null)
    } catch (err) {
      setProcedureAchat(previous)
      setError(err instanceof ApiError ? err.message : 'Impossible de changer la procédure.')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (readOnly) return
    setError(null)

    if (objet.trim().length < 15) {
      setError("L'objet est obligatoire (15 caractères minimum).")
      return
    }
    if (!description.trim()) {
      setError('La description est obligatoire.')
      return
    }

    setSubmitting(true)
    try {
      await updateDemandeAchat(demandeAchat.id_demande_achat, {
        objet: objet.trim(),
        description: description.trim(),
        procedureAchat,
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
      {/* 760 (élargi depuis 640 le 09/09/2026) : la ligne Type procédure d'achat / Montant & marché / Gestion documentaire tient sur trois boutons/champs — 640px ne suffisait plus une fois "Gestion documentaire" ajouté (bascule à la ligne suivante, .row a flex-wrap:wrap et .gp-btn white-space:nowrap, gpmm.css). */}
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="demandeAchatModalTitle" style={{ maxWidth: 760 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="demandeAchatModalTitle">
            {demandeAchat.numero}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={() => void handleClose()}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            <div className="gp-field">
              <label className="gp-label" htmlFor="da-objet">
                Objet de la DA
              </label>
              <input
                id="da-objet"
                className="gp-input"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                maxLength={75}
                readOnly={readOnly}
              />
            </div>

            <div className="gp-field">
              <label className="gp-label" htmlFor="da-description">
                Description de la DA
              </label>
              <textarea
                id="da-description"
                className="gp-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={256}
                rows={4}
                readOnly={readOnly}
              />
            </div>

            {procedureAchat === 'MARCHE' && (nummarche !== null || idMarcheTiers !== null) && (
              <span
                className="gp-tip da-modal__resume"
                data-tip={fournisseurRetenuLabel ? `${nummarche ?? `Marché tiers #${idMarcheTiers}`} — ${fournisseurRetenuLabel}` : undefined}
                style={{ display: 'block', width: '100%' }}
              >
                <span style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span className="mono">{nummarche ?? `Marché tiers #${idMarcheTiers}`}</span>
                  {fournisseurRetenuLabel && ` — ${fournisseurRetenuLabel}`}
                </span>
              </span>
            )}

            {procedureAchat === 'HORS_MARCHE' && idFournisseurRetenu !== null && (
              <span
                className="gp-tip da-modal__resume"
                data-tip={fournisseurRetenuLabel ?? undefined}
                style={{ display: 'block', width: '100%' }}
              >
                <span style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fournisseurRetenuLabel ?? '—'}
                  {candidatsCount !== null && ` — ${candidatsCount} entreprise(s) consultée(s)`}
                </span>
              </span>
            )}

            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="gp-field" style={{ flex: 2 }}>
                <label className="gp-label">Type procédure d'achat</label>
                {procedureEditable && !readOnly ? (
                  <Combobox
                    options={PROCEDURE_ACHAT_OPTIONS}
                    value={procedureAchat}
                    onChange={(v) => {
                      if (v === 'MARCHE' || v === 'HORS_MARCHE') void handleProcedureChange(v)
                    }}
                    placeholder="Choisir…"
                    ariaLabel="Type procédure d'achat"
                    style={{ maxWidth: 'none' }}
                  />
                ) : (
                  <input
                    className="gp-input"
                    value={PROCEDURE_ACHAT_OPTIONS.find((o) => o.value === procedureAchat)?.label ?? procedureAchat}
                    readOnly
                    aria-label="Type procédure d'achat"
                  />
                )}
              </div>

              <div className="gp-field" style={{ flex: '1 1 auto' }}>
                <label className="gp-label" style={{ visibility: 'hidden' }} aria-hidden="true">
                  .
                </label>
                {/* title natif plutôt que .gp-tip (rogné par overflow:hidden de .gp-modal — bulle trop large pour ce texte). */}
                <span style={{ width: '100%' }}>
                  <button
                    type="button"
                    className="gp-btn gp-btn--secondary"
                    disabled={readOnly}
                    title={
                      procedureAchat === 'MARCHE'
                        ? 'Choisir le marché à utiliser et le montant de la DA'
                        : 'Lister les entreprises consultées et le montant de leur devis'
                    }
                    onClick={() => (procedureAchat === 'MARCHE' ? setMarcheModalOpen(true) : setFournisseurModalOpen(true))}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {procedureAchat === 'MARCHE' ? 'Montant & marché' : 'Éléments de consultation'}
                  </button>
                </span>
              </div>

              <div className="gp-field" style={{ flex: '1 1 auto' }}>
                <label className="gp-label" style={{ visibility: 'hidden' }} aria-hidden="true">
                  .
                </label>
                <span
                  className="gp-tip"
                  data-tip={
                    idFournisseurRetenu === null
                      ? 'Identifiez d\'abord un fournisseur (marché ou éléments de consultation)'
                      : readOnly
                        ? 'Consulter les devis et pièces complémentaires de la DA'
                        : 'Gérer les devis et pièces complémentaires de la DA'
                  }
                >
                  <button
                    type="button"
                    className="gp-btn gp-btn--secondary"
                    disabled={idFournisseurRetenu === null}
                    onClick={() => setGestionDocumentaireOpen(true)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <svg className="ti">
                      <use href="#i-folder" />
                    </svg>
                    Gestion documentaire
                  </button>
                </span>
              </div>
            </div>

            <div className="row">
              <div className="gp-field" style={{ flex: '0 0 21.25%' }}>
                <label className="gp-label" htmlFor="da-montant">
                  Montant DA
                </label>
                <input id="da-montant" className="gp-input" value={formatMontantDecimal(montant) || '—'} readOnly />
              </div>
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
            <button type="button" className="gp-btn gp-btn--secondary" onClick={() => void handleClose()}>
              {readOnly ? 'Fermer' : 'Retour'}
            </button>
            {!readOnly && (
              <button type="submit" className="gp-btn gp-btn--primary" disabled={submitting}>
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
        </form>
      </div>

      {marcheModalOpen && (
        <MarcheDaModal
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          currentNummarche={nummarche}
          currentIdMarcheTiers={idMarcheTiers}
          initialMontant={montant}
          onClose={() => setMarcheModalOpen(false)}
          onSelected={(da) => {
            setNummarche(da.nummarche)
            setIdMarcheTiers(da.id_marche_tiers)
            setIdFournisseurRetenu(da.id_fournisseur_retenu)
            setMontant(String(da.montant_demande || ''))
          }}
        />
      )}

      {fournisseurModalOpen && (
        <FournisseurDaModal
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          initialMotifChoix={motifChoix}
          initialLibelleMotifChoix={libelleMotifChoix}
          onClose={() => setFournisseurModalOpen(false)}
          onSaved={(da, count) => {
            setIdFournisseurRetenu(da.id_fournisseur_retenu)
            setMotifChoix(da.motif_choix)
            setLibelleMotifChoix(da.libelle_motif_choix)
            // Nettoyage croisé (bug corrigé le 09/09/2026) : le backend efface NUMMARCHE/ID_MARCHE_TIERS au même appel.
            setNummarche(da.nummarche)
            setIdMarcheTiers(da.id_marche_tiers)
            // MONTANT_DEMANDE dérivé du candidat retenu (décision du 09/09/2026) — voir formatMontantDecimal, affichage seul dans CreationDA.
            setMontant(String(da.montant_demande || ''))
            setCandidatsCount(count)
          }}
        />
      )}

      {gestionDocumentaireOpen && idFournisseurRetenu !== null && (
        <GestionDocumentaireModal
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          procedureAchat={procedureAchat}
          objetDa={objet}
          idFournisseurRetenu={idFournisseurRetenu}
          montantDemande={Number(montant) || 0}
          readOnly={readOnly}
          roleHint={roleHint}
          onClose={() => setGestionDocumentaireOpen(false)}
        />
      )}
    </div>
  )
}

export interface MarcheDaModalProps {
  idDemandeAchat: number
  idService: number
  currentNummarche: string | null
  currentIdMarcheTiers: number | null
  initialMontant: string
  onClose: () => void
  onSelected: (demandeAchat: DemandeAchatRow) => void
}

const FILTRE_MARCHE_OPTIONS = [
  { value: 'MARCHE', label: 'Marché service' },
  { value: 'MARCHE_TIERS', label: 'Marché tiers' },
  { value: 'TOUS', label: 'Tous' },
]

/** Jours restants avant DTEFINMAX (arrondi au jour), `null` si la date n'est pas renseignée. */
function joursRestants(dtefinmax: string | null): number | null {
  if (!dtefinmax) return null
  const diffMs = new Date(`${dtefinmax}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(diffMs / 86400000)
}

interface MarcheDaRow {
  key: string
  origin: 'MARCHE' | 'MARCHE_TIERS'
  numero: string
  fournisseur: string
  libelle: string
  jours: number | null
  alertedate: number
  /** `null` pour un marché tiers (pas d'alerte sur montant, croquis DA.pdf page 3). */
  montantRestant: number | null
  seuilMontant: number | null
  select: { nummarche: string | null; idMarcheTiers: number | null }
}

type MarcheDaColumn = 'numero' | 'fournisseur' | 'libelle' | 'alertedate' | 'alertemt'

/**
 * Écran MarcheDA (bouton « Marché concerné », CreationDA — procédure MARCHE
 * uniquement, croquis DA.pdf page 3) : liste combinée des marchés du service
 * (finances.marche, UTILISABLE = ACTIF ET COMPLETUDE) et des marchés tiers
 * (finances.marche_tiers, ACTIF), filtrable par « Filtre marché » (Marché
 * service/Marché tiers/Tous) et par recherche texte client (numéro,
 * fournisseur, libellé — aucun paramètre de recherche serveur, même principe
 * que MarchesPGI.tsx/MarchesTiers.tsx). Sélection par clic sur la ligne
 * (bascule), saisie du montant obligatoire, « Enregistrer » commet le tout en
 * un seul appel à PUT /demandes-achat/:id/marche (ID_FOURNISSEUR_RETENU/
 * MOTIF_CHOIX dérivés côté serveur, jamais ici).
 */
export function MarcheDaModal({
  idDemandeAchat,
  idService,
  currentNummarche,
  currentIdMarcheTiers,
  initialMontant,
  onClose,
  onSelected,
}: MarcheDaModalProps) {
  const [filtre, setFiltre] = useState<string | null>('TOUS')
  const [search, setSearch] = useState('')
  const [montant, setMontant] = useState(initialMontant)
  const [montantFocused, setMontantFocused] = useState(false)
  const [selection, setSelection] = useState<{ nummarche: string | null; idMarcheTiers: number | null }>({
    nummarche: currentNummarche,
    idMarcheTiers: currentIdMarcheTiers,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { marches } = useMarches(idService)
  const { marcheTiers } = useMarcheTiers(idService)
  const { fournisseurs } = useFournisseurs(idService)
  const fournisseurLabel = (idFournisseur: number) => fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'

  const rowsMarche: MarcheDaRow[] = marches
    .filter((m) => m.utilisable)
    .map((m) => ({
      key: m.nummarche,
      origin: 'MARCHE',
      numero: m.nummarche,
      fournisseur: m.fournisseur_raison_sociale ?? '—',
      libelle: m.libelle_service ?? '—',
      jours: joursRestants(m.dtefinmax),
      alertedate: m.alertedate,
      montantRestant: m.mt_solde,
      seuilMontant: m.mtmaxi != null ? m.alertemt * m.mtmaxi : null,
      select: { nummarche: m.nummarche, idMarcheTiers: null },
    }))
  const rowsMarcheTiers: MarcheDaRow[] = marcheTiers
    .filter((m) => m.actif)
    .map((m) => ({
      key: String(m.id_marche_tiers),
      origin: 'MARCHE_TIERS',
      numero: m.nummarche,
      fournisseur: fournisseurLabel(m.id_fournisseur),
      libelle: m.libelle_service,
      jours: joursRestants(m.dtefinmax),
      alertedate: m.alertedate,
      montantRestant: null,
      seuilMontant: null,
      select: { nummarche: null, idMarcheTiers: m.id_marche_tiers },
    }))

  const searchLc = search.trim().toLowerCase()
  const rows = (filtre === 'MARCHE' ? rowsMarche : filtre === 'MARCHE_TIERS' ? rowsMarcheTiers : [...rowsMarche, ...rowsMarcheTiers]).filter(
    (r) => !searchLc || r.numero.toLowerCase().includes(searchLc) || r.fournisseur.toLowerCase().includes(searchLc) || r.libelle.toLowerCase().includes(searchLc),
  )

  const { sort, toggleSort } = useColumnSort<MarcheDaColumn>()
  const displayedRows = sortRows(rows, sort, (r, column) => {
    if (column === 'numero') return r.numero
    if (column === 'fournisseur') return r.fournisseur
    if (column === 'libelle') return r.libelle
    if (column === 'alertedate') return String(r.jours ?? -1)
    return String(r.montantRestant ?? -1)
  })

  const isSelected = (r: MarcheDaRow) => r.select.nummarche === selection.nummarche && r.select.idMarcheTiers === selection.idMarcheTiers

  function toggleSelect(r: MarcheDaRow) {
    setSelection(isSelected(r) ? { nummarche: null, idMarcheTiers: null } : r.select)
  }

  async function handleSubmit() {
    setError(null)
    if (!montant.trim()) {
      setError('Le montant est obligatoire.')
      return
    }
    setSubmitting(true)
    try {
      const da = await selectMarcheDemandeAchat(idDemandeAchat, { ...selection, montantDemande: Number(montant) })
      onSelected(da)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="marcheDaModalTitle" style={{ maxWidth: 1196 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="marcheDaModalTitle">
            Sélectionner un marché
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="gp-field" style={{ flex: 1 }}>
              <label className="gp-label" htmlFor="marcheda-recherche">
                Recherche
              </label>
              <div className="gp-inputgroup">
                <svg className="ti">
                  <use href="#i-search" />
                </svg>
                <input
                  id="marcheda-recherche"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Recherche sur numéro marché, fournisseur, libellé…"
                  aria-label="Recherche sur numéro marché, fournisseurs, libelle marche"
                />
              </div>
            </div>
            <div className="gp-field" style={{ width: 200 }}>
              <label className="gp-label">Filtre marché</label>
              <Combobox
                options={FILTRE_MARCHE_OPTIONS}
                value={filtre}
                onChange={setFiltre}
                placeholder="Tous"
                ariaLabel="Filtre marché"
                style={{ maxWidth: 'none' }}
              />
            </div>
          </div>

          <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 320 }}>
            <table className="gp-table da-marche-table">
              <colgroup>
                <col style={{ width: 109 }} />
                <col style={{ width: 226 }} />
                <col style={{ width: 546 }} />
                <col style={{ width: 124 }} />
                <col style={{ width: 106 }} />
              </colgroup>
              <thead>
                <tr>
                  <SortableTh label="Numéro marche" column="numero" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Fournisseur" column="fournisseur" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Libelle" column="libelle" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Alerte date" column="alertedate" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Alerte MT" column="alertemt" sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((r) => (
                  <tr key={r.key} className={isSelected(r) ? 'is-sel' : undefined} onClick={() => toggleSelect(r)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{r.numero}</td>
                    <td>{r.fournisseur}</td>
                    <td>{r.libelle}</td>
                    <td>
                      {r.jours !== null && (
                        <span className={`da-alert-dot ${r.jours >= r.alertedate ? 'da-alert-dot--ok' : 'da-alert-dot--warn'}`} />
                      )}
                      {r.jours !== null ? `${r.jours} jours` : '—'}
                    </td>
                    <td>
                      {r.origin === 'MARCHE_TIERS' ? (
                        <span className="da-alert-tiers" title="Marché tiers — pas d'alerte sur montant">
                          <svg className="ti">
                            <use href="#i-chevron-right" />
                          </svg>
                        </span>
                      ) : (
                        <>
                          {r.montantRestant !== null && r.seuilMontant !== null && (
                            <span className={`da-alert-dot ${r.montantRestant >= r.seuilMontant ? 'da-alert-dot--ok' : 'da-alert-dot--warn'}`} />
                          )}
                          {r.montantRestant !== null ? CURRENCY_FORMAT_ROUND.format(r.montantRestant) : '—'}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {displayedRows.length === 0 && (
                  <tr>
                    <td colSpan={5}>Aucun résultat.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="gp-field" style={{ width: 220 }}>
            <label className="gp-label" htmlFor="marcheda-montant">
              Montant de la demande d'achat
            </label>
            <input
              id="marcheda-montant"
              className="gp-input"
              value={montantFocused ? montant : formatMontantDecimal(montant)}
              onChange={(e) => setMontant(sanitizeDecimal(e.target.value))}
              onFocus={() => setMontantFocused(true)}
              onBlur={() => setMontantFocused(false)}
              inputMode="decimal"
              placeholder="Saisie du Montant"
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export interface InvestissementDaModalProps {
  investissements: OperationInvestissement[]
  currentNumeroOperation: string | null
  onClose: () => void
  onSelected: (numeroOperation: string) => void
}

/**
 * Modale de sélection de l'opération d'investissement (TraiterFadRcModal, imputation
 * comptable INVESTISSEMENT, décision du 16/09/2026) — liste des opérations UTILISABLE du
 * service, recherche texte client (numéro, libellé). Contrairement à MarcheDaModal, purement
 * locale : « Enregistrer » commet juste NUMERO_OPERATION dans le formulaire parent (pas
 * d'appel API ici — transmis avec le reste à transmettreFad/retransmettreCb).
 */
export function InvestissementDaModal({ investissements, currentNumeroOperation, onClose, onSelected }: InvestissementDaModalProps) {
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<string | null>(currentNumeroOperation)

  const searchLc = search.trim().toLowerCase()
  const rows = investissements.filter((i) => i.utilisable).filter((i) => {
    if (!searchLc) return true
    const libelle = i.libelle_service ?? i.libelle
    return i.numero_operation.toLowerCase().includes(searchLc) || libelle.toLowerCase().includes(searchLc)
  })

  function handleSubmit() {
    if (selection) onSelected(selection)
    onClose()
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="investissementDaModalTitle" style={{ maxWidth: 1196 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="investissementDaModalTitle">
            Sélectionner une opération d'investissement « utilisable »
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="gp-field">
            <label className="gp-label" htmlFor="investissementda-recherche">
              Recherche
            </label>
            <div className="gp-inputgroup">
              <svg className="ti">
                <use href="#i-search" />
              </svg>
              <input
                id="investissementda-recherche"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Recherche sur numéro, libellé…"
                aria-label="Recherche sur numéro, libellé opération"
              />
            </div>
          </div>

          <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 320 }}>
            <table className="gp-table">
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Libellé</th>
                  <th>Montant travaux</th>
                  <th>Montant FESI</th>
                  <th>MT AP.1</th>
                  <th>MT AP.8</th>
                  <th>MT CP.1</th>
                  <th>MT CP.8</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr
                    key={i.numero_operation}
                    className={selection === i.numero_operation ? 'is-sel' : undefined}
                    onClick={() => setSelection(i.numero_operation)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono">{i.numero_operation}</td>
                    <td>{i.libelle_service ?? i.libelle}</td>
                    <td>{CURRENCY_FORMAT_ROUND.format(i.mt_travaux)}</td>
                    <td>{CURRENCY_FORMAT_ROUND.format(i.mt_fesi)}</td>
                    <td>{CURRENCY_FORMAT_ROUND.format(i.mt_budget_ap1)}</td>
                    <td>{CURRENCY_FORMAT_ROUND.format(i.mt_budget_ap8)}</td>
                    <td>{CURRENCY_FORMAT_ROUND.format(i.mt_budget_cp1)}</td>
                    <td>{CURRENCY_FORMAT_ROUND.format(i.mt_budget_cp8)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8}>Aucun résultat.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="gp-modal__ft">
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={!selection} onClick={handleSubmit}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

const MAX_CANDIDATS = 5
const MOTIF_CHOIX_OPTIONS: MotifChoix[] = ['Prix', 'Délai', 'Technique', 'Autre']

interface FournisseurCandidat {
  idDevis: number
  idFournisseur: number
  montantDevis: string
  /** Format ISO (YYYY-MM-DD), lié à un <input type="date"> — voir demandeAchat.service.ts#genererFadPdf (fiche FAD papier, bouton CB). */
  delaiLivraison: string
  nomFichierOriginal: string | null
}

export interface FournisseurDaModalProps {
  idDemandeAchat: number
  idService: number
  initialMotifChoix: MotifChoix | null
  initialLibelleMotifChoix: string | null
  onClose: () => void
  /** `candidatsCount` : nombre d'entreprises consultées au moment de l'enregistrement — voir le résumé « Nom fournisseur — n entreprise(s) consultée(s) » de CreationDA. */
  onSaved: (demandeAchat: DemandeAchatRow, candidatsCount: number) => void
}

/**
 * Écran FournisseurDA (bouton « Éléments de consultation », CreationDA —
 * procédure HORS_MARCHE uniquement, croquis DA.pdf page 4) : liste des
 * entreprises consultées (1 à 5, sans doublon), ordonnée par glisser-déposer
 * (useDragReorder — le premier candidat est le retenu), montant du devis
 * pour chacune, motif du choix (libellé obligatoire si "Autre").
 * Adaptation du widget double-liste-avec-flèches du croquis en icônes
 * d'action par ligne (Ajouter/Retirer), pour rester cohérent avec le reste
 * de l'application (aucun composant "liste à transférer" ailleurs dans ce
 * codebase).
 *
 * Ajout/retrait d'un candidat écrit immédiatement en base (décision du
 * 09/09/2026 — addConsultationCandidat/removeConsultationCandidat) au lieu
 * d'être stocké seulement en état local jusqu'à « Enregistrer » : la ligne
 * DEVIS_CONSULTE doit exister dès l'ajout pour que le bouton « Gestion
 * documentaire » de CreationDA fonctionne avant même le premier
 * « Enregistrer » de la liste. « Enregistrer » ne fait plus que fixer
 * l'ordre/le montant/le motif (voir saveConsultationDemandeAchat) — il ne
 * crée ni ne supprime plus de ligne. La gestion documentaire (devis/pièces
 * complémentaires) a été retirée de cette modale le 09/09/2026 — elle
 * s'effectue désormais depuis CreationDA (bouton « Gestion documentaire »,
 * voir GestionDocumentaireModal).
 */
export function FournisseurDaModal({
  idDemandeAchat,
  idService,
  initialMotifChoix,
  initialLibelleMotifChoix,
  onClose,
  onSaved,
}: FournisseurDaModalProps) {
  const [loading, setLoading] = useState(true)
  const [candidats, setCandidats] = useState<FournisseurCandidat[]>([])
  const [search, setSearch] = useState('')
  const [motifChoix, setMotifChoixState] = useState<MotifChoix | null>(initialMotifChoix ?? 'Prix')
  const [libelleAutreMotif, setLibelleAutreMotif] = useState(initialLibelleMotifChoix ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedMontantId, setFocusedMontantId] = useState<number | null>(null)
  const [pendingIdFournisseur, setPendingIdFournisseur] = useState<number | null>(null)

  const { fournisseurs } = useFournisseurs(idService)
  const { services } = useServices()
  const libelleService = services.find((s) => s.id_service === idService)?.libelle_service

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getConsultationDemandeAchat(idDemandeAchat)
      .then((rows) => {
        if (cancelled) return
        setCandidats(
          [...rows]
            .sort((a, b) => a.ordre - b.ordre)
            .map((r) => ({
              idDevis: r.idDevis,
              idFournisseur: r.idFournisseur,
              montantDevis: r.montantDevis != null ? String(r.montantDevis) : '',
              delaiLivraison: r.delaiLivraison ?? '',
              nomFichierOriginal: r.nomFichierOriginal,
            })),
        )
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les entreprises déjà consultées.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idDemandeAchat])

  const fournisseurLabel = (idFournisseur: number) => fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'

  const searchLc = search.trim().toLowerCase()
  const idsConsultes = new Set(candidats.map((c) => c.idFournisseur))
  const fournisseursDisponibles = fournisseurs
    .filter((f) => !idsConsultes.has(f.id_fournisseur))
    .filter((f) => !searchLc || f.raison_sociale_service.toLowerCase().includes(searchLc))

  async function ajouterCandidat(idFournisseur: number) {
    if (candidats.length >= MAX_CANDIDATS || pendingIdFournisseur !== null) return
    setError(null)
    setPendingIdFournisseur(idFournisseur)
    try {
      const candidat = await addConsultationCandidat(idDemandeAchat, idFournisseur)
      setCandidats((prev) => [
        ...prev,
        {
          idDevis: candidat.idDevis,
          idFournisseur: candidat.idFournisseur,
          montantDevis: '',
          delaiLivraison: '',
          nomFichierOriginal: candidat.nomFichierOriginal,
        },
      ])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setPendingIdFournisseur(null)
    }
  }

  async function retirerCandidat(candidat: FournisseurCandidat) {
    if (pendingIdFournisseur !== null) return
    setError(null)
    setPendingIdFournisseur(candidat.idFournisseur)
    try {
      await removeConsultationCandidat(idDemandeAchat, candidat.idDevis)
      setCandidats((prev) => prev.filter((c) => c.idDevis !== candidat.idDevis))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setPendingIdFournisseur(null)
    }
  }

  function changerMontant(idDevis: number, value: string) {
    setCandidats((prev) => prev.map((c) => (c.idDevis === idDevis ? { ...c, montantDevis: sanitizeDecimal(value) } : c)))
  }

  function changerDelai(idDevis: number, value: string) {
    setCandidats((prev) => prev.map((c) => (c.idDevis === idDevis ? { ...c, delaiLivraison: value } : c)))
  }

  const reorder = useDragReorder(
    candidats.map((c) => String(c.idDevis)),
    (newOrderKeys) => {
      const byId = new Map(candidats.map((c) => [String(c.idDevis), c]))
      setCandidats(newOrderKeys.map((key) => byId.get(key)!))
    },
  )

  async function handleSubmit() {
    setError(null)

    if (candidats.length === 0) {
      setError('Au moins une entreprise consultée est requise.')
      return
    }
    if (candidats.some((c) => !c.montantDevis.trim())) {
      setError('Le montant du devis est obligatoire pour chaque entreprise consultée.')
      return
    }
    if (!motifChoix) {
      setError('Le motif du choix est obligatoire.')
      return
    }
    if (motifChoix === 'Autre' && !libelleAutreMotif.trim()) {
      setError('Le libellé du motif est obligatoire quand le motif est "Autre".')
      return
    }

    setSubmitting(true)
    try {
      const da = await saveConsultationDemandeAchat(idDemandeAchat, {
        candidats: candidats.map((c) => ({
          idDevis: c.idDevis,
          montantDevis: Number(c.montantDevis),
          delaiLivraison: c.delaiLivraison.trim() === '' ? null : c.delaiLivraison,
        })),
        motifChoix,
        libelleMotifChoix: motifChoix === 'Autre' ? libelleAutreMotif.trim() : undefined,
      })
      onSaved(da, candidats.length)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="fournisseurDaModalTitle" style={{ maxWidth: 900 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="fournisseurDaModalTitle">
            Éléments de consultation
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
            <div className="stack" style={{ gap: 16 }}>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                  <label className="gp-label" htmlFor="fournisseurda-recherche">
                    Fournisseurs{libelleService ? ` : ${libelleService}` : ''}
                  </label>
                  <div className="gp-inputgroup" style={{ flex: 1 }}>
                    <svg className="ti">
                      <use href="#i-search" />
                    </svg>
                    <input
                      id="fournisseurda-recherche"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Recherche libellé fournisseur…"
                      aria-label="Rechercher un fournisseur"
                    />
                  </div>
                </div>
                {/* Hauteur fixe = 5 lignes (25px/ligne, -30% des 36px par défaut de .gp-table — voir .da-fournisseurda-table), au-delà on scrolle. */}
                <div className="gp-table-wrap gp-scroll" style={{ height: 126 }}>
                  <table className="gp-table da-fournisseurda-table">
                    <tbody>
                      {fournisseursDisponibles.map((f) => (
                        <tr key={f.id_fournisseur}>
                          <td>{f.raison_sociale_service}</td>
                          <td style={{ width: 40 }}>
                            {/* title natif plutôt que .gp-tip (rogné par le scroll de la liste — voir commentaire sur la hauteur fixe ci-dessus). */}
                            <div className="gp-rowacts">
                              <button
                                type="button"
                                title={candidats.length >= MAX_CANDIDATS ? '5 entreprises consultées maximum' : 'Ajouter aux consultées'}
                                aria-label={`Ajouter ${f.raison_sociale_service} aux consultées`}
                                disabled={candidats.length >= MAX_CANDIDATS || pendingIdFournisseur !== null}
                                onClick={() => void ajouterCandidat(f.id_fournisseur)}
                              >
                                <svg className="ti" style={{ color: 'var(--gp-success)' }}>
                                  <use href="#i-circle-plus" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {fournisseursDisponibles.length === 0 && (
                        <tr>
                          <td>Aucun fournisseur.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="stack" style={{ gap: 8 }}>
                <span className="gp-label">
                  {candidats.length} entreprise(s) consultée(s)
                </span>
                {/* Hauteur fixe = 3 lignes (41px/ligne — voir .da-consultees-table), au-delà on scrolle. */}
                <div className="gp-table-wrap gp-scroll" style={{ height: 123 }}>
                  <table className="gp-table da-consultees-table">
                    <tbody>
                      {candidats.map((c, index) => {
                        const key = String(c.idDevis)
                        return (
                          <tr key={key} {...reorder.dragProps(key)} style={{ opacity: reorder.draggedKey === key ? 0.5 : undefined }}>
                            <td className="mono" style={{ width: 24, cursor: 'grab' }} aria-label="Glisser pour réordonner">
                              <svg className="ti">
                                <use href="#i-grip-vertical" />
                              </svg>
                            </td>
                            <td>
                              {fournisseurLabel(c.idFournisseur)}
                              {index === 0 && <span className="gp-badge gp-badge--success" style={{ marginLeft: 6 }}>Retenu</span>}
                            </td>
                            <td style={{ width: 150 }}>
                              <input
                                className="gp-input gp-input--compact"
                                value={focusedMontantId === c.idDevis ? c.montantDevis : formatMontantDecimal(c.montantDevis)}
                                onChange={(e) => changerMontant(c.idDevis, e.target.value)}
                                onFocus={() => setFocusedMontantId(c.idDevis)}
                                onBlur={() => setFocusedMontantId(null)}
                                inputMode="decimal"
                                placeholder="Montant devis"
                                aria-label={`Montant du devis — ${fournisseurLabel(c.idFournisseur)}`}
                              />
                            </td>
                            <td style={{ width: 140 }}>
                              <DatePicker
                                value={c.delaiLivraison || null}
                                onChange={(value) => changerDelai(c.idDevis, value ?? '')}
                                ariaLabel={`Délai annoncé — ${fournisseurLabel(c.idFournisseur)}`}
                              />
                            </td>
                            <td style={{ width: 40 }}>
                              {/* title natif plutôt que .gp-tip (rogné par le scroll de la liste). */}
                              <div className="gp-rowacts">
                                <button
                                  className="del"
                                  title="Retirer des consultées"
                                  aria-label={`Retirer ${fournisseurLabel(c.idFournisseur)} des consultées`}
                                  disabled={pendingIdFournisseur !== null}
                                  onClick={() => void retirerCandidat(c)}
                                >
                                  <svg className="ti">
                                    <use href="#i-x" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {candidats.length === 0 && (
                        <tr>
                          <td>Aucune entreprise consultée pour l'instant.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="gp-field">
            <span className="gp-label">Motif du choix</span>
            <div className="row" style={{ gap: 16, marginTop: 6, alignItems: 'center' }}>
              {MOTIF_CHOIX_OPTIONS.map((option) => (
                <label className="gp-choice da-motif-choice" key={option}>
                  <input
                    className="gp-radio"
                    type="radio"
                    name="fournisseurda-motif"
                    checked={motifChoix === option}
                    onChange={() => setMotifChoixState(option)}
                  />
                  {option}
                </label>
              ))}
              {motifChoix === 'Autre' && (
                <input
                  className="gp-input"
                  style={{ flex: 1, minWidth: 160 }}
                  value={libelleAutreMotif}
                  onChange={(e) => setLibelleAutreMotif(e.target.value)}
                  placeholder="Libellé autre motif"
                  aria-label="Libellé autre motif"
                />
              )}
            </div>
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export interface GestionDocumentaireModalProps {
  idDemandeAchat: number
  idService: number
  procedureAchat: ProcedureAchat
  objetDa: string
  /** Fournisseur déjà identifié (marché retenu ou premier candidat consulté) — le bouton d'ouverture est désactivé tant qu'il vaut `null`. */
  idFournisseurRetenu: number
  /** DEMANDE_ACHAT.MONTANT_DEMANDE — montant affiché à côté du sélecteur Fournisseurs en procédure Marché (un seul fournisseur, DEVIS_CONSULTE.MONTANT_DEVIS non significatif pour cette procédure). En Hors marché, le montant affiché est celui du devis du fournisseur sélectionné (chacun le sien), ce prop n'est alors pas utilisé. */
  montantDemande: number
  /**
   * Mode consultation (décision du 16/09/2026, modale « Valider les éléments
   * de la commande » du CDS) : masque Ajouter/Remplacer/Supprimer sur le
   * devis et les pièces complémentaires — seuls l'affichage et le
   * téléchargement restent. Faux par défaut (comportement inchangé pour
   * CreationDA).
   */
  readOnly?: boolean
  /**
   * Devis seul verrouillé, pièces complémentaires restant modifiables
   * (décision du 17/09/2026 — RC, ValiderCommandeRcModal/TraiterFadRcModal) :
   * tant que le RC n'a pas (re)transmis la FAD au N+2, il peut compléter la
   * base documentaire mais pas toucher au devis retenu. L'icône devis reste
   * visible mais désactivée (grisée) plutôt que masquée — Télécharger reste
   * actif. Indépendant de `readOnly` ci-dessus (CDS, lui, n'a droit à rien
   * du tout). Voir demandeAchat.service.ts#STATUTS_PIECES_MODIFIABLES pour
   * le verrou équivalent côté backend.
   */
  devisReadOnly?: boolean
  /**
   * Écrans de suivi CDS/CB (décision du 18/09/2026 — corrige au passage un
   * bug latent identique pour CDS, jamais couvert par un test d'intégration
   * réel) : un acteur CDS/CB pur (sans rôle RC ni ADMIN_*) n'est reconnu par
   * le backend que via ce hint explicite (voir
   * demandeAchat.service.ts#resolveAccessContext) — sans lui, la
   * consultation/les pièces/le téléchargement du devis d'une FAD qui n'est
   * pas la sienne se solderaient par un 403, même en pure lecture.
   */
  roleHint?: 'CDS' | 'CB'
  onClose: () => void
}

/**
 * Écran unifié de gestion documentaire (bouton « Gestion documentaire »,
 * CreationDA — décision du 09/09/2026, croquis DA2.pdf page 1 ; passé en
 * liste de fournisseurs le 17/09/2026, esquisse fournie par l'utilisateur —
 * remplace le sélecteur Fournisseurs à choix unique par une ligne par
 * fournisseur, chacune avec son devis et ses pièces complémentaires propres,
 * plus lisible dès qu'il y a plusieurs candidats en Hors Marché). Devis
 * (DEVIS_CONSULTE) et pièces complémentaires (PIECE_JOINTE) par fournisseur —
 * un seul fournisseur (donc une seule ligne) en procédure Marché (le
 * titulaire), une ligne par candidat consulté en Hors marché.
 */
export function GestionDocumentaireModal({
  idDemandeAchat,
  idService,
  procedureAchat,
  objetDa,
  idFournisseurRetenu,
  montantDemande,
  readOnly = false,
  devisReadOnly = false,
  roleHint,
  onClose,
}: GestionDocumentaireModalProps) {
  const [loading, setLoading] = useState(true)
  const [candidats, setCandidats] = useState<ConsultationCandidat[]>([])
  const [pieceCounts, setPieceCounts] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [devisModalIdFournisseur, setDevisModalIdFournisseur] = useState<number | null>(null)
  const [devisCreatingIdFournisseur, setDevisCreatingIdFournisseur] = useState<number | null>(null)
  const [piecesModalIdFournisseur, setPiecesModalIdFournisseur] = useState<number | null>(null)

  const { fournisseurs } = useFournisseurs(idService)
  const fournisseurLabel = (idFournisseur: number) => fournisseurs.find((f) => f.id_fournisseur === idFournisseur)?.raison_sociale_service ?? '—'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getConsultationDemandeAchat(idDemandeAchat, roleHint)
      .then((rows) => {
        if (!cancelled) setCandidats(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les éléments déjà déposés.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idDemandeAchat, roleHint])

  // Marché : une seule ligne (le titulaire), même si sa ligne DEVIS_CONSULTE n'existe pas encore.
  // Hors marché : une ligne par candidat déjà consulté (voir FournisseurDA) — jamais de ligne de plus.
  const rows: { idFournisseur: number; candidat: ConsultationCandidat | null }[] =
    procedureAchat === 'MARCHE'
      ? [{ idFournisseur: idFournisseurRetenu, candidat: candidats.find((c) => c.idFournisseur === idFournisseurRetenu) ?? null }]
      : candidats.map((c) => ({ idFournisseur: c.idFournisseur, candidat: c }))

  // Clé stable (indépendante de la référence du tableau `candidats`) pour ne recharger les
  // compteurs de pièces que quand l'ensemble des fournisseurs affichés change réellement.
  const rowIdsKey = rows.map((r) => r.idFournisseur).join(',')

  useEffect(() => {
    const idsFournisseur = rowIdsKey === '' ? [] : rowIdsKey.split(',').map(Number)
    if (idsFournisseur.length === 0) {
      setPieceCounts({})
      return
    }
    let cancelled = false
    Promise.all(idsFournisseur.map((id) => getPiecesDemandeAchat(idDemandeAchat, id, roleHint).then((list) => [id, list.length] as const)))
      .then((entries) => {
        if (!cancelled) setPieceCounts(Object.fromEntries(entries))
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les pièces complémentaires.')
      })
    return () => {
      cancelled = true
    }
  }, [idDemandeAchat, rowIdsKey, roleHint])

  /** MARCHE uniquement : la ligne DEVIS_CONSULTE peut ne pas encore exister (jamais ouverte via l'ancien bouton « Ajouter Devis » de MarcheDA) — créée à la volée. En Hors Marché, `candidat` existe toujours (voir `rows` ci-dessus). */
  async function handleOpenDevisModal(idFournisseur: number, candidat: ConsultationCandidat | null) {
    if (candidat) {
      setDevisModalIdFournisseur(idFournisseur)
      return
    }
    setError(null)
    setDevisCreatingIdFournisseur(idFournisseur)
    try {
      const created = await getOrCreateMarcheDevis(idDemandeAchat)
      setCandidats((prev) => [...prev, created])
      setDevisModalIdFournisseur(idFournisseur)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDevisCreatingIdFournisseur(null)
    }
  }

  async function handleTelechargerDevis(candidat: ConsultationCandidat) {
    if (!candidat.nomFichierOriginal) return
    try {
      const blob = await downloadDevisFileBlob(idDemandeAchat, candidat.idDevis, roleHint)
      triggerBlobDownload(blob, candidat.nomFichierOriginal)
    } catch {
      setError('Impossible de télécharger le devis.')
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="gestionDocumentaireModalTitle" style={{ maxWidth: 640 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="gestionDocumentaireModalTitle">
            Gestion documentaire
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
            <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'hidden' }}>
              {/* table-layout:fixed/minWidth:0 — voir la même note historique sur le tableau Pièces complémentaires (PiecesComplementairesModal). */}
              <table className="gp-table" style={{ tableLayout: 'fixed', minWidth: 0, width: '100%' }}>
                <colgroup>
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 56 }} />
                  <col style={{ width: 56 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th>Montant</th>
                    <th>Devis</th>
                    <th>Pièces</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ idFournisseur, candidat }, index) => {
                    const label = fournisseurLabel(idFournisseur)
                    const montant = procedureAchat === 'MARCHE' ? montantDemande : (candidat?.montantDevis ?? null)
                    const hasDevis = Boolean(candidat?.nomFichierOriginal)
                    const count = pieceCounts[idFournisseur] ?? 0
                    return (
                      <tr key={idFournisseur}>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
                          {label}
                          {rows.length > 1 && index === 0 && (
                            <span className="gp-badge gp-badge--success" style={{ marginLeft: 6 }}>
                              Retenu
                            </span>
                          )}
                        </td>
                        <td>{montant !== null ? CURRENCY_FORMAT.format(montant) : '—'}</td>
                        <td>
                          <div className="gp-rowacts">
                            {!readOnly && (
                              <span
                                className="gp-tip"
                                data-tip={devisReadOnly ? 'Devis verrouillé tant que la FAD n\'est pas (re)transmise' : hasDevis ? 'Remplacer le devis' : 'Ajouter le devis'}
                              >
                                <button
                                  type="button"
                                  aria-label={`${hasDevis ? 'Remplacer' : 'Ajouter'} le devis — ${label}`}
                                  disabled={devisReadOnly || devisCreatingIdFournisseur === idFournisseur}
                                  onClick={() => void handleOpenDevisModal(idFournisseur, candidat)}
                                >
                                  <svg className="ti" style={{ color: devisReadOnly ? undefined : hasDevis ? 'var(--gp-success)' : 'var(--gp-danger)' }}>
                                    <use href="#i-file-invoice" />
                                  </svg>
                                </button>
                              </span>
                            )}
                            <span className="gp-tip" data-tip="Télécharger le devis">
                              <button
                                type="button"
                                aria-label={`Télécharger le devis — ${label}`}
                                disabled={!hasDevis}
                                onClick={() => candidat && void handleTelechargerDevis(candidat)}
                              >
                                <svg className="ti">
                                  <use href="#i-download" />
                                </svg>
                              </button>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="gp-rowacts">
                            <span className="gp-tip" data-tip="Pièces complémentaires">
                              <button
                                type="button"
                                aria-label={count > 0 ? `Pièces complémentaires — ${label} (${count})` : `Pièces complémentaires — ${label}`}
                                onClick={() => setPiecesModalIdFournisseur(idFournisseur)}
                              >
                                <svg className="ti" style={{ color: 'var(--gp-primary)' }}>
                                  <use href="#i-files" />
                                </svg>
                              </button>
                              <PieceCountBadge count={count} />
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4}>Aucun fournisseur consulté.</td>
                    </tr>
                  )}
                </tbody>
              </table>
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
            Fermer
          </button>
        </div>
      </div>

      {!readOnly &&
        devisModalIdFournisseur !== null &&
        (() => {
          const candidat = candidats.find((c) => c.idFournisseur === devisModalIdFournisseur) ?? null
          return (
            <AddPieceDaModal
              kind="DEVIS"
              idDemandeAchat={idDemandeAchat}
              idDevis={candidat?.idDevis}
              idFournisseur={devisModalIdFournisseur}
              objetDa={objetDa}
              fournisseurLabel={fournisseurLabel(devisModalIdFournisseur)}
              currentNomFichier={candidat?.nomFichierOriginal ?? null}
              onClose={() => setDevisModalIdFournisseur(null)}
              onUploadedDevis={(updated) => setCandidats((prev) => prev.map((c) => (c.idDevis === updated.idDevis ? updated : c)))}
            />
          )
        })()}

      {piecesModalIdFournisseur !== null && (
        <PiecesComplementairesModal
          idDemandeAchat={idDemandeAchat}
          idFournisseur={piecesModalIdFournisseur}
          fournisseurLabel={fournisseurLabel(piecesModalIdFournisseur)}
          objetDa={objetDa}
          readOnly={readOnly}
          roleHint={roleHint}
          onClose={() => setPiecesModalIdFournisseur(null)}
          onCountChange={(count) => setPieceCounts((prev) => ({ ...prev, [piecesModalIdFournisseur]: count }))}
        />
      )}
    </div>
  )
}

export interface AddPieceDaModalProps {
  kind: 'DEVIS' | 'PIECE_COMPLEMENTAIRE'
  idDemandeAchat: number
  /** Requis quand `kind === 'DEVIS'`. */
  idDevis?: number
  idFournisseur: number
  objetDa: string
  fournisseurLabel: string
  currentNomFichier: string | null
  /** Écrans de suivi CDS/CB (décision du 18/09/2026), pertinent uniquement pour `kind === 'PIECE_COMPLEMENTAIRE'` — voir GestionDocumentaireModalProps#roleHint. */
  roleHint?: 'CDS' | 'CB'
  onClose: () => void
  /** Requis quand `kind === 'DEVIS'`. */
  onUploadedDevis?: (candidat: ConsultationCandidat) => void
  /** Requis quand `kind === 'PIECE_COMPLEMENTAIRE'`. */
  onUploadedPiece?: (piece: PieceJointe) => void
}

/** FICHE_FAD est généré par le système (fiche récapitulative de la FAD, Phase 2) — jamais proposé au dépôt manuel. */
const TYPE_PIECE_EXCLUS_SAISIE = new Set(['FICHE_FAD'])

/**
 * Modale AddPieces (croquis DA2.pdf page 2) : dépôt/remplacement d'un
 * fichier — devis (titre « Devis », remplace le fichier existant en place,
 * jamais de sélecteur de type) ou pièce complémentaire (titre « Pièce
 * complémentaire », type de pièce obligatoire, une nouvelle ligne
 * PIECE_JOINTE à chaque dépôt).
 */
export function AddPieceDaModal({
  kind,
  idDemandeAchat,
  idDevis,
  idFournisseur,
  objetDa,
  fournisseurLabel,
  currentNomFichier,
  roleHint,
  onClose,
  onUploadedDevis,
  onUploadedPiece,
}: AddPieceDaModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [typePiece, setTypePiece] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { items: typesPiece } = useLibelleReferentiel('TYPE_PIECE_FAD')
  const typePieceOptions = typesPiece.filter((t) => t.actif && !TYPE_PIECE_EXCLUS_SAISIE.has(t.code)).map((t) => ({ value: t.code, label: t.libelle }))

  useEffect(() => {
    if (kind === 'PIECE_COMPLEMENTAIRE' && !typePiece && typePieceOptions.length > 0) setTypePiece(typePieceOptions[0].value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typePieceOptions])

  async function handleSubmit() {
    setError(null)
    if (!file) {
      setError('Un fichier est requis.')
      return
    }
    if (kind === 'PIECE_COMPLEMENTAIRE' && !typePiece) {
      setError('Type de pièce requis.')
      return
    }
    setSubmitting(true)
    try {
      if (kind === 'DEVIS') {
        const candidat = await uploadDevisFile(idDemandeAchat, idDevis as number, file)
        onUploadedDevis?.(candidat)
      } else {
        const piece = await addPieceDemandeAchat(idDemandeAchat, idFournisseur, typePiece as string, file, roleHint)
        onUploadedPiece?.(piece)
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Retire uniquement le fichier (la ligne DEVIS_CONSULTE reste, le
   * fournisseur reste consulté/retenu) — voir removeConsultationCandidat
   * pour retirer le fournisseur tout entier (écran Éléments de
   * consultation). Confirmation obligatoire avant suppression (décision du
   * 17/09/2026) — voir confirmDeleteOpen.
   */
  async function confirmDelete() {
    setError(null)
    setDeleting(true)
    try {
      const candidat = await deleteDevisFile(idDemandeAchat, idDevis as number)
      onUploadedDevis?.(candidat)
      setConfirmDeleteOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleDownload() {
    if (!currentNomFichier) return
    try {
      const blob = await downloadDevisFileBlob(idDemandeAchat, idDevis as number)
      triggerBlobDownload(blob, currentNomFichier)
    } catch {
      setError('Impossible de télécharger le devis.')
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="addPieceDaModalTitle" style={{ maxWidth: 560 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="addPieceDaModalTitle">
            {kind === 'DEVIS' ? 'Devis' : 'Pièce complémentaire'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="stack" style={{ gap: 2 }}>
            <span className="gp-help">{objetDa || '—'}</span>
            <span className="gp-label">{fournisseurLabel}</span>
          </div>

          {kind === 'PIECE_COMPLEMENTAIRE' && (
            <div className="gp-field">
              <label className="gp-label">Type de pièce</label>
              <Combobox
                options={typePieceOptions}
                value={typePiece}
                onChange={(v) => {
                  if (v) setTypePiece(v)
                }}
                placeholder="Type de pièce"
                ariaLabel="Type de pièce"
                style={{ maxWidth: 'none' }}
              />
            </div>
          )}

          <div className="gp-field">
            <label className="gp-label">Fichier (PDF, 10 Mo max)</label>
            {!file && currentNomFichier && kind === 'DEVIS' && (
              <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                <input className="gp-input" style={{ flex: 1 }} value={currentNomFichier} readOnly />
                <div className="gp-rowacts">
                  <button type="button" title="Télécharger le devis" aria-label="Télécharger le devis" onClick={() => void handleDownload()}>
                    <svg className="ti">
                      <use href="#i-download" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="del"
                    title="Supprimer le devis"
                    aria-label="Supprimer le devis"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <svg className="ti">
                      <use href="#i-trash" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {!file && currentNomFichier && kind === 'DEVIS' && (
              <p className="gp-help">Déposer un fichier ci-dessous remplace le devis actuel.</p>
            )}
            <FileDropzone accept="application/pdf" maxSizeOctets={MAX_FICHIER_TAILLE_OCTETS} file={file} onFileSelected={setFile} disabled={submitting} />
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
            Retour
          </button>
          <button type="button" className="gp-btn gp-btn--primary" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Envoi…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {confirmDeleteOpen && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteDevisModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deleteDevisModalTitle">
                Supprimer le devis
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setConfirmDeleteOpen(false)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>Supprimer définitivement « {currentNomFichier} » ? Cette action est irréversible.</p>
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setConfirmDeleteOpen(false)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export interface PiecesComplementairesModalProps {
  idDemandeAchat: number
  idFournisseur: number
  fournisseurLabel: string
  objetDa: string
  readOnly: boolean
  /** Écrans de suivi CDS/CB (décision du 18/09/2026) — voir GestionDocumentaireModalProps#roleHint. */
  roleHint?: 'CDS' | 'CB'
  onClose: () => void
  /** Prévient GestionDocumentaireModal du nouveau total, pour mettre à jour le badge de la ligne sans tout recharger. */
  onCountChange: (count: number) => void
}

/**
 * Gestion des pièces complémentaires d'un fournisseur de la DA (icône
 * « Pièces », une par ligne de GestionDocumentaireModal, esquisse fournie
 * par l'utilisateur le 17/09/2026) : reprend telle quelle l'ancienne section
 * « Pièces complémentaires » de GestionDocumentaireModal, sortie dans sa
 * propre modale pour rester consultable/modifiable fournisseur par
 * fournisseur sans sélecteur.
 */
export function PiecesComplementairesModal({
  idDemandeAchat,
  idFournisseur,
  fournisseurLabel,
  objetDa,
  readOnly,
  roleHint,
  onClose,
  onCountChange,
}: PiecesComplementairesModalProps) {
  const [pieces, setPieces] = useState<PieceJointe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [pieceToDelete, setPieceToDelete] = useState<PieceJointe | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { items: typesPieceReferentiel } = useLibelleReferentiel('TYPE_PIECE_FAD')
  const typePieceLabel = (code: string) => typesPieceReferentiel.find((t) => t.code === code)?.libelle ?? code

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPiecesDemandeAchat(idDemandeAchat, idFournisseur, roleHint)
      .then((rows) => {
        if (!cancelled) setPieces(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger les pièces complémentaires.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idDemandeAchat, idFournisseur, roleHint])

  /** Confirmation obligatoire avant toute suppression (décision du 17/09/2026) — voir pieceToDelete. */
  async function confirmSupprimerPiece() {
    if (!pieceToDelete) return
    setError(null)
    setDeleting(true)
    try {
      await removePieceDemandeAchat(idDemandeAchat, pieceToDelete.idPiece, roleHint)
      // setPieces(next) direct (pas de callback fonctionnel) : appeler onCountChange — un setState
      // du parent GestionDocumentaireModal — depuis l'intérieur d'un callback de mise à jour de
      // setPieces déclenchait « Cannot update a component while rendering a different component ».
      const next = pieces.filter((p) => p.idPiece !== pieceToDelete.idPiece)
      setPieces(next)
      onCountChange(next.length)
      setPieceToDelete(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleTelechargerPiece(piece: PieceJointe) {
    try {
      const blob = await downloadPieceDemandeAchatBlob(idDemandeAchat, piece.idPiece, roleHint)
      triggerBlobDownload(blob, piece.nomFichierOriginal)
    } catch {
      setError('Impossible de télécharger la pièce.')
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="piecesComplementairesModalTitle" style={{ maxWidth: 560 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="piecesComplementairesModalTitle">
            Pièces complémentaires
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <div className="stack" style={{ gap: 2 }}>
            <span className="gp-help">{objetDa || '—'}</span>
            <span className="gp-label">{fournisseurLabel}</span>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {!readOnly && (
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setAddModalOpen(true)}>
                <svg className="ti">
                  <use href="#i-files" />
                </svg>
                Ajouter une pièce complémentaire
              </button>
            )}
          </div>

          {/* table-layout:fixed/minWidth:0 — voir la note historique de ce tableau, reprise à l'identique depuis l'ancienne section inline de GestionDocumentaireModal. */}
          <div className="gp-table-wrap gp-scroll" style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'hidden' }}>
            <table className="gp-table" style={{ tableLayout: 'fixed', minWidth: 0, width: '100%' }}>
              <colgroup>
                <col style={{ width: 130 }} />
                <col />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Fichier PDF</th>
                  <th>Type pièce</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={3}>Chargement…</td>
                  </tr>
                )}
                {!loading &&
                  pieces.map((p) => (
                    <tr key={p.idPiece}>
                      <td title={p.nomFichierOriginal} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nomFichierOriginal}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typePieceLabel(p.typePiece)}</td>
                      <td>
                        <div className="gp-rowacts">
                          <button title="Télécharger" aria-label={`Télécharger ${p.nomFichierOriginal}`} onClick={() => void handleTelechargerPiece(p)}>
                            <svg className="ti">
                              <use href="#i-download" />
                            </svg>
                          </button>
                          {!readOnly && (
                            <button
                              className="del"
                              title="Supprimer la pièce"
                              aria-label={`Supprimer ${p.nomFichierOriginal}`}
                              onClick={() => setPieceToDelete(p)}
                            >
                              <svg className="ti">
                                <use href="#i-trash" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {!loading && pieces.length === 0 && (
                  <tr>
                    <td colSpan={3}>Aucune pièce complémentaire.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
            Retour
          </button>
        </div>
      </div>

      {!readOnly && addModalOpen && (
        <AddPieceDaModal
          kind="PIECE_COMPLEMENTAIRE"
          idDemandeAchat={idDemandeAchat}
          idFournisseur={idFournisseur}
          objetDa={objetDa}
          fournisseurLabel={fournisseurLabel}
          currentNomFichier={null}
          roleHint={roleHint}
          onClose={() => setAddModalOpen(false)}
          onUploadedPiece={(piece) => {
            const next = [...pieces, piece]
            setPieces(next)
            onCountChange(next.length)
          }}
        />
      )}

      {pieceToDelete && (
        <div className="gp-overlay is-open">
          <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deletePieceDaModalTitle">
            <div className="gp-modal__hd">
              <h3 className="gp-modal__title" id="deletePieceDaModalTitle">
                Supprimer la pièce
              </h3>
              <button className="gp-modal__close" aria-label="Fermer" onClick={() => setPieceToDelete(null)}>
                <svg className="ti">
                  <use href="#i-x" />
                </svg>
              </button>
            </div>
            <div className="gp-modal__bd gp-scroll stack">
              <p>Supprimer définitivement « {pieceToDelete.nomFichierOriginal} » ? Cette action est irréversible.</p>
            </div>
            <div className="gp-modal__ft">
              <button type="button" className="gp-btn gp-btn--secondary" onClick={() => setPieceToDelete(null)}>
                Annuler
              </button>
              <button type="button" className="gp-btn gp-btn--danger" disabled={deleting} onClick={() => void confirmSupprimerPiece()}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DeleteDemandeAchatModal({
  demandeAchat,
  onClose,
  onDeleted,
}: {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteDemandeAchat(demandeAchat.id_demande_achat)
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="deleteDaModalTitle">
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="deleteDaModalTitle">
            Supprimer la demande d'achat
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="gp-modal__bd gp-scroll stack">
          <p>
            Supprimer définitivement la DA {demandeAchat.numero} ({demandeAchat.objet_rc || 'sans objet'}) ? Cette action
            est irréversible.
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
          <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="gp-btn gp-btn--danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
