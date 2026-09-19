import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ValiderCommandeCbModal } from './ValiderCommandeCbModal'
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
  imputation_comptable: 'FONCTIONNEMENT',
  procedure_achat: 'HORS_MARCHE',
  type_achat: 'FOURNITURES',
  type_fad: 'FERMEE',
  motif_choix: null,
  libelle_motif_choix: null,
  montant_retenu: null,
  montant_commande: null,
  validee_sur_seuil_ds: false,
  date_creation: '2026-09-08',
  matricule_demandeur: '10001',
  code_site: 'S1',
  code_sous_site: null,
  code_secteur: 'SEC1',
  code_sous_secteur: null,
  code_cug: 'CUG1',
  numero_operation: null,
  nummarche: null,
  id_marche_tiers: null,
  id_fournisseur_retenu: 42,
  code_statut: 'FAD_TRANSMISE_CDS_CB',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const decisionCbMock = vi.fn()
const transmettreDsOuSeuilMock = vi.fn()
const getConsultationMock = vi.fn()
const getPiecesMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  decisionCb: (...args: unknown[]) => decisionCbMock(...args),
  transmettreDsOuSeuil: (...args: unknown[]) => transmettreDsOuSeuilMock(...args),
  getConsultationDemandeAchat: (...args: unknown[]) => getConsultationMock(...args),
  // GestionDocumentaireModal (rendue à l'intérieur de la modale) importe tout ce module — voir
  // TraiterFadRcModal.test.tsx pour la même remarque.
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
  addPieceDemandeAchat: vi.fn(),
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
  useLibelleReferentiel: () => ({ items: [], loading: false }),
}))
vi.mock('../../hooks/useCug', () => ({
  useCug: () => ({ cug: [{ code_cug: 'CUG1', libelle_cug: 'Fournitures bureau', id_service: 10, actif: true }], loading: false }),
}))
vi.mock('../../hooks/useInvestissementsPgi', () => ({
  useInvestissementsPgi: () => ({
    investissements: [
      {
        numero_operation: 'OP001',
        libelle: 'Opération 1',
        libelle_service: 'Rénovation quai 3',
        id_service: 10,
        code_cug: 'CUG1',
        statut: 'ACTIF',
        actif: true,
        utilisable: true,
        mt_initial: 100000,
        mt_travaux: 80000,
        mt_fesi: 20000,
        mt_budget_ap1: 10000,
        mt_engage_ap1: 0,
        mt_liquide_ap1: 0,
        mt_solde_ap1: 10000,
        mt_budget_ap8: 20000,
        mt_engage_ap8: 0,
        mt_liquide_ap8: 0,
        mt_solde_ap8: 20000,
        mt_budget_cp1: 30000,
        mt_engage_cp1: 0,
        mt_liquide_cp1: 0,
        mt_solde_cp1: 30000,
        mt_budget_cp8: 40000,
        mt_engage_cp8: 0,
        mt_liquide_cp8: 0,
        mt_solde_cp8: 40000,
        nombre_pieces: 0,
      },
    ],
    loading: false,
  }),
}))

