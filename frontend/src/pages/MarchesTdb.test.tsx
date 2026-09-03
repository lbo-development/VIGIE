import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MarchesTdb } from './MarchesTdb'
import { api } from '../services/api'
import type { MeRole } from '../hooks/useCurrentUser'
import type { OrgDirection } from '../hooks/useDirections'
import type { OrgService } from '../hooks/useServices'
import type { Marche } from '../hooks/useMarches'
import type { MarcheTiers } from '../hooks/useMarcheTiers'

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
]

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

const marchesMock = vi.hoisted(() => ({ marches: [] as Marche[], loading: false, refetch: vi.fn() }))
const marcheTiersMock = vi.hoisted(() => ({ marcheTiers: [] as MarcheTiers[], loading: false, refetch: vi.fn() }))

function makeMarche(overrides: Partial<Marche>): Marche {
  return {
    nummarche: 'M0909311',
    actif: true,
    completude: true,
    utilisable: true,
    typeproc: 'MARCHE',
    typedecompoprix: null,
    naturepresta: null,
    libpgi: 'Nettoyage',
    libelle_service: 'Nettoyage des installations',
    titulaire: 'NAID',
    fournisseur_raison_sociale: 'NAID',
    agentgestion: null,
    planpreventionactif: null,
    code_cug: null,
    dtevalid: null,
    dtenotif: null,
    dtedebut: '2026-01-01',
    dtefinmax: '2026-12-31',
    mtmaxi: 100000,
    mt_solde: 50000,
    alertemt: 0.8,
    alertedate: 30,
    ...overrides,
  }
}

