import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Directions } from './Directions'
import type { OrgDirection } from '../hooks/useDirections'

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DSI', libelle_direction: 'Systèmes d\'Information', actif: false },
]

vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false, refetch: vi.fn() }),
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('Directions', () => {
  it('affiche la liste des directions avec leur statut', () => {
    render(<Directions />)

    const row = screen.getByText('DG').closest('tr')!
    expect(within(row).getByText('Direction Générale')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()

    const inactiveRow = screen.getByText('DSI').closest('tr')!
    expect(within(inactiveRow).getByText('Inactif')).toBeInTheDocument()
  })

  it('filtre par statut (Tous / Actif / Inactif)', () => {
    render(<Directions />)

    const selectStatus = (label: string) => {
      const trigger = screen.getByRole('button', { name: 'Filtrer les directions par statut' })
      fireEvent.click(trigger)
      const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
      fireEvent.click(within(menu).getByText(label))
    }

    selectStatus('Actif')
    expect(screen.getByText('DG')).toBeInTheDocument()
    expect(screen.queryByText('DSI')).not.toBeInTheDocument()

    selectStatus('Inactif')
    expect(screen.queryByText('DG')).not.toBeInTheDocument()
    expect(screen.getByText('DSI')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec Code, Libellé et Actif', () => {
    render(<Directions />)

    fireEvent.click(screen.getByRole('button', { name: /nouvelle direction/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouvelle direction')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toBeInTheDocument()
    expect(within(dialog).getByText('Actif')).toBeInTheDocument()
  })

  it('ouvre le formulaire de modification pré-rempli', () => {
    render(<Directions />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier la direction' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Modifier la direction')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toHaveValue('DG')
  })
})
