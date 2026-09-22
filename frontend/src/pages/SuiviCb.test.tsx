import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SuiviCb } from './SuiviCb'
import type { DemandeAchat as DemandeAchatRow, AccueilScope, AccueilSynthese } from '../hooks/useDemandeAchat'
import type { MeResponse } from '../hooks/useCurrentUser'
import { ApiError } from '../services/api'

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
  code_statut: 'FAD_TRANSMISE_CDS_CB',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const FAD_VALIDEE: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 5, numero: '2026-09-09-001', code_statut: 'FAD_VALIDEE_CB' }
const FAD_A_COMPLETER: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 6, numero: '2026-09-10-001', code_statut: 'FAD_A_COMPLETER_CB' }
const FAD_A_COMMANDER: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 7, numero: '2026-09-11-001', code_statut: 'FAD_A_COMMANDER' }
const EN_COURS: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 2, numero: '2026-09-07-001', code_statut: 'FAD_A_MODIFIER_CB' }
const FAD_COMMANDEE: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 3, numero: '2026-08-01-001', code_statut: 'FAD_COMMANDEE' }
const FAD_REJETEE: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 4, numero: '2026-08-02-001', code_statut: 'FAD_REJETEE_CB' }

const SYNTHESE_VIDE: AccueilSynthese = {
  enTransit: { RC: { nombre: 0, montant: 0 }, CDS: { nombre: 0, montant: 0 }, DS: { nombre: 0, montant: 0 }, CB: { nombre: 0, montant: 0 } },
  mesDemandes: { enCours: { nombre: 0, montant: 0 }, commande: { nombre: 0, montant: 0 } },
}

let currentUserData: MeResponse | null = null
const listMock = vi.fn()
const syntheseMock = vi.fn()
const decisionCbMock = vi.fn()
const transmettreDsOuSeuilMock = vi.fn()
const completerCbMock = vi.fn()
const commanderMock = vi.fn()
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
const downloadFadPdfBlobMock = vi.fn()
const triggerBlobDownloadMock = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { email: 'nadia.klein@gpmm.fr' } }, loading: false, signOut: vi.fn() }),
}))
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: currentUserData, loading: false }),
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
vi.mock('../hooks/useCug', () => ({
  useCug: () => ({ cug: [{ code_cug: 'CUG1', libelle_cug: 'Fournitures bureau', id_service: 10, actif: true }], loading: false }),
}))
vi.mock('../hooks/useInvestissementsPgi', () => ({
  useInvestissementsPgi: () => ({ investissements: [], loading: false }),
}))

vi.mock('../hooks/useDemandeAchat', () => ({
  useDemandeAchatList: (...args: unknown[]) => listMock(...args),
  useAccueilSynthese: (...args: unknown[]) => syntheseMock(...args),
  decisionCb: (...args: unknown[]) => decisionCbMock(...args),
  transmettreDsOuSeuil: (...args: unknown[]) => transmettreDsOuSeuilMock(...args),
  completerCb: (...args: unknown[]) => completerCbMock(...args),
  commander: (...args: unknown[]) => commanderMock(...args),
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
  downloadFadPdfBlob: (...args: unknown[]) => downloadFadPdfBlobMock(...args),
}))

vi.mock('../components/demandeAchat/constants', async () => {
  const actual = await vi.importActual<typeof import('../components/demandeAchat/constants')>('../components/demandeAchat/constants')
  return { ...actual, triggerBlobDownload: (...args: unknown[]) => triggerBlobDownloadMock(...args) }
})

/** Route listMock par `params.scope` — même principe que pages/SuiviCds.test.tsx. */
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
  listMock.mockReset()
  syntheseMock.mockReset().mockReturnValue({ data: SYNTHESE_VIDE, loading: false, error: null, refetch: vi.fn() })
  decisionCbMock.mockReset()
  transmettreDsOuSeuilMock.mockReset()
  completerCbMock.mockReset()
  commanderMock.mockReset()
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
  downloadFadPdfBlobMock.mockReset()
  triggerBlobDownloadMock.mockReset()

  mockLists({ A_TRAITER_CB: [FAD_A_TRAITER] })
  currentUserData = {
    matricule: '33001',
    nom: 'KLEIN',
    prenom: 'Nadia',
    idService: 10,
    idCellule: null,
    roles: [{ typeRole: 'CB', perimeterLabel: 'Service Maintenance', idService: 10, idCellule: null }],
  }
})

describe('SuiviCb — en-tête', () => {
  it('affiche le nom du service du rôle CB dans le titre', () => {
    render(<SuiviCb />)
    expect(screen.getByRole('heading', { name: 'Suivi CB — Service Maintenance' })).toBeInTheDocument()
  })
})

