import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Header } from './Header'
import type { NavItem } from '../../config/navigation'

const ITEMS: NavItem[] = [{ to: '/', label: 'Accueil', icon: '' }]

describe('Header — bouton "Actualiser la page"', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() })
    // jsdom n'implémente pas ResizeObserver — utilisé par Header pour les indicateurs de défilement des onglets.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  it('recharge la page au clic, à l\'extrême droite du header', () => {
    render(
      <MemoryRouter>
        <Header items={ITEMS} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Actualiser la page' }))

    expect(window.location.reload).toHaveBeenCalled()
  })
})
