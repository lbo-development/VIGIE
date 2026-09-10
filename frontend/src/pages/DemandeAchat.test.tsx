import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { DemandeAchat } from './DemandeAchat'
import type { DemandeAchat as DemandeAchatRow } from '../hooks/useDemandeAchat'
import type { MeResponse } from '../hooks/useCurrentUser'

const DA1: DemandeAchatRow = {
  id_demande_achat: 1,
  numero: '2026-09-08-001',
  id_service: 10,
  objet: 'Achat de fournitures',
  description: 'Fournitures diverses',
  montant_demande: 1200,
  imputation_comptable: null,
  procedure_achat: 'HORS_MARCHE',
  type_achat: null,
  type_fad: null,
  motif_choix: null,
  libelle_motif_choix: null,
  montant_retenu: null,
  montant_commande: null,
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

const DA2: DemandeAchatRow = { ...DA1, id_demande_achat: 2, numero: '2026-09-08-002', code_statut: 'DA_A_COMPLETER' }

let currentUserData: MeResponse | null = null
const listMock = vi.fn()
const createMock = vi.fn()
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

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: currentUserData, loading: false }),
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: [{ id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true }], loading: false }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 10, code_service: 'S1', libelle_service: 'Service Voyageurs', id_direction: 1, actif: true }], loading: false }),
}))
vi.mock('../hooks/useCellules', () => ({
  useCellules: () => ({ cellules: [{ id_cellule: 100, code_cellule: 'C1', libelle_cellule: 'Cellule A', id_service: 10, actif: true }], loading: false }),
}))
vi.mock('../hooks/useActeurs', () => ({
  useActeurs: () => ({ acteurs: [{ matricule: '10002', nom: 'DUPONT', prenom: 'Jean', fonction: null, id_cellule: 100 }], loading: false }),
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
  createDemandeAchat: (...args: unknown[]) => createMock(...args),
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

beforeEach(() => {
  listMock.mockReset()
  createMock.mockReset()
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
  listMock.mockReturnValue({ demandesAchat: [DA1, DA2], loading: false, error: null, refetch: vi.fn() })
  getConsultationMock.mockResolvedValue([])
  getPiecesMock.mockResolvedValue([])
  // Par défaut : idDevis calqué sur idFournisseur (unique dans les fixtures ci-dessus, ACME=42/BETA=43) — suffisant pour les tests, la vraie valeur vient du serveur.
  addConsultationMock.mockImplementation((_idDemandeAchat: number, idFournisseur: number) =>
    Promise.resolve({ idDevis: idFournisseur, idFournisseur, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null }),
  )
  removeConsultationMock.mockResolvedValue(undefined)
})

describe('DemandeAchat — Demandeur simple', () => {
  beforeEach(() => {
    currentUserData = { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 100, roles: [] }
  })

  it('affiche Direction/Service/Cellule/Demandeur figés (lecture seule)', () => {
    render(<DemandeAchat />)

    expect(screen.getByDisplayValue('Direction Générale')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Service Voyageurs')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cellule A')).toBeInTheDocument()
    expect(screen.getByDisplayValue('MARTIN Alice')).toBeInTheDocument()
  })

  it('"Nouvelle demande" est activé sans sélection (crée pour soi-même)', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 3, objet: '' })
    render(<DemandeAchat />)

    const bouton = screen.getByRole('button', { name: 'Nouvelle demande' })
    expect(bouton).toBeEnabled()

    fireEvent.click(bouton)
    await waitFor(() => expect(createMock).toHaveBeenCalledWith(undefined))
  })

  it('la liste affiche le statut de chaque DA avec son libellé', () => {
    render(<DemandeAchat />)

    expect(screen.getByText('En préparation')).toBeInTheDocument()
    expect(screen.getByText('À compléter')).toBeInTheDocument()
  })

  it('Supprimer est désactivé pour une DA_A_COMPLETER, activé pour une DA_EN_PREPARATION', () => {
    render(<DemandeAchat />)

    const rowEnPrep = screen.getByText('2026-09-08-001').closest('tr')!
    const rowACompleter = screen.getByText('2026-09-08-002').closest('tr')!

    expect(within(rowEnPrep).getByRole('button', { name: 'Supprimer une DA' })).toBeEnabled()
    expect(within(rowACompleter).getByRole('button', { name: 'Supprimer une DA' })).toBeDisabled()
  })
})

