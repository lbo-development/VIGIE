import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { Utilisateurs } from './Utilisateurs'
import type { AdminActeur } from '../hooks/useAllActeurs'
import type { OrgCellule } from '../hooks/useCellules'

const ACTEURS: AdminActeur[] = [
  { matricule: '12520', nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: 7, actif: true },
  { matricule: '99999', nom: 'MARTIN', prenom: 'Alice', fonction: 'RC', id_cellule: 7, actif: false },
]

const CELLULES: OrgCellule[] = [{ id_cellule: 7, code_cellule: 'C1', libelle_cellule: 'Cellule Achats', id_service: 1, actif: true }]

const refetch = vi.fn()
vi.mock('../hooks/useAllActeurs', () => ({
  useAllActeurs: () => ({ acteurs: ACTEURS, loading: false, error: null, refetch }),
}))
vi.mock('../hooks/useCellules', () => ({
  useCellules: () => ({ cellules: CELLULES, loading: false, refetch: vi.fn() }),
}))

const apiPost = vi.fn()
const apiPut = vi.fn()
const apiDelete = vi.fn()
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: (...a: unknown[]) => apiPost(...a), put: (...a: unknown[]) => apiPut(...a), delete: (...a: unknown[]) => apiDelete(...a) } }
})

describe('Utilisateurs', () => {
  it('affiche la liste avec cellule et statut', () => {
    render(<Utilisateurs />)

    const row = screen.getByText('12520').closest('tr')!
    expect(within(row).getByText('DUPONT')).toBeInTheDocument()
    expect(within(row).getByText('Cellule Achats')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()

    const inactiveRow = screen.getByText('99999').closest('tr')!
    expect(within(inactiveRow).getByText('Inactif')).toBeInTheDocument()
  })

  it('filtre par statut', () => {
    render(<Utilisateurs />)

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer les utilisateurs par statut' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('Actif'))

    expect(screen.getByText('12520')).toBeInTheDocument()
    expect(screen.queryByText('99999')).not.toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec les champs attendus, y compris email', () => {
    render(<Utilisateurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouvel utilisateur/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Matricule')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Nom')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Prénom')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Fonction')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Adresse e-mail (compte)')).toBeInTheDocument()
  })

  it('ouvre le formulaire de modification pré-rempli, sans champ email, matricule non modifiable', () => {
    render(<Utilisateurs />)

    fireEvent.click(screen.getAllByRole('button', { name: "Modifier l'utilisateur" })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Nom')).toHaveValue('DUPONT')
    expect(within(dialog).getByLabelText('Matricule')).toBeDisabled()
    expect(within(dialog).queryByLabelText('Adresse e-mail (compte)')).not.toBeInTheDocument()
  })

  it('affiche le mot de passe temporaire une fois la création réussie, puis rafraîchit au clic sur Terminé', async () => {
    apiPost.mockResolvedValue({ temporaryPassword: 'TEMP-PASS-1234' })
    render(<Utilisateurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouvel utilisateur/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Matricule'), { target: { value: '55555' } })
    fireEvent.change(within(dialog).getByLabelText('Nom'), { target: { value: 'Nom' } })
    fireEvent.change(within(dialog).getByLabelText('Prénom'), { target: { value: 'Prenom' } })
    fireEvent.change(within(dialog).getByLabelText('Fonction'), { target: { value: 'Fonction' } })
    fireEvent.change(within(dialog).getByLabelText('Adresse e-mail (compte)'), { target: { value: 'a@b.fr' } })

    fireEvent.click(within(document.body).getByRole('button', { name: 'Cellule' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('Cellule Achats'))

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.getByLabelText('Mot de passe temporaire')).toHaveValue('TEMP-PASS-1234'))

    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('supprime après confirmation, affiche l\'erreur 409 si le backend refuse', async () => {
    const { ApiError } = await import('../services/api')
    apiDelete.mockRejectedValue(new ApiError('Cet acteur est référencé', 409))
    render(<Utilisateurs />)

    fireEvent.click(screen.getAllByRole('button', { name: "Supprimer l'utilisateur" })[0])
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(screen.getByText('Cet acteur est référencé')).toBeInTheDocument())
  })
})
