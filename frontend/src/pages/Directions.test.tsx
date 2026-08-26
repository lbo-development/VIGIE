import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Directions } from './Directions'
import type { OrgDirection } from '../hooks/useDirections'

const DIRECTIONS: OrgDirection[] = [{ id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale' }]

vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false, refetch: vi.fn() }),
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('Directions', () => {
  it('affiche la liste des directions', () => {
    render(<Directions />)

    expect(screen.getByText('DG')).toBeInTheDocument()
    expect(screen.getByText('Direction Générale')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec Code et Libellé', () => {
    render(<Directions />)

    fireEvent.click(screen.getByRole('button', { name: /nouvelle direction/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouvelle direction')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toBeInTheDocument()
  })

  it('ouvre le formulaire de modification pré-rempli', () => {
    render(<Directions />)

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Modifier la direction')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toHaveValue('DG')
  })
})
