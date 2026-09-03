import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Fournisseurs } from './Fournisseurs'
import type { Fournisseur } from '../hooks/useFournisseurs'
import type { OrgService } from '../hooks/useServices'
import type { OrgDirection } from '../hooks/useDirections'
import type { MeRole } from '../hooks/useCurrentUser'
import { api, ApiError } from '../services/api'

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

const FOURNISSEURS: Fournisseur[] = [
  {
    id_fournisseur: 1,
    id_service: 1,
    raison_sociale_pgi: null,
    raison_sociale_service: 'Acme',
    siren: '732829320',
    numpgi: null,
    adr1: null,
    adr2: null,
    cp: null,
    ville: 'Marseille',
    cedex: null,
    type_creation: 'SERVICE',
    actif: true,
    contacts: [
      {
        id_contact: 1,
        id_fournisseur: 1,
        nom: 'Dupont',
        prenom: 'Jean',
        mail: null,
        telfixe: null,
        telmobile: null,
        fonction: 'Responsable régional',
        naturefonction: 'COMMERCIAL',
      },
    ],
  },
  {
    id_fournisseur: 2,
    id_service: 1,
    raison_sociale_pgi: null,
    raison_sociale_service: 'Bemat',
    siren: '987654324',
    numpgi: null,
    adr1: null,
    adr2: null,
    cp: null,
    ville: 'Aix',
    cedex: null,
    type_creation: 'SERVICE',
    actif: false,
    contacts: [],
  },
]

