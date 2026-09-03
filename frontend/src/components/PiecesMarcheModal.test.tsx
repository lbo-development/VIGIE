import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { PiecesMarcheModal } from './PiecesMarcheModal'
import { api } from '../services/api'
import type { MarchePiece } from '../hooks/usePiecesMarche'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), postForm: vi.fn(), getBlob: vi.fn() } }
})

const PIECE: MarchePiece = {
  id_marche_piece: 1,
  type_marche: 'SERVICE',
  nummarche: 'M1234567',
  id_marche_tiers: null,
  type_piece: 'CCAP',
  numero_avenant: 0,
  nom_fichier_original: 'ccap.pdf',
  taille_octets: 2048,
  matricule_depot: '12520',
  created_at: '2026-09-02T10:00:00.000Z',
  updated_at: '2026-09-02T10:00:00.000Z',
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

describe('PiecesMarcheModal', () => {
  it('liste les pièces du marché interrogé', async () => {
    render(<PiecesMarcheModal marcheRef={{ typeMarche: 'SERVICE', nummarche: 'M1234567' }} label="M1234567" canManage={false} onClose={vi.fn()} />)

    expect(await screen.findByText('ccap.pdf')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/marches/pieces?typeMarche=SERVICE&nummarche=M1234567')
  })

  it("masque Modifier/Supprimer quand canManage vaut false, ne masque pas Télécharger", async () => {
    render(<PiecesMarcheModal marcheRef={{ typeMarche: 'SERVICE', nummarche: 'M1234567' }} label="M1234567" canManage={false} onClose={vi.fn()} />)

    await screen.findByText('ccap.pdf')
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeInTheDocument()
  })

  it('modifie le type de pièce et le numéro d\'avenant (canManage)', async () => {
    vi.mocked(api.put).mockResolvedValue({ ...PIECE, type_piece: 'AE', numero_avenant: 1 })

    render(<PiecesMarcheModal marcheRef={{ typeMarche: 'SERVICE', nummarche: 'M1234567' }} label="M1234567" canManage={true} onClose={vi.fn()} />)

    await screen.findByText('ccap.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    selectComboboxOption('Type de pièce', 'AE')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/marches/pieces/1', { typePiece: 'AE', numeroAvenant: 0 }))
  })

  it('supprime une pièce après confirmation (canManage)', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined)

    render(<PiecesMarcheModal marcheRef={{ typeMarche: 'SERVICE', nummarche: 'M1234567' }} label="M1234567" canManage={true} onClose={vi.fn()} />)

    await screen.findByText('ccap.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText(/Cette action est irréversible/)).toBeInTheDocument()

    const confirmDialog = screen.getByRole('dialog', { name: 'Supprimer la pièce' })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/marches/pieces/1'))
  })

  it('télécharge la pièce au clic sur Télécharger', async () => {
    const blob = new Blob(['contenu'], { type: 'application/pdf' })
    vi.mocked(api.getBlob).mockResolvedValue(blob)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })

    render(<PiecesMarcheModal marcheRef={{ typeMarche: 'SERVICE', nummarche: 'M1234567' }} label="M1234567" canManage={false} onClose={vi.fn()} />)

    await screen.findByText('ccap.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }))

    await waitFor(() => expect(api.getBlob).toHaveBeenCalledWith('/marches/pieces/1/download'))
    vi.unstubAllGlobals()
  })
})
