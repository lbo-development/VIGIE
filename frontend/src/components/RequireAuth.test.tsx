import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'

let mockAuth: { session: unknown; loading: boolean } = { session: null, loading: false }
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('../pages/ForcePasswordChange', () => ({
  ForcePasswordChange: () => <div>Écran de changement de mot de passe</div>,
}))

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>Login</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<div>Contenu protégé</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('redirige vers /login sans session', () => {
    mockAuth = { session: null, loading: false }
    renderGuard()

    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument()
  })

  it('affiche le contenu protégé avec une session normale', () => {
    mockAuth = { session: { user: { user_metadata: {} } }, loading: false }
    renderGuard()

    expect(screen.getByText('Contenu protégé')).toBeInTheDocument()
  })

  it('force le changement de mot de passe quand must_change_password est vrai', () => {
    mockAuth = { session: { user: { user_metadata: { must_change_password: true } } }, loading: false }
    renderGuard()

    expect(screen.getByText('Écran de changement de mot de passe')).toBeInTheDocument()
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument()
  })
})
