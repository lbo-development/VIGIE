import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SeuilsValidationDs } from './SeuilsValidationDs'
import type { SeuilValidationDs } from '../hooks/useSeuilsValidationDs'
import type { OrgService } from '../hooks/useServices'
import type { OrgDirection } from '../hooks/useDirections'
import type { MeRole } from '../hooks/useCurrentUser'

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1, actif: true },
  { id_service: 3, code_service: 'COMPTA', libelle_service: 'Comptabilité', id_direction: 2, actif: true },
]

// Voyageurs n'a volontairement aucune ligne : doit s'afficher à 0/0.
const SEUILS: SeuilValidationDs[] = [
  { id_service: 1, seuil_fonctionnement: 5000, seuil_investissement: 20000 },
  { id_service: 3, seuil_fonctionnement: 8000, seuil_investissement: 0 },
]

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, roles: [] as MeRole[] },
  loading: false,
}))

vi.mock('../hooks/useSeuilsValidationDs', () => ({
  useSeuilsValidationDs: () => ({ seuils: SEUILS, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserMock,
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

/** Ouvre la combobox nommée `ariaLabel` et clique l'option `optionText` dans son menu. */
function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('SeuilsValidationDs', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
  })

  it('la liste est vide tant qu\'aucune direction n\'est choisie, et aucune option "Toutes les directions" n\'existe', () => {
    render(<SeuilsValidationDs />)

    expect(screen.getByText('Sélectionne une direction pour afficher les seuils.')).toBeInTheDocument()
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Filtrer par direction' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    expect(within(menu).queryByText(/toutes les directions/i)).not.toBeInTheDocument()
  })

  it('affiche les services de la direction choisie, avec leurs seuils', () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Voyageurs')).toBeInTheDocument()
    expect(screen.queryByText('Comptabilité')).not.toBeInTheDocument()
  })

  it('un service sans ligne en base affiche des seuils à 0 (pas une ligne manquante)', () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const row = screen.getByText('Voyageurs').closest('tr')!
    expect(within(row).getAllByText('0,00 €')).toHaveLength(2)
  })

  it('affiche les montants existants formatés', () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const row = screen.getByText('Maintenance').closest('tr')!
    expect(within(row).getByText('5 000,00 €')).toBeInTheDocument()
    expect(within(row).getByText('20 000,00 €')).toBeInTheDocument()
  })

  it('changer de direction met à jour la liste', () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Finances')

    expect(screen.getByText('Comptabilité')).toBeInTheDocument()
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()
    expect(screen.queryByText('Voyageurs')).not.toBeInTheDocument()
  })

  it('ouvre le formulaire pré-rempli pour un service ayant déjà des seuils', () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier les seuils' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Seuil de validation')).toBeInTheDocument()
    expect(within(dialog).getByText(/Direction\s*:\s*Direction Générale/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Service\s*:\s*Maintenance/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Seuil fonctionnement (€)')).toHaveValue('5000')
    expect(within(dialog).getByLabelText('Seuil investissement (€)')).toHaveValue('20000')
  })

  it('ouvre le formulaire pré-rempli à 0/0 pour un service sans seuil existant', () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const row = screen.getByText('Voyageurs').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Modifier les seuils' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Seuil de validation')).toBeInTheDocument()
    expect(within(dialog).getByText(/Direction\s*:\s*Direction Générale/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Service\s*:\s*Voyageurs/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Seuil fonctionnement (€)')).toHaveValue('0')
    expect(within(dialog).getByLabelText('Seuil investissement (€)')).toHaveValue('0')
  })

  it("la saisie des seuils n'accepte que des chiffres (pas de virgule, point ou lettre) et n'a pas de spin button natif", () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier les seuils' })[0])

    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText('Seuil fonctionnement (€)')
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.change(input, { target: { value: '12,5.3abc' } })
    expect(input).toHaveValue('1253')
  })

  it('a un bouton "Modifier les seuils" avec info-bulle explicite', () => {
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const button = screen.getAllByRole('button', { name: 'Modifier les seuils' })[0]
    expect(button.closest('.gp-tip')).toHaveAttribute('data-tip', 'Modifier les seuils')
  })

  it('ADMIN_SERVICE : la direction se positionne automatiquement sur son propre périmètre, et seul son service est listé', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<SeuilsValidationDs />)

    // Pas besoin de choisir la direction : la liste est déjà affichée.
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.queryByText('Voyageurs')).not.toBeInTheDocument()
    expect(screen.queryByText('Comptabilité')).not.toBeInTheDocument()
  })

  it('ADMIN_APP voit tous les services de la direction choisie', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<SeuilsValidationDs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Voyageurs')).toBeInTheDocument()
  })
})
