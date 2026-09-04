import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { InvestissementsPGI } from './InvestissementsPGI'
import { api } from '../services/api'
import type { OperationInvestissement } from '../hooks/useInvestissementsPgi'
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
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

const INVESTISSEMENTS: OperationInvestissement[] = [
  {
    numero_operation: 'VN000203',
    libelle: 'Réfection quai 4 (PGI)',
    libelle_service: 'Réfection quai 4',
    id_service: 1,
    code_cug: '268',
    statut: 'A',
    actif: true,
    utilisable: true,
    mt_initial: 15000,
    mt_travaux: 12000,
    mt_fesi: 3000,
    mt_budget_ap1: 15000,
    mt_engage_ap1: 5000,
    mt_liquide_ap1: 2000,
    mt_solde_ap1: 10000,
    mt_budget_ap8: 0,
    mt_engage_ap8: 0,
    mt_liquide_ap8: 0,
    mt_solde_ap8: 0,
    mt_budget_cp1: 0,
    mt_engage_cp1: 0,
    mt_liquide_cp1: 0,
    mt_solde_cp1: 0,
    mt_budget_cp8: 8000,
    mt_engage_cp8: 3000,
    mt_liquide_cp8: 1000,
    mt_solde_cp8: 5000,
  },
  {
    numero_operation: 'SU010096',
    libelle: 'Modernisation portique',
    libelle_service: null,
    id_service: 1,
    code_cug: '142',
    statut: 'F',
    actif: false,
    utilisable: false,
    mt_initial: 6000000,
    mt_travaux: 5400000,
    mt_fesi: 600000,
    mt_budget_ap1: 0,
    mt_engage_ap1: 0,
    mt_liquide_ap1: 0,
    mt_solde_ap1: 0,
    mt_budget_ap8: 0,
    mt_engage_ap8: 0,
    mt_liquide_ap8: 0,
    mt_solde_ap8: 0,
    mt_budget_cp1: 0,
    mt_engage_cp1: 0,
    mt_liquide_cp1: 0,
    mt_solde_cp1: 0,
    mt_budget_cp8: 0,
    mt_engage_cp8: 0,
    mt_liquide_cp8: 0,
    mt_solde_cp8: 0,
  },
]

