import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { SuppleanceModal } from './SuppleanceModal'
import { ApiError } from '../../services/api'
import type { MesSuppleances, SuppleanceView } from '../../hooks/useSuppleance'

const createSuppleance = vi.fn()
const retireSuppleance = vi.fn()
const useSuppleantCandidats = vi.fn()
vi.mock('../../hooks/useSuppleance', () => ({
  createSuppleance: (...args: unknown[]) => createSuppleance(...args),
  retireSuppleance: (...args: unknown[]) => retireSuppleance(...args),
  useSuppleantCandidats: (...args: unknown[]) => useSuppleantCandidats(...args),
}))

const ROLE_RC = { idRole: 42, typeRole: 'RC' as const, perimeterLabel: 'Cellule Achats' }
const ROLE_CDS = { idRole: 43, typeRole: 'CDS' as const, perimeterLabel: 'Service Voyageurs' }

const CANDIDATS = [
  { matricule: '100002', nom: 'MARTIN', prenom: 'Anne', fonction: 'Acheteuse' },
  { matricule: '100003', nom: 'DUPONT', prenom: 'Jean', fonction: '' },
]

function suppleance(overrides: Partial<SuppleanceView>): SuppleanceView {
  return {
    idSuppleance: 1,
    idRole: 42,
    typeRole: 'RC',
    perimeterLabel: 'Cellule Achats',
    matriculeSuppleant: '100002',
    suppleantNomPrenom: 'Anne MARTIN',
    dateDebut: '2026-09-22',
    dateFin: '2026-09-25',
    dateRetrait: null,
    statut: 'A_VENIR',
    ...overrides,
  }
}

const DATA_UN_ROLE: MesSuppleances = { roles: [ROLE_RC], suppleances: [] }

function renderModal(data: MesSuppleances = DATA_UN_ROLE, onChanged = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<SuppleanceModal data={data} onChanged={onChanged} onClose={onClose} />)
  return { onChanged, onClose }
}

function selectComboboxOption(ariaLabel: string, optionText: string) {
  fireEvent.click(screen.getByRole('button', { name: ariaLabel }))
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

function typeDate(ariaLabel: string, text: string) {
  const input = screen.getByLabelText(ariaLabel)
  fireEvent.change(input, { target: { value: text } })
  fireEvent.blur(input)
}

function fillValidForm() {
  selectComboboxOption('Suppléant', 'Anne MARTIN — Acheteuse')
  typeDate('Date de début', '22/09/2026')
  typeDate('Date de fin', '25/09/2026')
}

beforeEach(() => {
  // « Aujourd'hui » = 20/09/2026 : sert la règle de non-rétroactivité côté client.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-20T10:00:00Z'))
  createSuppleance.mockReset()
  retireSuppleance.mockReset()
  useSuppleantCandidats.mockReset().mockReturnValue({ candidats: CANDIDATS, loading: false, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SuppleanceModal — déclaration', () => {
  it('avec un seul rôle, l\'affiche sans sélecteur et charge directement ses suppléants possibles', () => {
    renderModal()

    expect(screen.getByText('RC — Cellule Achats')).toBeInTheDocument()
    expect(useSuppleantCandidats).toHaveBeenCalledWith(42)
  })

  it('avec plusieurs rôles, n\'appelle aucun suppléant tant qu\'aucun rôle n\'est choisi, puis recharge au changement de rôle', () => {
    renderModal({ roles: [ROLE_RC, ROLE_CDS], suppleances: [] })

    expect(useSuppleantCandidats).toHaveBeenLastCalledWith(null)

    selectComboboxOption('Rôle', 'CDS — Service Voyageurs')

    expect(useSuppleantCandidats).toHaveBeenLastCalledWith(43)
  })

  it('exige un suppléant puis les deux dates', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))
    expect(screen.getByText('Choisissez le suppléant.')).toBeInTheDocument()

    selectComboboxOption('Suppléant', 'Anne MARTIN — Acheteuse')
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))
    expect(screen.getByText('Renseignez les dates de début et de fin.')).toBeInTheDocument()
    expect(createSuppleance).not.toHaveBeenCalled()
  })

  it('refuse une suppléance qui commence dans le passé', () => {
    renderModal()
    selectComboboxOption('Suppléant', 'Anne MARTIN — Acheteuse')
    typeDate('Date de début', '19/09/2026')
    typeDate('Date de fin', '25/09/2026')

    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))

    expect(screen.getByText('Une suppléance ne peut pas commencer dans le passé.')).toBeInTheDocument()
    expect(createSuppleance).not.toHaveBeenCalled()
  })

  it('accepte une suppléance qui commence aujourd\'hui', () => {
    renderModal()
    selectComboboxOption('Suppléant', 'Anne MARTIN — Acheteuse')
    typeDate('Date de début', '20/09/2026')
    typeDate('Date de fin', '20/09/2026')

    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))

    expect(screen.getByRole('heading', { name: 'Confirmer la suppléance' })).toBeInTheDocument()
  })

  it('refuse une date de fin antérieure au début', () => {
    renderModal()
    selectComboboxOption('Suppléant', 'Anne MARTIN — Acheteuse')
    typeDate('Date de début', '25/09/2026')
    typeDate('Date de fin', '22/09/2026')

    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))

    expect(screen.getByText('La date de fin doit être postérieure ou égale à la date de début.')).toBeInTheDocument()
  })

  it('affiche un récapitulatif des conséquences avant d\'enregistrer, sans appel serveur à ce stade', () => {
    renderModal()
    fillValidForm()

    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Anne MARTIN')).toBeInTheDocument()
    expect(within(dialog).getByText(/tous les droits de votre rôle/)).toBeInTheDocument()
    expect(within(dialog).getByText(/lecture seule/)).toBeInTheDocument()
    expect(createSuppleance).not.toHaveBeenCalled()
  })

  it('« Retour » revient au formulaire sans rien enregistrer', () => {
    renderModal()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))

    expect(screen.getByRole('button', { name: 'Déclarer la suppléance' })).toBeInTheDocument()
    expect(createSuppleance).not.toHaveBeenCalled()
  })

  it('enregistre après confirmation, recharge la liste et vide le formulaire', async () => {
    createSuppleance.mockResolvedValue(suppleance({}))
    const { onChanged } = renderModal()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppléance' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(createSuppleance).toHaveBeenCalledWith({
      idRole: 42,
      matriculeSuppleant: '100002',
      dateDebut: '2026-09-22',
      dateFin: '2026-09-25',
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Déclarer la suppléance' })).toBeInTheDocument())
    expect((screen.getByLabelText('Date de début') as HTMLInputElement).value).toBe('')
  })

  it('affiche le refus du serveur (ex. période chevauchante) sur le formulaire', async () => {
    createSuppleance.mockRejectedValue(new ApiError('Une suppléance existe déjà sur une période chevauchante pour ce rôle', 409))
    renderModal()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Déclarer la suppléance' }))

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppléance' }))

    expect(await screen.findByText('Une suppléance existe déjà sur une période chevauchante pour ce rôle')).toBeInTheDocument()
  })

  it('ne propose que les suppléants renvoyés par le serveur', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Suppléant' }))
    const menu = document.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getAllByText(/MARTIN|DUPONT/)).toHaveLength(2)
  })
})

