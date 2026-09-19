import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CompleterCbModal } from './CompleterCbModal'
import type { DemandeAchat as DemandeAchatRow, HistoriqueStatutView } from '../../hooks/useDemandeAchat'

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
  code_statut: 'FAD_A_COMPLETER_CB',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const completerCbMock = vi.fn()
const getHistoriqueMock = vi.fn()
const getConsultationMock = vi.fn()
const getPiecesMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  completerCb: (...args: unknown[]) => completerCbMock(...args),
  getHistoriqueStatuts: (...args: unknown[]) => getHistoriqueMock(...args),
  // GestionDocumentaireModal importe tout ce module — voir TraiterFadRcModal.test.tsx.
  updateDemandeAchat: vi.fn(),
  selectMarcheDemandeAchat: vi.fn(),
  getConsultationDemandeAchat: (...args: unknown[]) => getConsultationMock(...args),
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
vi.mock('../../hooks/useFournisseurs', () => ({
  useFournisseurs: () => ({
    fournisseurs: [{ id_fournisseur: 42, id_service: 10, raison_sociale_service: 'ACME', etatfournisseur: 'Actif' }],
    loading: false,
  }),
}))
vi.mock('../../hooks/useMarches', () => ({
  useMarches: () => ({ marches: [], loading: false }),
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

const HISTORIQUE: HistoriqueStatutView[] = [
  {
    idHisto: 1,
    codeStatut: 'FAD_A_COMPLETER_CB',
    libelleStatut: 'À compléter (CB)',
    dateHeure: '2026-09-10T10:00:00Z',
    matriculeActeur: '30001',
    acteurNomPrenom: 'Jean Dupont',
    suppleanceLabel: null,
    commentaireStatut: 'Précisez le numéro d\'opération.',
  },
]

beforeEach(() => {
  completerCbMock.mockReset()
  getHistoriqueMock.mockReset().mockResolvedValue(HISTORIQUE)
  getConsultationMock.mockReset().mockResolvedValue([])
  getPiecesMock.mockReset().mockResolvedValue([])
})

describe('CompleterCbModal', () => {
  it('affiche le motif du DS extrait du dernier FAD_A_COMPLETER_CB de l\'historique', async () => {
    render(<CompleterCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByText(/Motif du DS : Précisez le numéro d'opération\./)).toBeInTheDocument()
  })

  it('demande l\'historique avec le rôle CB explicite', () => {
    render(<CompleterCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(getHistoriqueMock).toHaveBeenCalledWith(1, 'CB')
  })

  it('affiche les champs budgétaires éditables préremplis', () => {
    render(<CompleterCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'CUG' })).toHaveTextContent('CUG1')
    expect(screen.getByRole('button', { name: "Type d'achat" })).toHaveTextContent('Fournitures')
    expect(screen.getByRole('button', { name: 'Imputation comptable' })).toHaveTextContent('Fonctionnement')
  })

  it('Retransmettre au DS appelle completerCb avec les champs courants', async () => {
    const onSaved = vi.fn()
    completerCbMock.mockResolvedValue(DA)
    render(<CompleterCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retransmettre au DS' }))

    await waitFor(() =>
      expect(completerCbMock).toHaveBeenCalledWith(1, {
        codeCug: 'CUG1',
        typeAchat: 'FOURNITURES',
        imputationComptable: 'FONCTIONNEMENT',
        numeroOperation: null,
      }),
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('refuse la retransmission si Investissement est choisi sans numéro d\'opération', async () => {
    const daInvestissementSansNumero: DemandeAchatRow = { ...DA, imputation_comptable: 'INVESTISSEMENT', numero_operation: null }
    render(<CompleterCbModal demandeAchat={daInvestissementSansNumero} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retransmettre au DS' }))

    expect(await screen.findByText('Le numéro d\'opération est obligatoire pour une imputation en investissement.')).toBeInTheDocument()
    expect(completerCbMock).not.toHaveBeenCalled()
  })
})
