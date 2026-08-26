import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Reglages } from './Reglages'
import type { ParametreKey, ParametreRow } from '../hooks/useParametreAdmin'

const KEYS: ParametreKey[] = [
  { cle: 'auth.inactivite_delai_minutes', libelle: "Délai d'inactivité (minutes)", defaut: 30 },
]

const ROWS: ParametreRow[] = [
  {
    id_parametre: 1,
    cle: 'auth.inactivite_delai_minutes',
    valeur: 20,
    id_direction: null,
    id_service: 1,
    description: null,
    date_maj: '2026-08-27T10:00:00Z',
    matricule_maj: '12520',
  },
]

vi.mock('../hooks/useParametreAdmin', () => ({
  useParametreKeys: () => ({ keys: KEYS, loading: false }),
  useParametreRows: () => ({ rows: ROWS, loading: false, error: null, refetch: vi.fn() }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1 }], loading: false }),
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: [{ id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale' }], loading: false }),
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('Reglages', () => {
  it("n'affiche le tableau qu'après sélection d'un paramètre", () => {
    render(<Reglages />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('affiche les lignes existantes une fois le paramètre choisi', () => {
    render(<Reglages />)

    fireEvent.click(screen.getByRole('button', { name: 'Paramètre' }))
    fireEvent.click(screen.getByText("Délai d'inactivité (minutes)"))

    expect(screen.getByText('Service — Maintenance')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('ouvre le formulaire "Nouvelle valeur" avec le sélecteur de portée', () => {
    render(<Reglages />)

    fireEvent.click(screen.getByRole('button', { name: 'Paramètre' }))
    fireEvent.click(screen.getByText("Délai d'inactivité (minutes)"))
    fireEvent.click(screen.getByRole('button', { name: /nouvelle valeur/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Nouvelle valeur/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Valeur')).toBeInTheDocument()
  })
})
