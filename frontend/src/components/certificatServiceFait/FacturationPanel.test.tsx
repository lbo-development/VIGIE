import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FacturationPanel } from './FacturationPanel'
import type { SyntheseFacturation } from '../../hooks/useCertificatServiceFait'

const SYNTHESE: SyntheseFacturation = {
  csf: { nombre: 3, montant: 1599 },
  commandes: { nombre: 2, montant: 1500 },
  certifie: { nombre: 1, montant: 400 },
  liquide: { nombre: 1, montant: 200 },
  commandesSansCsf: { nombre: 1, montant: 500 },
}

function tile(label: string) {
  return screen.getByText(label).closest('article') as HTMLElement
}

// Décision du 25/09/2026 — redéfinition des tuiles (CSF = tous les CSF existants hors
// CSF_EN_PREPARATION, Certifié = CSF_VALIDE_BUDGET seul, Liquidé = nouveau, CSF_LIQUIDE seul).
describe('FacturationPanel', () => {
  it('affiche les 5 tuiles avec leur nombre et leur montant', () => {
    render(<FacturationPanel synthese={SYNTHESE} error={null} />)

    expect(within(tile('CSF')).getByText('3')).toBeInTheDocument()
    expect(within(tile('CSF')).getByText('1 599,00 €')).toBeInTheDocument()
    expect(within(tile('Commandes')).getByText('2')).toBeInTheDocument()
    expect(within(tile('Certifié')).getByText('1')).toBeInTheDocument()
    expect(within(tile('Certifié')).getByText('400,00 €')).toBeInTheDocument()
    expect(within(tile('Liquidé')).getByText('1')).toBeInTheDocument()
    expect(within(tile('Liquidé')).getByText('200,00 €')).toBeInTheDocument()
    expect(within(tile('Commandes sans CSF')).getByText('1')).toBeInTheDocument()
  })

  it('affiche des zéros tant que la synthèse n\'est pas chargée', () => {
    render(<FacturationPanel synthese={null} error={null} />)

    expect(within(tile('CSF')).getByText('0')).toBeInTheDocument()
    expect(within(tile('Certifié')).getByText('0')).toBeInTheDocument()
    expect(within(tile('Liquidé')).getByText('0')).toBeInTheDocument()
  })

  it('affiche l\'erreur quand fournie', () => {
    render(<FacturationPanel synthese={null} error="Impossible de charger la synthèse." />)
    expect(screen.getByText('Impossible de charger la synthèse.')).toBeInTheDocument()
  })
})
