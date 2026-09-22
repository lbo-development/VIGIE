import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { Home } from './Home'
import type { DemandeAchat as DemandeAchatRow, AccueilScope, AccueilSynthese } from '../hooks/useDemandeAchat'
import type { MeResponse } from '../hooks/useCurrentUser'

const DA1: DemandeAchatRow = {
  id_demande_achat: 1,
  numero: '2026-09-08-001',
  id_service: 10,
  objet_demandeur: 'Achat de fournitures',
  description_demandeur: 'Fournitures diverses',
  objet_rc: 'Achat de fournitures',
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
  code_statut: 'DA_EN_PREPARATION',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const DA2: DemandeAchatRow = { ...DA1, id_demande_achat: 2, numero: '2026-09-08-002', code_statut: 'DA_A_COMPLETER_RC' }
const FAD1: DemandeAchatRow = { ...DA1, id_demande_achat: 3, numero: '2026-09-05-001', code_statut: 'FAD_TRANSMISE_RC_CDS' }
const FAD_COMMANDEE: DemandeAchatRow = { ...DA1, id_demande_achat: 4, numero: '2026-08-01-001', code_statut: 'FAD_COMMANDEE' }
const DA_REJETEE: DemandeAchatRow = { ...DA1, id_demande_achat: 5, numero: '2026-08-02-001', code_statut: 'DA_REJETEE_RC' }

const SYNTHESE_VIDE: AccueilSynthese = {
  enTransit: { RC: { nombre: 0, montant: 0 }, CDS: { nombre: 0, montant: 0 }, DS: { nombre: 0, montant: 0 }, CB: { nombre: 0, montant: 0 } },
  mesDemandes: { enCours: { nombre: 0, montant: 0 }, commande: { nombre: 0, montant: 0 } },
}

let currentUserData: MeResponse | null = null
const listMock = vi.fn()
const syntheseMock = vi.fn()
const createMock = vi.fn()
const transmettreRcMock = vi.fn()
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
  useAuth: () => ({ session: { user: { email: 'alice.martin@gpmm.fr' } }, loading: false, signOut: vi.fn() }),
}))
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: currentUserData, loading: false }),
}))
vi.mock('../hooks/useFournisseurs', () => ({
  useFournisseurs: () => ({
    fournisseurs: [
      { id_fournisseur: 42, id_service: 10, raison_sociale_service: 'ACME', etatfournisseur: 'Actif' },
      { id_fournisseur: 43, id_service: 10, raison_sociale_service: 'BETA SERVICES', etatfournisseur: 'Actif' },
    ],
    loading: false,
  }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 10, code_service: 'S1', libelle_service: 'Service Voyageurs', id_direction: 1, actif: true }], loading: false }),
}))
vi.mock('../hooks/useMarches', () => ({
  useMarches: () => ({
    marches: [
      {
        nummarche: 'M2026001',
        actif: true,
        completude: true,
        utilisable: true,
        typeproc: 'AO',
        typedecompoprix: null,
        naturepresta: null,
        libpgi: null,
        libelle_service: 'Fourniture de bureau',
        titulaire: null,
        fournisseur_raison_sociale: 'ACME',
        agentgestion: null,
        planpreventionactif: null,
        code_cug: null,
        dtevalid: null,
        dtenotif: null,
        dtedebut: null,
        dtefinmax: null,
        mtmaxi: 50000,
        mt_solde: 50000,
        alertemt: 0.8,
        alertedate: 30,
        nombre_pieces: 0,
      },
    ],
    loading: false,
  }),
}))
vi.mock('../hooks/useMarcheTiers', () => ({
  useMarcheTiers: () => ({ marcheTiers: [], loading: false }),
}))
vi.mock('../hooks/useLibelleReferentiel', () => ({
  useLibelleReferentiel: () => ({
    items: [
      { domaine: 'TYPE_PIECE_FAD', code: 'PLAN', libelle: 'Plan', ordre: 1, actif: true },
      { domaine: 'TYPE_PIECE_FAD', code: 'DOC_TECHNIQUE', libelle: 'Documentation technique', ordre: 2, actif: true },
      { domaine: 'TYPE_PIECE_FAD', code: 'FICHE_FAD', libelle: 'Fiche récapitulative FAD', ordre: 7, actif: true },
    ],
    loading: false,
  }),
}))
vi.mock('../hooks/useDemandeAchat', () => ({
  useDemandeAchatList: (...args: unknown[]) => listMock(...args),
  useAccueilSynthese: (...args: unknown[]) => syntheseMock(...args),
  createDemandeAchat: (...args: unknown[]) => createMock(...args),
  transmettreRc: (...args: unknown[]) => transmettreRcMock(...args),
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

/** Route listMock par `params.scope` — même principe que le backend (une liste fixe par onglet). */
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
    refetch: vi.fn(),
  }))
}