const CANDIDATS: ConsultationCandidat[] = [
  { idDevis: 1, idFournisseur: 42, montantDevis: 980, delaiLivraison: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-acme.pdf', tailleOctets: 1000 },
  { idDevis: 2, idFournisseur: 43, montantDevis: 1200, delaiLivraison: null, ordre: 2, retenu: false, nomFichierOriginal: 'devis-beta.pdf', tailleOctets: 1200 },
]

beforeEach(() => {
  decisionCbMock.mockReset()
  transmettreDsOuSeuilMock.mockReset()
  getConsultationMock.mockReset().mockResolvedValue(CANDIDATS)
  getPiecesMock.mockReset().mockResolvedValue([])
})

describe('ValiderCommandeCbModal — FAD_TRANSMISE_CDS_CB (décision)', () => {
  it('affiche le résumé (objet, montant) et la liste des entreprises consultées (Hors Marché)', async () => {
    render(<ValiderCommandeCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('Achat de fournitures diverses')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1 200,00 €')).toBeInTheDocument()
    expect(await screen.findByText('ACME')).toBeInTheDocument()
    expect(screen.getByText('BETA SERVICES')).toBeInTheDocument()
    expect(screen.getByText('Retenu')).toBeInTheDocument()
  })

  it('affiche numéro et libellé du marché (Marché)', () => {
    const daMarche: DemandeAchatRow = { ...DA, procedure_achat: 'MARCHE', nummarche: 'M2026001' }
    render(<ValiderCommandeCbModal demandeAchat={daMarche} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('M2026001')).toBeInTheDocument()
    expect(screen.getByText('Fourniture de bureau')).toBeInTheDocument()
  })

  it('propose Valider/Modifier/Rejeter, jamais de bouton Annuler ni Transmettre', () => {
    render(<ValiderCommandeCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transmettre' })).not.toBeInTheDocument()
  })

  it('affiche les champs budgétaires éditables (CUG, Type d\'achat, Imputation comptable) préremplis', () => {
    render(<ValiderCommandeCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'CUG' })).toHaveTextContent('CUG1')
    expect(screen.getByRole('button', { name: "Type d'achat" })).toHaveTextContent('Fournitures')
    expect(screen.getByRole('button', { name: 'Imputation comptable' })).toHaveTextContent('Fonctionnement')
  })

  it('refuse Rejeter sans commentaire', async () => {
    render(<ValiderCommandeCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))

    expect(await screen.findByText('Un commentaire est requis pour justifier ce choix.')).toBeInTheDocument()
    expect(decisionCbMock).not.toHaveBeenCalled()
  })

  it('Valider ne nécessite aucun commentaire et appelle decisionCb avec les champs budgétaires courants', async () => {
    const onSaved = vi.fn()
    decisionCbMock.mockResolvedValue(DA)
    render(<ValiderCommandeCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    await waitFor(() =>
      expect(decisionCbMock).toHaveBeenCalledWith(1, {
        decision: 'VALIDER',
        commentaireStatut: undefined,
        codeCug: 'CUG1',
        typeAchat: 'FOURNITURES',
        imputationComptable: 'FONCTIONNEMENT',
        numeroOperation: null,
      }),
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('Modifier avec commentaire transmet le motif', async () => {
    decisionCbMock.mockResolvedValue(DA)
    render(<ValiderCommandeCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Commentaire (obligatoire sauf pour Valider)'), { target: { value: 'À revoir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))

    await waitFor(() => expect(decisionCbMock).toHaveBeenCalledWith(1, expect.objectContaining({ decision: 'MODIFIER', commentaireStatut: 'À revoir' })))
  })

  it('Gestion documentaire ouvre avec le devis verrouillé (pas de bouton Ajouter/Remplacer/Supprimer le devis actif)', async () => {
    render(<ValiderCommandeCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))

    expect(await screen.findByRole('dialog', { name: 'Gestion documentaire' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Télécharger le devis — ACME' })).toBeInTheDocument()
  })
})

describe('ValiderCommandeCbModal — FAD_VALIDEE_CB (transmettre au DS/exemption de seuil)', () => {
  const FAD_VALIDEE: DemandeAchatRow = { ...DA, code_statut: 'FAD_VALIDEE_CB' }

  it('propose uniquement Transmettre, pas les boutons de décision ni de commentaire, champs budgétaires en lecture seule', () => {
    render(<ValiderCommandeCbModal demandeAchat={FAD_VALIDEE} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Transmettre' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Commentaire (obligatoire sauf pour Valider)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'CUG' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('CUG1')).toBeInTheDocument()
  })

  it("n'affiche jamais la valeur du seuil de validation DS", () => {
    render(<ValiderCommandeCbModal demandeAchat={FAD_VALIDEE} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/seuil/i)).not.toBeInTheDocument()
  })

  it('Transmettre appelle transmettreDsOuSeuil sans saisie', async () => {
    const onSaved = vi.fn()
    transmettreDsOuSeuilMock.mockResolvedValue(FAD_VALIDEE)
    render(<ValiderCommandeCbModal demandeAchat={FAD_VALIDEE} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Transmettre' }))

    await waitFor(() => expect(transmettreDsOuSeuilMock).toHaveBeenCalledWith(1))
    expect(onSaved).toHaveBeenCalled()
  })
})
