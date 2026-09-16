import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChangePasswordModal } from './ChangePasswordModal'

const signInWithPassword = vi.fn()
const updateUser = vi.fn()
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { email: 'test@gpmm.fr' } }, loading: false, signOut: vi.fn() }),
}))

function fillForm(current: string, next: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: confirmation } })
}

describe('ChangePasswordModal', () => {
  it('rejette un nouveau mot de passe trop court sans appeler Supabase', () => {
    render(<ChangePasswordModal onClose={vi.fn()} />)

    fillForm('ancien-mdp', 'court', 'court')
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(screen.getByText('Le nouveau mot de passe doit contenir au moins 8 caractères.')).toBeInTheDocument()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('rejette une confirmation différente sans appeler Supabase', () => {
    render(<ChangePasswordModal onClose={vi.fn()} />)

    fillForm('ancien-mdp', 'nouveaumdp1', 'autrechose1')
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(screen.getByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('affiche "Mot de passe actuel incorrect" si la re-vérification échoue, sans appeler updateUser', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<ChangePasswordModal onClose={vi.fn()} />)

    fillForm('mauvais-mdp', 'nouveaumdp1', 'nouveaumdp1')
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    await waitFor(() => expect(screen.getByText('Mot de passe actuel incorrect.')).toBeInTheDocument())
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('re-vérifie le mot de passe actuel puis met à jour et affiche la confirmation', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    updateUser.mockResolvedValue({ error: null })
    render(<ChangePasswordModal onClose={vi.fn()} />)

    fillForm('ancien-mdp', 'nouveaumdp1', 'nouveaumdp1')
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    await waitFor(() => expect(screen.getByText('Mot de passe changé')).toBeInTheDocument())
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'test@gpmm.fr', password: 'ancien-mdp' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'nouveaumdp1' })
  })

  it('ferme la modale au clic sur Annuler', () => {
    const onClose = vi.fn()
    render(<ChangePasswordModal onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onClose).toHaveBeenCalled()
  })
})
