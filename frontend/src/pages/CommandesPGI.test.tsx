import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CommandesPGI } from './CommandesPGI'
import type { CommandePgi } from '../hooks/useCommandesPgi'
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
  { id_service: 3, code_service: 'TEST', libelle_service: 'Service Test', id_direction: 2, actif: true },
]

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

const COMMANDES: CommandePgi[] = [
  {
    numcmd: 'P2500929-21',
    code_cug: '268',
    id_service: 1,
    acheteur: 'SCARICA, SOPHIE',
    dtecmd: '2026-05-11',
    compte_budgetaire: 231,
    catop: 'SU',
    libfournisseur: 'TERIDEAL AGSTP',
    marche: 'P2500929',
    mtactuel: 1050,
    mtengage: 1050,
    mtliquide: 0,
    dtelastimport: '2026-09-03',
  },
  {
    numcmd: 'M2511830-10',
    code_cug: '271',
    id_service: 1,
    acheteur: 'VATANIAN, AUDREY',
    dtecmd: '2026-07-15',
    compte_budgetaire: null,
    catop: 'M A J',
    libfournisseur: 'GPMM_LOGISTIQUE',
    marche: 'HM',
    mtactuel: 1949.71,
    mtengage: 1949.71,
    mtliquide: 0,
    dtelastimport: '2026-09-03',
  },
  {
    numcmd: 'P0000000-1',
    code_cug: '268',
    id_service: 1,
    acheteur: 'SCARICA, SOPHIE',
    dtecmd: '2026-01-01',
    compte_budgetaire: 231,
    catop: 'SU',
    libfournisseur: 'FOURNISSEUR ZERO',
    marche: 'HM',
    mtactuel: 0,
    mtengage: 0,
    mtliquide: 0,
    dtelastimport: '2026-09-03',
  },
  {
    // Simule une ligne importée avant le correctif "Marché vide -> HM" (migration
    // 20260903100000_commande_pgi_marche_hors_marche.sql pas encore exécutée) : `marche`
    // encore NULL en base malgré le type `string` — la recherche ne doit pas planter dessus.
    numcmd: 'P1111111-1',
    code_cug: '268',
    id_service: 1,
    acheteur: 'SCARICA, SOPHIE',
    dtecmd: '2026-02-01',
    compte_budgetaire: 231,
    catop: 'SU',
    libfournisseur: 'FOURNISSEUR LEGACY',
    marche: null as unknown as string,
    mtactuel: 500,
    mtengage: 500,
    mtliquide: 0,
    dtelastimport: '2026-09-03',
  },
  {
    // Service isolé (Direction Finances) pour tester "Reste à liquider" sans interférer avec
    // les autres cas (Maintenance) où mtliquide vaut toujours 0.
    numcmd: 'P3333333-1',
    code_cug: '999',
    id_service: 3,
    acheteur: 'TEST',
    dtecmd: '2026-03-01',
    compte_budgetaire: 611,
    catop: 'SU',
    libfournisseur: 'FOURNISSEUR TEST',
    marche: 'HM',
    mtactuel: 1000,
    mtengage: 1000,
    mtliquide: 300,
    dtelastimport: '2026-09-03',
  },
]

