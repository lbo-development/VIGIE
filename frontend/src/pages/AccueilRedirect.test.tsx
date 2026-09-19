import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccueilRedirect } from './AccueilRedirect'
import type { MeResponse } from '../hooks/useCurrentUser'

let mockCurrentUser: { data: MeResponse | null; loading: boolean } = { data: null, loading: false }
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockCurrentUser,
}))

function roles(types: Array<'RC' | 'CDS' | 'CB'>): MeResponse['roles'] {
  return types.map((typeRole) => ({ typeRole, perimeterLabel: null, idService: null, idCellule: null }))
}

function renderRedirect() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AccueilRedirect />} />
        <Route path="/mes-demandes" element={<div>Mes demandes</div>} />
        <Route path="/suivi-rc" element={<div>Suivi RC</div>} />
        <Route path="/suivi-cds" element={<div>Suivi CDS</div>} />
        <Route path="/suivi-cb" element={<div>Suivi CB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AccueilRedirect', () => {
  it("n'affiche rien pendant le chargement de /api/me", () => {
    mockCurrentUser = { data: null, loading: true }
    renderRedirect()

    expect(screen.queryByText('Mes demandes')).not.toBeInTheDocument()
    expect(screen.queryByText('Suivi RC')).not.toBeInTheDocument()
    expect(screen.queryByText('Suivi CDS')).not.toBeInTheDocument()
  })

  it('redirige vers /mes-demandes sans aucun rôle actif', () => {
    mockCurrentUser = { data: { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 3, roles: [] }, loading: false }
    renderRedirect()

    expect(screen.getByText('Mes demandes')).toBeInTheDocument()
  })

  it('redirige vers /mes-demandes quand currentUser est null (compte non rattaché à un ACTEUR)', () => {
    mockCurrentUser = { data: null, loading: false }
    renderRedirect()

    expect(screen.getByText('Mes demandes')).toBeInTheDocument()
  })

  it('redirige vers /suivi-rc avec un rôle RC actif', () => {
    mockCurrentUser = { data: { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 3, roles: roles(['RC']) }, loading: false }
    renderRedirect()

    expect(screen.getByText('Suivi RC')).toBeInTheDocument()
  })

  it('redirige vers /suivi-cds avec un rôle CDS actif', () => {
    mockCurrentUser = { data: { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 3, roles: roles(['CDS']) }, loading: false }
    renderRedirect()

    expect(screen.getByText('Suivi CDS')).toBeInTheDocument()
  })

  it('cumul RC+CDS : RC prioritaire', () => {
    mockCurrentUser = {
      data: { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 3, roles: roles(['CDS', 'RC']) },
      loading: false,
    }
    renderRedirect()

    expect(screen.getByText('Suivi RC')).toBeInTheDocument()
  })

  it('redirige vers /suivi-cb avec un rôle CB actif', () => {
    mockCurrentUser = { data: { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 3, roles: roles(['CB']) }, loading: false }
    renderRedirect()

    expect(screen.getByText('Suivi CB')).toBeInTheDocument()
  })

  it('cumul CDS+CB : CDS prioritaire', () => {
    mockCurrentUser = {
      data: { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 3, roles: roles(['CB', 'CDS']) },
      loading: false,
    }
    renderRedirect()

    expect(screen.getByText('Suivi CDS')).toBeInTheDocument()
  })

  it('cumul RC+CB : RC prioritaire', () => {
    mockCurrentUser = {
      data: { matricule: '10001', nom: 'MARTIN', prenom: 'Alice', idService: 10, idCellule: 3, roles: roles(['CB', 'RC']) },
      loading: false,
    }
    renderRedirect()

    expect(screen.getByText('Suivi RC')).toBeInTheDocument()
  })
})
