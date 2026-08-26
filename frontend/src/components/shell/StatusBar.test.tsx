import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from './StatusBar'

const signOut = vi.fn()

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { email: 'test@gpmm.fr' } },
    loading: false,
    signOut,
  }),
}))

describe('StatusBar', () => {
  it("affiche l'email connecté et un bouton de déconnexion", () => {
    render(<StatusBar />)

    expect(screen.getByText('test@gpmm.fr')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /se déconnecter/i })).toBeInTheDocument()
  })

  it('déclenche signOut au clic sur le bouton de déconnexion', () => {
    render(<StatusBar />)

    fireEvent.click(screen.getByRole('button', { name: /se déconnecter/i }))

    expect(signOut).toHaveBeenCalled()
  })
})
