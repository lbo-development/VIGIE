import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SuiviRc } from './SuiviRc'
import type { DemandeAchat as DemandeAchatRow, AccueilScope, AccueilSynthese } from '../hooks/useDemandeAchat'
import type { MeResponse } from '../hooks/useCurrentUser'

const DA_A_TRAITER: DemandeAchatRow = {
  id_demande_achat: 1,
  numero: '2026-09-08-001',
  id_service: 10,
  objet_demandeur: 'Achat de fournitures diverses',
  description_demandeur: 'Fournitures diverses',
  objet_rc: 'Achat de fournitures diverses',
  description_rc: 'Fournitures diverses',
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
  id_fournisseur_retenu: null,
  code_statut: 'DA_TRANSMISE_DEM_RC',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const DA_VALIDEE: DemandeAchatRow = { ...DA_A_TRAITER, id_demande_achat: 5, numero: '2026-09-09-001', code_statut: 'DA_VALIDEE_RC' }
const EN_COURS: DemandeAchatRow = { ...DA_A_TRAITER, id_demande_achat: 2, numero: '2026-09-07-001', code_statut: 'FAD_TRANSMISE_RC_CDS' }
const FAD_COMMANDEE: DemandeAchatRow = { ...DA_A_TRAITER, id_demande_achat: 3, numero: '2026-08-01-001', code_statut: 'FAD_COMMANDEE' }
const DA_REJETEE: DemandeAchatRow = { ...DA_A_TRAITER, id_demande_achat: 4, numero: '2026-08-02-001', code_statut: 'DA_REJETEE_RC' }

const SYNTHESE_VIDE: AccueilSynthese = {
  enTransit: { RC: { nombre: 0, montant: 0 }, CDS: { nombre: 0, montant: 0 }, DS: { nombre: 0, montant: 0 }, CB: { nombre: 0, montant: 0 } },
  mesDemandes: { enCours: { nombre: 0, montant: 0 }, commande: { nombre: 0, montant: 0 } },
}

let currentUserData: MeResponse | null = null
const listMock = vi.fn()
const syntheseMock = vi.fn()
const decisionRcMock = vi.fn()
const devaliderRcMock = vi.fn()
const transmettreFadMock = vi.fn()
const retransmettreCbMock = vi.fn()
const getHistoriqueMock = vi.fn()
const updateMock = vi.fn()
const selectMarcheMock = vi.fn()
const getConsultationMock = vi.fn()
const addConsultationMock = vi.fn()
const removeConsultationMock = vi.fn()
const saveConsultationMock = vi.fn()
const getOrCreateMarcheDevisMock = vi.fn()
const uploadDevisFileMock = vi.fn()
const downloadDevisFileBlobMock = vi.fn()
const deleteDevisFileMock = vi.fn()
const getPiecesMock = vi.fn()
const addPieceMock = vi.fn()
const removePieceMock = vi.fn()
const downloadPieceBlobMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { email: 'julie.petit@gpmm.fr' } }, loading: false, signOut: vi.fn() }),
}))
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: currentUserData, loading: false }),
}))
vi.mock('../hooks/useCellules', () => ({
  useCellules: () => ({ cellules: [{ id_cellule: 7, code_cellule: 'C1', libelle_cellule: 'Cellule Achats Nord', id_service: 10, actif: true }], loading: false }),
}))
vi.mock('../hooks/useFournisseurs', () => ({
  useFournisseurs: () => ({
    fournisseurs: [{ id_fournisseur: 42, id_service: 10, raison_sociale_service: 'ACME', etatfournisseur: 'Actif' }],
    loading: false,
  }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 10, code_service: 'S1', libelle_service: 'Service Voyageurs', id_direction: 1, actif: true }], loading: false }),
}))
vi.mock('../hooks/useMarches', () => ({
  useMarches: () => ({ marches: [], loading: false }),
}))
vi.mock('../hooks/useMarcheTiers', () => ({
  useMarcheTiers: () => ({ marcheTiers: [], loading: false }),
}))
vi.mock('../hooks/useLibelleReferentiel', () => ({
  useLibelleReferentiel: () => ({ items: [], loading: false }),
}))
vi.mock('../hooks/useSites', () => ({
  useSites: () => ({ sites: [], loading: false }),
}))
vi.mock('../hooks/useSecteurs', () => ({
  useSecteurs: () => ({ secteurs: [], loading: false }),
}))
vi.mock('../hooks/useCug', () => ({
  useCug: () => ({ cug: [], loading: false }),
}))
vi.mock('../hooks/useInvestissementsPgi', () => ({
  useInvestissementsPgi: () => ({ investissements: [], loading: false }),
}))
const enregistrerFadMock = vi.fn()

