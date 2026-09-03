import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MarchesPGI } from './MarchesPGI'
import { api } from '../services/api'
import type { MeRole } from '../hooks/useCurrentUser'
import type { OrgDirection } from '../hooks/useDirections'
import type { OrgService } from '../hooks/useServices'
import type { Marche } from '../hooks/useMarches'

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

const marchesMock = vi.hoisted(() => ({ marches: [] as Marche[], loading: false, refetch: vi.fn() }))

const optionsMock = vi.hoisted(() => ({
  options: {
    acteurs: [{ matricule: '12520', nom: 'DUPONT', prenom: 'Jean' }],
  },
}))

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1, actif: true },
]

/** Même formateur que CURRENCY_FORMAT dans MarchesPGI.tsx (non exporté) — évite de figer l'espace insécable ICU en dur dans une assertion. */
const CURRENCY_FORMAT_TEST = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

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
    code_cug: '268',
    dtevalid: '2025-12-15',
    dtenotif: '2025-12-20',
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
vi.mock('../hooks/useMarcheOptions', () => ({
  useMarcheOptions: () => optionsMock,
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

/** Ouvre la modale de filtre, sélectionne "Oui" pour les critères demandés, puis clique "Filtrer" (dans la modale). */
function applyFilterModal(checks: { actif?: boolean; complet?: boolean; alerteDate?: boolean; alerteMontant?: boolean }) {
  fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
  const modal = screen.getByRole('dialog', { name: 'Filtrer les marchés' })
  const labelToText: Record<string, string> = {
    actif: 'Actif',
    complet: 'Complet',
    alerteDate: 'Alerte date',
    alerteMontant: 'Alerte montant',
  }
  for (const [key, shouldCheck] of Object.entries(checks)) {
    if (!shouldCheck) continue
    fireEvent.click(within(modal).getByRole('radio', { name: `${labelToText[key]} : Oui` }))
  }
  fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))
}

describe('MarchesPGI', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    marchesMock.marches = []
    marchesMock.loading = false
    marchesMock.refetch.mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockReset().mockResolvedValue({ exists: true, valeur: null })
  })

  it("ADMIN_APP : filtre Direction/Service en cascade, obligatoire avant d'afficher le contenu", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<MarchesPGI />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les marchés.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).getByText('Maintenance')).toBeInTheDocument()
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    expect(
      screen.queryByText('Sélectionne une direction et un service pour afficher les marchés.'),
    ).not.toBeInTheDocument()
  })

  it('acteur non ADMIN_APP : comboboxes affichées, pré-remplies sur la direction/le service de sa cellule', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<MarchesPGI />)

    expect(screen.getByRole('button', { name: 'Direction' })).toHaveTextContent('Direction Générale')
    expect(screen.getByRole('button', { name: 'Service' })).toHaveTextContent('Maintenance')
    expect(
      screen.queryByText('Sélectionne une direction et un service pour afficher les marchés.'),
    ).not.toBeInTheDocument()
  })

  it("acteur non ADMIN_APP sans cellule affectée : aucun pré-remplissage, message d'invite affiché", () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    render(<MarchesPGI />)

    expect(screen.getByRole('button', { name: 'Direction' })).toHaveTextContent('Choisir une direction…')
    expect(screen.getByText('Sélectionne une direction et un service pour afficher les marchés.')).toBeInTheDocument()
  })

  it("acteur non ADMIN_APP : changer de direction ne propose aucun service (le sien n'y appartient pas)", () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<MarchesPGI />)

    selectComboboxOption('Direction', 'Direction Finances')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).queryByText('Maintenance')).not.toBeInTheDocument()

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les marchés.')).toBeInTheDocument()
  })

  it('affiche une carte par marché avec numéro, libellé de service et pastilles', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M0909311', libelle_service: 'Nettoyage des installations', fournisseur_raison_sociale: 'NAID' }),
    ]
    render(<MarchesPGI />)

    expect(screen.getByText('M0909311 — NAID')).toBeInTheDocument()
    expect(screen.getByText('Nettoyage des installations')).toBeInTheDocument()
  })

  it("libellé « État des marchés au [date] » : lit /marches/last-import pour le service filtré (idService en query, pas forcément le sien)", async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    currentUserMock.data.idService = null
    vi.mocked(api.get).mockResolvedValue({ exists: true, valeur: '2026-08-20' })
    render(<MarchesPGI />)

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('Maintenance'))

    await waitFor(() => expect(screen.getByText('État des marchés au 20/08/2026')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/marches/last-import?idService=1')
  })

  it("paramètre last.import.marche.pgi jamais initialisé pour ce service (exists: false) : alarme dédiée, pas de libellé de date", async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    vi.mocked(api.get).mockResolvedValue({ exists: false, valeur: null })
    render(<MarchesPGI />)

    await waitFor(() =>
      expect(screen.getByText('Paramètre "last.import.marche.pgi" non initialisé.')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/État des marchés au/)).not.toBeInTheDocument()
    expect(screen.queryByText('État des marchés — aucun import PGI effectué')).not.toBeInTheDocument()
  })

  it("paramètre initialisé mais aucun import encore effectué (exists: true, valeur: null) : libellé de repli, alarme de rappel", async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    vi.mocked(api.get).mockResolvedValue({ exists: true, valeur: null })
    render(<MarchesPGI />)

    await waitFor(() => expect(screen.getByText('État des marchés — aucun import PGI effectué')).toBeInTheDocument())
    expect(screen.getByText('Pensez à importer les marchés récents')).toBeInTheDocument()
  })

  it('dernier import il y a plus de 15 jours : alarme affichée', async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const staleDate = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)
    vi.mocked(api.get).mockResolvedValue({ exists: true, valeur: staleDate })
    render(<MarchesPGI />)

    await waitFor(() => expect(screen.getByText('Pensez à importer les marchés récents')).toBeInTheDocument())
  })

  it('dernier import il y a moins de 15 jours : pas d\'alarme', async () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    vi.mocked(api.get).mockResolvedValue({ exists: true, valeur: recentDate })
    render(<MarchesPGI />)

    await waitFor(() => expect(screen.getByText(/État des marchés au/)).toBeInTheDocument())
    expect(screen.queryByText('Pensez à importer les marchés récents')).not.toBeInTheDocument()
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
    render(<MarchesPGI />)

    // Enregistrés (DTEFINMAX >= aujourd'hui) = M_FUTUR + M_ARCHIVE_FUTUR = 2. Sélectionnés : aucun critère
    // de Statut contraint par défaut ("Tous", modale de filtre) → même population = 2.
    expect(screen.getByText('2 marchés sélectionnés sur 2 marchés enregistrés.')).toBeInTheDocument()
  })

  it('Visualiser est toujours visible, même sans rôle particulier — Modifier réservé à canManage', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<MarchesPGI />)

    expect(screen.getByRole('button', { name: 'Visualiser' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
  })

  it('modale de visualisation — ouverture, affiche les champs en lecture seule, se ferme sur "Retour"', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({
        nummarche: 'M1234567',
        fournisseur_raison_sociale: 'NAID',
        libelle_service: 'Nettoyage des locaux',
        typeproc: 'MARCHE',
        typedecompoprix: 'FORFAIT',
        naturepresta: 'TRAVAUX',
        agentgestion: 'DUPONT Jean',
        code_cug: '268',
        dtevalid: '2025-12-15',
        dtenotif: '2025-12-20',
        dtedebut: '2026-01-01',
        dtefinmax: '2026-12-31',
        mtmaxi: 100000,
        mt_solde: 50000,
        alertedate: 60,
        alertemt: 0.75,
      }),
    ]
    render(<MarchesPGI />)

    fireEvent.click(screen.getByRole('button', { name: 'Visualiser' }))
    const dialog = screen.getByRole('dialog', { name: 'Marché M1234567' })

    expect(within(dialog).getByLabelText('Numéro du marché')).toHaveValue('M1234567')
    expect(within(dialog).getByLabelText('Titulaire')).toHaveValue('NAID')
    expect(within(dialog).getByLabelText('Libellé')).toHaveValue('Nettoyage des locaux')
    expect(within(dialog).getByLabelText('Type de procédure')).toHaveValue('MARCHE')
    expect(within(dialog).getByLabelText('Décomposition du prix')).toHaveValue('Forfait')
    expect(within(dialog).getByLabelText('Nature de la prestation')).toHaveValue('Travaux')
    expect(within(dialog).getByLabelText('Validation')).toHaveValue('15/12/2025')
    expect(within(dialog).getByLabelText('Notification')).toHaveValue('20/12/2025')
    expect(within(dialog).getByLabelText('Début')).toHaveValue('01/01/2026')
    expect(within(dialog).getByLabelText('Fin max')).toHaveValue('31/12/2026')
    expect(within(dialog).getByLabelText('Agent gestionnaire')).toHaveValue('DUPONT Jean')
    expect(within(dialog).getByLabelText('CUG')).toHaveValue('268')
    expect(within(dialog).getByLabelText('Solde restant')).toHaveValue(CURRENCY_FORMAT_TEST.format(50000))
    expect(within(dialog).getByLabelText('Alerte sur date')).toHaveValue('60 j')
    expect(within(dialog).getByLabelText('Alerte sur montant')).toHaveValue('75 %')

    for (const input of within(dialog).getAllByRole('textbox')) {
      expect(input).toHaveAttribute('readonly')
    }
    expect(within(dialog).queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retour' }))
    expect(screen.queryByRole('dialog', { name: 'Marché M1234567' })).not.toBeInTheDocument()
  })

  it('modale de visualisation — champs non renseignés affichés "—"', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({
        nummarche: 'M1234567',
        fournisseur_raison_sociale: null,
        libelle_service: null,
        typedecompoprix: null,
        naturepresta: null,
        agentgestion: null,
        code_cug: null,
        dtevalid: null,
        dtenotif: null,
        mtmaxi: null,
        mt_solde: null,
      }),
    ]
    render(<MarchesPGI />)

    fireEvent.click(screen.getByRole('button', { name: 'Visualiser' }))
    const dialog = screen.getByRole('dialog', { name: 'Marché M1234567' })

    expect(within(dialog).getByLabelText('Titulaire')).toHaveValue('—')
    expect(within(dialog).getByLabelText('Libellé')).toHaveValue('—')
    expect(within(dialog).getByLabelText('Décomposition du prix')).toHaveValue('—')
    expect(within(dialog).getByLabelText('Nature de la prestation')).toHaveValue('—')
    expect(within(dialog).getByLabelText('Validation')).toHaveValue('—')
    expect(within(dialog).getByLabelText('Notification')).toHaveValue('—')
    expect(within(dialog).getByLabelText('Agent gestionnaire')).toHaveValue('—')
    expect(within(dialog).getByLabelText('CUG')).toHaveValue('—')
    expect(within(dialog).getByLabelText('Solde restant')).toHaveValue('—')
  })

  it.each(['ADMIN_SERVICE', 'CB'])('Modifier est visible pour %s, y compris sans MTMAXI/MT_SOLDE (bug corrigé le 01/09/2026)', (typeRole) => {
    currentUserMock.data.roles = [{ typeRole, perimeterLabel: null, idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311', mtmaxi: null, mt_solde: null })]
    render(<MarchesPGI />)

    expect(screen.getByRole('button', { name: 'Visualiser' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
  })

  it('Modifier est visible pour ADMIN_APP', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<MarchesPGI />)

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
  })

  it('affiche actifs ET archivés par défaut (tous les critères de la modale sur "Tous")', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<MarchesPGI />)

    expect(screen.getByText(/M_ACTIF/)).toBeInTheDocument()
    expect(screen.getByText(/M_ARCHIVE/)).toBeInTheDocument()
  })

  it('modale de filtre — "Actif" sur Oui : masque les marchés archivés', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<MarchesPGI />)

    applyFilterModal({ actif: true })

    expect(screen.getByText(/M_ACTIF/)).toBeInTheDocument()
    expect(screen.queryByText(/M_ARCHIVE/)).not.toBeInTheDocument()
  })

  it('modale de filtre — "Complet" sur Oui : masque les fiches incomplètes', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_COMPLET', completude: true }),
      makeMarche({ nummarche: 'M_INCOMPLET', completude: false }),
    ]
    render(<MarchesPGI />)

    applyFilterModal({ complet: true })

    expect(screen.getByText(/M_COMPLET/)).toBeInTheDocument()
    expect(screen.queryByText(/M_INCOMPLET/)).not.toBeInTheDocument()
  })

  it('modale de filtre — "Alerte date" ET "Alerte montant" sur Oui ensemble : ne garde que les marchés en alerte sur les deux critères', () => {
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
    render(<MarchesPGI />)

    applyFilterModal({ alerteDate: true, alerteMontant: true })

    expect(screen.getByText(/M_DOUBLE_ALERTE/)).toBeInTheDocument()
    expect(screen.queryByText(/M_ALERTE_DATE_SEULE/)).not.toBeInTheDocument()
  })

  it('modale de filtre — "Retour" ferme sans appliquer le choix fait', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<MarchesPGI />)

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les marchés' })
    fireEvent.click(within(modal).getByRole('radio', { name: 'Actif : Oui' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Retour' }))

    expect(screen.queryByRole('dialog', { name: 'Filtrer les marchés' })).not.toBeInTheDocument()
    expect(screen.getByText(/M_ACTIF/)).toBeInTheDocument()
    expect(screen.getByText(/M_ARCHIVE/)).toBeInTheDocument()
  })

  it('modale de filtre — critère "Non" : ne garde que les marchés qui ne vérifient pas le critère (ex. archivés seulement)', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<MarchesPGI />)

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les marchés' })
    fireEvent.click(within(modal).getByRole('radio', { name: 'Actif : Non' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Filtrer' }))

    expect(screen.queryByText(/M_ACTIF/)).not.toBeInTheDocument()
    expect(screen.getByText(/M_ARCHIVE/)).toBeInTheDocument()
  })

  it('pas de bouton "Supprimer les filtres" dans la modale (retiré, maquette du 02/09/2026 — vit désormais sur la page principale)', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<MarchesPGI />)

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }))
    const modal = screen.getByRole('dialog', { name: 'Filtrer les marchés' })

    expect(within(modal).queryByRole('button', { name: 'Supprimer les filtres' })).not.toBeInTheDocument()
  })

  it('le bouton "Supprimer les filtres" de la page principale vide directement le filtre appliqué (sans repasser par la modale)', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M_ACTIF', actif: true }),
      makeMarche({ nummarche: 'M_ARCHIVE', actif: false }),
    ]
    render(<MarchesPGI />)

    applyFilterModal({ actif: true })
    expect(screen.queryByText(/M_ARCHIVE/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer les filtres' }))

    expect(screen.getByText(/M_ACTIF/)).toBeInTheDocument()
    expect(screen.getByText(/M_ARCHIVE/)).toBeInTheDocument()
  })

  it('ne filtre pas tant que "Filtrer" n\'est pas cliqué', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({ nummarche: 'M0909311', libpgi: 'Nettoyage', titulaire: 'NAID' }),
      makeMarche({ nummarche: 'M1101912', libpgi: 'Climatisation', titulaire: 'SPIE' }),
    ]
    render(<MarchesPGI />)

    fireEvent.change(screen.getByLabelText('Rechercher un marché'), { target: { value: 'spie' } })

    expect(screen.getByText(/M0909311/)).toBeInTheDocument()
    expect(screen.getByText(/M1101912/)).toBeInTheDocument()
  })

  it('le clic sur "Filtrer" ouvre la modale de filtre', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<MarchesPGI />)

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
    render(<MarchesPGI />)

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
    render(<MarchesPGI />)

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
    render(<MarchesPGI />)

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
    render(<MarchesPGI />)

    expect(screen.queryByText(/M_ECHU/)).not.toBeInTheDocument()
    expect(screen.getByText('Aucun marché pour ce filtre.')).toBeInTheDocument()
    expect(screen.getByText('0 marchés sélectionnés sur 0 marchés enregistrés.')).toBeInTheDocument()
  })

  it('aucun bouton "Nouveau marché" nulle part (création manuelle retirée le 01/09/2026, seul l\'import PGI crée des marchés)', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M0909311' })]
    render(<MarchesPGI />)

    expect(screen.queryByRole('button', { name: /nouveau marché/i })).not.toBeInTheDocument()
  })

  function openEditModal() {
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    return screen.getByRole('dialog', { name: 'Modifier le marché' })
  }

  it('modale de modification — ouverture, pré-remplit les champs actuels, numéro/titulaire en lecture seule', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [
      makeMarche({
        nummarche: 'M1234567',
        fournisseur_raison_sociale: 'NAID',
        typeproc: 'MARCHE',
        typedecompoprix: 'FORFAIT',
        naturepresta: 'TRAVAUX',
        libelle_service: 'Nettoyage des locaux',
        agentgestion: 'DUPONT Jean',
        alertedate: 60,
        alertemt: 0.75,
        planpreventionactif: 'Réf. PP-2026-01',
      }),
    ]
    render(<MarchesPGI />)

    const dialog = openEditModal()

    expect(within(dialog).getByText(/Numéro\s*:\s*M1234567/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Titulaire\s*:\s*NAID/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Numéro du marché')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Titulaire' })).not.toBeInTheDocument()

    expect(within(dialog).getByLabelText('Libellé')).toHaveValue('Nettoyage des locaux')
    expect(within(dialog).queryByRole('button', { name: 'Type de procédure' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Décomposition du prix' })).toHaveTextContent('Forfait')
    expect(within(dialog).getByRole('button', { name: 'Nature de la prestation' })).toHaveTextContent('Travaux')
    expect(within(dialog).getByRole('button', { name: 'Agent gestionnaire' })).toHaveTextContent('DUPONT Jean')
    expect(within(dialog).getByLabelText('Alerte sur date')).toHaveValue(60)
    expect(within(dialog).getByLabelText('Alerte sur montant')).toHaveValue(75)
    expect(within(dialog).getByLabelText('Plan de prévention actif')).toHaveValue('Réf. PP-2026-01')
  })

  it('modale de modification — Agent gestionnaire reste "Non renseigné" si AGENTGESTION ne correspond à aucun acteur du service', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M1234567', agentgestion: 'Agent parti depuis' })]
    render(<MarchesPGI />)

    const dialog = openEditModal()

    expect(within(dialog).getByRole('button', { name: 'Agent gestionnaire' })).toHaveTextContent('Non renseigné')
  })

  it('modale de modification — validation : libellé obligatoire', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M1234567', libelle_service: '' })]
    render(<MarchesPGI />)

    const dialog = openEditModal()
    fireEvent.change(within(dialog).getByLabelText('Libellé'), { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(dialog).getByText('Le libellé est obligatoire.')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('modale de modification — Alerte sur date et Alerte sur montant utilisent le composant spin button (chevrons)', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M1234567' })]
    render(<MarchesPGI />)

    const dialog = openEditModal()

    for (const label of ['Alerte sur date', 'Alerte sur montant']) {
      expect(within(dialog).getByLabelText(label).closest('.gp-spin')).not.toBeNull()
      expect(within(dialog).getByRole('button', { name: `Augmenter ${label}` })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: `Diminuer ${label}` })).toBeInTheDocument()
    }
  })

  it("modale de modification — pas de champ CUG ni Montant maximum (non modifiables via « Modifier »)", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M1234567' })]
    render(<MarchesPGI />)

    const dialog = openEditModal()

    expect(within(dialog).queryByText('CUG')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/montant maximum/i)).not.toBeInTheDocument()
  })

  it('modale de modification — soumission : convertit Alerte sur montant (%) en ratio, résout Agent gestionnaire en texte, PUT /marches/:nummarche, ferme et rafraîchit la liste', async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M1234567', libelle_service: 'Nettoyage' })]
    vi.mocked(api.put).mockResolvedValue({ nummarche: 'M1234567' })
    render(<MarchesPGI />)

    const dialog = openEditModal()
    fireEvent.change(within(dialog).getByLabelText('Libellé'), { target: { value: 'Nettoyage des locaux' } })
    selectComboboxOption('Agent gestionnaire', 'DUPONT Jean')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Modifier le marché' })).not.toBeInTheDocument())

    expect(api.put).toHaveBeenCalledWith(
      '/marches/M1234567',
      expect.objectContaining({
        libelleService: 'Nettoyage des locaux',
        agentgestion: 'DUPONT Jean',
        alertemt: 0.8,
        alertedate: 30,
      }),
    )
    expect(marchesMock.refetch).toHaveBeenCalled()
  })

  it('modale de modification — le plan de prévention actif est un champ texte libre', async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marchesMock.marches = [makeMarche({ nummarche: 'M1234567', planpreventionactif: null })]
    vi.mocked(api.put).mockResolvedValue({ nummarche: 'M1234567' })
    render(<MarchesPGI />)

    const dialog = openEditModal()
    fireEvent.change(within(dialog).getByLabelText('Plan de prévention actif'), { target: { value: 'Réf. PP-2026-02' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.put).toHaveBeenCalled())
    expect(api.put).toHaveBeenCalledWith('/marches/M1234567', expect.objectContaining({ planpreventionactif: 'Réf. PP-2026-02' }))
  })
})
