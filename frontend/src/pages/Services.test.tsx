import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Services } from './Services'
import type { OrgService } from '../hooks/useServices'
import type { OrgDirection } from '../hooks/useDirections'

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale' },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances' },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1 },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 2 },
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

describe('Services', () => {
  it('affiche la liste des services avec leur direction', () => {
    render(<Services />)

    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Voyageurs')).toBeInTheDocument()
    expect(screen.getByText('Direction Générale')).toBeInTheDocument()
  })

  it('filtre la liste par direction', () => {
    render(<Services />)

    const trigger = screen.getByRole('button', { name: 'Filtrer par direction' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(menu).getByText('Direction Finances'))

    expect(screen.getByText('Voyageurs')).toBeInTheDocument()
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec le champ direction', () => {
    render(<Services />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau service/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouveau service')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Direction' })).toBeInTheDocument()
  })
})
