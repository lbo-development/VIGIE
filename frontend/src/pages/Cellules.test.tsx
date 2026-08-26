import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Cellules } from './Cellules'
import type { OrgCellule } from '../hooks/useCellules'
import type { OrgService } from '../hooks/useServices'

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1 },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1 },
]

const CELLULES: OrgCellule[] = [
  { id_cellule: 1, code_cellule: 'ATEL', libelle_cellule: 'Atelier', id_service: 1 },
  { id_cellule: 2, code_cellule: 'GARE', libelle_cellule: 'Gare', id_service: 2 },
]

vi.mock('../hooks/useCellules', () => ({
  useCellules: () => ({ cellules: CELLULES, loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false, refetch: vi.fn() }),
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('Cellules', () => {
  it('affiche la liste des cellules avec leur service', () => {
    render(<Cellules />)

    expect(screen.getByText('Atelier')).toBeInTheDocument()
    expect(screen.getByText('Gare')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
  })

  it('filtre la liste par service', () => {
    render(<Cellules />)

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(menu).getByText('Voyageurs'))

    expect(screen.getByText('Gare')).toBeInTheDocument()
    expect(screen.queryByText('Atelier')).not.toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec le champ service', () => {
    render(<Cellules />)

    fireEvent.click(screen.getByRole('button', { name: /nouvelle cellule/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouvelle cellule')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Service' })).toBeInTheDocument()
  })
})