beforeEach(() => {
  listMock.mockReset()
  syntheseMock.mockReset()
  createMock.mockReset()
  transmettreRcMock.mockReset()
  getHistoriqueMock.mockReset()
  updateMock.mockReset()
  selectMarcheMock.mockReset()
  getConsultationMock.mockReset()
  addConsultationMock.mockReset()
  removeConsultationMock.mockReset()
  saveConsultationMock.mockReset()
  getOrCreateMarcheDevisMock.mockReset()
  uploadDevisFileMock.mockReset()
  downloadDevisFileBlobMock.mockReset()
  deleteDevisFileMock.mockReset()
  getPiecesMock.mockReset()
  addPieceMock.mockReset()
  removePieceMock.mockReset()
  downloadPieceBlobMock.mockReset()
  deleteMock.mockReset()

  mockLists({ A_FINALISER: [DA1, DA2] })
  syntheseMock.mockReturnValue({ data: SYNTHESE_VIDE, loading: false, error: null, refetch: vi.fn() })
  getConsultationMock.mockResolvedValue([])
  getPiecesMock.mockResolvedValue([])
  getHistoriqueMock.mockResolvedValue([])
  addConsultationMock.mockImplementation((_idDemandeAchat: number, idFournisseur: number) =>
    Promise.resolve({ idDevis: idFournisseur, idFournisseur, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null }),
  )
  removeConsultationMock.mockResolvedValue(undefined)
  currentUserData = { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 100, roles: [] }
})

