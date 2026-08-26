import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { GisementTechnique } from './GisementTechnique'
import type { Secteur } from '../hooks/useSecteurs'
import type { OrgService } from '../hooks/useServices'
import type { MeRole } from '../hooks/useCurrentUser'

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1 },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1 },
]

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, roles: [] as MeRole[] },
  loading: false,
}))

const SECTEURS: Secteur[] = [
  {
    code_secteur: 'MANUT',
    lib_secteur: 'Manutention',
    ordre_secteur: 1,
    id_service: 1,
    actif: true,
    sous_secteurs: [
      { code_secteur: 'MANUT', code_sous_secteur: 'Grues', ordre_sous_secteur: 1, actif: true },
    ],
  },
]

vi.mock('../hooks/useSecteurs', () => ({
  useSecteurs: () => ({ secteurs: SECTEURS, loading: false, error: null, refetch: vi.fn() }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false }),
}))
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserMock,
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

describe('GisementTechnique', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
  })

  it("affiche les secteurs ; le détail des sous-secteurs n'apparaît qu'après sélection", () => {
    render(<GisementTechnique />)

    expect(screen.getByText('Manutention')).toBeInTheDocument()
    expect(screen.queryByText('Grues')).not.toBeInTheDocument()
    expect(screen.getByText(/sélectionne un secteur/i)).toBeInTheDocument()
  })

  it('affiche les sous-secteurs du secteur sélectionné (icône œil)', () => {
    render(<GisementTechnique />)

    fireEvent.click(screen.getByRole('button', { name: 'Voir les sous-secteurs' }))

    expect(screen.getByText('Grues')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création de secteur avec le champ service', () => {
    render(<GisementTechnique />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau secteur/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouveau secteur')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création de sous-secteur pour le secteur sélectionné', () => {
    render(<GisementTechnique />)

    fireEvent.click(screen.getByRole('button', { name: 'Voir les sous-secteurs' }))
    fireEvent.click(screen.getByRole('button', { name: /nouveau sous-secteur/i }))

    expect(within(screen.getByRole('dialog')).getByText('Nouveau sous-secteur')).toBeInTheDocument()
  })

  it('ADMIN_SERVICE ne voit que son propre service dans la combobox', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<GisementTechnique />)

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(menu).queryByText('Voyageurs')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Tous les services')).not.toBeInTheDocument()
  })

  it('ADMIN_APP voit tous les services dans la combobox', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<GisementTechnique />)

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(menu).getByText('Voyageurs')).toBeInTheDocument()
    expect(within(menu).getByText('Tous les services')).toBeInTheDocument()
  })
})
