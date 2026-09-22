import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { SuiviCds } from './SuiviCds'
import type { DemandeAchat as DemandeAchatRow, AccueilScope, AccueilSynthese } from '../hooks/useDemandeAchat'
import type { MeResponse } from '../hooks/useCurrentUser'

const FAD_A_TRAITER: DemandeAchatRow = {
  id_demande_achat: 1,
  numero: '2026-09-08-001',
  id_service: 10,
  objet_demandeur: 'Achat de fournitures diverses',
  description_demandeur: 'Fournitures diverses',
  objet_rc: 'Achat de fournitures diverses',
  description_rc: 'Fournitures diverses',
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
  id_fournisseur_retenu: null,
  code_statut: 'FAD_TRANSMISE_RC_CDS',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const FAD_VALIDEE: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 5, numero: '2026-09-09-001', code_statut: 'FAD_VALIDEE_CDS' }
const EN_COURS: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 2, numero: '2026-09-07-001', code_statut: 'FAD_A_COMPLETER_CDS' }
const FAD_COMMANDEE: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 3, numero: '2026-08-01-001', code_statut: 'FAD_COMMANDEE' }
const FAD_REJETEE: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 4, numero: '2026-08-02-001', code_statut: 'FAD_REJETEE_CDS' }

const SYNTHESE_VIDE: AccueilSynthese = {
  enTransit: { RC: { nombre: 0, montant: 0 }, CDS: { nombre: 0, montant: 0 }, DS: { nombre: 0, montant: 0 }, CB: { nombre: 0, montant: 0 } },
  mesDemandes: { enCours: { nombre: 0, montant: 0 }, commande: { nombre: 0, montant: 0 } },
}

let currentUserData: MeResponse | null = null
const listMock = vi.fn()
const syntheseMock = vi.fn()
const decisionCdsMock = vi.fn()
const transmettreCbMock = vi.fn()
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
  useAuth: () => ({ session: { user: { email: 'paul.durand@gpmm.fr' } }, loading: false, signOut: vi.fn() }),
}))
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: currentUserData, loading: false }),
}))
let mesSuppleancesData: { roles: unknown[]; suppleances: unknown[] } | null = null
vi.mock('../hooks/useSuppleance', () => ({
  useMesSuppleances: () => ({ data: mesSuppleancesData, loading: false, error: null, refetch: vi.fn() }),
  useSuppleantCandidats: () => ({ candidats: [], loading: false, error: null }),
  createSuppleance: vi.fn(),
  retireSuppleance: vi.fn(),
}))
vi.mock('../hooks/useFournisseurs', () => ({
  useFournisseurs: () => ({
    fournisseurs: [{ id_fournisseur: 42, id_service: 10, raison_sociale_service: 'ACME', etatfournisseur: 'Actif' }],
    loading: false,
  }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 10, code_service: 'S1', libelle_service: 'Service Maintenance', id_direction: 1, actif: true }], loading: false }),
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

