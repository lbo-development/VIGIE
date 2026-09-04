import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ImportMarches } from './ImportMarches'
import type { MeRole } from '../hooks/useCurrentUser'
import type { OrgDirection } from '../hooks/useDirections'
import type { OrgService } from '../hooks/useServices'

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

const marcheImportMock = vi.hoisted(() => ({
  state: { step: 'idle' } as
    | { step: 'idle' }
    | { step: 'previewing' }
    | { step: 'ready'; file: File; report: unknown }
    | { step: 'confirming'; file: File; report: unknown }
    | { step: 'done'; report: unknown }
    | { step: 'error'; message: string },
  preview: vi.fn(),
  confirm: vi.fn(),
  reset: vi.fn(),
}))

const lastImportInfoMock = vi.hoisted(() => ({ value: null as { exists: boolean; valeur: string | null } | null }))

const DIRECTIONS: OrgDirection[] = [
  { id_direction: 1, code_direction: 'DG', libelle_direction: 'Direction Générale', actif: true },
  { id_direction: 2, code_direction: 'DF', libelle_direction: 'Direction Finances', actif: true },
]

const SERVICES: OrgService[] = [
  { id_service: 1, code_service: 'MAINT', libelle_service: 'Maintenance', id_direction: 1, actif: true },
  { id_service: 2, code_service: 'VOY', libelle_service: 'Voyageurs', id_direction: 1, actif: true },
]

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => currentUserMock,
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: DIRECTIONS, loading: false }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: SERVICES, loading: false }),
}))
vi.mock('../hooks/useMarcheImport', () => ({
  useMarcheImport: () => marcheImportMock,
}))
vi.mock('../hooks/useLastImportMarchePgi', () => ({
  useLastImportMarchePgi: () => lastImportInfoMock.value,
}))

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('ImportMarches', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    marcheImportMock.state = { step: 'idle' }
    marcheImportMock.preview.mockReset()
    marcheImportMock.confirm.mockReset()
    marcheImportMock.reset.mockReset()
    lastImportInfoMock.value = null
  })

  it('affiche un message de droits insuffisants sans ADMIN_APP/ADMIN_SERVICE/CB', () => {
    render(<ImportMarches />)

    expect(screen.getByText('Droits insuffisants pour accéder à cette page.')).toBeInTheDocument()
  })

  it("ADMIN_APP : la zone de dépôt n'apparaît qu'une fois direction ET service choisis", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<ImportMarches />)

    expect(screen.getByText('Sélectionne une direction et un service pour pouvoir importer un fichier.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).getByText('Maintenance')).toBeInTheDocument()
    expect(within(serviceMenu).queryByText('Comptabilité')).not.toBeInTheDocument()
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    expect(
      screen.queryByText('Sélectionne une direction et un service pour pouvoir importer un fichier.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/glisse-dépose/i)).toBeInTheDocument()
  })

  it('ADMIN_SERVICE : comboboxes affichées, pré-remplies sur son propre service, zone de dépôt visible directement', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<ImportMarches />)

    expect(screen.getByRole('button', { name: 'Direction' })).toHaveTextContent('Direction Générale')
    expect(screen.getByRole('button', { name: 'Service' })).toHaveTextContent('Maintenance')
    expect(screen.getByText(/glisse-dépose/i)).toBeInTheDocument()
  })

  it("ADMIN_SERVICE : changer de direction ne propose aucun service (le sien n'y appartient pas) — aucune donnée accessible ailleurs", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<ImportMarches />)

    selectComboboxOption('Direction', 'Direction Finances')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    expect(within(serviceMenu).queryByText('Maintenance')).not.toBeInTheDocument()

    expect(screen.getByText('Sélectionne une direction et un service pour pouvoir importer un fichier.')).toBeInTheDocument()
  })

  it('CB : comboboxes affichées, pré-remplies sur son propre service, zone de dépôt visible directement', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<ImportMarches />)

    expect(screen.getByRole('button', { name: 'Service' })).toHaveTextContent('Maintenance')
    expect(screen.getByText(/glisse-dépose/i)).toBeInTheDocument()
  })

  it("affiche la date de la dernière importation dans l'entête (paramètre existant, valeur renseignée, récente)", () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    const [y, m, d] = recentDate.split('-')
    lastImportInfoMock.value = { exists: true, valeur: recentDate }
    render(<ImportMarches />)

    expect(screen.getByText(`Dernière importation le ${d}/${m}/${y}`)).toBeInTheDocument()
    expect(screen.queryByText('Pensez à importer les marchés récents')).not.toBeInTheDocument()
  })

  it("affiche l'alerte de rappel si la dernière importation date de plus de 15 jours", () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    const staleDate = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)
    lastImportInfoMock.value = { exists: true, valeur: staleDate }
    render(<ImportMarches />)

    expect(screen.getByText('Pensez à importer les marchés récents')).toBeInTheDocument()
  })

  it("affiche un message dédié et l'alerte de rappel si aucun import n'a encore été enregistré (paramètre existant, valeur vide)", () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    lastImportInfoMock.value = { exists: true, valeur: null }
    render(<ImportMarches />)

    expect(screen.getByText('Dernière importation — aucun import effectué')).toBeInTheDocument()
    expect(screen.getByText('Pensez à importer les marchés récents')).toBeInTheDocument()
  })

  it("affiche un message dédié si le paramètre n'existe pas encore pour ce service", () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    lastImportInfoMock.value = { exists: false, valeur: null }
    render(<ImportMarches />)

    expect(screen.getByText('Paramètre "last.import.marche.pgi" non initialisé.')).toBeInTheDocument()
  })

  it('ADMIN_APP : affiche la date de la dernière importation une fois direction et service choisis', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    const [y, m, d] = recentDate.split('-')
    lastImportInfoMock.value = { exists: true, valeur: recentDate }
    render(<ImportMarches />)

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    expect(screen.getByText(`Dernière importation le ${d}/${m}/${y}`)).toBeInTheDocument()
  })

  it('le dépôt (ou la sélection) du fichier déclenche preview()', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<ImportMarches />)

    const file = new File(['contenu'], 'marches.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(marcheImportMock.preview).toHaveBeenCalledWith(file)
  })

  it('état "ready" : affiche les listes créés/archivés et les anomalies, avec les boutons Confirmer/Annuler', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    marcheImportMock.state = {
      step: 'ready',
      file: new File([''], 'marches.xlsx'),
      report: {
        dateFichier: '2026-08-10',
        aCreer: [{ nummarche: 'M0909311', libelle: 'Nettoyage' }],
        aArchiver: [{ nummarche: 'M_ANCIEN', libelle: 'Ancien marché' }],
        anomalies: [{ ligne: 15, message: 'CUG inconnu' }],
      },
    }
    render(<ImportMarches />)

    expect(screen.getByText(/M0909311/)).toBeInTheDocument()
    expect(screen.getByText(/M_ANCIEN/)).toBeInTheDocument()
    expect(screen.getByText(/CUG inconnu/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: "Confirmer l'import" }))
    expect(marcheImportMock.confirm).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(marcheImportMock.reset).toHaveBeenCalled()
  })

  it('état "done" : affiche le résumé et permet de télécharger le compte-rendu ou de relancer un import', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    marcheImportMock.state = {
      step: 'done',
      report: {
        dateFichier: '2026-08-10',
        aCreer: [{ nummarche: 'M0909311', libelle: 'Nettoyage' }],
        aArchiver: [],
        anomalies: [],
        fournisseursAjoutes: [],
      },
    }
    render(<ImportMarches />)

    expect(screen.getByText('Import terminé')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /télécharger le compte-rendu/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nouvel import' }))
    expect(marcheImportMock.reset).toHaveBeenCalled()
  })

  it('état "error" : affiche le message d\'anomalie bloquante', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    marcheImportMock.state = { step: 'error', message: 'La cellule A1 doit contenir "Grand Port Maritime de Marseille".' }
    render(<ImportMarches />)

    expect(screen.getByText('La cellule A1 doit contenir "Grand Port Maritime de Marseille".')).toBeInTheDocument()
  })
})
