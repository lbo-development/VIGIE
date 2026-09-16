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
const transmettreFadMock = vi.fn()
const retransmettreCbMock = vi.fn()
const getHistoriqueMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  decisionRc: (...args: unknown[]) => decisionRcMock(...args),
  transmettreFad: (...args: unknown[]) => transmettreFadMock(...args),
  retransmettreCb: (...args: unknown[]) => retransmettreCbMock(...args),
  getHistoriqueStatuts: (...args: unknown[]) => getHistoriqueMock(...args),
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
      { numero_operation: 'OP001', libelle: 'Opération 1', libelle_service: 'Opération 1', id_service: 10, code_cug: 'CUG1', statut: 'ACTIF', actif: true, utilisable: true },
    ],
    loading: false,
  }),
}))

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

beforeEach(() => {
  decisionRcMock.mockReset()
  transmettreFadMock.mockReset()
  retransmettreCbMock.mockReset()
  getHistoriqueMock.mockReset().mockResolvedValue([])
})

describe('TraiterFadRcModal — DA_TRANSMISE_DEM_RC (décision)', () => {
  it('affiche le résumé lecture seule (objet, montant, procédure, fournisseur)', () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('Achat de fournitures diverses')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1 200,00 €')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hors marché')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ACME')).toBeInTheDocument()
  })

  it('refuse Rejeter sans commentaire', async () => {
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))

    expect(await screen.findByText('Un commentaire est requis pour justifier ce choix.')).toBeInTheDocument()
    expect(decisionRcMock).not.toHaveBeenCalled()
  })

  it('Valider ne nécessite aucun commentaire et appelle decisionRc', async () => {
    const onSaved = vi.fn()
    decisionRcMock.mockResolvedValue(DA)
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(decisionRcMock).toHaveBeenCalledWith(1, { decision: 'VALIDER', commentaireStatut: undefined }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('Rejeter avec commentaire transmet le motif', async () => {
    decisionRcMock.mockResolvedValue(DA)
    render(<TraiterFadRcModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Commentaire (obligatoire sauf pour Valider)'), { target: { value: 'Hors budget' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))

    await waitFor(() => expect(decisionRcMock).toHaveBeenCalledWith(1, { decision: 'REJETER', commentaireStatut: 'Hors budget' }))
  })
})

describe('TraiterFadRcModal — DA_VALIDEE_RC (complétion + transmission au CDS)', () => {
  const DA_VALIDEE: DemandeAchatRow = { ...DA, code_statut: 'DA_VALIDEE_RC' }

  it('refuse la transmission sans les champs obligatoires (site/secteur/CUG/type achat/imputation)', async () => {
    render(<TraiterFadRcModal demandeAchat={DA_VALIDEE} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Transmettre au CDS' }))

    expect(await screen.findByText("Site, secteur, CUG, type d'achat et imputation comptable sont obligatoires.")).toBeInTheDocument()
    expect(transmettreFadMock).not.toHaveBeenCalled()
  })

  it("n'affiche le champ Numéro d'opération que pour une imputation Investissement", () => {
    render(<TraiterFadRcModal demandeAchat={DA_VALIDEE} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.queryByLabelText("Numéro d'opération")).not.toBeInTheDocument()

    selectComboboxOption('Imputation comptable', 'Investissement')

    expect(screen.getByLabelText("Numéro d'opération")).toBeInTheDocument()
  })

  it('remplit le formulaire et transmet au CDS via transmettreFad', async () => {
    const onSaved = vi.fn()
    transmettreFadMock.mockResolvedValue(DA_VALIDEE)
    render(<TraiterFadRcModal demandeAchat={DA_VALIDEE} onClose={vi.fn()} onSaved={onSaved} />)

    selectComboboxOption('Site', 'Site Nord')
    selectComboboxOption('Secteur', 'Secteur Nord')
    selectComboboxOption('CUG', 'Fournitures bureau')
    selectComboboxOption("Type d'achat", 'Fournitures')
    selectComboboxOption('Imputation comptable', 'Fonctionnement')

    fireEvent.click(screen.getByRole('button', { name: 'Transmettre au CDS' }))

    await waitFor(() =>
      expect(transmettreFadMock).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          codeSite: 'S1',
          codeSecteur: 'SEC1',
          codeCug: 'CUG1',
          typeAchat: 'FOURNITURES',
          imputationComptable: 'FONCTIONNEMENT',
          numeroOperation: null,
        }),
      ),
    )
    expect(onSaved).toHaveBeenCalled()
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

    await waitFor(() => expect(retransmettreCbMock).toHaveBeenCalledWith(1, expect.objectContaining({ codeSite: 'S1', codeCug: 'CUG1' })))
    expect(onSaved).toHaveBeenCalled()
  })
})