vi.mock('../hooks/useCommandesPgi', () => ({
  useCommandesPgi: (idService: number | null) => ({
    commandes: idService === null ? [] : COMMANDES.filter((c) => c.id_service === idService),
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
const lastImportInfoMock = vi.hoisted(() => ({ value: null as { exists: boolean; valeur: string | null } | null }))
vi.mock('../hooks/useCommandeLastImport', () => ({
  useCommandeLastImport: () => lastImportInfoMock.value,
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

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('CommandesPGI', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    lastImportInfoMock.value = null
  })

  it("invite à choisir une direction et un service tant que les deux ne sont pas sélectionnés", () => {
    render(<CommandesPGI />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les commandes.')).toBeInTheDocument()
  })

  it('affiche les commandes du service une fois direction et service choisis', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText('P2500929-21')).toBeInTheDocument()
    expect(screen.getByText('TERIDEAL AGSTP')).toBeInTheDocument()
    expect(screen.getByText('M2511830-10')).toBeInTheDocument()
    expect(screen.getByText('GPMM_LOGISTIQUE')).toBeInTheDocument()
  })

  it('un service sans commande affiche le message dédié', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Voyageurs')

    expect(screen.getByText('Aucune commande pour ce filtre.')).toBeInTheDocument()
  })

  it('la recherche filtre par numéro de commande, fournisseur ou marché', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const search = screen.getByLabelText('Recherche')
    fireEvent.change(search, { target: { value: 'GPMM' } })

    expect(screen.queryByText('P2500929-21')).not.toBeInTheDocument()
    expect(screen.getByText('M2511830-10')).toBeInTheDocument()
  })

  it("ne plante pas quand une commande a un Marché encore null (donnée antérieure au correctif HM)", () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const search = screen.getByLabelText('Recherche')
    expect(() => fireEvent.change(search, { target: { value: 'LEGACY' } })).not.toThrow()

    expect(screen.getByText('P1111111-1')).toBeInTheDocument()
    expect(screen.queryByText('P2500929-21')).not.toBeInTheDocument()
  })

  it("ADMIN_SERVICE : direction et service pré-remplis sur son propre service", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<CommandesPGI />)

    expect(screen.getByRole('button', { name: 'Filtrer par direction' })).toHaveTextContent('Direction Générale')
    expect(screen.getByRole('button', { name: 'Filtrer par service' })).toHaveTextContent('Maintenance')
    expect(screen.getByText('P2500929-21')).toBeInTheDocument()
  })

  it("affiche 'HM' pour une commande hors marché et '—' pour le compte budgétaire absent", () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const row = screen.getByText('M2511830-10').closest('tr') as HTMLElement
    expect(within(row).getByText('HM')).toBeInTheDocument()
    expect(within(row).getByText('—')).toBeInTheDocument()
  })

  it('calcule "% engagé" et "% liquidé" par rapport au Montant total', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const row = screen.getByText('P2500929-21').closest('tr') as HTMLElement
    expect(within(row).getByText('100 %')).toBeInTheDocument()
    expect(within(row).getByText('0 %')).toBeInTheDocument()
  })

  it('affiche "Reste à liquider" (Montant total - Montant liquidé)', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Finances')
    selectComboboxOption('Filtrer par service', 'Service Test')

    // P3333333-1 : mtactuel 1000, mtliquide 300 -> reste 700 €.
    const row = screen.getByText('P3333333-1').closest('tr') as HTMLElement
    expect(within(row).getByText('700 €')).toBeInTheDocument()
  })

  it('trie les lignes au clic sur un en-tête de colonne (ex. Fournisseur), inverse au second clic', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const numcmdInOrder = () => Array.from(document.querySelectorAll('td.mono')).map((td) => td.textContent)

    fireEvent.click(screen.getByRole('button', { name: 'Fournisseur' }))
    expect(numcmdInOrder()).toEqual(['P1111111-1', 'P0000000-1', 'M2511830-10', 'P2500929-21'])

    fireEvent.click(screen.getByRole('button', { name: 'Fournisseur' }))
    expect(numcmdInOrder()).toEqual(['P2500929-21', 'M2511830-10', 'P0000000-1', 'P1111111-1'])
  })

  it('trie numériquement "Montant total" (pas lexicographiquement)', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const numcmdInOrder = () => Array.from(document.querySelectorAll('td.mono')).map((td) => td.textContent)

    fireEvent.click(screen.getByRole('button', { name: 'Montant total' }))
    expect(numcmdInOrder()).toEqual(['P0000000-1', 'P1111111-1', 'P2500929-21', 'M2511830-10'])
  })

  it('affiche "—" pour "% engagé"/"% liquidé" quand le Montant total est nul (pas de division par zéro)', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const row = screen.getByText('P0000000-1').closest('tr') as HTMLElement
    expect(within(row).getAllByText('—')).toHaveLength(2)
  })

  it('affiche tous les champs de la table (CUG, Acheteur, Catégorie opération, Dernière importation)', () => {
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    const row = screen.getByText('P2500929-21').closest('tr') as HTMLElement
    expect(within(row).getByText('268')).toBeInTheDocument()
    expect(within(row).getByText('SCARICA, SOPHIE')).toBeInTheDocument()
    expect(within(row).getByText('SU')).toBeInTheDocument()
    expect(within(row).getByText('03/09/2026')).toBeInTheDocument()
  })

  it("affiche la date de la dernière importation dans l'entête (paramètre existant, valeur renseignée, récente)", () => {
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    const [y, m, d] = recentDate.split('-')
    lastImportInfoMock.value = { exists: true, valeur: recentDate }
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText(`État des commandes au ${d}/${m}/${y}`)).toBeInTheDocument()
    expect(screen.queryByText('Pensez à importer les commandes récentes')).not.toBeInTheDocument()
  })

  it("affiche l'alerte de rappel si la dernière importation date de plus de 15 jours", () => {
    const staleDate = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)
    lastImportInfoMock.value = { exists: true, valeur: staleDate }
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText('Pensez à importer les commandes récentes')).toBeInTheDocument()
  })

  it("affiche un message dédié et l'alerte de rappel si aucun import n'a encore été enregistré", () => {
    lastImportInfoMock.value = { exists: true, valeur: null }
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText('État des commandes — aucun import PGI effectué')).toBeInTheDocument()
    expect(screen.getByText('Pensez à importer les commandes récentes')).toBeInTheDocument()
  })

  it("affiche un message dédié si le paramètre n'existe pas encore pour ce service", () => {
    lastImportInfoMock.value = { exists: false, valeur: null }
    render(<CommandesPGI />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')
    selectComboboxOption('Filtrer par service', 'Maintenance')

    expect(screen.getByText('Paramètre "last.import.commande.pgi" non initialisé.')).toBeInTheDocument()
  })
})
