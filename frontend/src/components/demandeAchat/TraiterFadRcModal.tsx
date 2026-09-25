import { useEffect, useState, type FormEvent } from 'react'
import { useSites } from '../../hooks/useSites'
import { useSecteurs } from '../../hooks/useSecteurs'
import { useCug } from '../../hooks/useCug'
import { useInvestissementsPgi } from '../../hooks/useInvestissementsPgi'
import {
  transmettreFad,
  retransmettreCb,
  enregistrerFad,
  getHistoriqueStatuts,
  type DemandeAchat as DemandeAchatRow,
  type MotifChoix,
  type TypeFad,
} from '../../hooks/useDemandeAchat'
import { Combobox } from '../Combobox'
import { GestionDocumentaireModal, InvestissementDaModal } from './modals'
import { ApiError } from '../../services/api'

export interface TraiterFadRcModalProps {
  demandeAchat: DemandeAchatRow
  onClose: () => void
  onSaved: () => void
  /**
   * Appelé après un enregistrement intermédiaire réussi (bouton « Enregistrer », contrairement à
   * onSaved qui ferme la modale) — transmet la ligne à jour au parent pour qu'il rafraîchisse ses
   * listes en tâche de fond. Sans ce callback, rouvrir la modale après « Retour » réaffiche les
   * anciennes valeurs (le parent réinjecte encore la ligne obsolète de sa liste non rafraîchie).
   */
  onProgressSaved?: (demandeAchat: DemandeAchatRow) => void
}

/**
 * Modale « Traiter » de l'écran de suivi RC — complétion et transmission de
 * la FAD (OP1.2b), une fois la décision (OP1.2, « Valider les éléments de la
 * commande ») déjà prise. Décision du 16/09/2026 (revient sur la fusion
 * décision+complétion du 15/09/2026) : ne gère plus `DA_TRANSMISE_DEM_RC` du
 * tout — l'icône « Traiter » n'apparaît plus pour ce statut (voir
 * ValiderCommandeRcModal, qui gère désormais Valider/Compléter/Rejeter/
 * Annuler). Reste inchangée pour `DA_VALIDEE_RC`/`FAD_A_COMPLETER_CDS`
 * (formulaire de complétion + « Transmettre au CDS ») et `FAD_A_MODIFIER_CB`
 * (reprise CB, tous champs optionnels). Accès à la gestion documentaire
 * directement depuis la modale. N'affiche jamais OBJET_DEMANDEUR/
 * DESCRIPTION_DEMANDEUR (décision explicite du 15/09/2026 : uniquement les
 * champs RC éditables).
 */
