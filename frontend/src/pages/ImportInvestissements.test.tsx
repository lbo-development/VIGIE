import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ImportInvestissements } from './ImportInvestissements'
import type { MeRole } from '../hooks/useCurrentUser'
import type { OrgDirection } from '../hooks/useDirections'
import type { OrgService } from '../hooks/useServices'

const currentUserMock = vi.hoisted(() => ({
  data: { matricule: '12520', nom: null, prenom: null, idService: null as number | null, roles: [] as MeRole[] },
  loading: false,
}))

const investissementImportMock = vi.hoisted(() => ({
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
vi.mock('../hooks/useInvestissementImport', () => ({
  useInvestissementImport: () => investissementImportMock,
}))
vi.mock('../hooks/useLastImportInvestissement', () => ({
  useLastImportInvestissement: () => lastImportInfoMock.value,
}))

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

describe('ImportInvestissements', () => {
  beforeEach(() => {
    currentUserMock.data.roles = []
    investissementImportMock.state = { step: 'idle' }
    investissementImportMock.preview.mockReset()
    investissementImportMock.confirm.mockReset()
    investissementImportMock.reset.mockReset()
    lastImportInfoMock.value = null
  })

  it('affiche un message de droits insuffisants sans ADMIN_APP/ADMIN_SERVICE/CB', () => {
    render(<ImportInvestissements />)

    expect(screen.getByText('Droits insuffisants pour accéder à cette page.')).toBeInTheDocument()
  })

  it("ADMIN_APP : la zone de dépôt n'apparaît qu'une fois direction ET service choisis", () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null }]
    render(<ImportInvestissements />)

    expect(screen.getByText('Sélectionne une direction et un service pour pouvoir importer un fichier.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Service' })).not.toBeInTheDocument()

    selectComboboxOption('Direction', 'Direction Générale')
    const serviceTrigger = screen.getByRole('button', { name: 'Service' })
    fireEvent.click(serviceTrigger)
    const serviceMenu = document.querySelector('.gp-menu') as HTMLElement
    fireEvent.click(within(serviceMenu).getByText('Maintenance'))

    expect(
      screen.queryByText('Sélectionne une direction et un service pour pouvoir importer un fichier.'),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/glisse-dépose/i)).toBeInTheDocument()
  })

  it('ADMIN_SERVICE : comboboxes affichées, pré-remplies sur son propre service, zone de dépôt visible directement', () => {
    currentUserMock.data.roles = [{ typeRole: 'ADMIN_SERVICE', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<ImportInvestissements />)

    expect(screen.getByRole('button', { name: 'Direction' })).toHaveTextContent('Direction Générale')
    expect(screen.getByRole('button', { name: 'Service' })).toHaveTextContent('Maintenance')
    expect(screen.getByText(/glisse-dépose/i)).toBeInTheDocument()
  })

  it('CB : comboboxes affichées, pré-remplies sur son propre service, zone de dépôt visible directement', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<ImportInvestissements />)

    expect(screen.getByRole('button', { name: 'Service' })).toHaveTextContent('Maintenance')
    expect(screen.getByText(/glisse-dépose/i)).toBeInTheDocument()
  })

  it("affiche la date de la dernière importation dans l'entête (paramètre existant, valeur renseignée, récente)", () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10)
    const [y, m, d] = recentDate.split('-')
    lastImportInfoMock.value = { exists: true, valeur: recentDate }
    render(<ImportInvestissements />)

    expect(screen.getByText(`Dernière importation le ${d}/${m}/${y}`)).toBeInTheDocument()
    expect(screen.queryByText('Pensez à importer les investissements récents')).not.toBeInTheDocument()
  })

  it("affiche l'alerte de rappel si la dernière importation date de plus de 15 jours", () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    const staleDate = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10)
    lastImportInfoMock.value = { exists: true, valeur: staleDate }
    render(<ImportInvestissements />)

    expect(screen.getByText('Pensez à importer les investissements récents')).toBeInTheDocument()
  })

  it("affiche un message dédié si le paramètre n'existe pas encore pour ce service", () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    lastImportInfoMock.value = { exists: false, valeur: null }
    render(<ImportInvestissements />)

    expect(screen.getByText('Paramètre "last.import.investissement.pgi" non initialisé.')).toBeInTheDocument()
  })

  it('le dépôt (ou la sélection) du fichier déclenche preview()', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    render(<ImportInvestissements />)

    const file = new File(['contenu'], 'investissements.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(investissementImportMock.preview).toHaveBeenCalledWith(file)
  })

  it('état "ready" : affiche les opérations à intégrer, le nombre d\'inactivations et les anomalies, avec les boutons Confirmer/Annuler', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    investissementImportMock.state = {
      step: 'ready',
      file: new File([''], 'investissements.xlsx'),
      report: {
        lignes: [
          { numeroOperation: 'VN000203', libelle: 'Opération test', statut: 'A', mtInitial: 1000, mtSoldeAp1: 10, mtSoldeAp8: 0, mtSoldeCp1: 0, mtSoldeCp8: 20 },
        ],
        nbExclues: 2,
        anomalies: [
          { ligne: 15, type: 'cug_hors_service', message: 'Le CUG "999" (opération "VN000204") n\'est pas affecté au service cible de l\'import.' },
          { ligne: 22, type: 'cug_hors_service', message: 'Le CUG "888" (opération "VN000205") n\'est pas affecté au service cible de l\'import.' },
        ],
      },
    }
    render(<ImportInvestissements />)

    expect(screen.getByText('VN000203')).toBeInTheDocument()
    expect(screen.getByText('Opération test')).toBeInTheDocument()
    expect(screen.getByText('CUG hors service : 2')).toBeInTheDocument()
    expect(screen.queryByText(/VN000204/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: "Confirmer l'import" }))
    expect(investissementImportMock.confirm).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(investissementImportMock.reset).toHaveBeenCalled()
  })

  it('état "done" : affiche le résumé et permet de télécharger le compte-rendu ou de relancer un import', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    investissementImportMock.state = {
      step: 'done',
      report: {
        lignes: [
          { numeroOperation: 'VN000203', libelle: 'Opération test', statut: 'A', mtInitial: 1000, mtSoldeAp1: 10, mtSoldeAp8: 0, mtSoldeCp1: 0, mtSoldeCp8: 20 },
        ],
        nbExclues: 0,
        anomalies: [],
      },
    }
    render(<ImportInvestissements />)

    expect(screen.getByText('Import terminé')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /télécharger le compte-rendu/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nouvel import' }))
    expect(investissementImportMock.reset).toHaveBeenCalled()
  })

  it('état "error" : affiche le message d\'anomalie bloquante', () => {
    currentUserMock.data.roles = [{ typeRole: 'CB', perimeterLabel: 'Maintenance', idService: 1 }]
    investissementImportMock.state = { step: 'error', message: 'Feuille "OP" absente du fichier.' }
    render(<ImportInvestissements />)

    expect(screen.getByText('Feuille "OP" absente du fichier.')).toBeInTheDocument()
  })
})