vi.mock('../hooks/useDemandeAchat', () => ({
  useDemandeAchatList: (...args: unknown[]) => listMock(...args),
  useAccueilSynthese: (...args: unknown[]) => syntheseMock(...args),
  decisionRc: (...args: unknown[]) => decisionRcMock(...args),
  devaliderRc: (...args: unknown[]) => devaliderRcMock(...args),
  transmettreFad: (...args: unknown[]) => transmettreFadMock(...args),
  retransmettreCb: (...args: unknown[]) => retransmettreCbMock(...args),
  enregistrerFad: (...args: unknown[]) => enregistrerFadMock(...args),
  getHistoriqueStatuts: (...args: unknown[]) => getHistoriqueMock(...args),
  updateDemandeAchat: (...args: unknown[]) => updateMock(...args),
  selectMarcheDemandeAchat: (...args: unknown[]) => selectMarcheMock(...args),
  getConsultationDemandeAchat: (...args: unknown[]) => getConsultationMock(...args),
  addConsultationCandidat: (...args: unknown[]) => addConsultationMock(...args),
  removeConsultationCandidat: (...args: unknown[]) => removeConsultationMock(...args),
  saveConsultationDemandeAchat: (...args: unknown[]) => saveConsultationMock(...args),
  getOrCreateMarcheDevis: (...args: unknown[]) => getOrCreateMarcheDevisMock(...args),
  uploadDevisFile: (...args: unknown[]) => uploadDevisFileMock(...args),
  downloadDevisFileBlob: (...args: unknown[]) => downloadDevisFileBlobMock(...args),
  deleteDevisFile: (...args: unknown[]) => deleteDevisFileMock(...args),
  getPiecesDemandeAchat: (...args: unknown[]) => getPiecesMock(...args),
  addPieceDemandeAchat: (...args: unknown[]) => addPieceMock(...args),
  removePieceDemandeAchat: (...args: unknown[]) => removePieceMock(...args),
  downloadPieceDemandeAchatBlob: (...args: unknown[]) => downloadPieceBlobMock(...args),
  deleteDemandeAchat: (...args: unknown[]) => deleteMock(...args),
}))

/**
 * Une instance de refetch stable par scope (contrairement à un `vi.fn()` frais à chaque rendu) —
 * permet aux tests d'observer qu'« Enregistrer » (TraiterFadRcModal, sans fermer la modale)
 * rafraîchit bien les listes en tâche de fond via `onProgressSaved`/`refetchAll`.
 */
const refetchMocks: Record<AccueilScope, ReturnType<typeof vi.fn>> = {
  A_FINALISER: vi.fn(),
  SUIVI_FAD: vi.fn(),
  A_TRAITER: vi.fn(),
  EN_COURS: vi.fn(),
  A_TRAITER_CDS: vi.fn(),
  EN_COURS_CDS: vi.fn(),
  A_TRAITER_CB: vi.fn(),
  EN_COURS_CB: vi.fn(),
  A_TRAITER_DS: vi.fn(),
  EN_COURS_DS: vi.fn(),
  FAD_COMMANDEES: vi.fn(),
  REJETEES_ANNULEES: vi.fn(),
}

/** Route listMock par `params.scope` — même principe que pages/Home.test.tsx. */
function mockLists(overrides: Partial<Record<AccueilScope, DemandeAchatRow[]>>) {
  const byScope: Record<AccueilScope, DemandeAchatRow[]> = {
    A_FINALISER: [],
    SUIVI_FAD: [],
    A_TRAITER: [],
    EN_COURS: [],
    A_TRAITER_CDS: [],
    EN_COURS_CDS: [],
    A_TRAITER_CB: [],
    EN_COURS_CB: [],
    A_TRAITER_DS: [],
    EN_COURS_DS: [],
    FAD_COMMANDEES: [],
    REJETEES_ANNULEES: [],
    ...overrides,
  }
  listMock.mockImplementation((params: { scope?: AccueilScope }) => ({
    demandesAchat: params.scope ? byScope[params.scope] : [],
    loading: false,
    error: null,
    refetch: params.scope ? refetchMocks[params.scope] : vi.fn(),
  }))
}

