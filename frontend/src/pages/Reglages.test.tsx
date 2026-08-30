import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Reglages } from './Reglages'
import type { ParametreKey, ParametreRow } from '../hooks/useParametreAdmin'
import type { MeRole } from '../hooks/useCurrentUser'
import { api } from '../services/api'

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

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

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
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserMock,
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('Reglages', () => {
  beforeEach(() => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
  })

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

  it('un utilisateur sans rôle ADMIN_APP ne voit ni "Nouvelle valeur" ni la colonne "Actions"', () => {
    currentUserMock.data.roles = []
    render(<Reglages />)

    fireEvent.click(screen.getByRole('button', { name: 'Paramètre' }))
    fireEvent.click(screen.getByText("Délai d'inactivité (minutes)"))

    expect(screen.queryByRole('button', { name: /nouvelle valeur/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Actions')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier la valeur' })).not.toBeInTheDocument()
  })

  it('ADMIN_APP : la colonne "Actions" ouvre un formulaire de modification, portée fixe (pas de sélecteur)', () => {
    render(<Reglages />)

    fireEvent.click(screen.getByRole('button', { name: 'Paramètre' }))
    fireEvent.click(screen.getByText("Délai d'inactivité (minutes)"))
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la valeur' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Modifier la valeur/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Portée' })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Portée\s*:\s*Service — Maintenance/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Valeur')).toHaveValue('20')
  })

  it("la saisie de la valeur n'accepte que des chiffres (pas de virgule, point ou lettre) et n'a pas de spin button natif", () => {
    render(<Reglages />)

    fireEvent.click(screen.getByRole('button', { name: 'Paramètre' }))
    fireEvent.click(screen.getByText("Délai d'inactivité (minutes)"))
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la valeur' }))

    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByLabelText('Valeur')
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.change(input, { target: { value: '12,5.3abc' } })
    expect(input).toHaveValue('1253')
  })

  it('formulaire de modification : enregistre la nouvelle valeur en conservant la portée de la ligne', async () => {
    vi.mocked(api.put).mockResolvedValue({ ...ROWS[0], valeur: 45 })
    render(<Reglages />)

    fireEvent.click(screen.getByRole('button', { name: 'Paramètre' }))
    fireEvent.click(screen.getByText("Délai d'inactivité (minutes)"))
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la valeur' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Valeur'), { target: { value: '45' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await Promise.resolve()
    expect(api.put).toHaveBeenCalledWith('/parametres/auth.inactivite_delai_minutes', {
      valeur: 45,
      idDirection: null,
      idService: 1,
    })
  })
})
