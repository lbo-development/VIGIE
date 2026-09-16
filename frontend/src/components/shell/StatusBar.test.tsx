import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from './StatusBar'

const signOut = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
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

  it('ouvre la modale de changement de mot de passe au clic sur son bouton', () => {
    render(<StatusBar />)

    fireEvent.click(screen.getByRole('button', { name: /changer le mot de passe/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Changer mon mot de passe')).toBeInTheDocument()
  })
})
