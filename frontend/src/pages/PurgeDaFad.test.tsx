import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { PurgeDaFad } from './PurgeDaFad'
import type { OrgService } from '../hooks/useServices'
import type { OrgDirection } from '../hooks/useDirections'

const DIRECTIONS: OrgDirection[] = [{ id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true }]

const SERVICES: OrgService[] = [{ id_service: 10, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true }]

vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { email: 'admin@gpmm.fr' } }, loading: false, signOut: vi.fn() }),
}))

const getCountDaFadService = vi.fn()
const purgerDaFadService = vi.fn()
vi.mock('../hooks/usePurgeDaFad', () => ({
  getCountDaFadService: (...args: unknown[]) => getCountDaFadService(...args),
  purgerDaFadService: (...args: unknown[]) => purgerDaFadService(...args),
}))

const signInWithPassword = vi.fn()
vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) } },
}))

/** Ouvre la combobox nommée `ariaLabel` et clique l'option `optionText` — même helper que SeuilsValidationDs.test.tsx. */
function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

async function selectionnerService() {
  selectComboboxOption('Direction', 'Direction Générale')
  selectComboboxOption('Service', 'Maintenance')
  await waitFor(() => expect(getCountDaFadService).toHaveBeenCalledWith(10))
}

describe('PurgeDaFad', () => {
  beforeEach(() => {
    getCountDaFadService.mockReset()
    purgerDaFadService.mockReset()
    signInWithPassword.mockReset()
  })

  it('le bouton de suppression est désactivé tant qu\'aucun service n\'est choisi', () => {
    render(<PurgeDaFad />)
    expect(screen.getByRole('button', { name: /Supprimer toutes les DA\/FAD du service/ })).toBeDisabled()
  })

  it('affiche le nombre de demandes une fois le service choisi, active le bouton', async () => {
    getCountDaFadService.mockResolvedValue(7)
    render(<PurgeDaFad />)

    await selectionnerService()

    await waitFor(() => expect(screen.getByText('7 demandes d\'achat trouvées pour Maintenance.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Supprimer toutes les DA\/FAD du service/ })).not.toBeDisabled()
  })

  it('désactive le bouton si le service n\'a aucune demande', async () => {
    getCountDaFadService.mockResolvedValue(0)
    render(<PurgeDaFad />)

    await selectionnerService()

    await waitFor(() => expect(screen.getByText('Aucune demande d\'achat pour Maintenance.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Supprimer toutes les DA\/FAD du service/ })).toBeDisabled()
  })

  it('étape 1 : affiche la question avec le compte et le nom du service, Annuler ferme sans rien appeler', async () => {
    getCountDaFadService.mockResolvedValue(7)
    render(<PurgeDaFad />)
    await selectionnerService()
    await waitFor(() => screen.getByText(/7 demandes d'achat trouvées/))

    fireEvent.click(screen.getByRole('button', { name: /Supprimer toutes les DA\/FAD du service/ }))

    expect(screen.getByText(/Êtes-vous sûr de vouloir supprimer les 7 demandes du service/)).toBeInTheDocument()
    expect(screen.getByText('Maintenance', { selector: 'strong' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByText(/Êtes-vous sûr/)).not.toBeInTheDocument()
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(purgerDaFadService).not.toHaveBeenCalled()
  })

  it('étape 2 : mot de passe incorrect affiche une erreur et n\'appelle jamais la suppression', async () => {
    getCountDaFadService.mockResolvedValue(7)
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<PurgeDaFad />)
    await selectionnerService()
    await waitFor(() => screen.getByText(/7 demandes d'achat trouvées/))

    fireEvent.click(screen.getByRole('button', { name: /Supprimer toutes les DA\/FAD du service/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'mauvais-mdp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    await waitFor(() => expect(screen.getByText('Mot de passe incorrect.')).toBeInTheDocument())
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'admin@gpmm.fr', password: 'mauvais-mdp' })
    expect(purgerDaFadService).not.toHaveBeenCalled()
  })

  it('mot de passe correct : appelle la suppression, affiche le résultat et réinitialise la sélection', async () => {
    getCountDaFadService.mockResolvedValue(7)
    signInWithPassword.mockResolvedValue({ error: null })
    purgerDaFadService.mockResolvedValue(7)
    render(<PurgeDaFad />)
    await selectionnerService()
    await waitFor(() => screen.getByText(/7 demandes d'achat trouvées/))

    fireEvent.click(screen.getByRole('button', { name: /Supprimer toutes les DA\/FAD du service/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))

    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'bon-mdp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    await waitFor(() => expect(purgerDaFadService).toHaveBeenCalledWith(10))
    await waitFor(() => expect(screen.getByText('7 demandes d\'achat supprimées définitivement.')).toBeInTheDocument())
    // Sélection réinitialisée — plus de compte affiché pour "Maintenance".
    expect(screen.queryByText(/demandes d'achat trouvées/)).not.toBeInTheDocument()
  })
})
