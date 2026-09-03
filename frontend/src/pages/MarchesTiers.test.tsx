import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MarchesTiers } from './MarchesTiers'
import { api, ApiError } from '../services/api'
import type { MeRole } from '../hooks/useCurrentUser'
import type { OrgDirection } from '../hooks/useDirections'
import type { OrgService } from '../hooks/useServices'
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

const marcheTiersMock = vi.hoisted(() => ({ marcheTiers: [] as MarcheTiers[], loading: false, refetch: vi.fn() }))

const fournisseursMock = vi.hoisted(() => ({
  fournisseurs: [{ id_fournisseur: 5, id_service: 1, raison_sociale_service: 'NAID', actif: true, contacts: [] }],
}))

const creationOptionsMock = vi.hoisted(() => ({
  options: { cugs: [], acteurs: [{ matricule: '12520', nom: 'DUPONT', prenom: 'Jean' }] },
}))

/** Même formateur que CURRENCY_FORMAT dans MarchesTiers.tsx (non exporté) — évite de figer l'espace insécable ICU en dur dans une assertion. */
const CURRENCY_FORMAT_TEST = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

function makeMarcheTiers(overrides: Partial<MarcheTiers>): MarcheTiers {
  return {
    id_marche_tiers: 1,
    id_service: 1,
    nummarche: 'M1234567',
    libelle_service: 'Nettoyage des locaux',
    id_fournisseur: 5,
    mtmaxi: 10000,
    dtedebut: '2026-01-01',
    dtefinmax: '2099-12-31',
    typeproc: 'MARCHE',
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
vi.mock('../hooks/useMarcheTiers', () => ({
  useMarcheTiers: () => marcheTiersMock,
}))
vi.mock('../hooks/useFournisseurs', () => ({
  useFournisseurs: () => fournisseursMock,
}))
vi.mock('../hooks/useMarcheOptions', () => ({
  useMarcheOptions: () => creationOptionsMock,
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

function fillDate(ariaLabel: string, frDate: string) {
  const input = screen.getByLabelText(ariaLabel)
  fireEvent.change(input, { target: { value: frDate } })
  fireEvent.blur(input)
}

/** Renseigne les champs obligatoires (décision du 02/09/2026) hors Numéro/Libellé — communs création et modification. */
function fillRequiredFields() {
  selectComboboxOption('Décomposition du prix', 'Forfait')
  selectComboboxOption('Agent gestionnaire', 'DUPONT Jean')
  fireEvent.change(screen.getByLabelText('Montant maximum (€)'), { target: { value: '10000' } })
  fillDate('Date de début', '01/01/2026')
  fillDate('Date de fin maximum', '31/12/2099')
}

describe('MarchesTiers', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    marcheTiersMock.marcheTiers = []
    marcheTiersMock.loading = false
    marcheTiersMock.refetch.mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  it("aucun service sélectionné : message d'invite, pas de tableau", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<MarchesTiers />)

    expect(screen.getByText('Sélectionne une direction et un service pour afficher les marchés tiers.')).toBeInTheDocument()
  })

  it('ADMIN_APP : filtre Direction/Service en cascade, affiche la liste une fois les deux choisis', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    marcheTiersMock.marcheTiers = [makeMarcheTiers({})]
    render(<MarchesTiers />)

    expect(screen.queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    selectComboboxOption('Direction', 'Direction Générale')
    selectComboboxOption('Service', 'Maintenance')

    expect(screen.getByText(/M1234567/)).toBeInTheDocument()
    expect(screen.getByText(/NAID/)).toBeInTheDocument()
  })

  it("acteur sans rôle d'administration (simple Demandeur) : voit la liste de son service mais pas les actions d'écriture", () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [makeMarcheTiers({})]
    render(<MarchesTiers />)

    expect(screen.getByText(/M1234567/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Visualiser' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nouveau marché tiers/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })

  it('ADMIN_SERVICE : voit le bouton "Nouveau marché tiers" et peut modifier/supprimer une ligne', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [makeMarcheTiers({})]
    render(<MarchesTiers />)

    expect(screen.getByRole('button', { name: /nouveau marché tiers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('CB : voit aussi le bouton "Nouveau marché tiers" et peut supprimer une ligne', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [makeMarcheTiers({})]
    render(<MarchesTiers />)

    expect(screen.getByRole('button', { name: /nouveau marché tiers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('card — pastille de statut (Actif/Inactif) et barre de durée avec jours restants', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    const dansCentJours = new Date()
    dansCentJours.setDate(dansCentJours.getDate() + 100)
    marcheTiersMock.marcheTiers = [
      makeMarcheTiers({
        dtedebut: '2026-01-01',
        dtefinmax: dansCentJours.toISOString().slice(0, 10),
        actif: false,
      }),
    ]
    render(<MarchesTiers />)

    expect(screen.getByTitle('Inactif')).toBeInTheDocument()
    expect(screen.queryByTitle('Actif')).not.toBeInTheDocument()
    expect(screen.getByText(/j restants/)).toBeInTheDocument()
  })

  it('modale de visualisation — ouverture, affiche les champs en lecture seule, se ferme sur "Retour"', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [
      makeMarcheTiers({
        nummarche: 'M1234567',
        libelle_service: 'Nettoyage des locaux',
        id_fournisseur: 5,
        typeproc: 'MARCHE',
        typedecompoprix: 'FORFAIT',
        agentgestion: 'DUPONT Jean',
        mtmaxi: 10000,
        dtedebut: '2026-01-01',
        dtefinmax: '2026-12-31',
        alertedate: 60,
        actif: true,
        commentaire: 'Autorisation verbale du service X',
      }),
    ]
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Visualiser' }))
    const dialog = screen.getByRole('dialog', { name: 'Marché tiers M1234567' })

    expect(within(dialog).getByLabelText('Numéro du marché')).toHaveValue('M1234567')
    expect(within(dialog).getByLabelText('Titulaire')).toHaveValue('NAID')
    expect(within(dialog).getByLabelText('Libellé')).toHaveValue('Nettoyage des locaux')
    expect(within(dialog).getByLabelText('Type de procédure')).toHaveValue('MARCHE')
    expect(within(dialog).getByLabelText('Décomposition du prix')).toHaveValue('Forfait')
    expect(within(dialog).getByLabelText('Début')).toHaveValue('01/01/2026')
    expect(within(dialog).getByLabelText('Fin max')).toHaveValue('31/12/2026')
    expect(within(dialog).getByLabelText('Montant maximum')).toHaveValue(CURRENCY_FORMAT_TEST.format(10000))
    expect(within(dialog).getByLabelText('Alerte sur date')).toHaveValue('60 j')
    expect(within(dialog).getByLabelText('Agent gestionnaire')).toHaveValue('DUPONT Jean')
    expect(within(dialog).getByLabelText('Statut')).toHaveValue('Actif')
    expect(within(dialog).getByLabelText('Commentaire')).toHaveValue('Autorisation verbale du service X')

    for (const input of within(dialog).getAllByRole('textbox')) {
      expect(input).toHaveAttribute('readonly')
    }

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retour' }))
    expect(screen.queryByRole('dialog', { name: 'Marché tiers M1234567' })).not.toBeInTheDocument()
  })

  it('modale de visualisation — commentaire non renseigné affiché "—"', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [makeMarcheTiers({ nummarche: 'M1234567', commentaire: null })]
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Visualiser' }))
    const dialog = screen.getByRole('dialog', { name: 'Marché tiers M1234567' })

    expect(within(dialog).getByLabelText('Commentaire')).toHaveValue('—')
  })

  it('modale de création — pas de champ Type de procédure (déduit du numéro côté serveur), soumet via POST /marches/tiers', async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    vi.mocked(api.post).mockResolvedValue(makeMarcheTiers({}))
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau marché tiers/i }))
    const dialog = screen.getByRole('dialog', { name: 'Nouveau marché tiers' })

    expect(within(dialog).queryByLabelText(/type de procédure/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /type de procédure/i })).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Numéro du marché'), { target: { value: 'm1234567' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Titulaire' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('NAID'))
    fireEvent.change(within(dialog).getByLabelText(/^Libellé/), { target: { value: 'Nettoyage des locaux' } })
    fillRequiredFields()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nouveau marché tiers' })).not.toBeInTheDocument())
    expect(api.post).toHaveBeenCalledWith(
      '/marches/tiers',
      expect.objectContaining({
        idService: 1,
        nummarche: 'M1234567',
        idFournisseur: 5,
        libelleService: 'Nettoyage des locaux',
        typedecompoprix: 'FORFAIT',
        agentgestion: 'DUPONT Jean',
        mtmaxi: 10000,
        dtefinmax: '2099-12-31',
      }),
    )
  })

  it('modale de création — saisit un commentaire, transmis dans le payload', async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    vi.mocked(api.post).mockResolvedValue(makeMarcheTiers({}))
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau marché tiers/i }))
    const dialog = screen.getByRole('dialog', { name: 'Nouveau marché tiers' })

    fireEvent.change(within(dialog).getByLabelText('Numéro du marché'), { target: { value: 'm1234567' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Titulaire' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('NAID'))
    fireEvent.change(within(dialog).getByLabelText(/^Libellé/), { target: { value: 'Nettoyage des locaux' } })
    fillRequiredFields()
    fireEvent.change(within(dialog).getByLabelText('Commentaire'), { target: { value: 'Autorisation verbale du service X' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nouveau marché tiers' })).not.toBeInTheDocument())
    expect(api.post).toHaveBeenCalledWith(
      '/marches/tiers',
      expect.objectContaining({ commentaire: 'Autorisation verbale du service X' }),
    )
  })

  it('modale de création — champs obligatoires manquants bloquent la soumission', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau marché tiers/i }))
    const dialog = screen.getByRole('dialog', { name: 'Nouveau marché tiers' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(
      within(dialog).getByText(
        'Numéro de marché, titulaire, décomposition du prix, agent gestionnaire, montant maximum, date de début et date de fin maximum sont obligatoires.',
      ),
    ).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('modale de création — libellé trop court (< 15 caractères) bloque la soumission', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau marché tiers/i }))
    const dialog = screen.getByRole('dialog', { name: 'Nouveau marché tiers' })

    fireEvent.change(within(dialog).getByLabelText('Numéro du marché'), { target: { value: 'm1234567' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Titulaire' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('NAID'))
    fireEvent.change(within(dialog).getByLabelText(/^Libellé/), { target: { value: 'Court' } })
    fillRequiredFields()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(dialog).getByText('Le libellé doit contenir au moins 15 caractères.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it("modale de modification — pas de champ Numéro (immuable), affiche le numéro et le type de procédure en lecture seule, soumet via PUT", async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    const existing = makeMarcheTiers({ libelle_service: 'Nettoyage des locaux', actif: true })
    marcheTiersMock.marcheTiers = [existing]
    vi.mocked(api.put).mockResolvedValue(existing)
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const dialog = screen.getByRole('dialog', { name: 'Modifier le marché tiers' })

    expect(within(dialog).queryByLabelText('Numéro du marché')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Numéro\s*:\s*M1234567/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Type de procédure\s*:\s*MARCHE/)).toBeInTheDocument()
    // Champs pré-remplis depuis le marché existant (Décomposition du prix, Agent gestionnaire,
    // Montant maximum, Fin max) — pas besoin de fillRequiredFields ici.
    expect(within(dialog).getByRole('button', { name: 'Agent gestionnaire' })).toHaveTextContent('DUPONT Jean')

    fireEvent.change(within(dialog).getByLabelText(/^Libellé/), { target: { value: 'Nettoyage des locaux modifié' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Modifier le marché tiers' })).not.toBeInTheDocument())
    expect(api.put).toHaveBeenCalledWith(
      '/marches/tiers/1',
      expect.objectContaining({ libelleService: 'Nettoyage des locaux modifié', actif: true }),
    )
  })

  it('modale de modification — ACTIF forcé désactivé si la date de fin maximum est dépassée', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    const hier = new Date()
    hier.setDate(hier.getDate() - 1)
    marcheTiersMock.marcheTiers = [makeMarcheTiers({ dtefinmax: hier.toISOString().slice(0, 10), actif: true })]
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const dialog = screen.getByRole('dialog', { name: 'Modifier le marché tiers' })

    const actifSwitch = within(dialog).getByRole('checkbox')
    expect(actifSwitch).toBeDisabled()
    expect(actifSwitch).not.toBeChecked()
    expect(within(dialog).getByText(/sera automatiquement inactif/)).toBeInTheDocument()
  })

  it("modale de modification — ACTIF soumis au backend forcé à false si la date de fin maximum est dépassée", async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    const hier = new Date()
    hier.setDate(hier.getDate() - 1)
    const existing = makeMarcheTiers({ dtefinmax: hier.toISOString().slice(0, 10), actif: true })
    marcheTiersMock.marcheTiers = [existing]
    vi.mocked(api.put).mockResolvedValue(existing)
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const dialog = screen.getByRole('dialog', { name: 'Modifier le marché tiers' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Modifier le marché tiers' })).not.toBeInTheDocument())
    expect(api.put).toHaveBeenCalledWith('/marches/tiers/1', expect.objectContaining({ actif: false }))
  })

  it('modale de suppression — ouverture, confirme, DELETE /marches/tiers/:id, ferme et rafraîchit la liste', async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [makeMarcheTiers({ nummarche: 'M1234567' })]
    vi.mocked(api.delete).mockResolvedValue(undefined)
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le marché tiers' })
    expect(within(dialog).getByText(/M1234567/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Supprimer le marché tiers' })).not.toBeInTheDocument())
    expect(api.delete).toHaveBeenCalledWith('/marches/tiers/1')
    expect(marcheTiersMock.refetch).toHaveBeenCalled()
  })

  it('modale de suppression — "Annuler" ferme sans appeler l\'API', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [makeMarcheTiers({})]
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le marché tiers' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('dialog', { name: 'Supprimer le marché tiers' })).not.toBeInTheDocument()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it("modale de suppression — 409 (référencé par une demande d'achat) affiche le message de l'API sans fermer la modale", async () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    currentUserMock.data.idService = 1
    marcheTiersMock.marcheTiers = [makeMarcheTiers({})]
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError("Ce marché tiers est encore référencé par une demande d'achat — impossible de le supprimer. Passez-le en Inactif à la place.", 409),
    )
    render(<MarchesTiers />)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const dialog = screen.getByRole('dialog', { name: 'Supprimer le marché tiers' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() =>
      expect(
        within(dialog).getByText(/impossible de le supprimer/),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole('dialog', { name: 'Supprimer le marché tiers' })).toBeInTheDocument()
    expect(marcheTiersMock.refetch).not.toHaveBeenCalled()
  })
})
