import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ValiderCommandeRcModal } from './ValiderCommandeRcModal'
import type { DemandeAchat as DemandeAchatRow, ConsultationCandidat } from '../../hooks/useDemandeAchat'

const DA: DemandeAchatRow = {
  id_demande_achat: 1,
  numero: '2026-09-08-001',
  id_service: 10,
  objet_demandeur: 'Achat de fournitures diverses',
  description_demandeur: 'Description demandeur',
  objet_rc: 'Achat de fournitures diverses',
  description_rc: 'Description demandeur',
  montant_demande: 1200,
  imputation_comptable: null,
  procedure_achat: 'HORS_MARCHE',
  type_achat: null,
  type_fad: null,
  motif_choix: null,
  libelle_motif_choix: null,
  montant_retenu: null,
  montant_commande: null,
  validee_sur_seuil_ds: false,
  date_creation: '2026-09-08',
  matricule_demandeur: '10001',
  code_site: null,
  code_sous_site: null,
  code_secteur: null,
  code_sous_secteur: null,
  code_cug: null,
  numero_operation: null,
  nummarche: null,
  id_marche_tiers: null,
  id_fournisseur_retenu: 42,
  code_statut: 'DA_TRANSMISE_DEM_RC',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const decisionRcMock = vi.fn()
const devaliderRcMock = vi.fn()
const getConsultationMock = vi.fn()
const getPiecesMock = vi.fn()
const addPieceMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  decisionRc: (...args: unknown[]) => decisionRcMock(...args),
  devaliderRc: (...args: unknown[]) => devaliderRcMock(...args),
  getConsultationDemandeAchat: (...args: unknown[]) => getConsultationMock(...args),
  // GestionDocumentaireModal (ouverte en consultation seule depuis cette modale) importe tout ce
  // module — voir TraiterFadRcModal.test.tsx pour la même remarque.
  updateDemandeAchat: vi.fn(),
  selectMarcheDemandeAchat: vi.fn(),
  addConsultationCandidat: vi.fn(),
  removeConsultationCandidat: vi.fn(),
  saveConsultationDemandeAchat: vi.fn(),
  getOrCreateMarcheDevis: vi.fn(),
  uploadDevisFile: vi.fn(),
  downloadDevisFileBlob: vi.fn(),
  deleteDevisFile: vi.fn(),
  getPiecesDemandeAchat: (...args: unknown[]) => getPiecesMock(...args),
  addPieceDemandeAchat: (...args: unknown[]) => addPieceMock(...args),
  removePieceDemandeAchat: vi.fn(),
  downloadPieceDemandeAchatBlob: vi.fn(),
  deleteDemandeAchat: vi.fn(),
}))

vi.mock('../../hooks/useFournisseurs', () => ({
  useFournisseurs: () => ({
    fournisseurs: [
      { id_fournisseur: 42, id_service: 10, raison_sociale_service: 'ACME', etatfournisseur: 'Actif' },
      { id_fournisseur: 43, id_service: 10, raison_sociale_service: 'BETA SERVICES', etatfournisseur: 'Actif' },
    ],
    loading: false,
  }),
}))
vi.mock('../../hooks/useMarches', () => ({
  useMarches: () => ({
    marches: [{ nummarche: 'M2026001', libelle_service: 'Fourniture de bureau', actif: true, completude: true, utilisable: true, typeproc: 'AO', typedecompoprix: null, naturepresta: null, libpgi: null, titulaire: null, fournisseur_raison_sociale: 'ACME', agentgestion: null, planpreventionactif: null, code_cug: null, dtevalid: null, dtenotif: null, dtedebut: null, dtefinmax: null, mtmaxi: null, mt_solde: null, alertemt: 0.8, alertedate: 30, nombre_pieces: 0 }],
    loading: false,
  }),
}))
vi.mock('../../hooks/useMarcheTiers', () => ({
  useMarcheTiers: () => ({ marcheTiers: [], loading: false }),
}))
vi.mock('../../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 10, code_service: 'S1', libelle_service: 'Service Voyageurs', id_direction: 1, actif: true }], loading: false }),
}))
vi.mock('../../hooks/useLibelleReferentiel', () => ({
  useLibelleReferentiel: () => ({
    items: [
      { domaine: 'TYPE_PIECE_FAD', code: 'PLAN', libelle: 'Plan', ordre: 1, actif: true },
      { domaine: 'TYPE_PIECE_FAD', code: 'FICHE_FAD', libelle: 'Fiche récapitulative FAD', ordre: 7, actif: true },
    ],
    loading: false,
  }),
}))

