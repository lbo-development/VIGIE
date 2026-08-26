import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { GisementGeographique } from './GisementGeographique'
import type { Site } from '../hooks/useSites'
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

const SITES: Site[] = [
  {
    code_site: 'CAP_JANET',
    lib_site: 'Cap Janet',
    ordre_site: 1,
    id_service: 1,
    actif: true,
    sous_sites: [{ code_site: 'CAP_JANET', code_sous_site: 'Gare Maritime', ordre_sous_site: 1, actif: true }],
  },
]

vi.mock('../hooks/useSites', () => ({
  useSites: () => ({ sites: SITES, loading: false, error: null, refetch: vi.fn() }),
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

describe('GisementGeographique', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
  })

  it("affiche les sites ; le détail des sous-sites n'apparaît qu'après sélection", () => {
    render(<GisementGeographique />)

    expect(screen.getByText('Cap Janet')).toBeInTheDocument()
    expect(screen.queryByText('Gare Maritime')).not.toBeInTheDocument()
    expect(screen.getByText(/sélectionne un site/i)).toBeInTheDocument()
  })

  it('affiche les sous-sites du site sélectionné (icône œil)', () => {
    render(<GisementGeographique />)

    fireEvent.click(screen.getByRole('button', { name: 'Voir les sous-sites' }))

    expect(screen.getByText('Gare Maritime')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création de site avec le champ service', () => {
    render(<GisementGeographique />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau site/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouveau site')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toBeInTheDocument()
  })

  it('ouvre le formulaire de création de sous-site pour le site sélectionné', () => {
    render(<GisementGeographique />)

    fireEvent.click(screen.getByRole('button', { name: 'Voir les sous-sites' }))
    fireEvent.click(screen.getByRole('button', { name: /nouveau sous-site/i }))

    expect(within(screen.getByRole('dialog')).getByText('Nouveau sous-site')).toBeInTheDocument()
  })

  it('ADMIN_SERVICE ne voit que son propre service dans la combobox', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<GisementGeographique />)

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(menu).queryByText('Voyageurs')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Tous les services')).not.toBeInTheDocument()
  })

  it('ADMIN_APP voit tous les services dans la combobox', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<GisementGeographique />)

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(menu).getByText('Voyageurs')).toBeInTheDocument()
    expect(within(menu).getByText('Tous les services')).toBeInTheDocument()
  })
})
