import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PieceCountBadge } from './PieceCountBadge'

describe('PieceCountBadge', () => {
  it("n'affiche rien quand count vaut 0", () => {
    const { container } = render(<PieceCountBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le nombre tel quel pour un compte à un ou deux chiffres', () => {
    render(<PieceCountBadge count={12} />)
    expect(screen.getByText('12')).toHaveClass('piece-count-badge')
  })

  it('plafonne l\'affichage à "99+" au-delà de 99', () => {
    render(<PieceCountBadge count={150} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })
})