const CANDIDATS: ConsultationCandidat[] = [
  { idDevis: 1, idFournisseur: 42, montantDevis: 980, delaiLivraison: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-acme.pdf', tailleOctets: 1000 },
  { idDevis: 2, idFournisseur: 43, montantDevis: 1200, delaiLivraison: null, ordre: 2, retenu: false, nomFichierOriginal: 'devis-beta.pdf', tailleOctets: 1200 },
]

beforeEach(() => {
  decisionRcMock.mockReset()
  devaliderRcMock.mockReset()
  getConsultationMock.mockReset().mockResolvedValue(CANDIDATS)
  getPiecesMock.mockReset().mockResolvedValue([])
  addPieceMock.mockReset()
})

describe('ValiderCommandeRcModal — DA_TRANSMISE_DEM_RC (décision)', () => {
  it('affiche le résumé (objet, montant) et la liste des entreprises consultées (Hors Marché)', async () => {
    render(<ValiderCommandeRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('Achat de fournitures diverses')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1 200,00 €')).toBeInTheDocument()
    expect(await screen.findByText('ACME')).toBeInTheDocument()
    expect(screen.getByText('BETA SERVICES')).toBeInTheDocument()
    expect(screen.getByText('980,00 €')).toBeInTheDocument()
    expect(screen.getByText('1 200,00 €')).toBeInTheDocument()
    expect(screen.getByText('Retenu')).toBeInTheDocument()
  })

  it('affiche numéro et libellé du marché (Marché)', () => {
    const daMarche: DemandeAchatRow = { ...DA, procedure_achat: 'MARCHE', nummarche: 'M2026001' }
    render(<ValiderCommandeRcModal demandeAchat={daMarche} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('M2026001')).toBeInTheDocument()
    expect(screen.getByText('Fourniture de bureau')).toBeInTheDocument()
  })

  it('propose Valider/Compléter/Rejeter/Annuler', () => {
    render(<ValiderCommandeRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Demander un complément' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dévalider' })).not.toBeInTheDocument()
  })

  it('refuse Rejeter sans commentaire', async () => {
    render(<ValiderCommandeRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))

    expect(await screen.findByText('Un commentaire est requis pour justifier ce choix.')).toBeInTheDocument()
    expect(decisionRcMock).not.toHaveBeenCalled()
  })

  it('Valider ne nécessite aucun commentaire ni champ de complétion et appelle decisionRc', async () => {
    const onSaved = vi.fn()
    decisionRcMock.mockResolvedValue(DA)
    render(<ValiderCommandeRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(decisionRcMock).toHaveBeenCalledWith(1, { decision: 'VALIDER', commentaireStatut: undefined }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('Rejeter avec commentaire transmet le motif', async () => {
    decisionRcMock.mockResolvedValue(DA)
    render(<ValiderCommandeRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Commentaire (obligatoire sauf pour Valider)'), { target: { value: 'Hors budget' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))

    await waitFor(() => expect(decisionRcMock).toHaveBeenCalledWith(1, { decision: 'REJETER', commentaireStatut: 'Hors budget' }))
  })

  it('Gestion documentaire (consultation seule) est désactivée sans fournisseur retenu, activée sinon', () => {
    const sansFournisseur: DemandeAchatRow = { ...DA, id_fournisseur_retenu: null }
    render(<ValiderCommandeRcModal demandeAchat={sansFournisseur} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Gestion documentaire' })).toBeDisabled()
  })

  it('Gestion documentaire : devis verrouillé (icône inactive, téléchargement actif) tant que le RC n\'a pas transmis au CDS, pièces complémentaires éditables', async () => {
    addPieceMock.mockResolvedValue({ idPiece: 5, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 2048 })
    render(<ValiderCommandeRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))
    const dialog = await screen.findByRole('dialog', { name: 'Gestion documentaire' })

    // Devis : icône présente mais désactivée, Télécharger reste actif.
    expect(within(dialog).getByRole('button', { name: 'Remplacer le devis — ACME' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Télécharger le devis — ACME' })).toBeEnabled()

    // Pièces complémentaires : toujours modifiables.
    fireEvent.click(await within(dialog).findByRole('button', { name: /Pièces complémentaires — ACME/ }))
    const piecesDialog = await screen.findByRole('dialog', { name: 'Pièces complémentaires' })
    fireEvent.click(within(piecesDialog).getByRole('button', { name: 'Ajouter une pièce complémentaire' }))
    const addDialog = await screen.findByRole('dialog', { name: 'Pièce complémentaire' })

    const file = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' })
    const input = addDialog.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(addPieceMock).toHaveBeenCalledWith(1, 42, 'PLAN', file, undefined))
    expect(await within(piecesDialog).findByText('plan.pdf')).toBeInTheDocument()
  })
})

describe('ValiderCommandeRcModal — DA_VALIDEE_RC (dévalider)', () => {
  const DA_VALIDEE: DemandeAchatRow = { ...DA, code_statut: 'DA_VALIDEE_RC' }

  it('propose uniquement Dévalider, pas les 4 boutons de décision', () => {
    render(<ValiderCommandeRcModal demandeAchat={DA_VALIDEE} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Dévalider' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Commentaire (obligatoire sauf pour Valider)')).not.toBeInTheDocument()
  })

  it('Dévalider appelle devaliderRc sans commentaire', async () => {
    const onSaved = vi.fn()
    devaliderRcMock.mockResolvedValue(DA_VALIDEE)
    render(<ValiderCommandeRcModal demandeAchat={DA_VALIDEE} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dévalider' }))

    await waitFor(() => expect(devaliderRcMock).toHaveBeenCalledWith(1))
    expect(onSaved).toHaveBeenCalled()
  })
})
