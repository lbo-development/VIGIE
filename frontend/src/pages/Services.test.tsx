import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Services } from './Services'
import type { OrgService } from '../hooks/useServices'
import type { OrgDirection } from '../hooks/useDirections'

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 2, actif: false },
]

vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false, refetch: vi.fn() }),
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

/** Ouvre la combobox nommée `ariaLabel` et clique l'option `optionText` dans son menu. */
function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('Services', () => {
  it('la liste est vide tant qu\'aucune direction n\'est choisie, et aucune option "Toutes les directions" n\'existe', () => {
    render(<Services />)

    expect(screen.getByText('Sélectionne une direction pour afficher les services.')).toBeInTheDocument()
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Filtrer par direction' })
    fireEvent.click(trigger)
    const menu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(menu).queryByText(/toutes les directions/i)).not.toBeInTheDocument()
  })

  it('affiche la liste des services de la direction choisie, avec leur direction et leur statut', () => {
    render(<Services />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const row = screen.getByText('Maintenance').closest('tr')!
    expect(within(row).getByText('Direction Générale')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()
    expect(screen.queryByText('Voyageurs')).not.toBeInTheDocument()
  })

  it('changer de direction met à jour la liste', () => {
    render(<Services />)

    selectComboboxOption('Filtrer par direction', 'Direction Finances')

    const inactiveRow = screen.getByText('Voyageurs').closest('tr')!
    expect(within(inactiveRow).getByText('Inactif')).toBeInTheDocument()
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()
  })

  it('filtre la liste par statut (Tous / Actif / Inactif), une fois une direction choisie', () => {
    render(<Services />)

    // Les deux services de test appartiennent à des directions différentes :
    // on se place sur "Toutes" n'existant plus, on doit choisir direction par
    // direction pour comparer leurs statuts.
    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer les services par statut', 'Actif')
    expect(screen.getByText('Maintenance')).toBeInTheDocument()

    selectComboboxOption('Filtrer les services par statut', 'Inactif')
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec le champ direction et le flag Actif', () => {
    render(<Services />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau service/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouveau service')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Direction' })).toBeInTheDocument()
    expect(within(dialog).getByText('Actif')).toBeInTheDocument()
  })

  it('ouvre le formulaire de modification sans la combo Direction (non réassignable)', () => {
    render(<Services />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier le service' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Modifier le service')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toHaveValue('MAINT')
    expect(within(dialog).queryByText('Direction')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Direction' })).not.toBeInTheDocument()
  })

  it('a un bouton "Modifier le service" avec info-bulle explicite', () => {
    render(<Services />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const button = screen.getAllByRole('button', { name: 'Modifier le service' })[0]
    expect(button.closest('.gp-tip')).toHaveAttribute('data-tip', 'Modifier le service')
  })
})
