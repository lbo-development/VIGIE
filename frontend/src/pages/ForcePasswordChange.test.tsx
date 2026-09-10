import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ForcePasswordChange } from './ForcePasswordChange'

const updateUser = vi.fn()
vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => updateUser(...args) } },
}))

describe('ForcePasswordChange', () => {
  it('rejette un mot de passe trop court sans appeler updateUser', () => {
    render(<ForcePasswordChange />)

    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'court' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'court' } })
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères.')).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejette une confirmation différente', () => {
    render(<ForcePasswordChange />)

    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'motdepasse1' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'autrechose1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    expect(screen.getByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('appelle updateUser avec must_change_password=false quand les mots de passe correspondent', async () => {
    updateUser.mockResolvedValue({ data: {}, error: null })
    render(<ForcePasswordChange />)

    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'motdepasse1' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'motdepasse1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({ password: 'motdepasse1', data: { must_change_password: false } }),
    )
  })

  it("affiche l'erreur renvoyée par Supabase en cas d'échec", async () => {
    updateUser.mockResolvedValue({ data: null, error: { message: 'Mot de passe trop faible' } })
    render(<ForcePasswordChange />)

    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'motdepasse1' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'motdepasse1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))

    await waitFor(() => expect(screen.getByText('Mot de passe trop faible')).toBeInTheDocument())
  })
})
