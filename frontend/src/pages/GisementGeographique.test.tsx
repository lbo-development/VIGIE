import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { GisementGeographique } from './GisementGeographique'
import type { Site } from '../hooks/useSites'
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
    sous_sites: [
      {
        code_site: 'CAP_JANET',
        code_sous_site: 'GARE_MARITIME',
        lib_sous_site: 'Gare Maritime',
        ordre_sous_site: 1,
        actif: true,
      },
      {
        code_site: 'CAP_JANET',
        code_sous_site: 'QUAI_NORD',
        lib_sous_site: 'Quai Nord',
        ordre_sous_site: 2,
        actif: false,
      },
    ],
  },
  {
    code_site: 'BASSIN_EST',
    lib_site: 'Bassin Est',
    ordre_site: 2,
    id_service: 1,
    actif: false,
    sous_sites: [],
  },
  {
    code_site: 'MOLE_1',
    lib_site: 'Môle 1',
    ordre_site: 3,
    id_service: 2,
    actif: true,
    sous_sites: [],
  },
]

vi.mock('../hooks/useSites', () => ({
  useSites: (idService: number | null) => ({
    sites: idService === null ? [] : SITES.filter((s) => s.id_service === idService),
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
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

/** Ouvre la combobox nommée `ariaLabel` et clique l'option `optionText` dans son menu (évite les collisions avec le même texte affiché ailleurs sur la page). */
function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

/** Sélectionne Direction Générale puis Maintenance (Cap Janet + Bassin Est, pas Môle 1). */
function selectDirectionAndService() {
  selectComboboxOption('Filtrer par direction', 'Direction Générale')
  selectComboboxOption('Filtrer par service', 'Maintenance')
}

describe('GisementGeographique', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
  })

  it('la liste est vide tant que direction et service ne sont pas tous les deux choisis, sans option "Tous"', () => {
    render(<GisementGeographique />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les sites.')).toBeInTheDocument()
    expect(screen.queryByText('Cap Janet')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filtrer par service' })).not.toBeInTheDocument()

    const directionTrigger = screen.getByRole('button', { name: 'Filtrer par direction' })
    fireEvent.click(directionTrigger)
    const directionMenu = directionTrigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    expect(within(directionMenu).queryByText(/toutes les directions/i)).not.toBeInTheDocument()
  })

  it('affiche un tableau unique Service / Libellé / Statut / Actions, une fois direction et service choisis', () => {
    render(<GisementGeographique />)

    selectDirectionAndService()

    const table = screen.getByRole('table')
    const headerRow = within(table).getAllByRole('row')[0]
    expect(headerRow.textContent).toBe('ServiceLibelléStatutActions')

    const row = within(table).getByText('Bassin Est').closest('tr')!
    expect(within(row).getByText('Inactif')).toBeInTheDocument()
    expect(screen.queryByText('Môle 1')).not.toBeInTheDocument()
  })

  it('trie par colonne (cycle asc → desc → neutre) sur Libellé', () => {
    render(<GisementGeographique />)

    selectDirectionAndService()

    const table = screen.getByRole('table')
    const firstDataRowText = () => within(table).getAllByRole('row')[1].textContent

    fireEvent.click(screen.getByRole('button', { name: 'Libellé' }))
    expect(firstDataRowText()).toContain('Bassin Est')

    fireEvent.click(screen.getByRole('button', { name: 'Libellé' }))
    expect(firstDataRowText()).toContain('Cap Janet')

    fireEvent.click(screen.getByRole('button', { name: 'Libellé' }))
    expect(firstDataRowText()).toContain('Cap Janet') // retour à l'ordre neutre (ordre_site)
  })

  it('filtre par statut (Tous / Actifs / Inactifs)', () => {
    render(<GisementGeographique />)

    selectDirectionAndService()

    selectComboboxOption('Filtrer les sites par statut', 'Actifs')
    expect(screen.queryByText('Bassin Est')).not.toBeInTheDocument()
    expect(screen.getByText('Cap Janet')).toBeInTheDocument()

    selectComboboxOption('Filtrer les sites par statut', 'Inactifs')
    expect(screen.getByText('Bassin Est')).toBeInTheDocument()
    expect(screen.queryByText('Cap Janet')).not.toBeInTheDocument()
  })

  it('filtre en cascade : la combo Service ne propose que les services de la direction choisie', () => {
    render(<GisementGeographique />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const serviceTrigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = serviceTrigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(serviceMenu).getByText('Voyageurs')).toBeInTheDocument()
    expect(within(serviceMenu).queryByText(/tous les services/i)).not.toBeInTheDocument()
  })

  it('ouvre le formulaire de création avec Code, Libellé et Service', () => {
    render(<GisementGeographique />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau site/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouveau site')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Code')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toBeInTheDocument()
    expect(within(dialog).getByText('Service')).toBeInTheDocument()
  })

  it('en création, le libellé de la direction (sous le titre) se met à jour selon le service choisi', () => {
    render(<GisementGeographique />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau site/i }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Direction : —')).toBeInTheDocument()

    const trigger = within(dialog).getByRole('button', { name: 'Service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(menu).getByText('Maintenance'))

    expect(within(dialog).getByText('Direction : Direction Générale')).toBeInTheDocument()
  })

  it('ADMIN_SERVICE : la modale de création pré-sélectionne son service et affiche sa direction', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<GisementGeographique />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau site/i }))
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByText('Direction : Direction Générale')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Service' })).toHaveTextContent('Maintenance')
  })

  it('ouvre le formulaire de modification avec Libellé et Actif seulement (pas de Code ni de Service)', () => {
    render(<GisementGeographique />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier le site' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Modifier le site')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Libellé')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Code')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Service')).not.toBeInTheDocument()
  })

  it('la modale de modification rappelle la direction et le service du site en lecture seule', () => {
    render(<GisementGeographique />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier le site' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Direction\s*:\s*Direction Générale/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Service\s*:\s*Maintenance/)).toBeInTheDocument()
  })

  it('ouvre la modale des sous-sites (libellé + statut, réordonnable) avec création/édition', () => {
    render(<GisementGeographique />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les sous-sites' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Sous-sites — Cap Janet')).toBeInTheDocument()
    expect(within(dialog).getByText('Gare Maritime')).toBeInTheDocument()
    expect(within(dialog).getByText('Quai Nord')).toBeInTheDocument()
    expect(within(dialog).getAllByLabelText('Glisser pour réordonner').length).toBe(2)

    fireEvent.click(within(dialog).getByRole('button', { name: /nouveau sous-site/i }))
    expect(within(screen.getByRole('dialog', { name: 'Nouveau sous-site' })).getByLabelText('Code')).toBeInTheDocument()
  })

  it('ouvre la modale de réordonnancement des sites (libellés uniquement, du même service — indépendant du filtre de page)', () => {
    render(<GisementGeographique />)

    selectDirectionAndService()
    // Ligne "Cap Janet" (service Maintenance) : la modale ne doit lister que
    // les sites de ce service, pas "Môle 1" (service Voyageurs) — même si le
    // filtre de page est actif sur Maintenance, la modale s'appuie sur la
    // liste complète, pas sur la liste déjà filtrée par la page.
    fireEvent.click(screen.getAllByRole('button', { name: 'Réordonner les sites' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Réordonner les sites — Maintenance')).toBeInTheDocument()
    expect(within(dialog).getByText('Cap Janet')).toBeInTheDocument()
    expect(within(dialog).getByText('Bassin Est')).toBeInTheDocument()
    expect(within(dialog).queryByText('Môle 1')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Actif')).not.toBeInTheDocument() // que le libellé, pas le statut
  })

  it('ADMIN_SERVICE : direction et service se positionnent automatiquement sur son propre périmètre', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<GisementGeographique />)

    // Pas besoin de choisir quoi que ce soit : la liste est déjà affichée.
    expect(screen.getByText('Cap Janet')).toBeInTheDocument()
    expect(screen.queryByText('Môle 1')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(menu).queryByText('Voyageurs')).not.toBeInTheDocument()
  })

  it('ADMIN_APP voit tous les services de la direction choisie dans la combobox de filtre', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<GisementGeographique />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(menu).getByText('Voyageurs')).toBeInTheDocument()
    expect(within(menu).queryByText(/tous les services/i)).not.toBeInTheDocument()
  })
})