describe('DemandeAchat — RC', () => {
  beforeEach(() => {
    currentUserData = {
      matricule: '20001',
      nom: 'DURAND',
      prenom: 'Paul',
      idService: 10,
      idCellule: 100,
      roles: [{ typeRole: 'RC', perimeterLabel: 'Cellule A', idService: null }],
    }
  })

  it('Direction/Service/Cellule restent figés, Demandeur devient un sélecteur', () => {
    render(<DemandeAchat />)

    expect(screen.getByDisplayValue('Direction Générale')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Service Voyageurs')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Cellule A')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Demandeur' })).toBeInTheDocument()
  })

  it('"Nouvelle demande" est désactivé tant qu\'aucun demandeur n\'est choisi', () => {
    render(<DemandeAchat />)

    expect(screen.getByRole('button', { name: 'Nouvelle demande' })).toBeDisabled()
  })

  it('choisir un demandeur active "Nouvelle demande" et crée pour ce demandeur', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 4 })
    render(<DemandeAchat />)

    fireEvent.click(screen.getByRole('button', { name: 'Demandeur' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('DUPONT Jean'))

    const bouton = screen.getByRole('button', { name: 'Nouvelle demande' })
    expect(bouton).toBeEnabled()

    fireEvent.click(bouton)
    await waitFor(() => expect(createMock).toHaveBeenCalledWith('10002'))
  })
})

