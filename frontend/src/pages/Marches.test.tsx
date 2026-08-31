import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Marches } from './Marches'
import type { MeRole } from '../hooks/useCurrentUser'
import type { OrgDirection } from '../hooks/useDirections'
import type { OrgService } from '../hooks/useServices'
import type { Marche } from '../hooks/useMarches'

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

const marchesMock = vi.hoisted(() => ({ marches: [] as Marche[], loading: false }))

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1, actif: true },
]

function makeMarche(overrides: Partial<Marche>): Marche {
  return {
    nummarche: 'M0909311',
    actif: true,
    completude: true,
    utilisable: true,
    libpgi: 'Nettoyage',
    libelle_service: 'Nettoyage des installations',
    titulaire: 'NAID',
    fournisseur_raison_sociale: 'NAID',
    dtedebut: '2026-01-01',
    dtefinmax: '2026-12-31',
    mtmaxi: 100000,
    mt_solde: 50000,
    alertemt: 0.8,
    alertedate: 30,
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

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = trigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

/** Ouvre la modale de filtre, coche/décoche les cases demandées, puis clique "Filtrer" (dans la modale). */
function applyFilterModal(checks: { actif?: boolean; complet?: boolean; alerteDate?: boolean; alerteMontant?: boolean }) {
  fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
  const modal = screen.getByRole('dialog', { name: 'Filtrer les marchés' })
  const labelToText: Record<string, string> = {
    actif: 'Actif',
    complet: 'Complet',
    alerteDate: 'Sur date',
    alerteMontant: 'Sur montant',
  }
  for (const [key, shouldCheck] of Object.entries(checks)) {
    if (!shouldCheck) continue
    fireEvent.click(within(modal).getByText(labelToText[key]))
  }
  fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))
}