describe('SuiviCb — tuiles de synthèse', () => {
  it('affiche "En transit" avec 3 compartiments seulement (RC/CDS/DS, pas CB) et "FAD du service"', () => {
    syntheseMock.mockReturnValue({
      data: {
        enTransit: { RC: { nombre: 3, montant: 25131.7 }, CDS: { nombre: 7, montant: 12000 }, DS: { nombre: 11, montant: 24340.8 }, CB: { nombre: 99, montant: 999999 } },
        mesDemandes: { enCours: { nombre: 38, montant: 150785.4 }, commande: { nombre: 23, montant: 50163.8 } },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<SuiviCb />)

    expect(screen.getByRole('heading', { name: 'En transit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FAD du service' })).toBeInTheDocument()
    // Le compartiment CB (99) n'est jamais affiché — seuls RC/CDS/DS le sont.
    expect(screen.queryByText('99')).not.toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
  })

  it('demande la synthèse avec le rôle CB explicite', () => {
    render(<SuiviCb />)
    expect(syntheseMock).toHaveBeenCalledWith('CB')
  })
})

describe('SuiviCb — onglets', () => {
  it('affiche les 4 onglets avec leur badge de comptage, "À traiter" actif par défaut, aucun onglet "À commander" séparé', () => {
    mockLists({ A_TRAITER_CB: [FAD_A_TRAITER], EN_COURS_CB: [EN_COURS], FAD_COMMANDEES: [FAD_COMMANDEE], REJETEES_ANNULEES: [FAD_REJETEE] })
    render(<SuiviCb />)

    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(within(screen.getByRole('tab', { name: /À traiter/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /En cours/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /FAD commandées/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /Rejetées \/ Annulées/ })).getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /À traiter/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('demande chaque liste avec le rôle CB explicite', () => {
    render(<SuiviCb />)
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'A_TRAITER_CB', role: 'CB' }))
  })
})

describe('SuiviCb — actions par ligne', () => {
  it('sur "À traiter", pour FAD_TRANSMISE_CDS_CB, propose "Valider les éléments de la commande"', () => {
    render(<SuiviCb />)
    const row = within(screen.getByText('2026-09-08-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Valider les éléments de la commande' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Historique des statuts' })).toBeInTheDocument()
  })

  it('sur "À traiter", pour FAD_VALIDEE_CB, propose aussi "Valider les éléments de la commande" (pour transmettre)', () => {
    mockLists({ A_TRAITER_CB: [FAD_VALIDEE] })
    render(<SuiviCb />)
    const row = within(screen.getByText('2026-09-09-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Valider les éléments de la commande' })).toBeInTheDocument()
  })

  it('sur "À traiter", pour FAD_A_COMPLETER_CB, propose "Répondre au DS"', () => {
    mockLists({ A_TRAITER_CB: [FAD_A_COMPLETER] })
    render(<SuiviCb />)
    const row = within(screen.getByText('2026-09-10-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Répondre au DS' })).toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Valider les éléments de la commande' })).not.toBeInTheDocument()
  })

  it('sur "À traiter", pour FAD_A_COMMANDER, propose "Commander"', () => {
    mockLists({ A_TRAITER_CB: [FAD_A_COMMANDER] })
    render(<SuiviCb />)
    const row = within(screen.getByText('2026-09-11-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Commander' })).toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Valider les éléments de la commande' })).not.toBeInTheDocument()
  })

  it('sur les autres onglets, "Voir les éléments de la demande"', () => {
    mockLists({ EN_COURS_CB: [EN_COURS] })
    render(<SuiviCb />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-07-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Voir les éléments de la demande' })).toBeInTheDocument()
  })

  it('bug corrigé le 22/09/2026 : depuis "Voir les éléments de la demande", la Gestion documentaire interroge le backend avec le rôle CB — sans ce paramètre, une CB pure (sans rôle RC) se voyait refuser l\'accès à sa propre FAD', () => {
    const EN_COURS_AVEC_FOURNISSEUR = { ...EN_COURS, id_fournisseur_retenu: 42 }
    mockLists({ EN_COURS_CB: [EN_COURS_AVEC_FOURNISSEUR] })
    render(<SuiviCb />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    fireEvent.click(within(screen.getByText('2026-09-07-001').closest('article')!).getByRole('button', { name: 'Voir les éléments de la demande' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))

    expect(getConsultationMock).toHaveBeenCalledWith(2, 'CB')
  })

  it('"Valider les éléments de la commande" ouvre ValiderCommandeCbModal', () => {
    render(<SuiviCb />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Valider les éléments de la commande' }))

    expect(screen.getByText(/Valider les éléments de la commande/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })

  it('"Répondre au DS" ouvre CompleterCbModal', () => {
    mockLists({ A_TRAITER_CB: [FAD_A_COMPLETER] })
    render(<SuiviCb />)
    fireEvent.click(within(screen.getByText('2026-09-10-001').closest('article')!).getByRole('button', { name: 'Répondre au DS' }))

    expect(screen.getByRole('dialog', { name: /Répondre au DS/ })).toBeInTheDocument()
  })

  it('"Commander" ouvre CommanderCbModal', () => {
    mockLists({ A_TRAITER_CB: [FAD_A_COMMANDER] })
    render(<SuiviCb />)
    fireEvent.click(within(screen.getByText('2026-09-11-001').closest('article')!).getByRole('button', { name: 'Commander' }))

    expect(screen.getByRole('dialog', { name: /Commander/ })).toBeInTheDocument()
  })

  it('"Historique" ouvre la modale d\'historique des statuts', () => {
    render(<SuiviCb />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Historique des statuts' }))

    expect(screen.getByRole('dialog', { name: /Historique des statuts/ })).toBeInTheDocument()
  })
})

describe('SuiviCb — fiche FAD papier (PDF)', () => {
  const FAD_TRANSMISE_DS: DemandeAchatRow = { ...FAD_A_TRAITER, id_demande_achat: 8, numero: '2026-09-12-001', code_statut: 'FAD_TRANSMISE_CB_DS' }
  const FAD_EXEMPTEE_SEUIL: DemandeAchatRow = { ...FAD_A_COMMANDER, validee_sur_seuil_ds: true }

  it('n\'affiche pas le bouton "Générer la fiche FAD" sur un statut "En cours" ordinaire (pas encore transmis au DS)', () => {
    mockLists({ EN_COURS_CB: [EN_COURS] })
    render(<SuiviCb />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-07-001').closest('article')!)

    expect(row.queryByRole('button', { name: 'Générer la fiche FAD (PDF)' })).not.toBeInTheDocument()
  })

  it('affiche le bouton "Générer la fiche FAD" sur "En cours" pour une FAD transmise au DS (FAD_TRANSMISE_CB_DS)', () => {
    mockLists({ EN_COURS_CB: [FAD_TRANSMISE_DS] })
    render(<SuiviCb />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-12-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Générer la fiche FAD (PDF)' })).toBeInTheDocument()
  })

  it('affiche le bouton en plus de "Commander" sur "À traiter" pour une FAD exemptée du seuil DS', () => {
    mockLists({ A_TRAITER_CB: [FAD_EXEMPTEE_SEUIL] })
    render(<SuiviCb />)
    const row = within(screen.getByText('2026-09-11-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Commander' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Générer la fiche FAD (PDF)' })).toBeInTheDocument()
  })

  it('n\'affiche pas le bouton sur "À traiter" pour une FAD_A_COMMANDER non exemptée (DS attendu)', () => {
    mockLists({ A_TRAITER_CB: [FAD_A_COMMANDER] })
    render(<SuiviCb />)
    const row = within(screen.getByText('2026-09-11-001').closest('article')!)

    expect(row.queryByRole('button', { name: 'Générer la fiche FAD (PDF)' })).not.toBeInTheDocument()
  })

  it('affiche la barre de progression indéterminée pendant la génération, la masque une fois terminé', async () => {
    let resolveDownload!: (blob: Blob) => void
    downloadFadPdfBlobMock.mockReturnValue(new Promise<Blob>((resolve) => { resolveDownload = resolve }))
    mockLists({ EN_COURS_CB: [FAD_TRANSMISE_DS] })
    render(<SuiviCb />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-12-001').closest('article')!)

    expect(screen.queryByText('Génération de la fiche FAD…')).not.toBeInTheDocument()
    fireEvent.click(row.getByRole('button', { name: 'Générer la fiche FAD (PDF)' }))
    expect(await screen.findByText('Génération de la fiche FAD…')).toBeInTheDocument()

    resolveDownload(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
    await vi.waitFor(() => expect(screen.queryByText('Génération de la fiche FAD…')).not.toBeInTheDocument())
  })

  it('télécharge le PDF au clic', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    downloadFadPdfBlobMock.mockResolvedValue(blob)
    mockLists({ EN_COURS_CB: [FAD_TRANSMISE_DS] })
    render(<SuiviCb />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-12-001').closest('article')!)

    fireEvent.click(row.getByRole('button', { name: 'Générer la fiche FAD (PDF)' }))

    await vi.waitFor(() => expect(downloadFadPdfBlobMock).toHaveBeenCalledWith(8))
    await vi.waitFor(() => expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, 'FAD-2026-09-12-001.pdf'))
  })

  it('affiche le message d\'erreur renvoyé par le serveur (ex. champs manquants) au lieu d\'un message générique', async () => {
    downloadFadPdfBlobMock.mockRejectedValue(
      new ApiError('Impossible de générer la fiche FAD, élément(s) manquant(s) : délai de l\'entreprise consultée (INEO).', 400),
    )
    mockLists({ EN_COURS_CB: [FAD_TRANSMISE_DS] })
    render(<SuiviCb />)
    fireEvent.click(screen.getByRole('tab', { name: /En cours/ }))
    const row = within(screen.getByText('2026-09-12-001').closest('article')!)

    fireEvent.click(row.getByRole('button', { name: 'Générer la fiche FAD (PDF)' }))

    expect(await screen.findByText(/délai de l'entreprise consultée \(INEO\)/)).toBeInTheDocument()
  })
})
