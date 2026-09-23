import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { TraiterFadRcModal } from './TraiterFadRcModal'
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
  code_statut: 'DA_VALIDEE_RC',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const transmettreFadMock = vi.fn()
const retransmettreCbMock = vi.fn()
const enregistrerFadMock = vi.fn()
const getHistoriqueMock = vi.fn()
const getConsultationMock = vi.fn()
const getPiecesMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  transmettreFad: (...args: unknown[]) => transmettreFadMock(...args),
  retransmettreCb: (...args: unknown[]) => retransmettreCbMock(...args),
  enregistrerFad: (...args: unknown[]) => enregistrerFadMock(...args),
  getHistoriqueStatuts: (...args: unknown[]) => getHistoriqueMock(...args),
  // GestionDocumentaireModal (rendue à l'intérieur de la modale, ouverte via le bouton "Gestion
  // documentaire") importe tout ce module — ces exports doivent exister même non exercés ici, sinon
  // la modale plante au montage ("n'est pas une fonction"). Couverture détaillée de son propre
  // comportement déjà assurée ailleurs (Home.test.tsx, via DemandeAchatModal).
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

vi.mock('../../hooks/useFournisseurs', () => ({
  useFournisseurs: () => ({
    fournisseurs: [{ id_fournisseur: 42, id_service: 10, raison_sociale_service: 'ACME', etatfournisseur: 'Actif' }],
    loading: false,
  }),
}))
vi.mock('../../hooks/useSites', () => ({
  useSites: () => ({
    sites: [
      { code_site: 'S1', lib_site: 'Site Nord', ordre_site: 1, id_service: 10, actif: true, sous_sites: [{ code_site: 'S1', code_sous_site: 'S1A', lib_sous_site: 'Zone A', ordre_sous_site: 1, actif: true }] },
    ],
    loading: false,
  }),
}))
vi.mock('../../hooks/useSecteurs', () => ({
  useSecteurs: () => ({
    secteurs: [
      { code_secteur: 'SEC1', lib_secteur: 'Secteur Nord', ordre_secteur: 1, id_service: 10, actif: true, sous_secteurs: [] },
    ],
    loading: false,
  }),
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
      {
        numero_operation: 'OP002',
        libelle: 'Opération 2',
        libelle_service: 'Réfection voie B',
        id_service: 10,
        code_cug: 'CUG1',
        statut: 'ACTIF',
        actif: true,
        utilisable: false,
        mt_initial: 50000,
        mt_travaux: 40000,
        mt_fesi: 10000,
        mt_budget_ap1: 5000,
        mt_engage_ap1: 0,
        mt_liquide_ap1: 0,
        mt_solde_ap1: 5000,
        mt_budget_ap8: 5000,
        mt_engage_ap8: 0,
        mt_liquide_ap8: 0,
        mt_solde_ap8: 5000,
        mt_budget_cp1: 5000,
        mt_engage_cp1: 0,
        mt_liquide_cp1: 0,
        mt_solde_cp1: 5000,
        mt_budget_cp8: 5000,
        mt_engage_cp8: 0,
        mt_liquide_cp8: 0,
        mt_solde_cp8: 5000,
        nombre_pieces: 0,
      },
    ],
    loading: false,
  }),
}))
vi.mock('../../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 10, code_service: 'S1', libelle_service: 'Service Voyageurs', id_direction: 1, actif: true }], loading: false }),
}))
vi.mock('../../hooks/useLibelleReferentiel', () => ({
  useLibelleReferentiel: () => ({ items: [], loading: false }),
}))

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

const CHAMPS_OBLIGATOIRES = { codeSite: 'S1', codeSecteur: 'SEC1', codeCug: 'CUG1', typeAchat: 'FOURNITURES', typeFad: 'FERMEE', imputationComptable: 'FONCTIONNEMENT' }

function remplirChampsObligatoires() {
  selectComboboxOption('Site', 'Site Nord')
  selectComboboxOption('Secteur', 'Secteur Nord')
  selectComboboxOption('CUG', 'CUG1 — Fournitures bureau')
  selectComboboxOption("Type d'achat", 'Fournitures')
  selectComboboxOption('Type de FAD', 'Fermée (action unique, prix forfaitaire)')
  selectComboboxOption('Imputation comptable', 'Fonctionnement')
}