beforeEach(() => {
  listMock.mockReset()
  syntheseMock.mockReset().mockReturnValue({ data: SYNTHESE_VIDE, loading: false, error: null, refetch: vi.fn() })
  decisionRcMock.mockReset()
  devaliderRcMock.mockReset()
  transmettreFadMock.mockReset()
  retransmettreCbMock.mockReset()
  getHistoriqueMock.mockReset().mockResolvedValue([])
  updateMock.mockReset()
  selectMarcheMock.mockReset()
  getConsultationMock.mockReset().mockResolvedValue([])
  addConsultationMock.mockReset()
  removeConsultationMock.mockReset()
  saveConsultationMock.mockReset()
  getOrCreateMarcheDevisMock.mockReset()
  uploadDevisFileMock.mockReset()
  downloadDevisFileBlobMock.mockReset()
  deleteDevisFileMock.mockReset()
  getPiecesMock.mockReset().mockResolvedValue([])
  addPieceMock.mockReset()
  removePieceMock.mockReset()
  downloadPieceBlobMock.mockReset()
  deleteMock.mockReset()
  enregistrerFadMock.mockReset()
  Object.values(refetchMocks).forEach((m) => m.mockReset())

  mockLists({ A_TRAITER: [DA_A_TRAITER] })
  currentUserData = {
    matricule: '20001',
    nom: 'PETIT',
    prenom: 'Julie',
    idService: 10,
    idCellule: 7,
    roles: [{ typeRole: 'RC', perimeterLabel: 'Cellule Achats Nord', idService: null, idCellule: 7 }],
  }
})

describe('SuiviRc — en-tête', () => {
  it('affiche le nom de la cellule du rôle RC dans le titre', () => {
    render(<SuiviRc />)
    expect(screen.getByRole('heading', { name: 'Suivi RC — Cellule Achats Nord' })).toBeInTheDocument()
  })
})

