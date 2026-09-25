import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommanderCbModal } from './CommanderCbModal'
import type { DemandeAchat as DemandeAchatRow } from '../../hooks/useDemandeAchat'
import { CURRENCY_FORMAT } from './constants'

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
  numero_commande: null,
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
  code_statut: 'FAD_A_COMMANDER',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const commanderMock = vi.fn()
const useMarcheTiersMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  commander: (...args: unknown[]) => commanderMock(...args),
}))
vi.mock('../../hooks/useMarcheTiers', () => ({
  useMarcheTiers: (...args: unknown[]) => useMarcheTiersMock(...args),
}))

beforeEach(() => {
  commanderMock.mockReset()
  useMarcheTiersMock.mockReset().mockReturnValue({ marcheTiers: [], loading: false, error: null, refetch: vi.fn() })
})

describe('CommanderCbModal', () => {
  it('affiche l\'objet et le montant de la demande', () => {
    const { container } = render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('Achat de fournitures diverses')).toBeInTheDocument()
    const montantDemandeInput = container.querySelectorAll('input[readonly]')[1] as HTMLInputElement
    expect(montantDemandeInput.value).toBe(CURRENCY_FORMAT.format(1200))
  })

  // Décision du 25/09/2026 — pré-rempli avec MONTANT_DEMANDE dès l'ouverture (cas courant où ils sont identiques).
  it('pré-remplit le montant de la commande avec le montant demandé', () => {
    render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('Montant de la commande')).toHaveValue(CURRENCY_FORMAT.format(1200))
  })

  it('refuse la saisie sans montant', async () => {
    render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Montant de la commande'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le montant de la commande est obligatoire.')).toBeInTheDocument()
    expect(commanderMock).not.toHaveBeenCalled()
  })

  it('appelle commander avec le montant et le numéro de commande saisis', async () => {
    const onSaved = vi.fn()
    commanderMock.mockResolvedValue(DA)
    render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText('Montant de la commande'), { target: { value: '1150.50' } })
    fireEvent.change(screen.getByLabelText('Numéro de commande'), { target: { value: 'BC-2026-042' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(commanderMock).toHaveBeenCalledWith(1, 1150.5, 'BC-2026-042'))
    expect(onSaved).toHaveBeenCalled()
  })

  // Décision du 25/09/2026 — numéro de commande PGI, obligatoire.
  describe('Numéro de commande (décision du 25/09/2026)', () => {
    it('reste vide en Hors marché, refuse sans saisie', async () => {
      render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

      expect(screen.getByLabelText('Numéro de commande')).toHaveValue('')

      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

      expect(await screen.findByText('Le numéro de commande est obligatoire.')).toBeInTheDocument()
      expect(commanderMock).not.toHaveBeenCalled()
    })

    it('pré-rempli avec NUMMARCHE en procédure Marché directe', () => {
      const daMarche: DemandeAchatRow = { ...DA, procedure_achat: 'MARCHE', nummarche: 'M2026001', id_marche_tiers: null }
      render(<CommanderCbModal demandeAchat={daMarche} onClose={vi.fn()} onSaved={vi.fn()} />)

      expect(screen.getByLabelText('Numéro de commande')).toHaveValue('M2026001')
    })

    it('pré-rempli avec le numéro du marché tiers une fois chargé', () => {
      useMarcheTiersMock.mockReturnValue({
        marcheTiers: [{ id_marche_tiers: 77, nummarche: 'MT-9001' }],
        loading: false,
        error: null,
        refetch: vi.fn(),
      })
      const daMarcheTiers: DemandeAchatRow = { ...DA, procedure_achat: 'MARCHE', nummarche: null, id_marche_tiers: 77 }
      render(<CommanderCbModal demandeAchat={daMarcheTiers} onClose={vi.fn()} onSaved={vi.fn()} />)

      expect(screen.getByLabelText('Numéro de commande')).toHaveValue('MT-9001')
      expect(useMarcheTiersMock).toHaveBeenCalledWith(10)
    })

    it('reste modifiable après pré-remplissage', () => {
      const daMarche: DemandeAchatRow = { ...DA, procedure_achat: 'MARCHE', nummarche: 'M2026001', id_marche_tiers: null }
      render(<CommanderCbModal demandeAchat={daMarche} onClose={vi.fn()} onSaved={vi.fn()} />)

      fireEvent.change(screen.getByLabelText('Numéro de commande'), { target: { value: 'BC-CORRIGE' } })
      expect(screen.getByLabelText('Numéro de commande')).toHaveValue('BC-CORRIGE')
    })
  })
})