beforeEach(() => {
  transmettreFadMock.mockReset()
  retransmettreCbMock.mockReset()
  enregistrerFadMock.mockReset()
  getHistoriqueMock.mockReset().mockResolvedValue([])
  getConsultationMock.mockReset().mockResolvedValue([])
  getPiecesMock.mockReset().mockResolvedValue([])
})

describe('TraiterFadRcModal — DA_VALIDEE_RC/FAD_A_COMPLETER_CDS (complétion + transmission au CDS)', () => {
  it('refuse la transmission sans les champs obligatoires', async () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Transmettre au CDS' }))

    expect(
      await screen.findByText('Site, secteur, CUG, type d\'achat, type de FAD et imputation comptable sont obligatoires.'),
    ).toBeInTheDocument()
    expect(transmettreFadMock).not.toHaveBeenCalled()
  })

  it('affiche Motif du choix en Hors Marché, masqué en Marché', () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Motif du choix' })).toBeInTheDocument()

    const daMarche: DemandeAchatRow = { ...DA, procedure_achat: 'MARCHE' }
    render(<TraiterFadRcModal demandeAchat={daMarche} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: 'Motif du choix' })).toHaveLength(1) // le second rendu n'en ajoute pas
  })

  it("n'affiche le champ Numéro d'opération que pour une imputation Investissement", () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.queryByLabelText("Numéro d'opération")).not.toBeInTheDocument()

    selectComboboxOption('Imputation comptable', 'Investissement')

    expect(screen.getByLabelText("Numéro d'opération")).toBeInTheDocument()
  })

  it('sélectionne le numéro d\'opération via la modale dédiée, limitée aux opérations utilisables, avec recherche', async () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    selectComboboxOption('Imputation comptable', 'Investissement')
    fireEvent.click(screen.getByLabelText("Numéro d'opération"))

    const dialog = await screen.findByRole('dialog', { name: /Sélectionner une opération d'investissement/ })
    expect(within(dialog).getByText('OP001')).toBeInTheDocument()
    // OP002 n'est pas UTILISABLE — absente de la liste.
    expect(within(dialog).queryByText('OP002')).not.toBeInTheDocument()
    expect(within(dialog).getByText('80 000 €')).toBeInTheDocument() // Montant travaux

    fireEvent.change(within(dialog).getByLabelText('Recherche sur numéro, libellé opération'), { target: { value: 'quai' } })
    expect(within(dialog).getByText('Rénovation quai 3')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByText('OP001'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(screen.queryByRole('dialog', { name: /Sélectionner une opération d'investissement/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Numéro d'opération" })).toHaveTextContent('OP001 — Rénovation quai 3')
  })

  it('remplit le formulaire et transmet au CDS via transmettreFad, avec typeFad', async () => {
    const onSaved = vi.fn()
    transmettreFadMock.mockResolvedValue(DA)
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    remplirChampsObligatoires()
    fireEvent.click(screen.getByRole('button', { name: 'Transmettre au CDS' }))

    await waitFor(() => expect(transmettreFadMock).toHaveBeenCalledWith(1, expect.objectContaining({ ...CHAMPS_OBLIGATOIRES, numeroOperation: null })))
    expect(onSaved).toHaveBeenCalled()
  })

  it('exige le libellé du motif quand motifChoix vaut "Autre" (Hors Marché)', async () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    remplirChampsObligatoires()
    selectComboboxOption('Motif du choix', 'Autre')
    fireEvent.click(screen.getByRole('button', { name: 'Transmettre au CDS' }))

    expect(await screen.findByText('Le libellé du motif est obligatoire quand le motif est "Autre".')).toBeInTheDocument()
    expect(transmettreFadMock).not.toHaveBeenCalled()
  })

  it('Gestion documentaire est désactivée sans fournisseur retenu, activée sinon', () => {
    const sansFournisseur: DemandeAchatRow = { ...DA, id_fournisseur_retenu: null }
    render(<TraiterFadRcModal demandeAchat={sansFournisseur} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Gestion documentaire' })).toBeDisabled()
  })

  it('Gestion documentaire : devis verrouillé (décision du 17/09/2026 — tant que le RC n\'a pas (re)transmis la FAD)', async () => {
    getConsultationMock.mockResolvedValue([
      { idDevis: 1, idFournisseur: 42, montantDevis: 1200, ordre: 1, retenu: true, nomFichierOriginal: null, tailleOctets: null },
    ])
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))

    expect(await screen.findByRole('dialog', { name: 'Gestion documentaire' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter le devis — ACME' })).toBeDisabled()
  })

  it('Enregistrer sauvegarde la saisie en cours via enregistrerFad, sans fermer la modale ni exiger les champs obligatoires', async () => {
    const onSaved = vi.fn()
    enregistrerFadMock.mockResolvedValue(DA)
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    selectComboboxOption('CUG', 'CUG1 — Fournitures bureau')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(enregistrerFadMock).toHaveBeenCalledWith(1, expect.objectContaining({ codeCug: 'CUG1' })))
    expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
    // Contrairement à Transmettre au CDS, aucun champ obligatoire n'est exigé et la modale reste ouverte.
    expect(transmettreFadMock).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Transmettre au CDS' })).toBeInTheDocument()
  })

  it('Enregistrer transmet la ligne à jour au parent via onProgressSaved (sinon rouvrir après Retour réaffiche les anciennes valeurs)', async () => {
    const onProgressSaved = vi.fn()
    const DA_MISE_A_JOUR: DemandeAchatRow = { ...DA, code_cug: 'CUG1' }
    enregistrerFadMock.mockResolvedValue(DA_MISE_A_JOUR)
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} onProgressSaved={onProgressSaved} />)

    selectComboboxOption('CUG', 'CUG1 — Fournitures bureau')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(onProgressSaved).toHaveBeenCalledWith(DA_MISE_A_JOUR))
  })

  it('Enregistrer exige le libellé du motif quand motifChoix vaut "Autre" (Hors Marché)', async () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    selectComboboxOption('Motif du choix', 'Autre')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le libellé du motif est obligatoire quand le motif est "Autre".')).toBeInTheDocument()
    expect(enregistrerFadMock).not.toHaveBeenCalled()
  })

  it('DA_VALIDEE_RC (première transmission) : ni motif d\'origine, ni champ réponse — ce n\'est pas une reprise', () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(getHistoriqueMock).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Votre réponse (facultatif)')).not.toBeInTheDocument()
  })

  // Décision du 23/09/2026 — écart corrigé : FAD_A_COMPLETER_CDS n'affichait jusqu'ici aucun motif
  // (seule la reprise CB l'affichait), et aucune des 3 reprises n'avait de champ de réponse libre.
  describe('FAD_A_COMPLETER_CDS — motif du CDS et réponse libre (décision du 23/09/2026)', () => {
    const DA_A_COMPLETER: DemandeAchatRow = { ...DA, code_statut: 'FAD_A_COMPLETER_CDS' }
    const ROWS: HistoriqueStatutView[] = [
      {
        idHisto: 1,
        codeStatut: 'FAD_A_COMPLETER_CDS',
        libelleStatut: 'À compléter',
        dateHeure: '2026-09-09T10:00:00Z',
        matriculeActeur: '22001',
        acteurNomPrenom: 'Paul Durand',
        suppleanceLabel: null,
        commentaireStatut: 'Numéro de marché manquant',
      },
    ]

    it('affiche le motif du CDS, absent jusqu\'ici pour ce statut', async () => {
      getHistoriqueMock.mockResolvedValue(ROWS)
      render(<TraiterFadRcModal demandeAchat={DA_A_COMPLETER} onClose={vi.fn()} onSaved={vi.fn()} />)

      expect(await screen.findByText(/Motif du CDS : Numéro de marché manquant/)).toBeInTheDocument()
    })

    it('transmet la réponse saisie à transmettreFad', async () => {
      transmettreFadMock.mockResolvedValue(DA_A_COMPLETER)
      render(<TraiterFadRcModal demandeAchat={DA_A_COMPLETER} onClose={vi.fn()} onSaved={vi.fn()} />)

      remplirChampsObligatoires()
      fireEvent.change(screen.getByLabelText('Votre réponse (facultatif)'), { target: { value: 'Marché ajouté, voir pièce jointe.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Transmettre au CDS' }))

      await waitFor(() =>
        expect(transmettreFadMock).toHaveBeenCalledWith(1, expect.objectContaining({ commentaireStatut: 'Marché ajouté, voir pièce jointe.' })),
      )
    })

    it('omet commentaireStatut si le champ réponse reste vide', async () => {
      transmettreFadMock.mockResolvedValue(DA_A_COMPLETER)
      render(<TraiterFadRcModal demandeAchat={DA_A_COMPLETER} onClose={vi.fn()} onSaved={vi.fn()} />)

      remplirChampsObligatoires()
      fireEvent.click(screen.getByRole('button', { name: 'Transmettre au CDS' }))

      await waitFor(() => expect(transmettreFadMock).toHaveBeenCalledWith(1, expect.objectContaining({ commentaireStatut: undefined })))
    })
  })
})