describe('Home — tuiles de synthèse', () => {
  it('affiche Nombre/Montant "En transit" par rôle (N+1/N+2/N+3/CB)', () => {
    syntheseMock.mockReturnValue({
      data: {
        enTransit: { RC: { nombre: 3, montant: 25131.7 }, CDS: { nombre: 14, montant: 31212.4 }, DS: { nombre: 11, montant: 24340.8 }, CB: { nombre: 10, montant: 70100.5 } },
        mesDemandes: { enCours: { nombre: 38, montant: 150785.4 }, commande: { nombre: 23, montant: 50163.8 } },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<Home />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
  })

  it('affiche 0 pour toutes les tuiles tant que la synthèse est en cours de chargement', () => {
    syntheseMock.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() })
    render(<Home />)

    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })
})

describe('Home — onglets', () => {
  it('affiche les 4 onglets avec leur badge de comptage', () => {
    mockLists({ A_FINALISER: [DA1, DA2], SUIVI_FAD: [FAD1], FAD_COMMANDEES: [FAD_COMMANDEE], REJETEES_ANNULEES: [DA_REJETEE] })
    render(<Home />)

    const tabAFinaliser = screen.getByRole('tab', { name: /A finaliser/ })
    expect(within(tabAFinaliser).getByText('2')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /Suivre & gérer les FAD/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /FAD commandées/ })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /Rejetées \/ Annulées/ })).getByText('1')).toBeInTheDocument()
  })

  it('"A finaliser" est l\'onglet actif par défaut, avec le bouton "Nouvelle demande"', () => {
    render(<Home />)

    expect(screen.getByRole('tab', { name: /A finaliser/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Nouvelle demande' })).toBeInTheDocument()
    expect(screen.getByText('2026-09-08-001')).toBeInTheDocument()
  })

  it('changer d\'onglet affiche la liste scopée correspondante et masque "Nouvelle demande"', () => {
    mockLists({ A_FINALISER: [DA1], SUIVI_FAD: [FAD1] })
    render(<Home />)

    fireEvent.click(screen.getByRole('tab', { name: /Suivre & gérer les FAD/ }))

    expect(screen.getByRole('tab', { name: /Suivre & gérer les FAD/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('2026-09-05-001')).toBeInTheDocument()
    expect(screen.queryByText('2026-09-08-001')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nouvelle demande' })).not.toBeInTheDocument()
  })

  it('sur les onglets 2/3/4, seules les actions Voir/Historique sont proposées (pas Modifier/Supprimer/Transmettre)', () => {
    mockLists({ SUIVI_FAD: [FAD1] })
    render(<Home />)

    fireEvent.click(screen.getByRole('tab', { name: /Suivre & gérer les FAD/ }))
    const row = within(screen.getByText('2026-09-05-001').closest('article')!)

    expect(row.getByRole('button', { name: 'Voir les éléments de la demande' })).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Historique des statuts' })).toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Modifier la demande' })).not.toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Transmettre au RC' })).not.toBeInTheDocument()
  })

  it('affiche le badge "Seuil DS" sur une FAD validée par exemption de seuil, pas sur les autres', () => {
    mockLists({ SUIVI_FAD: [FAD1, { ...FAD1, id_demande_achat: 6, numero: '2026-09-06-001', validee_sur_seuil_ds: true }] })
    render(<Home />)

    fireEvent.click(screen.getByRole('tab', { name: /Suivre & gérer les FAD/ }))

    const rowSansSeuil = within(screen.getByText('2026-09-05-001').closest('article')!)
    const rowAvecSeuil = within(screen.getByText('2026-09-06-001').closest('article')!)
    expect(rowSansSeuil.queryByText('Seuil DS')).not.toBeInTheDocument()
    expect(rowAvecSeuil.getByText('Seuil DS')).toBeInTheDocument()
  })
})

describe('Home — "A finaliser" (actions de ligne)', () => {
  it('"Nouvelle demande" crée un brouillon pour le connecté et ouvre la modale en édition', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 9, objet_demandeur: '', objet_rc: '' })
    render(<Home />)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await waitFor(() => expect(createMock).toHaveBeenCalledWith())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument()
  })

  it('Supprimer est désactivé pour DA_A_COMPLETER_RC, activé pour DA_EN_PREPARATION', () => {
    render(<Home />)

    const rowEnPrep = within(screen.getByText('2026-09-08-001').closest('article')!)
    const rowACompleter = within(screen.getByText('2026-09-08-002').closest('article')!)

    expect(rowEnPrep.getByRole('button', { name: 'Supprimer la demande' })).toBeEnabled()
    expect(rowACompleter.getByRole('button', { name: 'Supprimer la demande' })).toBeDisabled()
  })

  it('"Transmettre au RC" demande confirmation avant d\'appeler transmettreRc', async () => {
    transmettreRcMock.mockResolvedValue({ ...DA1, code_statut: 'DA_TRANSMISE_DEM_RC' })
    render(<Home />)

    const row = within(screen.getByText('2026-09-08-001').closest('article')!)
    fireEvent.click(row.getByRole('button', { name: 'Transmettre au RC' }))

    expect(transmettreRcMock).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog', { name: 'Transmettre au RC' })
    expect(within(dialog).getByText(/2026-09-08-001/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Transmettre' }))

    await waitFor(() => expect(transmettreRcMock).toHaveBeenCalledWith(1))
    expect(screen.queryByRole('dialog', { name: 'Transmettre au RC' })).not.toBeInTheDocument()
  })

  it('"Annuler" ferme la confirmation sans transmettre', async () => {
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Transmettre au RC' }))
    const dialog = await screen.findByRole('dialog', { name: 'Transmettre au RC' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('dialog', { name: 'Transmettre au RC' })).not.toBeInTheDocument()
    expect(transmettreRcMock).not.toHaveBeenCalled()
  })

  it("affiche l'erreur retournée si la transmission échoue (ex. DA incomplète), sans fermer la confirmation", async () => {
    const { ApiError } = await import('../services/api')
    transmettreRcMock.mockRejectedValue(new ApiError('Sélectionnez un marché ou consultez des fournisseurs avant de transmettre.', 409))
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Transmettre au RC' }))
    const dialog = await screen.findByRole('dialog', { name: 'Transmettre au RC' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transmettre' }))

    expect(await screen.findByText('Sélectionnez un marché ou consultez des fournisseurs avant de transmettre.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Transmettre au RC' })).toBeInTheDocument()
  })

  it('"Gérer les documents liés à la demande" est désactivé tant qu\'aucun fournisseur n\'est identifié', () => {
    render(<Home />)
    const row = within(screen.getByText('2026-09-08-001').closest('article')!)
    expect(row.getByRole('button', { name: 'Gérer les documents liés à la demande' })).toBeDisabled()
  })
})

describe('Home — Voir les éléments de la demande (lecture seule)', () => {
  it('ouvre la modale en lecture seule : champs figés, pas de bouton "Enregistrer"', async () => {
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Voir les éléments de la demande' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByLabelText('Objet de la DA')).toHaveAttribute('readonly')
    expect(within(dialog).queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument()
    // "Fermer" existe deux fois (icône ✕ du header + bouton du pied en lecture seule) — on cible le pied.
    expect(within(dialog.querySelector('.gp-modal__ft') as HTMLElement).getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  })

  it('"Montant & marché" est désactivé en lecture seule, "Gestion documentaire" reste accessible en consultation', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    mockLists({ A_FINALISER: [da] })
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Voir les éléments de la demande' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('button', { name: 'Montant & marché' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Gestion documentaire' })).toBeEnabled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Gestion documentaire' }))
    const gestionDialog = await screen.findByRole('dialog', { name: 'Gestion documentaire' })
    // Consultation seule : pas d'icône d'ajout/remplacement du devis, Télécharger reste actif.
    expect(within(gestionDialog).queryByRole('button', { name: /Ajouter le devis|Remplacer le devis/ })).not.toBeInTheDocument()
    expect(within(gestionDialog).getByRole('button', { name: 'Télécharger le devis — ACME' })).toBeInTheDocument()
  })
})

