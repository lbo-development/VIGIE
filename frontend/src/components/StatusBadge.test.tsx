import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it("affiche le libellé correspondant au statut 'ok'", () => {
    render(<StatusBadge status="ok" />)
    expect(screen.getByText(/connectée/i)).toBeInTheDocument()
  })

  it("affiche le libellé correspondant au statut 'error'", () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText(/injoignable/i)).toBeInTheDocument()
  })
})
