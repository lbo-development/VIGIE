import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Cellules } from './Cellules'
import type { OrgCellule } from '../hooks/useCellules'
import type { OrgService } from '../hooks/useServices'
import type { OrgDirection } from '../hooks/useDirections'

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1, actif: true },
  { id_service: 3, code_service: 'COMPTA', libelle_service: 'Comptabilité', id_direction: 2, actif: true },
]

const CELLULES: OrgCellule[] = [
  { id_cellule: 1, code_cellule: 'ATEL', libelle_cellule: 'Atelier', id_service: 1, actif: true },
  { id_cellule: 2, code_cellule: 'GARE', libelle_cellule: 'Gare', id_service: 2, actif: false },
  { id_cellule: 3, code_cellule: 'FACT', libelle_cellule: 'Facturation', id_service: 3, actif: true },
]

vi.mock('../hooks/useCellules', () => ({
  useCellules: () => ({ cellules: CELLULES, loading: false, refetch: vi.fn() }),
}))
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

describe('Cellules', () => {
  it('la liste est vide tant que direction et service ne sont pas tous les deux choisis, sans option "Tous"', () => {
    render(<Cellules />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les cellules.')).toBeInTheDocument()
    expect(screen.queryByText('Atelier')).not.toBeInTheDocument()

    const directionTrigger = screen.getByRole('button', { name: 'Filtrer par direction' })
    fireEvent.click(directionTrigger)
    const directionMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(directionMenu).queryByText(/toutes les directions/i)).not.toBeInTheDocument()
  })

  it('le filtre Service est masqué tant qu\'aucune direction n\'est choisie', () => {
    render(<Cellules />)

    expect(screen.queryByRole('button', { name: 'Filtrer par service' })).not.toBeInTheDocument()
  })

  it('affiche la liste une fois direction et service choisis, aucune option "Tous les services"', () => {
    render(<Cellules />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const serviceTrigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).queryByText(/tous les services/i)).not.toBeInTheDocument()
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    const row = screen.getByText('Atelier').closest('tr')!
    expect(within(row).getByText('Maintenance')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()
  })

  it('filtre la liste par service, une fois une direction choisie', () => {
    render(<Cellules />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Voyageurs')

    expect(screen.getByText('Gare')).toBeInTheDocument()
    expect(screen.queryByText('Atelier')).not.toBeInTheDocument()
  })

  it('filtre par statut (Tous / Actif / Inactif), une fois direction et service choisis', () => {
    render(<Cellules />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    selectComboboxOption('Filtrer les cellules par statut', 'Actif')
    expect(screen.getByText('Atelier')).toBeInTheDocument()

    selectComboboxOption('Filtrer les cellules par statut', 'Inactif')
    expect(screen.queryByText('Atelier')).not.toBeInTheDocument()
  })

  it('filtre en cascade : choisir une direction restreint la combo Service à ses seuls services', () => {
    render(<Cellules />)

    selectComboboxOption('Filtrer par direction', 'Direction Finances')

    const serviceTrigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).getByText('Comptabilité')).toBeInTheDocument()
    expect(within(serviceMenu).queryByText('Maintenance')).not.toBeInTheDocument()
    fireEvent.click(within(serviceMenu).getByText('Comptabilité'))

    expect(screen.getByText('Facturation')).toBeInTheDocument()
    expect(screen.queryByText('Atelier')).not.toBeInTheDocument()
    expect(screen.queryByText('Gare')).not.toBeInTheDocument()
  })

  it('changer de direction réinitialise le filtre Service et revide la liste', () => {
    render(<Cellules />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Voyageurs')
    expect(screen.getByText('Gare')).toBeInTheDocument()

    selectComboboxOption('Filtrer par direction', 'Direction Finances')

    // Le service "Voyageurs" n'appartient pas à cette direction : le filtre
    // Service retombe à vide, donc la liste aussi (plus de vue "tous les
    // services de la direction").
    expect(screen.getByText('Sélectionne une direction et un service pour afficher les cellules.')).toBeInTheDocument()
    expect(screen.queryByText('Facturation')).not.toBeInTheDocument()
  })

  it('formulaire de création : la combo Service n\'apparaît qu\'après avoir choisi une Direction', () => {
    render(<Cellules />)

    fireEvent.click(screen.getByRole('button', { name: /nouvelle cellule/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouvelle cellule')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Direction' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByText('Actif')).toBeInTheDocument()

    // Direction choisie : la combo Service apparaît, restreinte à cette direction.
    const directionTrigger = within(dialog).getByRole('button', { name: 'Direction' })
    fireEvent.click(directionTrigger)
    const directionMenu = document.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(directionMenu).getByText('Direction Générale'))

    const serviceTrigger = within(dialog).getByRole('button', { name: 'Service' })
    expect(serviceTrigger).toBeInTheDocument()
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(serviceMenu).queryByText('Comptabilité')).not.toBeInTheDocument()
  })

  it('formulaire de modification : la combo Service reste disponible directement, sans Direction', () => {
    render(<Cellules />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier la cellule' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Direction' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Service' })).toBeInTheDocument()
  })

  it('a un bouton "Modifier la cellule" avec info-bulle explicite', () => {
    render(<Cellules />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const button = screen.getAllByRole('button', { name: 'Modifier la cellule' })[0]
    expect(button.closest('.gp-tip')).toHaveAttribute('data-tip', 'Modifier la cellule')
  })
})