describe('Home — Historique des statuts', () => {
  it('ouvre la modale et charge l\'historique de la DA', async () => {
    getHistoriqueMock.mockResolvedValue([
      {
        idHisto: 1,
        codeStatut: 'DA_EN_PREPARATION',
        libelleStatut: 'DA en préparation',
        dateHeure: '2026-09-08T09:00:00Z',
        matriculeActeur: '10001',
        acteurNomPrenom: 'Alice MARTIN',
        suppleanceLabel: null,
        commentaireStatut: null,
      },
    ])
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Historique des statuts' }))

    await waitFor(() => expect(getHistoriqueMock).toHaveBeenCalledWith(1, undefined))
    expect(await screen.findByText('Alice MARTIN')).toBeInTheDocument()
    expect(screen.getByText('DA en préparation')).toBeInTheDocument()
  })

  it('mentionne la suppléance quand elle est renseignée', async () => {
    getHistoriqueMock.mockResolvedValue([
      {
        idHisto: 1,
        codeStatut: 'DA_VALIDEE_RC',
        libelleStatut: 'Validée par N+1',
        dateHeure: '2026-09-09T10:00:00Z',
        matriculeActeur: '20002',
        acteurNomPrenom: 'Jean DUPONT',
        suppleanceLabel: 'en suppléance de Alice MARTIN',
        commentaireStatut: null,
      },
    ])
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Historique des statuts' }))

    expect(await screen.findByText('en suppléance de Alice MARTIN')).toBeInTheDocument()
  })

  it('affiche une icône œil dans la colonne Commentaire quand il est renseigné, "—" sinon ; le clic ouvre le commentaire complet', async () => {
    getHistoriqueMock.mockResolvedValue([
      {
        idHisto: 1,
        codeStatut: 'DA_REJETEE_RC',
        libelleStatut: 'Rejetée par N+1',
        dateHeure: '2026-09-09T10:00:00Z',
        matriculeActeur: '20002',
        acteurNomPrenom: 'Jean DUPONT',
        suppleanceLabel: null,
        commentaireStatut: 'Achat non pertinent pour le service.',
      },
      {
        idHisto: 2,
        codeStatut: 'DA_EN_PREPARATION',
        libelleStatut: 'DA en préparation',
        dateHeure: '2026-09-08T09:00:00Z',
        matriculeActeur: '10001',
        acteurNomPrenom: 'Alice MARTIN',
        suppleanceLabel: null,
        commentaireStatut: null,
      },
    ])
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Historique des statuts' }))
    const dialog = await screen.findByRole('dialog', { name: /Historique des statuts/ })

    expect(within(dialog).queryByText('Achat non pertinent pour le service.')).not.toBeInTheDocument()
    expect(within(dialog).getAllByText('—')).toHaveLength(1)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Voir le commentaire' }))

    const commentDialog = await screen.findByRole('dialog', { name: 'Commentaire' })
    expect(within(commentDialog).getByText('Achat non pertinent pour le service.')).toBeInTheDocument()
  })
})

