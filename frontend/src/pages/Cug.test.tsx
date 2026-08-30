import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { Cug } from './Cug'
import type { Cug as CugRecord } from '../hooks/useCug'
import type { OrgService } from '../hooks/useServices'
import type { OrgDirection } from '../hooks/useDirections'
import type { MeRole } from '../hooks/useCurrentUser'
import { api } from '../services/api'

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1, actif: true },
  { id_service: 3, code_service: 'COMPTA', libelle_service: 'Comptabilité', id_direction: 2, actif: true },
]

const CUG: CugRecord[] = [
  { code_cug: 'CUG1', libelle_cug: 'Fournitures bureau', id_service: 1, actif: true },
  { code_cug: 'CUG2', libelle_cug: 'Prestations voyageurs', id_service: 2, actif: false },
  { code_cug: 'CUG3', libelle_cug: 'Frais comptables', id_service: 3, actif: true },
]

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

vi.mock('../hooks/useCug', () => ({
  useCug: () => ({ cug: CUG, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false }),
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false }),
}))
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserMock,
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('Cug', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  it('la liste est vide tant que direction et service ne sont pas tous les deux choisis, sans option "Tous"', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Cug />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les CUG.')).toBeInTheDocument()
    expect(screen.queryByText('Fournitures bureau')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filtrer par service' })).not.toBeInTheDocument()
  })

  it('affiche la liste une fois direction et service choisis (ADMIN_APP)', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Cug />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const row = screen.getByText('Fournitures bureau').closest('tr')!
    expect(within(row).getByText('CUG1')).toBeInTheDocument()
    expect(within(row).getByText('Maintenance')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()
  })

  it('filtre par statut (Actif / Inactif), une fois direction et service choisis', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Cug />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Voyageurs')

    selectComboboxOption('Filtrer les CUG par statut', 'Inactif')
    expect(screen.getByText('Prestations voyageurs')).toBeInTheDocument()

    selectComboboxOption('Filtrer les CUG par statut', 'Actif')
    expect(screen.queryByText('Prestations voyageurs')).not.toBeInTheDocument()
  })

  it('ADMIN_SERVICE : direction et service se positionnent automatiquement sur son propre périmètre', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<Cug />)

    expect(screen.getByText('Fournitures bureau')).toBeInTheDocument()
  })

  it('ADMIN_SERVICE : la combobox de filtre Service ne propose pas les autres services', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<Cug />)

    expect(screen.queryByText('Prestations voyageurs')).not.toBeInTheDocument()
    expect(screen.queryByText('Frais comptables')).not.toBeInTheDocument()
  })

  it('formulaire de création : la combo Service n\'apparaît qu\'après avoir choisi une Direction (ADMIN_APP)', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Cug />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau cug/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouveau CUG')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Direction' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toBeInTheDocument()

    const directionTrigger = within(dialog).getByRole('button', { name: 'Direction' })
    fireEvent.click(directionTrigger)
    const directionMenu = directionTrigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(directionMenu).getByText('Direction Générale'))

    const serviceTrigger = within(dialog).getByRole('button', { name: 'Service' })
    expect(serviceTrigger).toBeInTheDocument()
    fireEvent.click(serviceTrigger)
    const serviceMenu = serviceTrigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(serviceMenu).queryByText('Comptabilité')).not.toBeInTheDocument()
  })

  it('ADMIN_SERVICE : le formulaire de création masque Direction/Service et hérite de son propre service', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<Cug />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau cug/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Direction' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Direction\s*:\s*Direction Générale/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Service\s*:\s*Maintenance/)).toBeInTheDocument()
  })

  it('formulaire de modification : le code n\'est pas modifiable (clé naturelle, contrairement à Cellule)', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Cug />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le CUG' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Modifier le CUG')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Code')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toHaveValue('Fournitures bureau')
    expect(within(dialog).getByText(/Service\s*:\s*Maintenance/)).toBeInTheDocument()
  })

  it('formulaire de modification : enregistre le libellé et le statut via PUT /cug/:codeCug', async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    vi.mocked(api.put).mockResolvedValue({ ...CUG[0], libelle_cug: 'Fournitures et consommables' })
    render(<Cug />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le CUG' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Libellé'), { target: { value: 'Fournitures et consommables' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.put).toHaveBeenCalledWith('/cug/CUG1', { libelleCug: 'Fournitures et consommables', actif: true })
  })

  it('a un bouton "Modifier le CUG" avec info-bulle explicite', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Cug />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const button = screen.getByRole('button', { name: 'Modifier le CUG' })
    expect(button.closest('.gp-tip')).toHaveAttribute('data-tip', 'Modifier le CUG')
  })
})
