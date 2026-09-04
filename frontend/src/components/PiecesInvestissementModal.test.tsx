import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { PiecesInvestissementModal } from './PiecesInvestissementModal'
import { api } from '../services/api'
import type { InvestissementPiece } from '../hooks/usePiecesInvestissement'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), postForm: vi.fn(), getBlob: vi.fn() } }
})

const PIECE: InvestissementPiece = {
  id_investissement_piece: 1,
  numero_operation: 'IN025393',
  id_service: 1,
  type_piece: 'RAPPORT_CODIR',
  numero_reevaluation: 0,
  nom_fichier_original: 'rapport-codir.pdf',
  taille_octets: 2048,
  matricule_depot: '12520',
  created_at: '2026-09-04T10:00:00.000Z',
  updated_at: '2026-09-04T10:00:00.000Z',
}

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue([PIECE])
  vi.mocked(api.put).mockReset()
  vi.mocked(api.delete).mockReset()
  vi.mocked(api.getBlob).mockReset()
})

describe('PiecesInvestissementModal', () => {
  it("liste les pièces de l'opération interrogée", async () => {
    render(<PiecesInvestissementModal numeroOperation="IN025393" label="IN025393" canManage={false} onClose={vi.fn()} />)

    expect(await screen.findByText('rapport-codir.pdf')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/investissements/pieces?numeroOperation=IN025393')
  })

  it('masque Modifier/Supprimer quand canManage vaut false, ne masque pas Télécharger', async () => {
    render(<PiecesInvestissementModal numeroOperation="IN025393" label="IN025393" canManage={false} onClose={vi.fn()} />)

    await screen.findByText('rapport-codir.pdf')
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeInTheDocument()
  })

  it('modifie le type de pièce et le numéro de réévaluation (canManage)', async () => {
    vi.mocked(api.put).mockResolvedValue({ ...PIECE, type_piece: 'AUTRE', numero_reevaluation: 1 })

    render(<PiecesInvestissementModal numeroOperation="IN025393" label="IN025393" canManage={true} onClose={vi.fn()} />)

    await screen.findByText('rapport-codir.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    selectComboboxOption('Type de pièce', 'Autre')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/investissements/pieces/1', { typePiece: 'AUTRE', numeroReevaluation: 0 }))
  })

  it('supprime une pièce après confirmation (canManage)', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined)

    render(<PiecesInvestissementModal numeroOperation="IN025393" label="IN025393" canManage={true} onClose={vi.fn()} />)

    await screen.findByText('rapport-codir.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText(/Cette action est irréversible/)).toBeInTheDocument()

    const confirmDialog = screen.getByRole('dialog', { name: 'Supprimer la pièce' })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/investissements/pieces/1'))
  })

  it('télécharge la pièce au clic sur Télécharger', async () => {
    const blob = new Blob(['contenu'], { type: 'application/pdf' })
    vi.mocked(api.getBlob).mockResolvedValue(blob)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })

    render(<PiecesInvestissementModal numeroOperation="IN025393" label="IN025393" canManage={false} onClose={vi.fn()} />)

    await screen.findByText('rapport-codir.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }))

    await waitFor(() => expect(api.getBlob).toHaveBeenCalledWith('/investissements/pieces/1/download'))
    vi.unstubAllGlobals()
  })
})