function makeMarcheTiers(overrides: Partial<MarcheTiers>): MarcheTiers {
  return {
    id_marche_tiers: 1,
    id_service: 1,
    nummarche: 'P2605112',
    libelle_service: 'Nettoyage des locaux tiers',
    id_fournisseur: 5,
    mtmaxi: 10000,
    dtedebut: '2026-01-01',
    dtefinmax: '2099-12-31',
    typeproc: 'MAPA',
    typedecompoprix: 'FORFAIT',
    agentgestion: 'DUPONT Jean',
    alertedate: 120,
    actif: true,
    commentaire: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserMock,
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false }),
}))
vi.mock('../hooks/useMarches', () => ({
  useMarches: () => marchesMock,
}))
vi.mock('../hooks/useMarcheTiers', () => ({
  useMarcheTiers: () => marcheTiersMock,
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn().mockResolvedValue({ exists: true, valeur: null }), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('MarchesTdb', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    marchesMock.marches = []
    marchesMock.loading = false
    marcheTiersMock.marcheTiers = []
    marcheTiersMock.loading = false
    vi.mocked(api.get).mockReset().mockResolvedValue({ exists: true, valeur: null })
  })

  it("aucun service sélectionné : message d'invite, pas d'indicateurs", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<MarchesTdb />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher le tableau de bord.')).toBeInTheDocument()
    expect(screen.queryByText('Marchés')).not.toBeInTheDocument()
  })

  it('ADMIN_APP : filtre Direction/Service en cascade, affiche les deux sections une fois les deux choisis', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<MarchesTdb />)

    expect(screen.queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    selectComboboxOption('Direction', 'Direction Générale')
    selectComboboxOption('Service', 'Maintenance')

    expect(screen.getByText('États des marchés du service')).toBeInTheDocument()
    expect(screen.getByText("Marchés d'un service tiers")).toBeInTheDocument()
  })

  it('acteur sans rôle : voit le tableau de bord de son propre service (lecture ouverte)', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<MarchesTdb />)

    expect(screen.getByText('États des marchés du service')).toBeInTheDocument()
  })

  it('États des marchés — compte marchés/actifs/complets/utilisables/MAPA/MARCHE', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M1', actif: true, completude: true, utilisable: true, typeproc: 'MAPA' }),
      makeMarche({ nummarche: 'M2', actif: false, completude: true, utilisable: false, typeproc: 'MARCHE' }),
      makeMarche({ nummarche: 'M3', actif: true, completude: false, utilisable: false, typeproc: 'MARCHE' }),
    ]
    render(<MarchesTdb />)

    const section = screen.getByText('États des marchés du service').closest('.gp-panel') as HTMLElement
    expect(within(section).getByText('Marchés').nextSibling).toHaveTextContent('3')
    expect(within(section).getByText('Actifs').nextSibling).toHaveTextContent('2')
    expect(within(section).getByText('Complets').nextSibling).toHaveTextContent('2')
    expect(within(section).getByText('Utilisables').nextSibling).toHaveTextContent('1')
    expect(within(section).getByText('MAPA').nextSibling).toHaveTextContent('1')
    expect(within(section).getByText('Marché').nextSibling).toHaveTextContent('2')
  })

  it('États des marchés — compte les alertes sur date et sur montant séparément, et leur union', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const dansCinqJours = new Date()
    dansCinqJours.setDate(dansCinqJours.getDate() + 5)
    const dateProche = dansCinqJours.toISOString().slice(0, 10)
    marchesMock.marches = [
      // En alerte sur date uniquement (échéance proche, solde confortable).
      makeMarche({ nummarche: 'M1', dtefinmax: dateProche, alertedate: 30, mtmaxi: 100000, mt_solde: 90000, alertemt: 0.8 }),
      // En alerte sur montant uniquement (échéance lointaine, solde bas).
      makeMarche({ nummarche: 'M2', dtefinmax: '2099-12-31', alertedate: 30, mtmaxi: 100000, mt_solde: 5000, alertemt: 0.8 }),
      // En alerte sur les deux à la fois — ne doit compter qu'une fois dans "En alerte".
      makeMarche({ nummarche: 'M3', dtefinmax: dateProche, alertedate: 30, mtmaxi: 100000, mt_solde: 5000, alertemt: 0.8 }),
      // Aucune alerte.
      makeMarche({ nummarche: 'M4', dtefinmax: '2099-12-31', alertedate: 30, mtmaxi: 100000, mt_solde: 90000, alertemt: 0.8 }),
    ]
    render(<MarchesTdb />)

    const section = screen.getByText('États des marchés du service').closest('.gp-panel') as HTMLElement
    expect(within(section).getByText('Alerte sur date').nextSibling).toHaveTextContent('2')
    expect(within(section).getByText('Alerte sur montant').nextSibling).toHaveTextContent('2')
    expect(within(section).getByText('En alerte').nextSibling).toHaveTextContent('3')
  })

  it('Marchés tiers — compte marchés tiers/actifs/alerte sur date', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const hier = new Date()
    hier.setDate(hier.getDate() - 1)
    marcheTiersMock.marcheTiers = [
      makeMarcheTiers({ id_marche_tiers: 1, actif: true, dtefinmax: '2099-12-31' }),
      makeMarcheTiers({ id_marche_tiers: 2, actif: false, dtefinmax: '2099-12-31' }),
      makeMarcheTiers({ id_marche_tiers: 3, actif: true, dtefinmax: hier.toISOString().slice(0, 10), alertedate: 400 }),
    ]
    render(<MarchesTdb />)

    const section = screen.getByText("Marchés d'un service tiers").closest('.gp-panel') as HTMLElement
    expect(within(section).getByText('Marchés tiers').nextSibling).toHaveTextContent('3')
    expect(within(section).getByText('Actifs').nextSibling).toHaveTextContent('2')
    expect(within(section).getByText('Alerte sur date').nextSibling).toHaveTextContent('1')
  })

  it('présentation en deux colonnes : les deux sections vivent dans le même conteneur .demo-grid', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<MarchesTdb />)

    const gauche = screen.getByText('États des marchés du service').closest('.gp-panel') as HTMLElement
    const droite = screen.getByText("Marchés d'un service tiers").closest('.gp-panel') as HTMLElement
    expect(gauche.parentElement).toBe(droite.parentElement)
    expect(gauche.parentElement).toHaveClass('demo-grid')
  })

  it("libellé « État des marchés au [date] » sous le titre de gauche : lit /marches/last-import pour le service filtré", async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    vi.mocked(api.get).mockResolvedValue({ exists: true, valeur: '2026-08-20' })
    render(<MarchesTdb />)

    await waitFor(() => expect(screen.getByText('État des marchés au 20/08/2026')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/marches/last-import?idService=1')
  })

  it("paramètre last.import.marche.pgi jamais initialisé pour ce service : alarme dédiée", async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    vi.mocked(api.get).mockResolvedValue({ exists: false, valeur: null })
    render(<MarchesTdb />)

    await waitFor(() => expect(screen.getByText('Paramètre "last.import.marche.pgi" non initialisé.')).toBeInTheDocument())
  })

  it('dernier import il y a plus de 15 jours : message pour importer un fichier plus récent', async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const staleDate = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)
    vi.mocked(api.get).mockResolvedValue({ exists: true, valeur: staleDate })
    render(<MarchesTdb />)

    await waitFor(() => expect(screen.getByText('Pensez à importer les marchés récents')).toBeInTheDocument())
  })

  it("dernier import il y a moins de 15 jours : pas d'alarme", async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    vi.mocked(api.get).mockResolvedValue({ exists: true, valeur: recentDate })
    render(<MarchesTdb />)

    await waitFor(() => expect(screen.getByText(/État des marchés au/)).toBeInTheDocument())
    expect(screen.queryByText('Pensez à importer les marchés récents')).not.toBeInTheDocument()
  })
})