describe('Marches', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    marchesMock.marches = []
    marchesMock.loading = false
  })

  it("ADMIN_APP : filtre Direction/Service en cascade, obligatoire avant d'afficher le contenu", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Marches />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les marchés.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = serviceTrigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).getByText('Maintenance')).toBeInTheDocument()
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    expect(
      screen.queryByText('Sélectionne une direction et un service pour afficher les marchés.'),
    ).not.toBeInTheDocument()
  })

  it('acteur non ADMIN_APP : comboboxes affichées, pré-remplies sur la direction/le service de sa cellule', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<Marches />)

    expect(screen.getByRole('button', { name: 'Direction' })).toHaveTextContent('Direction Générale')
    expect(screen.getByRole('button', { name: 'Service' })).toHaveTextContent('Maintenance')
    expect(
      screen.queryByText('Sélectionne une direction et un service pour afficher les marchés.'),
    ).not.toBeInTheDocument()
  })

  it("acteur non ADMIN_APP sans cellule affectée : aucun pré-remplissage, message d'invite affiché", () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    render(<Marches />)

    expect(screen.getByRole('button', { name: 'Direction' })).toHaveTextContent('Choisir une direction…')
    expect(screen.getByText('Sélectionne une direction et un service pour afficher les marchés.')).toBeInTheDocument()
  })

  it("acteur non ADMIN_APP : changer de direction ne propose aucun service (le sien n'y appartient pas)", () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<Marches />)

    selectComboboxOption('Direction', 'Direction Finances')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = serviceTrigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).queryByText('Maintenance')).not.toBeInTheDocument()

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les marchés.')).toBeInTheDocument()
  })

  it('affiche une carte par marché avec numéro, libellé de service et pastilles', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M0909311', libelle_service: 'Nettoyage des installations', fournisseur_raison_sociale: 'NAID' }),
    ]
    render(<Marches />)

    expect(screen.getByText('M0909311 — NAID')).toBeInTheDocument()
    expect(screen.getByText('Nettoyage des installations')).toBeInTheDocument()
  })

  it('affiche "X marchés sélectionnés sur X marchés enregistrés" — sélectionnés est toujours un sous-ensemble d\'enregistrés', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const hier = new Date()
    hier.setDate(hier.getDate() - 1)
    const demain = new Date()
    demain.setDate(demain.getDate() + 1)
    marchesMock.marches = [
      // Enregistré (DTEFINMAX >= aujourd'hui) ET actif → sélectionné.
      makeMarche({ nummarche: 'M_FUTUR', actif: true, dtefinmax: demain.toISOString().slice(0, 10) }),
      // Actif mais déjà échu → ni enregistré, ni sélectionné (exclu des deux, cf. bug corrigé le 30/08/2026).
      makeMarche({ nummarche: 'M_EXPIRE', actif: true, dtefinmax: hier.toISOString().slice(0, 10) }),
      // Enregistré mais archivé → compte dans "enregistrés", pas dans "sélectionnés".
      makeMarche({ nummarche: 'M_ARCHIVE_FUTUR', actif: false, dtefinmax: demain.toISOString().slice(0, 10) }),
    ]
    render(<Marches />)

    // Enregistrés (DTEFINMAX >= aujourd'hui) = M_FUTUR + M_ARCHIVE_FUTUR = 2. Sélectionnés : aucun filtre
    // Statut coché par défaut (décision du 30/08/2026, modale de filtre) → même population = 2.
    expect(screen.getByText('2 marchés sélectionnés sur 2 marchés enregistrés.')).toBeInTheDocument()
  })

  it('Visualiser est toujours visible, même sans rôle particulier', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<Marches />)

    expect(screen.getByRole('button', { name: 'Visualiser' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument()
  })

  it.each(['ADMIN_SERVICE', 'CB'])('Modifier et Ajouter sont visibles pour %s', (typeRole) => {
    currentUserMock.data.roles = [{ typeRole, perimeterLabel: null, idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<Marches />)

    expect(screen.getByRole('button', { name: 'Visualiser' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument()
  })

  it('Modifier et Ajouter sont visibles pour ADMIN_APP', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<Marches />)

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = serviceTrigger.closest('.gp-combobox')!.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument()
  })

  it('affiche actifs ET archivés par défaut (aucune case de la modale cochée)', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<Marches />)

    expect(screen.getByText(/M_ACTIF/)).toBeInTheDocument()
    expect(screen.getByText(/M_ARCHIVE/)).toBeInTheDocument()
  })

  it('modale de filtre — case "Actif" cochée : masque les marchés archivés', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<Marches />)

    applyFilterModal({ actif: true })

    expect(screen.getByText(/M_ACTIF/)).toBeInTheDocument()
    expect(screen.queryByText(/M_ARCHIVE/)).not.toBeInTheDocument()
  })

  it('modale de filtre — case "Complet" cochée : masque les fiches incomplètes', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_COMPLET', completude: true }),
      makeMarche({ nummarche: 'M_INCOMPLET', completude: false }),
    ]
    render(<Marches />)

    applyFilterModal({ complet: true })

    expect(screen.getByText(/M_COMPLET/)).toBeInTheDocument()
    expect(screen.queryByText(/M_INCOMPLET/)).not.toBeInTheDocument()
  })

  it('modale de filtre — "Sur date" ET "Sur montant" cochées ensemble : ne garde que les marchés en alerte sur les deux critères', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const dansCinqJours = new Date()
    dansCinqJours.setDate(dansCinqJours.getDate() + 5)
    marchesMock.marches = [
      // En alerte sur les deux critères (jours restants < alertedate ET solde <= (1-alertemt)*mtmaxi).
      makeMarche({
        nummarche: 'M_DOUBLE_ALERTE',
        dtefinmax: dansCinqJours.toISOString().slice(0, 10),
        alertedate: 30,
        mtmaxi: 100000,
        mt_solde: 5000,
        alertemt: 0.8,
      }),
      // En alerte sur la date uniquement (solde confortable).
      makeMarche({
        nummarche: 'M_ALERTE_DATE_SEULE',
        dtefinmax: dansCinqJours.toISOString().slice(0, 10),
        alertedate: 30,
        mtmaxi: 100000,
        mt_solde: 90000,
        alertemt: 0.8,
      }),
    ]
    render(<Marches />)

    applyFilterModal({ alerteDate: true, alerteMontant: true })

    expect(screen.getByText(/M_DOUBLE_ALERTE/)).toBeInTheDocument()
    expect(screen.queryByText(/M_ALERTE_DATE_SEULE/)).not.toBeInTheDocument()
  })

  it('modale de filtre — "Retour" ferme sans appliquer les cases cochées', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<Marches />)

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les marchés' })
    fireEvent.click(within(modal).getByText('Actif'))
    fireEvent.click(within(modal).getByRole('button', { name: 'Retour' }))

    expect(screen.queryByRole('dialog', { name: 'Filtrer les marchés' })).not.toBeInTheDocument()
    expect(screen.getByText(/M_ACTIF/)).toBeInTheDocument()
    expect(screen.getByText(/M_ARCHIVE/)).toBeInTheDocument()
  })

  it('modale de filtre — "Supprimer les filtres" décoche les cases du brouillon (il faut encore cliquer "Filtrer" pour appliquer)', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<Marches />)

    applyFilterModal({ actif: true })
    expect(screen.queryByText(/M_ARCHIVE/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les marchés' })
    expect(within(modal).getByRole('checkbox', { name: 'Actif' })).toBeChecked()

    fireEvent.click(within(modal).getByRole('button', { name: 'Supprimer les filtres' }))
    expect(within(modal).getByRole('checkbox', { name: 'Actif' })).not.toBeChecked()

    fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))
    expect(screen.getByText(/M_ARCHIVE/)).toBeInTheDocument()
  })

  it('ne filtre pas tant que "Filtrer" n\'est pas cliqué', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M0909311', libpgi: 'Nettoyage', titulaire: 'NAID' }),
      makeMarche({ nummarche: 'M1101912', libpgi: 'Climatisation', titulaire: 'SPIE' }),
    ]
    render(<Marches />)

    fireEvent.change(screen.getByLabelText('Rechercher un marché'), { target: { value: 'spie' } })

    expect(screen.getByText(/M0909311/)).toBeInTheDocument()
    expect(screen.getByText(/M1101912/)).toBeInTheDocument()
  })

  it('le clic sur "Filtrer" ouvre la modale de filtre', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<Marches />)

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))

    expect(screen.getByRole('dialog', { name: 'Filtrer les marchés' })).toBeInTheDocument()
  })

  it('la recherche texte en attente est appliquée en même temps que la modale de filtre', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M0909311', libpgi: 'Nettoyage', titulaire: 'NAID' }),
      makeMarche({ nummarche: 'M1101912', libpgi: 'Climatisation', titulaire: 'SPIE' }),
    ]
    render(<Marches />)

    fireEvent.change(screen.getByLabelText('Rechercher un marché'), { target: { value: 'spie' } })
    applyFilterModal({})

    expect(screen.queryByText(/M0909311/)).not.toBeInTheDocument()
    expect(screen.getByText(/M1101912/)).toBeInTheDocument()
  })

  it('filtre par recherche texte à la touche Entrée', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M0909311', libpgi: 'Nettoyage', titulaire: 'NAID' }),
      makeMarche({ nummarche: 'M1101912', libpgi: 'Climatisation', titulaire: 'SPIE' }),
    ]
    render(<Marches />)

    const input = screen.getByLabelText('Rechercher un marché')
    fireEvent.change(input, { target: { value: 'spie' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.queryByText(/M0909311/)).not.toBeInTheDocument()
    expect(screen.getByText(/M1101912/)).toBeInTheDocument()
  })

  it('marché en alerte (jours restants < ALERTEDATE, mais encore enregistré) : la barre durée est rouge', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const dansCinqJours = new Date()
    dansCinqJours.setDate(dansCinqJours.getDate() + 5)
    marchesMock.marches = [
      makeMarche({
        nummarche: 'M_BIENTOT_ECHU',
        dtedebut: '2020-01-01',
        dtefinmax: dansCinqJours.toISOString().slice(0, 10),
        alertedate: 30,
      }),
    ]
    render(<Marches />)

    expect(screen.getByText(/M_BIENTOT_ECHU/)).toBeInTheDocument()
    expect(screen.getByText(/j restants/)).toBeInTheDocument()
  })

  it("un marché ACTIF déjà échu (DTEFINMAX < aujourd'hui) n'est plus \"enregistré\" : exclu de la liste et du compteur", () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const hier = new Date()
    hier.setDate(hier.getDate() - 1)
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ECHU', actif: true, dtefinmax: hier.toISOString().slice(0, 10) }),
    ]
    render(<Marches />)

    expect(screen.queryByText(/M_ECHU/)).not.toBeInTheDocument()
    expect(screen.getByText('Aucun marché pour ce filtre.')).toBeInTheDocument()
    expect(screen.getByText('0 marchés sélectionnés sur 0 marchés enregistrés.')).toBeInTheDocument()
  })
})