describe('TraiterFadRcModal — FAD_A_MODIFIER_CB (reprise, retransmission directe à la CB)', () => {
  const DA_A_MODIFIER: DemandeAchatRow = {
    ...DA,
    code_statut: 'FAD_A_MODIFIER_CB',
    code_site: 'S1',
    code_secteur: 'SEC1',
    code_cug: 'CUG1',
    type_achat: 'FOURNITURES',
    type_fad: 'FERMEE',
    imputation_comptable: 'FONCTIONNEMENT',
  }

  it('affiche le motif de la CB (dernière ligne FAD_A_MODIFIER_CB de l\'historique)', async () => {
    const rows: HistoriqueStatutView[] = [
      {
        idHisto: 1,
        codeStatut: 'FAD_TRANSMISE_CDS_CB',
        libelleStatut: 'Transmise à la CB',
        dateHeure: '2026-09-08T10:00:00Z',
        matriculeActeur: '20001',
        acteurNomPrenom: 'Paul Durand',
        suppleanceLabel: null,
        commentaireStatut: null,
      },
      {
        idHisto: 2,
        codeStatut: 'FAD_A_MODIFIER_CB',
        libelleStatut: 'À modifier',
        dateHeure: '2026-09-09T10:00:00Z',
        matriculeActeur: '30001',
        acteurNomPrenom: 'Julie Petit',
        suppleanceLabel: null,
        commentaireStatut: 'Montant incohérent avec le devis',
      },
    ]
    getHistoriqueMock.mockResolvedValue(rows)

    render(<TraiterFadRcModal demandeAchat={DA_A_MODIFIER} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(await screen.findByText(/Montant incohérent avec le devis/)).toBeInTheDocument()
  })

  it('autorise la retransmission sans rien modifier (tous les champs sont optionnels) via retransmettreCb', async () => {
    const onSaved = vi.fn()
    retransmettreCbMock.mockResolvedValue(DA_A_MODIFIER)
    render(<TraiterFadRcModal demandeAchat={DA_A_MODIFIER} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retransmettre à la CB' }))

    await waitFor(() => expect(retransmettreCbMock).toHaveBeenCalledWith(1, expect.objectContaining({ codeSite: 'S1', codeCug: 'CUG1', typeFad: 'FERMEE' })))
    expect(onSaved).toHaveBeenCalled()
  })

  it('Enregistrer reste disponible en reprise CB, sans transmettre', async () => {
    enregistrerFadMock.mockResolvedValue(DA_A_MODIFIER)
    render(<TraiterFadRcModal demandeAchat={DA_A_MODIFIER} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(enregistrerFadMock).toHaveBeenCalledWith(1, expect.anything()))
    expect(retransmettreCbMock).not.toHaveBeenCalled()
  })

  // Décision du 23/09/2026 — réponse libre au motif de la CB avant de retransmettre.
  it('transmet la réponse saisie à retransmettreCb', async () => {
    retransmettreCbMock.mockResolvedValue(DA_A_MODIFIER)
    render(<TraiterFadRcModal demandeAchat={DA_A_MODIFIER} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Votre réponse (facultatif)'), { target: { value: 'Montant corrigé.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retransmettre à la CB' }))

    await waitFor(() => expect(retransmettreCbMock).toHaveBeenCalledWith(1, expect.objectContaining({ commentaireStatut: 'Montant corrigé.' })))
  })
})
