import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import type { NavGroup } from '../../config/navigation'

const GROUPS: NavGroup[] = [
  {
    label: 'Paramètres',
    icon: 'i-settings',
    items: [{ to: '/parametres/gisement-geographique', label: 'Gisement géographique', icon: '' }],
  },
]

function renderSidebar(initialPath = '/') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar items={[]} groups={GROUPS} hidden={false} theme="light" onToggleTheme={() => {}} />
    </MemoryRouter>,
  )
  // Portée sur la nav : le pied de sidebar a son propre bouton "Paramètres"
  // (icône fixe du shell, sans rapport avec le groupe dépliable testé ici).
  return within(screen.getByRole('navigation'))
}

describe('Sidebar — groupes dépliables', () => {
  it('affiche le sous-menu replié par défaut', () => {
    const nav = renderSidebar()
    expect(nav.getByRole('button', { name: 'Paramètres' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('déplie le sous-menu au clic et affiche le lien enfant', () => {
    const nav = renderSidebar()
    const trigger = nav.getByRole('button', { name: 'Paramètres' })

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(nav.getByRole('link', { name: 'Gisement géographique' })).toHaveAttribute(
      'href',
      '/parametres/gisement-geographique',
    )
  })

  it('se déplie automatiquement quand la route active est un enfant du groupe', () => {
    const nav = renderSidebar('/parametres/gisement-geographique')
    expect(nav.getByRole('button', { name: 'Paramètres' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('le raccourci "Paramètres" du pied de sidebar mène à la première page du groupe', () => {
    renderSidebar()
    // En dehors de la nav (scope volontairement plus large ici) : c'est le lien du footer.
    expect(screen.getByRole('link', { name: 'Paramètres' })).toHaveAttribute(
      'href',
      '/parametres/gisement-geographique',
    )
  })

  it("n'affiche pas le raccourci \"Paramètres\" du pied de sidebar quand aucun groupe n'est accessible", () => {
    render(
      <MemoryRouter>
        <Sidebar items={[]} groups={[]} hidden={false} theme="light" onToggleTheme={() => {}} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'Paramètres' })).not.toBeInTheDocument()
  })
})