vi.mock('../hooks/useFournisseurs', () => ({
  useFournisseurs: (idService: number | null) => ({
    fournisseurs: idService === null ? [] : FOURNISSEURS.filter((f) => f.id_service === idService),
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

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

function selectDirectionAndService() {
  selectComboboxOption('Filtrer par direction', 'Direction Générale')
  selectComboboxOption('Filtrer par service', 'Maintenance')
}

describe('Fournisseurs', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = null
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  it('la liste est vide tant que direction et service ne sont pas tous les deux choisis, sans option "Tous"', () => {
    render(<Fournisseurs />)

    expect(
      screen.getByText('Sélectionne une direction et un service pour afficher les fournisseurs.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filtrer par service' })).not.toBeInTheDocument()

    const directionTrigger = screen.getByRole('button', { name: 'Filtrer par direction' })
    fireEvent.click(directionTrigger)
    const directionMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(directionMenu).queryByText(/toutes les directions/i)).not.toBeInTheDocument()
  })

  it('affiche la liste (Raison sociale / SIREN / Ville / Service / Statut / Actions) une fois direction et service choisis', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()

    const row = screen.getByText('Acme').closest('tr')!
    expect(within(row).getByText('732829320')).toBeInTheDocument()
    expect(within(row).getByText('Marseille')).toBeInTheDocument()
    expect(within(row).getByText('Maintenance')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()
  })

  it('filtre par statut (Tous / Actifs / Inactifs)', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()

    selectComboboxOption('Filtrer les fournisseurs par statut', 'Actifs')
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText('Bemat')).not.toBeInTheDocument()

    selectComboboxOption('Filtrer les fournisseurs par statut', 'Inactifs')
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
    expect(screen.getByText('Bemat')).toBeInTheDocument()
  })

  it('ADMIN_APP : le formulaire de création garde Direction → Service en cascade', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Fournisseurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau fournisseur/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Nouveau fournisseur')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Direction' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Raison sociale')).toBeInTheDocument()

    const directionTrigger = within(dialog).getByRole('button', { name: 'Direction' })
    fireEvent.click(directionTrigger)
    const directionMenu = document.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(directionMenu).getByText('Direction Générale'))

    expect(within(dialog).getByRole('button', { name: 'Service' })).toBeInTheDocument()
  })

  it('ADMIN_SERVICE : le formulaire de création masque Direction/Service et hérite de son propre service', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<Fournisseurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau fournisseur/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Direction' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Direction\s*:\s*Direction Générale/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Service\s*:\s*Maintenance/)).toBeInTheDocument()
  })

  it('Demandeur (sans rôle) : le formulaire de création masque aussi Direction/Service et hérite de son propre service', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<Fournisseurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau fournisseur/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: 'Direction' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Direction\s*:\s*Direction Générale/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Service\s*:\s*Maintenance/)).toBeInTheDocument()
  })

  it('le formulaire de création refuse un SIREN dont la clé de contrôle est incorrecte', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<Fournisseurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau fournisseur/i }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Raison sociale'), { target: { value: 'Acme' } })
    fireEvent.change(within(dialog).getByLabelText('SIREN'), { target: { value: '123456789' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(dialog).getByText('SIREN invalide (clé de contrôle incorrecte).')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('le formulaire de création accepte un SIREN valide saisi avec des espaces', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<Fournisseurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouveau fournisseur/i }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Raison sociale'), { target: { value: 'Acme' } })
    fireEvent.change(within(dialog).getByLabelText('SIREN'), { target: { value: '732 829 320' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(api.post).toHaveBeenCalledWith('/fournisseurs', expect.objectContaining({ siren: '732 829 320' }))
  })

  it('ouvre le formulaire de modification avec les coordonnées seulement (pas de Direction ni de Service éditables)', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier le fournisseur' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Modifier le fournisseur')).toBeInTheDocument()
    expect(within(dialog).getByText(/Direction\s*:\s*Direction Générale/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Service\s*:\s*Maintenance/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Direction' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Raison sociale')).toHaveValue('Acme')
  })

  it('ouvre la modale des contacts, avec création', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Contacts — Acme')).toBeInTheDocument()
    expect(within(dialog).getByText('Dupont Jean')).toBeInTheDocument()
    expect(within(dialog).getByText('Commercial — Responsable régional')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })
    expect(within(contactDialog).getByLabelText('Nom')).toBeInTheDocument()
  })

  it("le formulaire de contact refuse la création sans aucun numéro de téléphone", () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'Martin' } })
    fireEvent.change(within(contactDialog).getByLabelText('Prénom'), { target: { value: 'Paul' } })
    selectComboboxOption('Nature de fonction', 'Commercial')

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(contactDialog).getByText(/au moins un numéro de téléphone/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('le formulaire de contact refuse la création sans nature de fonction', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'Martin' } })
    fireEvent.change(within(contactDialog).getByLabelText('Prénom'), { target: { value: 'Paul' } })
    fireEvent.change(within(contactDialog).getByLabelText('Téléphone mobile'), { target: { value: '0611223344' } })

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(contactDialog).getByText(/nature de fonction est obligatoire/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('crée le contact quand nom, prénom, un téléphone et la nature de fonction sont renseignés', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'Martin' } })
    fireEvent.change(within(contactDialog).getByLabelText('Prénom'), { target: { value: 'Paul' } })
    fireEvent.change(within(contactDialog).getByLabelText('Téléphone fixe'), { target: { value: '0491000000' } })
    selectComboboxOption('Nature de fonction', 'Commercial')

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(api.post).toHaveBeenCalledWith(
      '/fournisseurs/1/contacts',
      expect.objectContaining({ nom: 'MARTIN', prenom: 'Paul', telfixe: '0491000000', naturefonction: 'COMMERCIAL' }),
    )
  })

  it('le champ Nom se met en majuscules au fur et à mesure de la saisie', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'martin' } })

    expect(within(contactDialog).getByLabelText('Nom')).toHaveValue('MARTIN')
  })

  it('le formulaire de contact refuse un nom vide, sans dépendre de la validation native du navigateur', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    expect(within(contactDialog).getByLabelText('Nom')).not.toBeRequired()

    fireEvent.change(within(contactDialog).getByLabelText('Prénom'), { target: { value: 'Paul' } })
    fireEvent.change(within(contactDialog).getByLabelText('Téléphone mobile'), { target: { value: '0611223344' } })
    selectComboboxOption('Nature de fonction', 'Commercial')

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(contactDialog).getByText('Le nom est obligatoire.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('le formulaire de contact refuse un prénom vide', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    expect(within(contactDialog).getByLabelText('Prénom')).not.toBeRequired()

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'Martin' } })
    fireEvent.change(within(contactDialog).getByLabelText('Téléphone mobile'), { target: { value: '0611223344' } })
    selectComboboxOption('Nature de fonction', 'Commercial')

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(contactDialog).getByText('Le prénom est obligatoire.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('le formulaire de contact refuse un mail de structure invalide, dans le même bloc d\'erreur que les autres contrôles', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'Martin' } })
    fireEvent.change(within(contactDialog).getByLabelText('Prénom'), { target: { value: 'Paul' } })
    fireEvent.change(within(contactDialog).getByLabelText('Mail'), { target: { value: 'pas-un-mail' } })
    fireEvent.change(within(contactDialog).getByLabelText('Téléphone mobile'), { target: { value: '0611223344' } })
    selectComboboxOption('Nature de fonction', 'Commercial')

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    const errorMessage = within(contactDialog).getByText('Adresse mail invalide.')
    expect(errorMessage.closest('.gp-errmsg')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('le formulaire de contact refuse un numéro de téléphone de structure invalide', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'Martin' } })
    fireEvent.change(within(contactDialog).getByLabelText('Prénom'), { target: { value: 'Paul' } })
    fireEvent.change(within(contactDialog).getByLabelText('Téléphone mobile'), { target: { value: '123' } })
    selectComboboxOption('Nature de fonction', 'Commercial')

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(contactDialog).getByText(/Numéro de téléphone invalide/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it.each([
    ['06 83 09 58 81'],
    ['+33 6 75 48 74 14'],
    ['+254 6 83 09 58 81'],
  ])('accepte le format de téléphone "%s"', (phone) => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /nouveau contact/i }))
    const contactDialog = screen.getByRole('dialog', { name: 'Nouveau contact' })

    fireEvent.change(within(contactDialog).getByLabelText('Nom'), { target: { value: 'Martin' } })
    fireEvent.change(within(contactDialog).getByLabelText('Prénom'), { target: { value: 'Paul' } })
    fireEvent.change(within(contactDialog).getByLabelText('Téléphone mobile'), { target: { value: phone } })
    selectComboboxOption('Nature de fonction', 'Commercial')

    fireEvent.click(within(contactDialog).getByRole('button', { name: 'Enregistrer' }))

    expect(api.post).toHaveBeenCalledWith('/fournisseurs/1/contacts', expect.objectContaining({ telmobile: phone }))
  })

  it('la modale des contacts est élargie (2 colonnes seulement, Nature/Fonction empilés sous Nom Prénom)', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Contacts — Acme' })

    expect(dialog).toHaveStyle({ maxWidth: '720px' })
    const headerRow = within(dialog).getAllByRole('row')[0]
    expect(headerRow.textContent).toBe('ContactActions')
  })

  it('demande confirmation avant de supprimer un contact', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Voir les contacts' })[0])
    const contactsDialog = screen.getByRole('dialog', { name: 'Contacts — Acme' })

    fireEvent.click(within(contactsDialog).getByRole('button', { name: 'Supprimer le contact' }))

    const confirmDialog = screen.getByRole('dialog', { name: 'Supprimer le contact' })
    expect(within(confirmDialog).getByText(/irréversible/)).toBeInTheDocument()
  })

  it('demande confirmation avant de supprimer un fournisseur', () => {
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer le fournisseur' })[0])

    const confirmDialog = screen.getByRole('dialog', { name: 'Supprimer le fournisseur' })
    expect(within(confirmDialog).getByText(/Acme.*irréversible/s)).toBeInTheDocument()
  })

  it('affiche le message du backend si le fournisseur est encore utilisé (409)', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(
      new ApiError("Ce fournisseur est encore utilisé par un marché, une demande d'achat ou un devis — impossible de le supprimer. Passez-le en Inactif à la place.", 409),
    )
    render(<Fournisseurs />)

    selectDirectionAndService()
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer le fournisseur' })[0])
    const confirmDialog = screen.getByRole('dialog', { name: 'Supprimer le fournisseur' })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Supprimer' }))

    expect(await within(confirmDialog).findByText(/Passez-le en Inactif à la place/)).toBeInTheDocument()
    // La modale reste ouverte (pas de onDeleted appelé) : le fournisseur est toujours visible.
    expect(screen.getByText('Acme')).toBeInTheDocument()
  })

  it('ADMIN_SERVICE : direction et service se positionnent automatiquement sur son propre périmètre', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<Fournisseurs />)

    expect(screen.getByText('Acme')).toBeInTheDocument()
  })

  it('Demandeur (sans rôle, rattaché à un service) : direction et service se verrouillent aussi sur son propre périmètre (régression 30/08/2026 — seul ADMIN_SERVICE était couvert)', () => {
    currentUserMock.data.roles = []
    currentUserMock.data.idService = 1
    render(<Fournisseurs />)

    expect(screen.getByText('Acme')).toBeInTheDocument()

    const serviceTrigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).queryByText('Voyageurs')).not.toBeInTheDocument()
  })

  it('ADMIN_APP voit tous les services de la direction choisie dans la combobox de filtre', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<Fournisseurs />)

    selectComboboxOption('Filtrer par direction', 'Direction Générale')

    const trigger = screen.getByRole('button', { name: 'Filtrer par service' })
    fireEvent.click(trigger)
    const menu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(menu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(menu).getByText('Voyageurs')).toBeInTheDocument()
  })
})
