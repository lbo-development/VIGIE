import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { RolesUtilisateurs } from './RolesUtilisateurs'
import type { RoleAttribution } from '../hooks/useRoleAttributions'

const ATTRIBUTIONS: RoleAttribution[] = [
  {
    idRole: 1,
    matricule: '12520',
    nom: 'DUPONT',
    prenom: 'Jean',
    typeRole: 'CDS',
    perimeterLabel: 'Service Achats',
    idCellule: null,
    idService: 1,
    idDirection: null,
    dateDebut: '2026-01-01',
  },
]

const refetch = vi.fn()
vi.mock('../hooks/useRoleAttributions', () => ({
  useRoleAttributions: () => ({ attributions: ATTRIBUTIONS, loading: false, error: null, refetch }),
}))
vi.mock('../hooks/useAllActeurs', () => ({
  useAllActeurs: () => ({
    acteurs: [{ matricule: '99999', nom: 'MARTIN', prenom: 'Alice', fonction: 'Agent', id_cellule: 7, actif: true }],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
vi.mock('../hooks/useCellules', () => ({
  useCellules: () => ({ cellules: [{ id_cellule: 7, code_cellule: 'C1', libelle_cellule: 'Cellule Achats', id_service: 1, actif: true }], loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 1, code_service: 'S1', libelle_service: 'Service Achats', id_direction: 1, actif: true }], loading: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useDirections', () => ({
  useDirections: () => ({ directions: [{ id_direction: 1, code_direction: 'D1', libelle_direction: 'Direction Générale', actif: true }], loading: false, refetch: vi.fn() }),
}))

let isAdminApp = false
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { matricule: '12520', nom: 'X', prenom: 'Y', idService: 1, idCellule: 7, roles: isAdminApp ? [{ typeRole: 'ADMIN_APP', perimeterLabel: null, idService: null, idCellule: null }] : [] },
    loading: false,
  }),
}))

const apiPost = vi.fn()
const apiPut = vi.fn()
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: (...a: unknown[]) => apiPost(...a), put: (...a: unknown[]) => apiPut(...a), delete: vi.fn() } }
})

describe('RolesUtilisateurs', () => {
  it('affiche les attributions actives avec leur périmètre', () => {
    isAdminApp = false
    render(<RolesUtilisateurs />)

    const row = screen.getByText(/DUPONT/).closest('tr')!
    expect(within(row).getByText('CDS (service)')).toBeInTheDocument()
    expect(within(row).getByText('Service Achats')).toBeInTheDocument()
    // Direction résolue via SERVICE (idDirection null sur l'attribution elle-même, remontée par idService).
    expect(within(row).getByText('Direction Générale')).toBeInTheDocument()
  })

  it('trie par Utilisateur au clic sur l\'en-tête (asc puis desc)', () => {
    isAdminApp = false
    ATTRIBUTIONS.push({
      idRole: 4,
      matricule: '77777',
      nom: 'AAAAA',
      prenom: 'Alice',
      typeRole: 'RC',
      perimeterLabel: 'Cellule Achats',
      idCellule: 7,
      idService: null,
      idDirection: null,
      dateDebut: '2026-02-01',
    })

    render(<RolesUtilisateurs />)
    const firstDataRow = () => screen.getAllByRole('row')[1]

    fireEvent.click(screen.getByRole('button', { name: 'Utilisateur' }))
    expect(within(firstDataRow()).getByText(/AAAAA/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Utilisateur' }))
    expect(within(firstDataRow()).getByText(/DUPONT/)).toBeInTheDocument()

    ATTRIBUTIONS.pop()
  })

  it('résout la direction via CELLULE -> SERVICE pour une attribution RC', () => {
    isAdminApp = false
    ATTRIBUTIONS.push({
      idRole: 2,
      matricule: '55555',
      nom: 'MOREL',
      prenom: 'Paul',
      typeRole: 'RC',
      perimeterLabel: 'Cellule Achats',
      idCellule: 7,
      idService: null,
      idDirection: null,
      dateDebut: '2026-02-01',
    })

    render(<RolesUtilisateurs />)

    const row = screen.getByText(/MOREL/).closest('tr')!
    expect(within(row).getByText('Direction Générale')).toBeInTheDocument()

    ATTRIBUTIONS.pop()
  })

  it('affiche "—" pour une attribution ADMIN_APP (transverse, aucune direction)', () => {
    isAdminApp = false
    ATTRIBUTIONS.push({
      idRole: 3,
      matricule: '11111',
      nom: 'ADMIN',
      prenom: 'App',
      typeRole: 'ADMIN_APP',
      perimeterLabel: null,
      idCellule: null,
      idService: null,
      idDirection: null,
      dateDebut: '2026-01-01',
    })

    render(<RolesUtilisateurs />)

    const row = screen.getByText(/ADMIN/).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    expect(cells[3]).toHaveTextContent('—')

    ATTRIBUTIONS.pop()
  })

  it('ADMIN_SERVICE ne voit pas DS/ADMIN_APP dans le choix de rôle', () => {
    isAdminApp = false
    render(<RolesUtilisateurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouvelle attribution/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rôle' }))
    const menu = document.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).queryByText('DS (direction)')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Administrateur applicatif')).not.toBeInTheDocument()
    expect(within(menu).getByText('RC (cellule)')).toBeInTheDocument()
  })

  it('ADMIN_APP voit DS dans le choix de rôle', () => {
    isAdminApp = true
    render(<RolesUtilisateurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouvelle attribution/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rôle' }))
    const menu = document.querySelector('.gp-menu') as HTMLElement

    expect(within(menu).getByText('DS (direction)')).toBeInTheDocument()
  })

  it('affiche le sélecteur de service quand CDS est choisi', () => {
    isAdminApp = false
    render(<RolesUtilisateurs />)

    fireEvent.click(screen.getByRole('button', { name: /nouvelle attribution/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rôle' }))
    fireEvent.click(within(document.querySelector('.gp-menu') as HTMLElement).getByText('CDS (service)'))

    expect(within(dialog).getByRole('button', { name: 'Service' })).toBeInTheDocument()
  })

  it('clôture une attribution après confirmation', async () => {
    isAdminApp = true
    apiPut.mockResolvedValue({})
    render(<RolesUtilisateurs />)

    fireEvent.click(screen.getByRole('button', { name: "Clôturer l'attribution" }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer' }))

    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/role-attributions/1/desactiver', {}))
    expect(refetch).toHaveBeenCalled()
  })
})