describe('DemandeAchat — ADMIN_SERVICE', () => {
  beforeEach(() => {
    currentUserData = {
      matricule: '30001',
      nom: 'LEROY',
      prenom: 'Sophie',
      idService: 10,
      idCellule: 100,
      roles: [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Service Voyageurs', idService: 10 }],
    }
  })

  it('Cellule devient un sélecteur, Demandeur reste vide tant que la cellule n\'est pas choisie', () => {
    render(<DemandeAchat />)

    expect(screen.getByRole('button', { name: 'Cellule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouvelle demande' })).toBeDisabled()
  })
})

describe('DemandeAchatModal — Marché concerné', () => {
  beforeEach(() => {
    currentUserData = { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 100, roles: [] }
  })

  it('affiche "Éléments de consultation" (actif) quand la procédure est Hors marché', () => {
    render(<DemandeAchat />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))

    expect(screen.getByRole('button', { name: 'Éléments de consultation' })).toBeEnabled()
  })

  it('la procédure est figée (lecture seule) en réouvrant via "Modifier une DA" — décision du 09/09/2026', () => {
    render(<DemandeAchat />)

    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))

    expect(screen.queryByRole('button', { name: "Type procédure d'achat" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Type procédure d'achat")).toHaveValue('Hors marché')
    expect(screen.getByLabelText("Type procédure d'achat")).toHaveAttribute('readonly')
  })

  it('la procédure reste modifiable juste après "Nouvelle demande" (pas encore réouverte)', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 6, objet: '' })
    render(<DemandeAchat />)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await screen.findByRole('dialog')

    expect(screen.getByRole('button', { name: "Type procédure d'achat" })).toBeInTheDocument()
  })

  it('changer la procédure la sauvegarde immédiatement (pas seulement au clic sur "Enregistrer") — bug corrigé le 09/09/2026 — uniquement à la création, la procédure est figée dès "Modifier une DA"', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 5, objet: '' })
    updateMock.mockResolvedValue({ ...DA1, id_demande_achat: 5, procedure_achat: 'MARCHE' })
    render(<DemandeAchat />)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: "Type procédure d'achat" }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('Marché'))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(5, { procedureAchat: 'MARCHE' }))
  })

  it('changer de procédure après avoir sélectionné un marché vide le résumé (marché/fournisseur) — bug corrigé le 09/09/2026', async () => {
    createMock.mockResolvedValue({ ...DA1, id_demande_achat: 9, objet: '', procedure_achat: 'MARCHE', nummarche: null, id_fournisseur_retenu: null })
    selectMarcheMock.mockResolvedValue({
      ...DA1,
      id_demande_achat: 9,
      procedure_achat: 'MARCHE',
      nummarche: 'M2026001',
      id_fournisseur_retenu: 42,
      montant_demande: 12500,
    })
    updateMock.mockResolvedValue({
      ...DA1,
      id_demande_achat: 9,
      procedure_achat: 'HORS_MARCHE',
      nummarche: null,
      id_marche_tiers: null,
      id_fournisseur_retenu: null,
      motif_choix: null,
      libelle_motif_choix: null,
      montant_demande: 0,
    })

    render(<DemandeAchat />)
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle demande' }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Montant & marché' }))
    const marcheDialog = await screen.findByRole('dialog', { name: 'Sélectionner un marché' })
    fireEvent.click(within(marcheDialog).getByText('M2026001').closest('tr')!)
    fireEvent.change(within(marcheDialog).getByLabelText("Montant de la demande d'achat"), { target: { value: '12500' } })
    fireEvent.click(within(marcheDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(selectMarcheMock).toHaveBeenCalled())
    expect(await within(dialog).findByText('M2026001')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: "Type procédure d'achat" }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('Hors marché'))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(9, { procedureAchat: 'HORS_MARCHE' }))
    await waitFor(() => expect(within(dialog).queryByText('M2026001')).not.toBeInTheDocument())
    expect(within(dialog).getByLabelText('Montant DA')).toHaveValue('—')
  })

  it('sélectionner un marché (clic sur la ligne) + montant appelle selectMarcheDemandeAchat et met à jour le résumé', async () => {
    const daMarche: DemandeAchatRow = { ...DA1, id_demande_achat: 5, procedure_achat: 'MARCHE' }
    listMock.mockReturnValue({ demandesAchat: [daMarche], loading: false, error: null, refetch: vi.fn() })
    selectMarcheMock.mockResolvedValue({ ...daMarche, nummarche: 'M2026001', id_fournisseur_retenu: 42, montant_demande: 12500 })

    render(<DemandeAchat />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))

    const bouton = screen.getByRole('button', { name: 'Montant & marché' })
    expect(bouton).toBeEnabled()
    fireEvent.click(bouton)

    const marcheDialog = await screen.findByRole('dialog', { name: 'Sélectionner un marché' })
    fireEvent.click(within(marcheDialog).getByText('M2026001').closest('tr')!)
    fireEvent.change(within(marcheDialog).getByLabelText("Montant de la demande d'achat"), { target: { value: '12500' } })
    fireEvent.click(within(marcheDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(selectMarcheMock).toHaveBeenCalledWith(5, { nummarche: 'M2026001', idMarcheTiers: null, montantDemande: 12500 }),
    )
    // Résumé procédure Marché : « Numéro de marché — Nom fournisseur » sur une seule ligne.
    await waitFor(() => expect(document.querySelector('.da-modal__resume')?.textContent).toBe('M2026001 — ACME'))
  })

  it('"Enregistrer" est bloqué tant que le montant est vide', async () => {
    const daMarche: DemandeAchatRow = { ...DA1, id_demande_achat: 5, procedure_achat: 'MARCHE', montant_demande: 0 }
    listMock.mockReturnValue({ demandesAchat: [daMarche], loading: false, error: null, refetch: vi.fn() })

    render(<DemandeAchat />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Montant & marché' }))

    const marcheDialog = await screen.findByRole('dialog', { name: 'Sélectionner un marché' })
    fireEvent.click(within(marcheDialog).getByText('M2026001').closest('tr')!)
    fireEvent.click(within(marcheDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(marcheDialog).findByText('Le montant est obligatoire.')).toBeInTheDocument()
    expect(selectMarcheMock).not.toHaveBeenCalled()
  })

  it('"Gestion documentaire" est désactivé tant qu\'aucun fournisseur n\'est identifié — décision du 09/09/2026 (gestion documentaire unifiée dans CreationDA)', async () => {
    const daMarche: DemandeAchatRow = { ...DA1, id_demande_achat: 5, procedure_achat: 'MARCHE', id_fournisseur_retenu: null }
    listMock.mockReturnValue({ demandesAchat: [daMarche], loading: false, error: null, refetch: vi.fn() })

    render(<DemandeAchat />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))

    expect(screen.getByRole('button', { name: 'Gestion documentaire' })).toBeDisabled()
  })

  it('"Gestion documentaire" ouvre l\'écran unifié une fois le marché enregistré et permet de déposer un devis créé à la volée — décision du 09/09/2026', async () => {
    const daMarche: DemandeAchatRow = { ...DA1, id_demande_achat: 7, procedure_achat: 'MARCHE', nummarche: 'M2026001', id_fournisseur_retenu: 42, montant_demande: 12500 }
    listMock.mockReturnValue({ demandesAchat: [daMarche], loading: false, error: null, refetch: vi.fn() })
    getOrCreateMarcheDevisMock.mockResolvedValue({ idDevis: 99, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null })
    uploadDevisFileMock.mockResolvedValue({ idDevis: 99, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-marche.pdf', tailleOctets: 4096 })

    render(<DemandeAchat />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))

    const gestionBtn = screen.getByRole('button', { name: 'Gestion documentaire' })
    expect(gestionBtn).toBeEnabled()
    fireEvent.click(gestionBtn)

    const gestionDialog = await screen.findByRole('dialog', { name: 'Gestion documentaire' })
    const ajouterDevisBtn = await within(gestionDialog).findByRole('button', { name: 'Ajouter le devis' })
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
  beforeEach(() => {
    currentUserData = { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 100, roles: [] }
  })

  async function openFournisseurDaModal() {
    render(<DemandeAchat />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))
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
        candidats: [{ idDevis: 42, montantDevis: 1500 }],
        motifChoix: 'Prix',
        libelleMotifChoix: undefined,
      }),
    )
  })

  it('après enregistrement, le résumé Hors marché affiche « Nom fournisseur — n entreprise(s) consultée(s) » sur une seule ligne', async () => {
    saveConsultationMock.mockResolvedValue({ ...DA1, id_fournisseur_retenu: 42, motif_choix: 'Prix' })
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' }))
    await waitFor(() => expect(addConsultationMock).toHaveBeenCalledWith(1, 42))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter BETA SERVICES aux consultées' }))
    await waitFor(() => expect(addConsultationMock).toHaveBeenCalledWith(1, 43))

    const montantAcme = await within(dialog).findByLabelText('Montant du devis — ACME')
    fireEvent.change(montantAcme, { target: { value: '1500' } })
    const montantBeta = within(dialog).getByLabelText('Montant du devis — BETA SERVICES')
    fireEvent.change(montantBeta, { target: { value: '1600' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(saveConsultationMock).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('.da-modal__resume')?.textContent).toBe('ACME — 2 entreprise(s) consultée(s)'))
  })

  it('après enregistrement, "Montant DA" (lecture seule) reflète le montant du candidat retenu — décision du 09/09/2026', async () => {
    saveConsultationMock.mockResolvedValue({ ...DA1, id_fournisseur_retenu: 42, motif_choix: 'Prix', montant_demande: 1500 })
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' }))
    const montant = await within(dialog).findByLabelText('Montant du devis — ACME')
    fireEvent.change(montant, { target: { value: '1500' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(saveConsultationMock).toHaveBeenCalled())
    const montantDa = screen.getByLabelText('Montant DA')
    expect(montantDa).toHaveValue(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1500))
    expect(montantDa).toHaveAttribute('readonly')
  })

  it('bloque "Enregistrer" sans aucun candidat', async () => {
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByText('Au moins une entreprise consultée est requise.')).toBeInTheDocument()
    expect(saveConsultationMock).not.toHaveBeenCalled()
  })

  it('exige le libellé du motif quand "Autre" est choisi', async () => {
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' }))
    const montant = await within(dialog).findByLabelText('Montant du devis — ACME')
    fireEvent.change(montant, { target: { value: '1500' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Autre' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByText('Le libellé du motif est obligatoire quand le motif est "Autre".')).toBeInTheDocument()
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

  it('autorise 2 décimales au montant du devis et l\'affiche au format CURRENCY_FORMAT (fr-FR) une fois le champ non focus', async () => {
    saveConsultationMock.mockResolvedValue({ ...DA1, id_fournisseur_retenu: 42, motif_choix: 'Prix' })
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' }))
    const montant = await within(dialog).findByLabelText('Montant du devis — ACME')

    fireEvent.focus(montant)
    fireEvent.change(montant, { target: { value: '1254.345' } })
    expect(montant).toHaveValue('1254.34')

    fireEvent.blur(montant)
    expect(montant).toHaveValue(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1254.34))

    fireEvent.focus(montant)
    expect(montant).toHaveValue('1254.34')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() =>
      expect(saveConsultationMock).toHaveBeenCalledWith(1, {
        candidats: [{ idDevis: 42, montantDevis: 1254.34 }],
        motifChoix: 'Prix',
        libelleMotifChoix: undefined,
      }),
    )
  })

  it('après "Enregistrer" de la liste, "Gestion documentaire" (CreationDA) permet de déposer le devis du candidat retenu — la gestion documentaire a été retirée de cette modale le 09/09/2026', async () => {
    saveConsultationMock.mockResolvedValue({ ...DA1, id_fournisseur_retenu: 42, motif_choix: 'Prix', montant_demande: 1500 })
    uploadDevisFileMock.mockResolvedValue({
      idDevis: 42,
      idFournisseur: 42,
      montantDevis: 1500,
      ordre: 1,
      retenu: true,
      nomFichierOriginal: 'devis-acme.pdf',
      tailleOctets: 2048,
    })
    const dialog = await openFournisseurDaModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter ACME aux consultées' }))
    expect(within(dialog).queryByRole('button', { name: 'Ajouter un devis — ACME' })).not.toBeInTheDocument()
    const montant = await within(dialog).findByLabelText('Montant du devis — ACME')
    fireEvent.change(montant, { target: { value: '1500' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(saveConsultationMock).toHaveBeenCalled())

    getConsultationMock.mockResolvedValue([
      { idDevis: 42, idFournisseur: 42, montantDevis: 1500, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null },
    ])
    const gestionBtn = await screen.findByRole('button', { name: 'Gestion documentaire' })
    expect(gestionBtn).toBeEnabled()
    fireEvent.click(gestionBtn)

    const gestionDialog = await screen.findByRole('dialog', { name: 'Gestion documentaire' })
    fireEvent.click(await within(gestionDialog).findByRole('button', { name: 'Ajouter le devis' }))
    const addDialog = await screen.findByRole('dialog', { name: 'Devis' })
    const file = new File(['%PDF-1.4'], 'devis-acme.pdf', { type: 'application/pdf' })
    const input = addDialog.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(uploadDevisFileMock).toHaveBeenCalledWith(1, 42, file))
  })
})

describe('DemandeAchatModal — Gestion documentaire', () => {
  beforeEach(() => {
    currentUserData = { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 100, roles: [] }
  })

  async function openGestionDocumentaireModal(da: DemandeAchatRow) {
    listMock.mockReturnValue({ demandesAchat: [da], loading: false, error: null, refetch: vi.fn() })
    render(<DemandeAchat />)
    fireEvent.click(within(screen.getByText('2026-09-08-001').closest('tr')!).getByRole('button', { name: 'Modifier une DA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))
    return screen.findByRole('dialog', { name: 'Gestion documentaire' })
  }

  it('procédure Marché : le sélecteur Fournisseurs n\'affiche que le titulaire retenu', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    const dialog = await openGestionDocumentaireModal(da)

    expect(within(dialog).getByRole('button', { name: 'Fournisseur' })).toHaveTextContent('ACME')
  })

  it('procédure Marché : le montant affiché est MONTANT_DEMANDE de la DA (un seul fournisseur)', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42, montant_demande: 12500 }
    const dialog = await openGestionDocumentaireModal(da)

    expect(within(dialog).getByLabelText('Montant')).toHaveValue(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(12500))
  })

  it('procédure Hors marché : le montant affiché est celui du devis du fournisseur sélectionné, change avec la sélection', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'HORS_MARCHE', id_fournisseur_retenu: 42, montant_demande: 1500 }
    getConsultationMock.mockResolvedValue([
      { idDevis: 42, idFournisseur: 42, montantDevis: 1500, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null },
      { idDevis: 43, idFournisseur: 43, montantDevis: 1600, ordre: 2, retenu: false, nomFichierOriginal: null, tailleOctets: null },
    ])
    const dialog = await openGestionDocumentaireModal(da)

    const montant = await within(dialog).findByLabelText('Montant')
    expect(montant).toHaveValue(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1500))

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fournisseur' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('BETA SERVICES'))

    await waitFor(() => expect(montant).toHaveValue(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1600)))
  })

  it('l\'icône « Gérer les documents liés à la demande » de la liste ouvre le même écran, désactivée tant qu\'aucun fournisseur n\'est identifié', async () => {
    const daSansFournisseur: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: null }
    const daAvecFournisseur: DemandeAchatRow = { ...DA2, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    listMock.mockReturnValue({ demandesAchat: [daSansFournisseur, daAvecFournisseur], loading: false, error: null, refetch: vi.fn() })

    render(<DemandeAchat />)

    const rowSansFournisseur = within(screen.getByText('2026-09-08-001').closest('tr')!)
    expect(rowSansFournisseur.getByRole('button', { name: 'Gérer les documents liés à la demande' })).toBeDisabled()

    const rowAvecFournisseur = within(screen.getByText('2026-09-08-002').closest('tr')!)
    const gererBtn = rowAvecFournisseur.getByRole('button', { name: 'Gérer les documents liés à la demande' })
    expect(gererBtn).toBeEnabled()
    fireEvent.click(gererBtn)

    const dialog = await screen.findByRole('dialog', { name: 'Gestion documentaire' })
    expect(within(dialog).getByRole('button', { name: 'Fournisseur' })).toHaveTextContent('ACME')
    // Ouvert directement depuis la liste — pas de « Modifier une DA » entre les deux.
    expect(screen.queryByRole('dialog', { name: '2026-09-08-002' })).not.toBeInTheDocument()
  })

  it('procédure Hors marché : le sélecteur Fournisseurs liste les candidats consultés, changer de sélection recharge le devis et les pièces', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'HORS_MARCHE', id_fournisseur_retenu: 42 }
    getConsultationMock.mockResolvedValue([
      { idDevis: 42, idFournisseur: 42, montantDevis: 1000, ordre: 1, retenu: true, nomFichierOriginal: 'devis-acme.pdf', tailleOctets: 100 },
      { idDevis: 43, idFournisseur: 43, montantDevis: 900, ordre: 2, retenu: false, nomFichierOriginal: null, tailleOctets: null },
    ])
    const dialog = await openGestionDocumentaireModal(da)

    expect(await within(dialog).findByDisplayValue('devis-acme.pdf')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fournisseur' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('BETA SERVICES'))

    expect(await within(dialog).findByDisplayValue('Aucun devis déposé')).toBeInTheDocument()
    expect(getPiecesMock).toHaveBeenCalledWith(1, 43)
  })

  it('ajoute une pièce complémentaire (type de pièce obligatoire, FICHE_FAD exclu de la liste)', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    addPieceMock.mockResolvedValue({ idPiece: 5, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 2048 })
    const dialog = await openGestionDocumentaireModal(da)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter une pièce complémentaire' }))
    const addDialog = await screen.findByRole('dialog', { name: 'Pièce complémentaire' })

    expect(within(addDialog).queryByText('Fiche récapitulative FAD')).not.toBeInTheDocument()

    const file = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' })
    const input = addDialog.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(within(addDialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(addPieceMock).toHaveBeenCalledWith(1, 42, 'PLAN', file))
    expect(await within(dialog).findByText('plan.pdf')).toBeInTheDocument()
  })

  it('affiche le libellé du type de pièce (référentiel), pas le code brut', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    getPiecesMock.mockResolvedValue([{ idPiece: 5, idFournisseur: 42, typePiece: 'DOC_TECHNIQUE', nomFichierOriginal: 'cycle-de-vie.pdf', tailleOctets: 2048 }])
    const dialog = await openGestionDocumentaireModal(da)

    expect(await within(dialog).findByText('Documentation technique')).toBeInTheDocument()
    expect(within(dialog).queryByText('DOC_TECHNIQUE')).not.toBeInTheDocument()
  })

  it('supprime une pièce complémentaire', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    getPiecesMock.mockResolvedValue([{ idPiece: 5, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 2048 }])
    const dialog = await openGestionDocumentaireModal(da)

    const row = (await within(dialog).findByText('plan.pdf')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Supprimer plan.pdf' }))

    await waitFor(() => expect(removePieceMock).toHaveBeenCalledWith(1, 5))
    await waitFor(() => expect(within(dialog).queryByText('plan.pdf')).not.toBeInTheDocument())
  })

  it('télécharge une pièce complémentaire et le devis', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    getConsultationMock.mockResolvedValue([
      { idDevis: 42, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-acme.pdf', tailleOctets: 100 },
    ])
    getPiecesMock.mockResolvedValue([{ idPiece: 5, idFournisseur: 42, typePiece: 'PLAN', nomFichierOriginal: 'plan.pdf', tailleOctets: 2048 }])
    downloadDevisFileBlobMock.mockResolvedValue(new Blob(['%PDF']))
    downloadPieceBlobMock.mockResolvedValue(new Blob(['%PDF']))
    const dialog = await openGestionDocumentaireModal(da)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Télécharger le devis' }))
    await waitFor(() => expect(downloadDevisFileBlobMock).toHaveBeenCalledWith(1, 42))

    const row = (await within(dialog).findByText('plan.pdf')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Télécharger plan.pdf' }))
    await waitFor(() => expect(downloadPieceBlobMock).toHaveBeenCalledWith(1, 5))
  })

  it('supprime le devis (fichier uniquement, le candidat reste consulté) — n\'est actif que si un fichier est déjà déposé', async () => {
    const da: DemandeAchatRow = { ...DA1, procedure_achat: 'MARCHE', id_fournisseur_retenu: 42 }
    getConsultationMock.mockResolvedValue([
      { idDevis: 42, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-acme.pdf', tailleOctets: 100 },
    ])
    deleteDevisFileMock.mockResolvedValue({ idDevis: 42, idFournisseur: 42, montantDevis: null, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null })
    const dialog = await openGestionDocumentaireModal(da)

    const supprimerBtn = await within(dialog).findByRole('button', { name: 'Supprimer le devis' })
    expect(supprimerBtn).toBeEnabled()
    fireEvent.click(supprimerBtn)

    await waitFor(() => expect(deleteDevisFileMock).toHaveBeenCalledWith(1, 42))
    expect(await within(dialog).findByDisplayValue('Aucun devis déposé')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Supprimer le devis' })).toBeDisabled()
  })
})