describe('SuiviRc — tuiles de synthèse', () => {
  it('affiche "En transit" avec 3 compartiments seulement (CDS/DS/CB, pas RC) et "Demandes de la cellule" (pas "Mes demandes")', () => {
    syntheseMock.mockReturnValue({
      data: {
        enTransit: { RC: { nombre: 99, montant: 999999 }, CDS: { nombre: 3, montant: 25131.7 }, DS: { nombre: 11, montant: 24340.8 }, CB: { nombre: 10, montant: 70100.5 } },
        mesDemandes: { enCours: { nombre: 38, montant: 150785.4 }, commande: { nombre: 23, montant: 50163.8 } },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<SuiviRc />)

    expect(screen.getByRole('heading', { name: 'En transit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Demandes de la cellule' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mes demandes' })).not.toBeInTheDocument()
    // Le compartiment RC (99) n'est jamais affiché — seuls CDS/DS/CB le sont.
    expect(screen.queryByText('99')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
  })
})

describe('SuiviRc — onglets', () => {
  it('affiche les 4 onglets avec leur badge de comptage, "À traiter" actif par défaut', () => {
    mockLists({ A_TRAITER: [DA_A_TRAITER], EN_COURS: [EN_COURS], FAD_COMMANDEES: [FAD_COMMANDEE], REJETEES_ANNULEES: [DA_REJETEE] })
    render(<SuiviRc />)

    expect(within(screen.getByRole('tab', { name: /À traiter/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /En cours/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /FAD commandées/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /Rejetées \/ Annulées/ })).getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /À traiter/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('ne propose jamais de bouton "Nouvelle demande" (le RC ne crée pas de DA)', () => {
    render(<SuiviRc />)
    expect(screen.queryByRole('button', { name: 'Nouvelle demande' })).not.toBeInTheDocument()
  })

  it('changer d\'onglet affiche la liste scopée correspondante', () => {
    mockLists({ A_TRAITER: [DA_A_TRAITER], EN_COURS: [EN_COURS] })
    render(<SuiviRc />)

    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))

    expect(screen.getByRole('tab', { name: /En cours/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('2026-09-07-001')).toBeInTheDocument()
    expect(screen.queryByText('2026-09-08-001')).not.toBeInTheDocument()
  })
})

describe('SuiviRc — actions par ligne', () => {
  it('sur "À traiter", pour DA_TRANSMISE_DEM_RC, propose "Valider les éléments de la commande"/Historique — pas Traiter', () => {
    render(<SuiviRc />)
    const row = within(screen.getByText('2026-09-08-001').closest('article')!)

    expect(row.queryByRole('button', { name: 'Traiter la demande' })).not.toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Valider les éléments de la commande' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Historique des statuts' })).toBeInTheDocument()
  })

  it('sur "À traiter", pour DA_VALIDEE_RC, propose Traiter ET "Valider les éléments de la commande" (pour Dévalider)', () => {
    mockLists({ A_TRAITER: [DA_VALIDEE] })
    render(<SuiviRc />)
    const row = within(screen.getByText('2026-09-09-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Traiter la demande' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Valider les éléments de la commande' })).toBeInTheDocument()
  })

  it('sur les autres onglets, pas de bouton Traiter, "Voir les éléments de la demande" (pas renommé)', () => {
    mockLists({ EN_COURS: [EN_COURS] })
    render(<SuiviRc />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-07-001').closest('article')!)

    expect(row.queryByRole('button', { name: 'Traiter la demande' })).not.toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Voir les éléments de la demande' })).toBeInTheDocument()
  })

  it('"Voir les éléments de la demande" (statuts hors décision) ouvre la DA en lecture seule (pied de modale réduit à "Fermer")', () => {
    mockLists({ EN_COURS: [EN_COURS] })
    render(<SuiviRc />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    fireEvent.click(within(screen.getByText('2026-09-07-001').closest('article')!).getByRole('button', { name: 'Voir les éléments de la demande' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Pied de modale readOnly : "Fermer" (pas "Retour"), sans "Enregistrer" — deux boutons portent
    // ce nom accessible (la croix ✕ et le pied de modale), d'où getAllByRole.
    expect(screen.getAllByRole('button', { name: 'Fermer' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument()
  })

  it('"Valider les éléments de la commande" ouvre ValiderCommandeRcModal pour DA_TRANSMISE_DEM_RC/DA_VALIDEE_RC', () => {
    render(<SuiviRc />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Valider les éléments de la commande' }))

    expect(screen.getByText(/Valider les éléments de la commande/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })

  it('"Historique" ouvre la modale d\'historique des statuts', () => {
    render(<SuiviRc />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Historique des statuts' }))

    expect(screen.getByRole('dialog', { name: /Historique des statuts/ })).toBeInTheDocument()
  })

  it('"Traiter" ouvre la modale de complétion/transmission pour DA_VALIDEE_RC', () => {
    mockLists({ A_TRAITER: [DA_VALIDEE] })
    render(<SuiviRc />)
    fireEvent.click(within(screen.getByText('2026-09-09-001').closest('article')!).getByRole('button', { name: 'Traiter la demande' }))

    expect(screen.getByText(/Compléter et transmettre au CDS/)).toBeInTheDocument()
  })

  it('« Enregistrer » (complétion FAD) ne ferme pas la modale et rafraîchit les listes en tâche de fond — évite l\'affichage de données obsolètes à la réouverture', async () => {
    mockLists({ A_TRAITER: [DA_VALIDEE] })
    enregistrerFadMock.mockResolvedValue({ ...DA_VALIDEE, code_site: 'S1' })
    render(<SuiviRc />)
    fireEvent.click(within(screen.getByText('2026-09-09-001').closest('article')!).getByRole('button', { name: 'Traiter la demande' }))

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByText('Enregistré.')
    // Contrairement à « Transmettre au CDS », la modale reste ouverte.
    expect(screen.getByText(/Compléter et transmettre au CDS/)).toBeInTheDocument()
    // Les listes sont rafraîchies en tâche de fond (refetchAll) — sinon rouvrir cette même ligne
    // après « Retour » réafficherait encore ses anciennes valeurs.
    expect(refetchMocks.A_TRAITER).toHaveBeenCalled()
    expect(refetchMocks.EN_COURS).toHaveBeenCalled()
    expect(refetchMocks.FAD_COMMANDEES).toHaveBeenCalled()
    expect(refetchMocks.REJETEES_ANNULEES).toHaveBeenCalled()
  })
})
