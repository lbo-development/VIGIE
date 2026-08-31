import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import type { NavItem } from '../../config/navigation'

const ITEMS: NavItem[] = [
  { to: '/parametres/gisement-geographique', label: 'Gisement géographique', icon: '' },
  { to: '/parametres/reglages', label: 'Réglages', icon: '' },
]

function renderSidebar(initialPath = '/', parametresLink: string | null = '/parametres/gisement-geographique') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar items={ITEMS} parametresLink={parametresLink} hidden={false} theme="light" onToggleTheme={() => {}} />
    </MemoryRouter>,
  )
  // Portée sur la nav : le pied de sidebar a son propre lien "Paramètres"
  // (bouton fixe du shell, sans rapport avec les items contextuels testés ici).
  return within(screen.getByRole('navigation'))
}

describe('Sidebar — liste plate contextuelle (pas de sous-menu)', () => {
  it('affiche directement les items, sans repli ni bouton de bascule', () => {
    const nav = renderSidebar()

    expect(nav.getByRole('link', { name: 'Gisement géographique' })).toHaveAttribute(
      'href',
      '/parametres/gisement-geographique',
    )
    expect(nav.getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/parametres/reglages')
    expect(nav.queryByRole('button')).not.toBeInTheDocument()
  })

  it('marque le lien actif selon la route courante', () => {
    const nav = renderSidebar('/parametres/reglages')

    expect(nav.getByRole('link', { name: 'Réglages' })).toHaveClass('is-active')
    expect(nav.getByRole('link', { name: 'Gisement géographique' })).not.toHaveClass('is-active')
  })

  it("ne marque pas actif un item dont la route n'est qu'un préfixe littéral de la page courante (régression 30/08/2026 — ex. \"/marches\" vs \"/marches/import\")", () => {
    const items: NavItem[] = [
      { to: '/marches', label: 'États des marchés', icon: '' },
      { to: '/marches/import', label: 'Importation marchés PGI', icon: '' },
    ]
    render(
      <MemoryRouter initialEntries={['/marches/import']}>
        <Sidebar items={items} parametresLink={null} hidden={false} theme="light" onToggleTheme={() => {}} />
      </MemoryRouter>,
    )
    const nav = within(screen.getByRole('navigation'))

    expect(nav.getByRole('link', { name: 'Importation marchés PGI' })).toHaveClass('is-active')
    expect(nav.getByRole('link', { name: 'États des marchés' })).not.toHaveClass('is-active')
  })
})

describe('Sidebar — bouton "Paramètres" du pied de sidebar', () => {
  it('mène à la cible fournie par parametresLink', () => {
    renderSidebar('/', '/parametres/gisement-geographique')

    // En dehors de la nav (scope volontairement plus large ici) : c'est le lien du footer.
    expect(screen.getByRole('link', { name: 'Paramètres' })).toHaveAttribute(
      'href',
      '/parametres/gisement-geographique',
    )
  })

  it('ne s\'affiche pas quand parametresLink est null (section inaccessible)', () => {
    renderSidebar('/', null)

    expect(screen.queryByRole('link', { name: 'Paramètres' })).not.toBeInTheDocument()
  })
})