describe('SuppleanceModal — liste et retrait', () => {
  const SUPPLEANCES: SuppleanceView[] = [
    suppleance({ idSuppleance: 1, statut: 'A_VENIR' }),
    suppleance({ idSuppleance: 2, statut: 'EN_COURS', dateDebut: '2026-09-18', dateFin: '2026-09-21' }),
    suppleance({ idSuppleance: 3, statut: 'TERMINEE', dateDebut: '2026-09-01', dateFin: '2026-09-05' }),
    suppleance({ idSuppleance: 4, statut: 'RETIREE', dateRetrait: '2026-09-19T08:00:00Z' }),
  ]

  it('liste les suppléances passées, en cours, à venir et retirées avec leur statut', () => {
    renderModal({ roles: [ROLE_RC], suppleances: SUPPLEANCES })

    expect(screen.getByText('À venir')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText('Terminée')).toBeInTheDocument()
    expect(screen.getByText('Retirée')).toBeInTheDocument()
  })

  it('sans suppléance, l\'indique', () => {
    renderModal()
    expect(screen.getByText('Aucune suppléance déclarée.')).toBeInTheDocument()
  })

  it('ne propose « Retirer » que pour les suppléances en cours ou à venir', () => {
    renderModal({ roles: [ROLE_RC], suppleances: SUPPLEANCES })

    expect(screen.getAllByRole('button', { name: /Retirer la suppléance du/ })).toHaveLength(2)
  })

  it('demande confirmation puis retire, et recharge la liste', async () => {
    retireSuppleance.mockResolvedValue(suppleance({ idSuppleance: 2, statut: 'RETIREE' }))
    const { onChanged } = renderModal({ roles: [ROLE_RC], suppleances: SUPPLEANCES })

    fireEvent.click(screen.getByRole('button', { name: 'Retirer la suppléance du 18/09/2026 au 21/09/2026' }))
    expect(retireSuppleance).not.toHaveBeenCalled()
    expect(screen.getByText(/perdra immédiatement les droits de votre rôle/)).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Retirer la suppléance' }).at(-1) as HTMLElement)

    await waitFor(() => expect(retireSuppleance).toHaveBeenCalledWith(2))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('« Annuler » ferme la confirmation sans retirer', () => {
    renderModal({ roles: [ROLE_RC], suppleances: SUPPLEANCES })

    fireEvent.click(screen.getByRole('button', { name: 'Retirer la suppléance du 22/09/2026 au 25/09/2026' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(retireSuppleance).not.toHaveBeenCalled()
    expect(screen.queryByText(/ne prendra jamais effet/)).not.toBeInTheDocument()
  })

  it('affiche le refus du serveur lors du retrait', async () => {
    retireSuppleance.mockRejectedValue(new ApiError('Cette suppléance est déjà retirée', 409))
    renderModal({ roles: [ROLE_RC], suppleances: SUPPLEANCES })

    fireEvent.click(screen.getByRole('button', { name: 'Retirer la suppléance du 18/09/2026 au 21/09/2026' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirer la suppléance' }).at(-1) as HTMLElement)

    expect(await screen.findByText('Cette suppléance est déjà retirée')).toBeInTheDocument()
  })
})