vi.mock('../hooks/useDemandeAchat', () => ({
  useDemandeAchatList: (...args: unknown[]) => listMock(...args),
  useAccueilSynthese: (...args: unknown[]) => syntheseMock(...args),
  decisionCds: (...args: unknown[]) => decisionCdsMock(...args),
  transmettreCb: (...args: unknown[]) => transmettreCbMock(...args),
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

/** Route listMock par `params.scope` — même principe que pages/SuiviRc.test.tsx. */
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
    FAD_COMMANDEES: [],
    REJETEES_ANNULEES: [],
    ...overrides,
  }
  listMock.mockImplementation((params: { scope?: AccueilScope }) => ({
    demandesAchat: params.scope ? byScope[params.scope] : [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }))
}

beforeEach(() => {
  mesSuppleancesData = null
  listMock.mockReset()
  syntheseMock.mockReset().mockReturnValue({ data: SYNTHESE_VIDE, loading: false, error: null, refetch: vi.fn() })
  decisionCdsMock.mockReset()
  transmettreCbMock.mockReset()
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

  mockLists({ A_TRAITER_CDS: [FAD_A_TRAITER] })
  currentUserData = {
    matricule: '22001',
    nom: 'DURAND',
    prenom: 'Paul',
    idService: 10,
    idCellule: null,
    roles: [{ typeRole: 'CDS', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null }],
  }
})

describe('SuiviCds — en-tête', () => {
  it('affiche le nom du service du rôle CDS dans le titre', () => {
    render(<SuiviCds />)
    expect(screen.getByRole('heading', { name: 'Suivi CDS — Service Maintenance' })).toBeInTheDocument()
  })
})

describe('SuiviCds — suppléance (décision du 20/09/2026)', () => {
  it("n'affiche le bouton « Suppléance » que pour un titulaire du rôle", () => {
    render(<SuiviCds />)
    expect(screen.queryByRole('button', { name: 'Suppléance' })).not.toBeInTheDocument()

    mesSuppleancesData = { roles: [{ idRole: 5, typeRole: 'CDS', perimeterLabel: 'Service Maintenance' }], suppleances: [] }
    cleanup()
    render(<SuiviCds />)
    expect(screen.getByRole('button', { name: 'Suppléance' })).toBeInTheDocument()
  })

  it("un suppléant voit le bandeau « Vous suppléez … » sous l'en-tête", () => {
    currentUserData = {
      matricule: '22001',
      nom: 'DURAND',
      prenom: 'Paul',
      idService: 10,
      idCellule: null,
      roles: [{ typeRole: 'CDS', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null, enSuppleanceDe: 'Jean DUPONT', suppleanceDateFin: '2026-09-30' }],
    }
    render(<SuiviCds />)
    expect(screen.getByText(/Vous suppléez Jean DUPONT/)).toBeInTheDocument()
  })
})

describe('SuiviCds — tuiles de synthèse', () => {
  it('affiche "En transit" avec 3 compartiments seulement (RC/DS/CB, pas CDS) et "FAD du service" (pas "Demandes de la cellule")', () => {
    syntheseMock.mockReturnValue({
      data: {
        enTransit: { RC: { nombre: 3, montant: 25131.7 }, CDS: { nombre: 99, montant: 999999 }, DS: { nombre: 11, montant: 24340.8 }, CB: { nombre: 10, montant: 70100.5 } },
        mesDemandes: { enCours: { nombre: 38, montant: 150785.4 }, commande: { nombre: 23, montant: 50163.8 } },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<SuiviCds />)

    expect(screen.getByRole('heading', { name: 'En transit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FAD du service' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Demandes de la cellule' })).not.toBeInTheDocument()
    // Le compartiment CDS (99) n'est jamais affiché — seuls RC/DS/CB le sont.
    expect(screen.queryByText('99')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
  })

  it('demande la synthèse avec le rôle CDS explicite', () => {
    render(<SuiviCds />)
    expect(syntheseMock).toHaveBeenCalledWith('CDS')
  })
})

describe('SuiviCds — onglets', () => {
  it('affiche les 4 onglets avec leur badge de comptage, "À traiter" actif par défaut', () => {
    mockLists({ A_TRAITER_CDS: [FAD_A_TRAITER], EN_COURS_CDS: [EN_COURS], FAD_COMMANDEES: [FAD_COMMANDEE], REJETEES_ANNULEES: [FAD_REJETEE] })
    render(<SuiviCds />)

    expect(within(screen.getByRole('tab', { name: /À traiter/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /En cours/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /FAD commandées/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /Rejetées \/ Annulées/ })).getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /À traiter/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('ne propose jamais de bouton "Nouvelle demande" (le CDS ne crée pas de DA)', () => {
    render(<SuiviCds />)
    expect(screen.queryByRole('button', { name: 'Nouvelle demande' })).not.toBeInTheDocument()
  })

  it('changer d\'onglet affiche la liste scopée correspondante', () => {
    mockLists({ A_TRAITER_CDS: [FAD_A_TRAITER], EN_COURS_CDS: [EN_COURS] })
    render(<SuiviCds />)

    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))

    expect(screen.getByRole('tab', { name: /En cours/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('2026-09-07-001')).toBeInTheDocument()
    expect(screen.queryByText('2026-09-08-001')).not.toBeInTheDocument()
  })

  it('demande chaque liste avec le rôle CDS explicite (indispensable pour un acteur cumulant RC+CDS)', () => {
    render(<SuiviCds />)
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'A_TRAITER_CDS', role: 'CDS' }))
  })
})

describe('SuiviCds — actions par ligne', () => {
  it('sur "À traiter", pour FAD_TRANSMISE_RC_CDS, propose "Valider les éléments de la commande"/Historique — jamais de bouton Traiter (le CDS ne modifie rien)', () => {
    render(<SuiviCds />)
    const row = within(screen.getByText('2026-09-08-001').closest('article')!)

    expect(row.queryByRole('button', { name: 'Traiter la demande' })).not.toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Valider les éléments de la commande' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Historique des statuts' })).toBeInTheDocument()
  })

  it('sur "À traiter", pour FAD_VALIDEE_CDS, propose aussi "Valider les éléments de la commande" (pour transmettre à la CB)', () => {
    mockLists({ A_TRAITER_CDS: [FAD_VALIDEE] })
    render(<SuiviCds />)
    const row = within(screen.getByText('2026-09-09-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Valider les éléments de la commande' })).toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Traiter la demande' })).not.toBeInTheDocument()
  })

  it('sur les autres onglets, "Voir les éléments de la demande" (pas renommé)', () => {
    mockLists({ EN_COURS_CDS: [EN_COURS] })
    render(<SuiviCds />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-07-001').closest('article')!)

    expect(row.queryByRole('button', { name: 'Traiter la demande' })).not.toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Voir les éléments de la demande' })).toBeInTheDocument()
  })

  it('"Voir les éléments de la demande" ouvre la FAD en lecture seule (pied de modale réduit à "Fermer")', () => {
    mockLists({ EN_COURS_CDS: [EN_COURS] })
    render(<SuiviCds />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    fireEvent.click(within(screen.getByText('2026-09-07-001').closest('article')!).getByRole('button', { name: 'Voir les éléments de la demande' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Fermer' })).toHaveLength(2)
  })

  it('bug corrigé le 22/09/2026 : depuis "Voir les éléments de la demande", la Gestion documentaire interroge le backend avec le rôle CDS — sans ce paramètre, un CDS pur (sans rôle RC) se voyait refuser l\'accès à sa propre FAD', () => {
    const EN_COURS_AVEC_FOURNISSEUR = { ...EN_COURS, id_fournisseur_retenu: 42 }
    mockLists({ EN_COURS_CDS: [EN_COURS_AVEC_FOURNISSEUR] })
    render(<SuiviCds />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    fireEvent.click(within(screen.getByText('2026-09-07-001').closest('article')!).getByRole('button', { name: 'Voir les éléments de la demande' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))

    expect(getConsultationMock).toHaveBeenCalledWith(2, 'CDS')
  })

  it('"Valider les éléments de la commande" ouvre ValiderCommandeCdsModal pour FAD_TRANSMISE_RC_CDS/FAD_VALIDEE_CDS', () => {
    render(<SuiviCds />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Valider les éléments de la commande' }))

    expect(screen.getByText(/Valider les éléments de la commande/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })

  it('"Historique" ouvre la modale d\'historique des statuts', () => {
    render(<SuiviCds />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Historique des statuts' }))

    expect(screen.getByRole('dialog', { name: /Historique des statuts/ })).toBeInTheDocument()
  })
})
