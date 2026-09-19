import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommanderCbModal } from './CommanderCbModal'
import type { DemandeAchat as DemandeAchatRow } from '../../hooks/useDemandeAchat'

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
  code_statut: 'FAD_A_COMMANDER',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const commanderMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  commander: (...args: unknown[]) => commanderMock(...args),
}))

beforeEach(() => {
  commanderMock.mockReset()
})

describe('CommanderCbModal', () => {
  it('affiche l\'objet et le montant de la demande', () => {
    render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('Achat de fournitures diverses')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1 200,00 €')).toBeInTheDocument()
  })

  it('refuse la saisie sans montant', async () => {
    render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le montant de la commande est obligatoire.')).toBeInTheDocument()
    expect(commanderMock).not.toHaveBeenCalled()
  })

  it('appelle commander avec le montant saisi', async () => {
    const onSaved = vi.fn()
    commanderMock.mockResolvedValue(DA)
    render(<CommanderCbModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText('Montant de la commande'), { target: { value: '1150.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(commanderMock).toHaveBeenCalledWith(1, 1150.5))
    expect(onSaved).toHaveBeenCalled()
  })
})