export function TraiterFadRcModal({ demandeAchat, onClose, onSaved, onProgressSaved }: TraiterFadRcModalProps) {
  const isReprisesCb = demandeAchat.code_statut === 'FAD_A_MODIFIER_CB'
  // Reprise après complément/modification (décision du 23/09/2026) — DA_VALIDEE_RC exclue : c'est
  // la transmission initiale, aucun motif à afficher ni à répondre.
  const isReprise = demandeAchat.code_statut === 'FAD_A_COMPLETER_CDS' || isReprisesCb

  const [objet, setObjet] = useState(demandeAchat.objet_rc)
  const [description, setDescription] = useState(demandeAchat.description_rc ?? '')
  const [motifChoix, setMotifChoix] = useState<string | null>(demandeAchat.motif_choix)
  const [libelleMotifChoix, setLibelleMotifChoix] = useState(demandeAchat.libelle_motif_choix ?? '')
  const [codeSite, setCodeSite] = useState<string | null>(demandeAchat.code_site)
  const [codeSousSite, setCodeSousSite] = useState<string | null>(demandeAchat.code_sous_site)
  const [codeSecteur, setCodeSecteur] = useState<string | null>(demandeAchat.code_secteur)
  const [codeSousSecteur, setCodeSousSecteur] = useState<string | null>(demandeAchat.code_sous_secteur)
  const [codeCug, setCodeCug] = useState<string | null>(demandeAchat.code_cug)
  const [typeAchat, setTypeAchat] = useState<string | null>(demandeAchat.type_achat)
  const [typeFad, setTypeFad] = useState<string | null>(demandeAchat.type_fad)
  const [imputationComptable, setImputationComptable] = useState<string | null>(demandeAchat.imputation_comptable)
  const [numeroOperation, setNumeroOperation] = useState<string | null>(demandeAchat.numero_operation)
  const [gestionDocumentaireOpen, setGestionDocumentaireOpen] = useState(false)
  const [investissementModalOpen, setInvestissementModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [motifOrigine, setMotifOrigine] = useState<string | null>(null)
  const [commentaireReponse, setCommentaireReponse] = useState('')
  const motifAuteur = isReprisesCb ? 'CB' : 'CDS'

  // Motif d'origine (décision du 23/09/2026 : généralisé à FAD_A_COMPLETER_CDS, qui n'affichait
  // rien jusqu'ici — seule la reprise CB était couverte) affiché en lecture seule, suivi du champ
  // de réponse libre avant de retransmettre.
  useEffect(() => {
    if (!isReprise) return
    let cancelled = false
    const codeStatutRecherche = isReprisesCb ? 'FAD_A_MODIFIER_CB' : 'FAD_A_COMPLETER_CDS'
    getHistoriqueStatuts(demandeAchat.id_demande_achat)
      .then((rows) => {
        if (cancelled) return
        const dernierRetour = [...rows].reverse().find((r) => r.codeStatut === codeStatutRecherche)
        setMotifOrigine(dernierRetour?.commentaireStatut ?? null)
      })
      .catch(() => {
        // Best effort — la modale reste utilisable sans le motif affiché.
      })
    return () => {
      cancelled = true
    }
  }, [isReprise, isReprisesCb, demandeAchat.id_demande_achat])

  const { sites } = useSites(demandeAchat.id_service)
  const { secteurs } = useSecteurs(demandeAchat.id_service)
  const { cug } = useCug()
  const { investissements } = useInvestissementsPgi(demandeAchat.id_service)

  const siteOptions = sites.map((s) => ({ value: s.code_site, label: s.lib_site }))
  const sousSitesDisponibles = sites.find((s) => s.code_site === codeSite)?.sous_sites ?? []
  const sousSiteOptions = sousSitesDisponibles.map((s) => ({ value: s.code_sous_site, label: s.lib_sous_site }))

  const secteurOptions = secteurs.map((s) => ({ value: s.code_secteur, label: s.lib_secteur }))
  const sousSecteursDisponibles = secteurs.find((s) => s.code_secteur === codeSecteur)?.sous_secteurs ?? []
  const sousSecteurOptions = sousSecteursDisponibles.map((s) => ({ value: s.code_sous_secteur, label: s.lib_sous_secteur }))

  const cugOptions = cug.map((c) => ({ value: c.code_cug, label: `${c.code_cug} — ${c.libelle_cug}` }))
  const investissementSelectionne = investissements.find((i) => i.numero_operation === numeroOperation)
  const investissementLabel = investissementSelectionne
    ? `${investissementSelectionne.numero_operation} — ${investissementSelectionne.libelle_service ?? investissementSelectionne.libelle}`
    : numeroOperation

  function handleSiteChange(v: string | null) {
    setCodeSite(v)
    if (!sites.find((s) => s.code_site === v)?.sous_sites.some((s) => s.code_sous_site === codeSousSite)) {
      setCodeSousSite(null)
    }
  }

  function handleSecteurChange(v: string | null) {
    setCodeSecteur(v)
    if (!secteurs.find((s) => s.code_secteur === v)?.sous_secteurs.some((s) => s.code_sous_secteur === codeSousSecteur)) {
      setCodeSousSecteur(null)
    }
  }

  /** MOTIF_CHOIX pertinent seulement en Hors Marché — en Marché il reste automatique ("Prix", un seul candidat, posé à OP1.1). */
  const motifEditable = demandeAchat.procedure_achat === 'HORS_MARCHE'

  /** Champs communs à la transmission finale et à l'enregistrement intermédiaire — un champ vide est omis (undefined), jamais écrasé de force. */
  function buildInput() {
    return {
      objet: objet.trim() || undefined,
      description: description.trim() || undefined,
      motifChoix: motifEditable && motifChoix ? (motifChoix as MotifChoix) : undefined,
      libelleMotifChoix: motifEditable && motifChoix === 'Autre' ? libelleMotifChoix.trim() : undefined,
      codeSite: codeSite ?? undefined,
      codeSousSite,
      codeSecteur: codeSecteur ?? undefined,
      codeSousSecteur,
      codeCug: codeCug ?? undefined,
      typeAchat: (typeAchat ?? undefined) as 'TRAVAUX' | 'FOURNITURES' | 'SERVICES' | undefined,
      typeFad: (typeFad ?? undefined) as TypeFad | undefined,
      imputationComptable: (imputationComptable ?? undefined) as 'FONCTIONNEMENT' | 'INVESTISSEMENT' | undefined,
      numeroOperation: imputationComptable === 'INVESTISSEMENT' ? numeroOperation : null,
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaveMessage(null)

    if (motifEditable && motifChoix === 'Autre' && !libelleMotifChoix.trim()) {
      setError('Le libellé du motif est obligatoire quand le motif est "Autre".')
      return
    }
    if (!isReprisesCb) {
      if (!codeSite || !codeSecteur || !codeCug || !typeAchat || !typeFad || !imputationComptable) {
        setError('Site, secteur, CUG, type d\'achat, type de FAD et imputation comptable sont obligatoires.')
        return
      }
    }
    if (imputationComptable === 'INVESTISSEMENT' && !numeroOperation) {
      setError('Le numéro d\'opération est obligatoire pour une imputation en investissement.')
      return
    }

    const input = buildInput()
    // Réponse au motif de complément/modification (décision du 23/09/2026) — séparée de
    // buildInput() car partagée avec handleEnregistrer, qui n'écrit aucune ligne d'historique.
    const commentaireStatut = commentaireReponse.trim() || undefined

    setSubmitting(true)
    try {
      if (isReprisesCb) {
        await retransmettreCb(demandeAchat.id_demande_achat, { ...input, commentaireStatut })
      } else {
        // Champs requis validés ci-dessus — cast sûr vers TransmettreFadInput.
        await transmettreFad(demandeAchat.id_demande_achat, { ...input, commentaireStatut } as Parameters<typeof transmettreFad>[1])
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Enregistrement intermédiaire (décision du 16/09/2026) — sauvegarde la saisie en cours sans
   * transmettre ni changer de statut, pour permettre de compléter la FAD en plusieurs fois.
   * Contrairement à handleSubmit, n'exige aucun champ obligatoire (seule règle qui s'applique
   * déjà, y compris à un enregistrement partiel : le libellé du motif si "Autre" est choisi).
   */
  async function handleEnregistrer() {
    setError(null)
    setSaveMessage(null)

    if (motifEditable && motifChoix === 'Autre' && !libelleMotifChoix.trim()) {
      setError('Le libellé du motif est obligatoire quand le motif est "Autre".')
      return
    }

    setSavingProgress(true)
    try {
      const updated = await enregistrerFad(demandeAchat.id_demande_achat, buildInput())
      setSaveMessage('Enregistré.')
      onProgressSaved?.(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSavingProgress(false)
    }
  }

  return (
    <div className="gp-overlay is-open">
      <div className="gp-modal" role="dialog" aria-modal="true" aria-labelledby="traiterFadRcModalTitle" style={{ maxWidth: 800 }}>
        <div className="gp-modal__hd">
          <h3 className="gp-modal__title" id="traiterFadRcModalTitle">
            {demandeAchat.numero} — {isReprisesCb ? 'Retransmettre à la CB' : 'Compléter et transmettre au CDS'}
          </h3>
          <button className="gp-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg className="ti">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="gp-modal__bd gp-scroll stack">
            {/* Échange motif/réponse présenté comme un fil (décision du 23/09/2026) — deux blocs
                empilés plutôt qu'une bannière isolée + un champ sans lien visuel avec elle.
                Construit uniquement avec des primitives gp-* existantes (gp-label, gp-textarea,
                --gp-warning-bg/--gp-info-bg déjà utilisés ailleurs) : pas de composant "chat"
                dédié, absent du design system GPMM (voir ForClaude/INSTRUCTIONS_UX.md). */}
            {isReprise && (
              <div className="stack" style={{ gap: 8 }}>
                {motifOrigine && (
                  <div style={{ background: 'var(--gp-warning-bg)', borderRadius: 'var(--gp-radius)', padding: '10px 12px' }}>
                    <p className="gp-label" style={{ color: 'var(--gp-warning-text)', margin: '0 0 4px' }}>
                      {motifAuteur}
                    </p>
                    <p style={{ margin: 0, color: 'var(--gp-warning-text)' }}>{motifOrigine}</p>
                  </div>
                )}
                <div style={{ background: 'var(--gp-info-bg)', borderRadius: 'var(--gp-radius)', padding: '10px 12px' }}>
                  <label className="gp-label" htmlFor="traiterfad-commentaire-reponse" style={{ color: 'var(--gp-info-text)' }}>
                    Vous (facultatif)
                  </label>
                  <textarea
                    id="traiterfad-commentaire-reponse"
                    className="gp-textarea"
                    value={commentaireReponse}
                    onChange={(e) => setCommentaireReponse(e.target.value)}
                    placeholder="Votre réponse…"
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <div className="gp-field">
              <label className="gp-label" htmlFor="traiterfad-objet">
                Objet de la DA
              </label>
              <input id="traiterfad-objet" className="gp-input" value={objet} onChange={(e) => setObjet(e.target.value)} maxLength={75} />
            </div>
            <div className="gp-field">
              <label className="gp-label" htmlFor="traiterfad-description">
                Description de la DA
              </label>
              <textarea
                id="traiterfad-description"
                className="gp-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={256}
                rows={3}
              />
            </div>

            {motifEditable && (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <div className="gp-field" style={{ flex: 1 }}>
                  <label className="gp-label">Motif du choix</label>
                  <Combobox
                    options={[
                      { value: 'Prix', label: 'Prix' },
                      { value: 'Délai', label: 'Délai' },
                      { value: 'Technique', label: 'Technique' },
                      { value: 'Autre', label: 'Autre' },
                    ]}
                    value={motifChoix}
                    onChange={setMotifChoix}
                    placeholder="Choisir…"
                    ariaLabel="Motif du choix"
                    style={{ maxWidth: 'none' }}
                  />
                </div>
                {motifChoix === 'Autre' && (
                  <div className="gp-field" style={{ flex: 1 }}>
                    <label className="gp-label" htmlFor="traiterfad-libelle-motif">
                      Libellé du motif
                    </label>
                    <input
                      id="traiterfad-libelle-motif"
                      className="gp-input"
                      value={libelleMotifChoix}
                      onChange={(e) => setLibelleMotifChoix(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Site</label>
                <Combobox options={siteOptions} value={codeSite} onChange={handleSiteChange} placeholder="Choisir…" ariaLabel="Site" style={{ maxWidth: 'none' }} />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Sous-site</label>
                <Combobox
                  options={sousSiteOptions}
                  value={codeSousSite}
                  onChange={setCodeSousSite}
                  placeholder="Aucun"
                  clearLabel="Aucun"
                  ariaLabel="Sous-site"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            </div>

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Secteur</label>
                <Combobox
                  options={secteurOptions}
                  value={codeSecteur}
                  onChange={handleSecteurChange}
                  placeholder="Choisir…"
                  ariaLabel="Secteur"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Sous-secteur</label>
                <Combobox
                  options={sousSecteurOptions}
                  value={codeSousSecteur}
                  onChange={setCodeSousSecteur}
                  placeholder="Aucun"
                  clearLabel="Aucun"
                  ariaLabel="Sous-secteur"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            </div>

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">CUG</label>
                <Combobox options={cugOptions} value={codeCug} onChange={setCodeCug} placeholder="Choisir…" ariaLabel="CUG" style={{ maxWidth: 'none' }} />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Type d'achat</label>
                <Combobox
                  options={[
                    { value: 'TRAVAUX', label: 'Travaux' },
                    { value: 'FOURNITURES', label: 'Fournitures' },
                    { value: 'SERVICES', label: 'Services' },
                  ]}
                  value={typeAchat}
                  onChange={setTypeAchat}
                  placeholder="Choisir…"
                  ariaLabel="Type d'achat"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Type de FAD</label>
                <Combobox
                  options={[
                    { value: 'FERMEE', label: 'Fermée (action unique, prix forfaitaire)' },
                    { value: 'CONTRAT', label: 'Contrat (annuel, prestations récurrentes)' },
                    { value: 'OUVERTE', label: 'Ouverte (enveloppe, objet non connu à l\'avance)' },
                  ]}
                  value={typeFad}
                  onChange={setTypeFad}
                  placeholder="Choisir…"
                  ariaLabel="Type de FAD"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            </div>

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="gp-field" style={{ flex: 1 }}>
                <label className="gp-label">Imputation comptable</label>
                <Combobox
                  options={[
                    { value: 'FONCTIONNEMENT', label: 'Fonctionnement' },
                    { value: 'INVESTISSEMENT', label: 'Investissement' },
                  ]}
                  value={imputationComptable}
                  onChange={setImputationComptable}
                  placeholder="Choisir…"
                  ariaLabel="Imputation comptable"
                  style={{ maxWidth: 'none' }}
                />
              </div>
              {imputationComptable === 'INVESTISSEMENT' && (
                <div className="gp-field" style={{ flex: 1 }}>
                  <label className="gp-label">Numéro d'opération</label>
                  <button
                    type="button"
                    className="gp-btn gp-btn--secondary"
                    aria-label="Numéro d'opération"
                    title={investissementLabel ?? undefined}
                    style={{ width: '100%', justifyContent: 'flex-start', overflow: 'hidden' }}
                    onClick={() => setInvestissementModalOpen(true)}
                  >
                    {/* .gp-btn impose white-space:nowrap (pensé pour un libellé court et fixe) — un libellé
                        d'opération un peu long pousserait sinon toute la modale en scroll horizontal. Tronqué
                        avec une ellipse plutôt que de laisser le contenu dicter la largeur. */}
                    <span style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                      {investissementLabel ?? 'Choisir…'}
                    </span>
                  </button>
                </div>
              )}
              <div className="gp-field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                <span
                  className="gp-tip"
                  data-tip={demandeAchat.id_fournisseur_retenu === null ? "Identifiez d'abord un fournisseur" : 'Gérer les pièces complémentaires et consulter le devis de la DA'}
                >
                  <button
                    type="button"
                    className="gp-btn gp-btn--secondary"
                    disabled={demandeAchat.id_fournisseur_retenu === null}
                    onClick={() => setGestionDocumentaireOpen(true)}
                  >
                    <svg className="ti">
                      <use href="#i-folder" />
                    </svg>
                    Gestion documentaire
                  </button>
                </span>
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
            {saveMessage && (
              <span className="gp-badge gp-badge--success" style={{ marginRight: 'auto' }}>
                {saveMessage}
              </span>
            )}
            <button type="button" className="gp-btn gp-btn--secondary" onClick={onClose}>
              Retour
            </button>
            <button type="button" className="gp-btn gp-btn--secondary" disabled={savingProgress || submitting} onClick={() => void handleEnregistrer()}>
              {savingProgress ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="submit" className="gp-btn gp-btn--primary" disabled={submitting}>
              {submitting ? 'Envoi…' : isReprisesCb ? 'Retransmettre à la CB' : 'Transmettre au CDS'}
            </button>
          </div>
        </form>
      </div>

      {gestionDocumentaireOpen && demandeAchat.id_fournisseur_retenu !== null && (
        <GestionDocumentaireModal
          idDemandeAchat={demandeAchat.id_demande_achat}
          idService={demandeAchat.id_service}
          procedureAchat={demandeAchat.procedure_achat}
          objetDa={objet}
          idFournisseurRetenu={demandeAchat.id_fournisseur_retenu}
          montantDemande={demandeAchat.montant_demande}
          devisReadOnly
          onClose={() => setGestionDocumentaireOpen(false)}
        />
      )}

      {investissementModalOpen && (
        <InvestissementDaModal
          investissements={investissements}
          currentNumeroOperation={numeroOperation}
          onClose={() => setInvestissementModalOpen(false)}
          onSelected={setNumeroOperation}
        />
      )}
    </div>
  )
}
