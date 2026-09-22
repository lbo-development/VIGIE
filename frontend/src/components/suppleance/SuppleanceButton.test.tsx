import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuppleanceButton } from './SuppleanceButton'
import { SuppleanceBanner } from './SuppleanceBanner'
import type { MesSuppleances } from '../../hooks/useSuppleance'
import type { MeRole } from '../../hooks/useCurrentUser'

const useMesSuppleances = vi.fn()
vi.mock('../../hooks/useSuppleance', () => ({
  useMesSuppleances: () => useMesSuppleances(),
  useSuppleantCandidats: () => ({ candidats: [], loading: false, error: null }),
  createSuppleance: vi.fn(),
  retireSuppleance: vi.fn(),
}))

function mockData(data: MesSuppleances | null, error: string | null = null) {
  useMesSuppleances.mockReturnValue({ data, loading: false, error, refetch: vi.fn() })
}

beforeEach(() => {
  useMesSuppleances.mockReset()
})

describe('SuppleanceButton', () => {
  it('n\'affiche rien tant que les données ne sont pas là', () => {
    mockData(null)
    const { container } = render(<SuppleanceButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('n\'affiche rien sans rôle suppléable (demandeur, suppléant pur, CB, admin)', () => {
    mockData({ roles: [], suppleances: [] })
    const { container } = render(<SuppleanceButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('n\'affiche rien en cas d\'erreur de chargement', () => {
    mockData(null, 'Impossible de charger les suppléances.')
    const { container } = render(<SuppleanceButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le bouton pour un titulaire RC/CDS/DS et ouvre la fenêtre de suppléance', () => {
    mockData({ roles: [{ idRole: 1, typeRole: 'CDS', perimeterLabel: 'Service Voyageurs' }], suppleances: [] })
    render(<SuppleanceButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Suppléance' }))

    expect(screen.getByRole('dialog', { name: 'Suppléance' })).toBeInTheDocument()
  })
})

describe('SuppleanceBanner', () => {
  const ROLE_SIMPLE: MeRole = { typeRole: 'RC', perimeterLabel: 'Cellule Achats', idService: null, idCellule: 7 }

  it('n\'affiche rien sans suppléance', () => {
    const { container } = render(<SuppleanceBanner roles={[ROLE_SIMPLE]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('un suppléant voit qui il supplée et jusqu\'à quand (fin incluse)', () => {
    render(<SuppleanceBanner roles={[{ ...ROLE_SIMPLE, typeRole: 'CDS', perimeterLabel: 'Service Voyageurs', enSuppleanceDe: 'Jean DUPONT', suppleanceDateFin: '2026-09-30' }]} />)

    expect(screen.getByText('Suppléance en cours')).toBeInTheDocument()
    expect(screen.getByText(/Vous suppléez Jean DUPONT \(CDS — Service Voyageurs\) jusqu'au 30\/09\/2026 inclus/)).toBeInTheDocument()
  })

  it('un titulaire suppléé voit que son rôle est en lecture seule', () => {
    render(<SuppleanceBanner roles={[{ ...ROLE_SIMPLE, lectureSeule: true, suppleantNomPrenom: 'Anne MARTIN', suppleanceDateFin: '2026-09-25' }]} />)

    expect(screen.getByText('Rôle en lecture seule')).toBeInTheDocument()
    expect(screen.getByText(/Anne MARTIN vous supplée sur votre rôle RC — Cellule Achats jusqu'au 25\/09\/2026 inclus/)).toBeInTheDocument()
  })

  it('un acteur suppléé sur un rôle et suppléant sur un autre voit les deux bandeaux', () => {
    render(
      <SuppleanceBanner
        roles={[
          { ...ROLE_SIMPLE, lectureSeule: true, suppleantNomPrenom: 'Anne MARTIN', suppleanceDateFin: '2026-09-25' },
          { ...ROLE_SIMPLE, typeRole: 'CDS', idCellule: null, idService: 3, enSuppleanceDe: 'Jean DUPONT', suppleanceDateFin: '2026-09-30' },
        ]}
      />,
    )

    expect(screen.getByText('Rôle en lecture seule')).toBeInTheDocument()
    expect(screen.getByText('Suppléance en cours')).toBeInTheDocument()
  })
})