describe('DemandeAchatModal — Marché concerné', () => {
  it('affiche "Éléments de consultation" (actif) quand la procédure est Hors marché', async () => {
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Modifier la demande' }))

    expect(screen.getByRole('button', { name: 'Éléments de consultation' })).toBeEnabled()
  })

  it('la procédure est figée (lecture seule) en réouvrant via "Modifier la demande"', async () => {
    render(<Home />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Modifier la demande' }))

    expect(screen.queryByRole('button', { name: "Type procédure d'achat" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Type procédure d'achat")).toHaveValue('Hors marché')
    expect(screen.getByLabelText("Type procédure d'achat")).toHaveAttribute('readonly')
  })

  it('la procédure reste modifiable juste après "Nouvelle demande" (pas encore réouverte)', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 6, objet_demandeur: '', objet_rc: '' })
    render(<Home />)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await screen.findByRole('dialog')

    expect(screen.getByRole('button', { name: "Type procédure d'achat" })).toBeInTheDocument()
  })

  it('changer la procédure la sauvegarde immédiatement (pas seulement au clic sur "Enregistrer")', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 5, objet_demandeur: '', objet_rc: '' })
    updateMock.mockResolvedValue({ ...DA1, id_demande_achat: 5, procedure_achat: 'MARCHE' })
    render(<Home />)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: "Type procédure d'achat" }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('Marché'))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(5, { procedureAchat: 'MARCHE' }))
  })

  it('sélectionner un marché (clic sur la ligne) + montant appelle selectMarcheDemandeAchat et met à jour le résumé', async () => {
    const daMarche: DemandeAchatRow = { ...DA1, id_demande_achat: 5, procedure_achat: 'MARCHE' }
    mockLists({ A_FINALISER: [daMarche] })
    selectMarcheMock.mockResolvedValue({ ...daMarche, nummarche: 'M2026001', id_fournisseur_retenu: 42, montant_demande: 12500 })

    render(<Home />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Modifier la demande' }))

    const bouton = screen.getByRole('button', { name: 'Montant & marché' })
    expect(bouton).toBeEnabled()
    fireEvent.click(bouton)

    const marcheDialog = await screen.findByRole('dialog', { name: 'Sélectionner un marché' })
    fireEvent.click(within(marcheDialog).getByText('M2026001').closest('tr')!)
    fireEvent.change(within(marcheDialog).getByLabelText("Montant de la demande d'achat"), { target: { value: '12500' } })
    fireEvent.click(within(marcheDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(selectMarcheMock).toHaveBeenCalledWith(5, { nummarche: 'M2026001', idMarcheTiers: null, montantDemande: 12500 }))
    await waitFor(() => expect(document.querySelector('.da-modal__resume')?.textContent).toBe('M2026001 — ACME'))
  })

  it('"Gestion documentaire" ouvre l\'écran unifié une fois le marché enregistré et permet de déposer un devis créé à la volée', async () => {
    const daMarche: DemandeAchatRow = { ...DA1, id_demande_achat: 7, procedure_achat: 'MARCHE', nummarche: 'M2026001', id_fournisseur_retenu: 42, montant_demande: 12500 }
    mockLists({ A_FINALISER: [daMarche] })
    getOrCreateMarcheDevisMock.mockResolvedValue({ idDevis: 99, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null })
    uploadDevisFileMock.mockResolvedValue({ idDevis: 99, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-marche.pdf', tailleOctets: 4096 })

    render(<Home />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Modifier la demande' }))

    const gestionBtn = screen.getByRole('button', { name: 'Gestion documentaire' })
    expect(gestionBtn).toBeEnabled()
    fireEvent.click(gestionBtn)

    const gestionDialog = await screen.findByRole('dialog', { name: 'Gestion documentaire' })
    const ajouterDevisBtn = await within(gestionDialog).findByRole('button', { name: 'Ajouter le devis — ACME' })
    fireEvent.click(ajouterDevisBtn)

    await waitFor(() => expect(getOrCreateMarcheDevisMock).toHaveBeenCalledWith(7))
    const addDialog = await screen.findByRole('dialog', { name: 'Devis' })
    const file = new File(['%PDF-1.4'], 'devis-marche.pdf', { type: 'application/pdf' })
    const input = addDialog.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(uploadDevisFileMock).toHaveBeenCalledWith(7, 99, file))
  })
})

describe('DemandeAchatModal — Éléments de consultation', () => {
  async function openFournisseurDaModal() {
    render(<Home />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Modifier la demande' }))
    fireEvent.click(screen.getByRole('button', { name: 'Éléments de consultation' }))
    return screen.findByRole('dialog', { name: 'Éléments de consultation' })
  }

  it('le motif "Prix" est sélectionné par défaut', async () => {
    const dialog = await openFournisseurDaModal()
    expect(within(dialog).getByRole('radio', { name: 'Prix' })).toBeChecked()
  })

  it('ajoute un candidat (écrit immédiatement en base), saisit le montant et le motif, puis enregistre', async () => {
    saveConsultationMock.mockResolvedValue({ ...DA1, id_fournisseur_retenu: 42, motif_choix: 'Prix' })
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' }))
    await waitFor(() => expect(addConsultationMock).toHaveBeenCalledWith(1, 42))
    const montant = await within(dialog).findByLabelText('Montant du devis — ACME')
    fireEvent.change(montant, { target: { value: '1500' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Prix' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(saveConsultationMock).toHaveBeenCalledWith(1, {
        candidats: [{ idDevis: 42, montantDevis: 1500, delaiLivraison: null }],
        motifChoix: 'Prix',
        libelleMotifChoix: undefined,
      }),
    )
  })

  it('bloque "Enregistrer" sans aucun candidat', async () => {
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByText('Au moins une entreprise consultée est requise.')).toBeInTheDocument()
    expect(saveConsultationMock).not.toHaveBeenCalled()
  })

  it('retirer un candidat (écrit immédiatement en base) le fait réapparaître dans la liste des fournisseurs disponibles', async () => {
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' }))
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Ajouter ACME aux consultées' })).not.toBeInTheDocument())

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer ACME des consultées' }))
    await waitFor(() => expect(removeConsultationMock).toHaveBeenCalledWith(1, 42))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' })).toBeInTheDocument())
  })
})

describe('DemandeAchatModal — Gestion documentaire', () => {
  async function openGestionDocumentaireModal(da: DemandeAchatRow) {
    mockLists({ A_FINALISER: [da] })
    render(<Home />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('article')!).getByRole('button', { name: 'Modifier la demande' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))
    return screen.findByRole('dialog', { name: 'Gestion documentaire' })
  }

  it('procédure Marché : la liste n\'affiche qu\'une ligne, celle du titulaire retenu', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    const dialog = await openGestionDocumentaireModal(da)

    expect(await within(dialog).findByText('ACME')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('row')).toHaveLength(2) // 1 ligne d'en-tête + 1 ligne fournisseur
  })

  it('ajoute une pièce complémentaire (type de pièce obligatoire, FICHE_FAD exclu de la liste)', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    addPieceMock.mockResolvedValue({ idPiece: 5, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 2048 })
    const dialog = await openGestionDocumentaireModal(da)

    fireEvent.click(await within(dialog).findByRole('button', { name: /Pièces complémentaires — ACME/ }))
    const piecesDialog = await screen.findByRole('dialog', { name: 'Pièces complémentaires' })

    fireEvent.click(within(piecesDialog).getByRole('button', { name: 'Ajouter une pièce complémentaire' }))
    const addDialog = await screen.findByRole('dialog', { name: 'Pièce complémentaire' })

    expect(within(addDialog).queryByText('Fiche récapitulative FAD')).not.toBeInTheDocument()

    const file = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' })
    const input = addDialog.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(addPieceMock).toHaveBeenCalledWith(1, 42, 'PLAN', file, undefined))
    expect(await within(piecesDialog).findByText('plan.pdf')).toBeInTheDocument()
  })

  it('supprime le devis — demande confirmation avant d\'appeler deleteDevisFile', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    getConsultationMock.mockResolvedValue([
      { idDevis: 99, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-acme.pdf', tailleOctets: 4096 },
    ])
    deleteDevisFileMock.mockResolvedValue({ idDevis: 99, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null })
    const dialog = await openGestionDocumentaireModal(da)

    fireEvent.click(await within(dialog).findByRole('button', { name: 'Remplacer le devis — ACME' }))
    const devisDialog = await screen.findByRole('dialog', { name: 'Devis' })
    fireEvent.click(within(devisDialog).getByRole('button', { name: 'Supprimer le devis' }))

    const confirmDialog = await screen.findByRole('dialog', { name: 'Supprimer le devis' })
    expect(deleteDevisFileMock).not.toHaveBeenCalled()
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(deleteDevisFileMock).toHaveBeenCalledWith(1, 99))
  })

  it('supprime une pièce complémentaire', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    getPiecesMock.mockResolvedValue([{ idPiece: 5, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 2048 }])
    const dialog = await openGestionDocumentaireModal(da)

    fireEvent.click(await within(dialog).findByRole('button', { name: /Pièces complémentaires — ACME/ }))
    const piecesDialog = await screen.findByRole('dialog', { name: 'Pièces complémentaires' })

    const row = (await within(piecesDialog).findByText('plan.pdf')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Supprimer plan.pdf' }))

    // Confirmation obligatoire (décision du 17/09/2026) — pas de suppression avant validation.
    const confirmDialog = await screen.findByRole('dialog', { name: 'Supprimer la pièce' })
    expect(removePieceMock).not.toHaveBeenCalled()
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(removePieceMock).toHaveBeenCalledWith(1, 5, undefined))
    await waitFor(() => expect(within(piecesDialog).queryByText('plan.pdf')).not.toBeInTheDocument())
  })
})