vi.mock('../hooks/useInvestissementsPgi', () => ({
  useInvestissementsPgi: (idService: number | null) => ({
    investissements: idService === null ? [] : INVESTISSEMENTS.filter((i) => i.id_service === idService),
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
const lastImportInfoMock = vi.hoisted(() => ({ value: null as { exists: boolean; valeur: string | null } | null }))
vi.mock('../hooks/useInvestissementLastImport', () => ({
  useInvestissementLastImport: () => lastImportInfoMock.value,
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
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), postForm: vi.fn(), getBlob: vi.fn() } }
})

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('InvestissementsPGI', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    lastImportInfoMock.value = null
    vi.mocked(api.put).mockReset()
    vi.mocked(api.get).mockReset().mockResolvedValue([])
    vi.mocked(api.postForm).mockReset()
  })

  it('invite à choisir une direction et un service tant que les deux ne sont pas sélectionnés', () => {
    render(<InvestissementsPGI />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les investissements.')).toBeInTheDocument()
  })

  it('affiche une carte par opération du service une fois direction et service choisis', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText('VN000203')).toBeInTheDocument()
    expect(screen.getByText('Réfection quai 4')).toBeInTheDocument()
    expect(screen.getByText('SU010096')).toBeInTheDocument()
    expect(screen.getByText('Modernisation portique')).toBeInTheDocument()
  })

  it("affiche LIBELLE (PGI) en repli tant que LIBELLE_SERVICE n'est pas renseigné", () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    // SU010096 : libelle_service null -> repli sur libelle PGI.
    expect(screen.getByText('Modernisation portique')).toBeInTheDocument()
    // VN000203 : libelle_service renseigné -> jamais le libellé PGI brut affiché.
    expect(screen.queryByText('Réfection quai 4 (PGI)')).not.toBeInTheDocument()
  })

  it('un service sans investissement affiche le message dédié', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Voyageurs')

    expect(screen.getByText('Aucun investissement pour ce filtre.')).toBeInTheDocument()
  })

  it("la recherche filtre par numéro d'opération ou libellé (touche Entrée)", () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const search = screen.getByLabelText('Rechercher un investissement')
    fireEvent.change(search, { target: { value: 'portique' } })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(screen.queryByText('VN000203')).not.toBeInTheDocument()
    expect(screen.getByText('SU010096')).toBeInTheDocument()
  })

  it('distingue les opérations actives des inactives (point de statut)', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const activeCard = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
    const inactiveCard = screen.getByText('SU010096').closest('.investissement-card') as HTMLElement
    expect(within(activeCard).getByTitle('Actif')).toBeInTheDocument()
    expect(within(inactiveCard).getByTitle('Inactif')).toBeInTheDocument()
  })

  it('affiche un second point Utilisable, à côté du point Actif', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const utilisableCard = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
    const nonUtilisableCard = screen.getByText('SU010096').closest('.investissement-card') as HTMLElement
    expect(within(utilisableCard).getByTitle('Utilisable')).toBeInTheDocument()
    expect(within(nonUtilisableCard).getByTitle('Non utilisable')).toBeInTheDocument()
  })

  it('affiche le statut PGI, les montants Travaux/FESI et les 4 montants disponibles (AP.1/AP.8/CP.1/CP.8)', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
    expect(within(card).getByText('A')).toBeInTheDocument()
    expect(within(card).getByText('12 000 €')).toBeInTheDocument()
    expect(within(card).getByText('3 000 €')).toBeInTheDocument()
    expect(within(card).getByText('10 000 €')).toBeInTheDocument()
    expect(within(card).getByText('5 000 €')).toBeInTheDocument()
  })

  it('bouton "Filtrer" : la modale filtre sur Actif (Oui/Non/Tous)', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les investissements' })
    fireEvent.click(within(modal).getByRole('radio', { name: 'Actif : Non' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))

    expect(screen.queryByText('VN000203')).not.toBeInTheDocument()
    expect(screen.getByText('SU010096')).toBeInTheDocument()
  })

  it('bouton "Filtrer" : la modale filtre sur Statut (Activée/Future/Toutes, sur A/F)', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les investissements' })
    fireEvent.click(within(modal).getByRole('radio', { name: 'Statut : Future' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))

    expect(screen.queryByText('VN000203')).not.toBeInTheDocument()
    expect(screen.getByText('SU010096')).toBeInTheDocument()
  })

  it('bouton "Filtrer" : la modale filtre sur Utilisable (Oui/Non/Tous)', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les investissements' })
    fireEvent.click(within(modal).getByRole('radio', { name: 'Utilisable : Non' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))

    expect(screen.queryByText('VN000203')).not.toBeInTheDocument()
    expect(screen.getByText('SU010096')).toBeInTheDocument()
  })

  it('bouton "Supprimer les filtres" : réinitialise Actif et la recherche', () => {
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les investissements' })
    fireEvent.click(within(modal).getByRole('radio', { name: 'Actif : Non' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))
    expect(screen.queryByText('VN000203')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer les filtres' }))

    expect(screen.getByText('VN000203')).toBeInTheDocument()
    expect(screen.getByText('SU010096')).toBeInTheDocument()
  })

  it("ADMIN_SERVICE : direction et service pré-remplis sur son propre service", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<InvestissementsPGI />)

    expect(screen.getByRole('button', { name: 'Filtrer par direction' })).toHaveTextContent('Direction Générale')
    expect(screen.getByRole('button', { name: 'Filtrer par service' })).toHaveTextContent('Maintenance')
    expect(screen.getByText('VN000203')).toBeInTheDocument()
  })

  it("affiche la date de la dernière importation dans l'entête (paramètre existant, valeur renseignée, récente)", () => {
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    const [y, m, d] = recentDate.split('-')
    lastImportInfoMock.value = { exists: true, valeur: recentDate }
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText(`État des investissements au ${d}/${m}/${y}`)).toBeInTheDocument()
    expect(screen.queryByText('Pensez à importer les investissements récents')).not.toBeInTheDocument()
  })

  it("affiche l'alerte de rappel si la dernière importation date de plus de 15 jours", () => {
    const staleDate = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)
    lastImportInfoMock.value = { exists: true, valeur: staleDate }
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText('Pensez à importer les investissements récents')).toBeInTheDocument()
  })

  it("affiche un message dédié si le paramètre n'existe pas encore pour ce service", () => {
    lastImportInfoMock.value = { exists: false, valeur: null }
    render(<InvestissementsPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText('Paramètre "last.import.investissement.pgi" non initialisé.')).toBeInTheDocument()
  })

  describe('actions des cartes', () => {
    it('icône Visualiser toujours présente, icône Modifier masquée sans ADMIN_APP/ADMIN_SERVICE/CB', () => {
      render(<InvestissementsPGI />)

      selectComboboxOption('Filtrer par direction', 'Direction Générale')
      selectComboboxOption('Filtrer par service', 'Maintenance')

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      expect(within(card).getByRole('button', { name: 'Visualiser' })).toBeInTheDocument()
      expect(within(card).queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    })

    it('icône Visualiser les pièces présente et active, Ajouter une pièce masquée sans droits', () => {
      render(<InvestissementsPGI />)

      selectComboboxOption('Filtrer par direction', 'Direction Générale')
      selectComboboxOption('Filtrer par service', 'Maintenance')

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      expect(within(card).getByRole('button', { name: 'Visualiser les pièces' })).not.toBeDisabled()
      expect(within(card).queryByRole('button', { name: 'Ajouter une pièce' })).not.toBeInTheDocument()
    })

    it('icône Ajouter une pièce présente et active pour ADMIN_SERVICE', () => {
      currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
      render(<InvestissementsPGI />)

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      expect(within(card).getByRole('button', { name: 'Ajouter une pièce' })).not.toBeDisabled()
    })

    it('Visualiser les pièces ouvre la modale des pièces, interroge /investissements/pieces', async () => {
      render(<InvestissementsPGI />)

      selectComboboxOption('Filtrer par direction', 'Direction Générale')
      selectComboboxOption('Filtrer par service', 'Maintenance')

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      fireEvent.click(within(card).getByRole('button', { name: 'Visualiser les pièces' }))

      const modal = await screen.findByRole('dialog', { name: 'Pièces — VN000203' })
      expect(within(modal).getByText('Aucune pièce déposée pour cette opération.')).toBeInTheDocument()
      expect(api.get).toHaveBeenCalledWith('/investissements/pieces?numeroOperation=VN000203')
    })

    it('Ajouter une pièce ouvre la modale de dépôt et envoie le fichier via postForm (ADMIN_SERVICE)', async () => {
      currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
      vi.mocked(api.postForm).mockResolvedValue({ id_investissement_piece: 1 })
      render(<InvestissementsPGI />)

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      fireEvent.click(within(card).getByRole('button', { name: 'Ajouter une pièce' }))

      const modal = screen.getByRole('dialog', { name: 'Ajouter une pièce — VN000203' })
      const file = new File([new Uint8Array(10)], 'rapport.pdf', { type: 'application/pdf' })
      const input = modal.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })
      fireEvent.click(within(modal).getByRole('button', { name: 'Ajouter' }))

      await waitFor(() => expect(api.postForm).toHaveBeenCalledTimes(1))
      const [path, formData] = vi.mocked(api.postForm).mock.calls[0] as [string, FormData]
      expect(path).toBe('/investissements/pieces')
      expect(formData.get('numeroOperation')).toBe('VN000203')
    })

    it('icône Modifier visible pour ADMIN_SERVICE', () => {
      currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
      render(<InvestissementsPGI />)

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      expect(within(card).getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
    })

    it('Visualiser ouvre le détail en lecture seule (statut, montants, 4 tranches complètes)', () => {
      render(<InvestissementsPGI />)

      selectComboboxOption('Filtrer par direction', 'Direction Générale')
      selectComboboxOption('Filtrer par service', 'Maintenance')

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      fireEvent.click(within(card).getByRole('button', { name: 'Visualiser' }))

      const modal = screen.getByRole('dialog', { name: 'Opération VN000203' })
      expect(within(modal).getByLabelText('Libellé (PGI)')).toHaveValue('Réfection quai 4 (PGI)')
      expect(within(modal).getByLabelText('Libellé (service)')).toHaveValue('Réfection quai 4')
      expect(within(modal).getByLabelText('Utilisable')).toHaveValue('Oui')
      expect(within(modal).getByText('AP.1')).toBeInTheDocument()
      expect(within(modal).getByText('CP.8')).toBeInTheDocument()

      fireEvent.click(within(modal).getByRole('button', { name: 'Retour' }))
      expect(screen.queryByRole('dialog', { name: 'Opération VN000203' })).not.toBeInTheDocument()
    })

    it('Modifier permet de changer Libellé (service) et enregistre via PUT /investissements/:numeroOperation', async () => {
      currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
      vi.mocked(api.put).mockResolvedValue({})
      render(<InvestissementsPGI />)

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      fireEvent.click(within(card).getByRole('button', { name: 'Modifier' }))

      const modal = screen.getByRole('dialog', { name: "Modifier l'opération" })
      const input = within(modal).getByLabelText('Libellé (service)')
      fireEvent.change(input, { target: { value: 'Nouveau libellé service' } })
      fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }))

      await waitFor(() =>
        expect(api.put).toHaveBeenCalledWith('/investissements/VN000203', {
          libelleService: 'Nouveau libellé service',
          actif: true,
          utilisable: true,
        }),
      )
      await waitFor(() => expect(screen.queryByRole('dialog', { name: "Modifier l'opération" })).not.toBeInTheDocument())
    })

    it('Modifier permet de basculer Actif et Utilisable', async () => {
      currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
      vi.mocked(api.put).mockResolvedValue({})
      render(<InvestissementsPGI />)

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      fireEvent.click(within(card).getByRole('button', { name: 'Modifier' }))

      const modal = screen.getByRole('dialog', { name: "Modifier l'opération" })
      const [actifCheckbox, utilisableCheckbox] = within(modal).getAllByRole('checkbox')
      fireEvent.click(actifCheckbox)
      fireEvent.click(utilisableCheckbox)
      fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }))

      await waitFor(() =>
        expect(api.put).toHaveBeenCalledWith('/investissements/VN000203', {
          libelleService: 'Réfection quai 4',
          actif: false,
          utilisable: false,
        }),
      )
    })

    it('Modifier : refuse un libellé vide, sans appeler PUT', () => {
      currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
      render(<InvestissementsPGI />)

      const card = screen.getByText('VN000203').closest('.investissement-card') as HTMLElement
      fireEvent.click(within(card).getByRole('button', { name: 'Modifier' }))

      const modal = screen.getByRole('dialog', { name: "Modifier l'opération" })
      fireEvent.change(within(modal).getByLabelText('Libellé (service)'), { target: { value: '   ' } })
      fireEvent.click(within(modal).getByRole('button', { name: 'Enregistrer' }))

      expect(screen.getByText('Le libellé est obligatoire.')).toBeInTheDocument()
      expect(api.put).not.toHaveBeenCalled()
    })
  })
})
