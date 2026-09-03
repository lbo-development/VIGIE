import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddPieceMarcheModal } from './AddPieceMarcheModal'
import { api } from '../services/api'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), postForm: vi.fn(), getBlob: vi.fn() } }
})

function makeFile(name: string, type: string, sizeOctets: number): File {
  return new File([new Uint8Array(sizeOctets)], name, { type })
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue([])
  vi.mocked(api.postForm).mockReset()
})

describe('AddPieceMarcheModal', () => {
  it("refuse la soumission sans fichier sélectionné", async () => {
    render(
      <AddPieceMarcheModal
        marcheRef={{ typeMarche: 'SERVICE', nummarche: 'M1234567' }}
        label="M1234567"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByText('Un fichier est requis.')).toBeInTheDocument()
    expect(api.postForm).not.toHaveBeenCalled()
  })

  it('envoie le fichier et les métadonnées (type de pièce, numéro d\'avenant, référence du marché) puis appelle onSaved', async () => {
    vi.mocked(api.postForm).mockResolvedValue({ id_marche_piece: 1 })
    const onSaved = vi.fn()

    render(
      <AddPieceMarcheModal
        marcheRef={{ typeMarche: 'SERVICE', nummarche: 'M1234567' }}
        label="M1234567"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    )

    selectFile(makeFile('ccap.pdf', 'application/pdf', 1000))
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() => expect(api.postForm).toHaveBeenCalledTimes(1))
    const [path, formData] = vi.mocked(api.postForm).mock.calls[0] as [string, FormData]
    expect(path).toBe('/marches/pieces')
    expect(formData.get('typeMarche')).toBe('SERVICE')
    expect(formData.get('nummarche')).toBe('M1234567')
    expect(formData.get('typePiece')).toBe('CCAP')
    expect(formData.get('numeroAvenant')).toBe('0')
    expect((formData.get('fichier') as File).name).toBe('ccap.pdf')

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('affiche le message d\'erreur renvoyé par le backend en cas d\'échec', async () => {
    const { ApiError } = await import('../services/api')
    vi.mocked(api.postForm).mockRejectedValue(new ApiError('Droits insuffisants pour ce service', 403))

    render(
      <AddPieceMarcheModal
        marcheRef={{ typeMarche: 'TIERS', idMarcheTiers: 7 }}
        label="M1234567"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    selectFile(makeFile('ae.pdf', 'application/pdf', 1000))
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByText('Droits insuffisants pour ce service')).toBeInTheDocument()
  })
})
