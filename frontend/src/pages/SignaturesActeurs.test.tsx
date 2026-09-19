import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { SignaturesActeurs } from './SignaturesActeurs'
import type { AdminActeur } from '../hooks/useAllActeurs'

const ACTEURS: AdminActeur[] = [
  { matricule: '12520', nom: 'DUPONT', prenom: 'Jean', fonction: 'Agent', id_cellule: 7, actif: true },
  { matricule: '99999', nom: 'MARTIN', prenom: 'Alice', fonction: 'RC', id_cellule: 8, actif: false },
]

vi.mock('../hooks/useAllActeurs', () => ({
  useAllActeurs: () => ({ acteurs: ACTEURS, loading: false, error: null, refetch: vi.fn() }),
}))

const apiGet = vi.fn()
const apiGetBlob = vi.fn()
const apiPutForm = vi.fn()
const apiDelete = vi.fn()
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    api: {
      get: (...a: unknown[]) => apiGet(...a),
      getBlob: (...a: unknown[]) => apiGetBlob(...a),
      putForm: (...a: unknown[]) => apiPutForm(...a),
      delete: (...a: unknown[]) => apiDelete(...a),
    },
  }
})

function makeFile(name: string, type: string, sizeOctets: number): File {
  return new File([new Uint8Array(sizeOctets)], name, { type })
}

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  apiGet.mockReset().mockResolvedValue(null)
  apiGetBlob.mockReset()
  apiPutForm.mockReset()
  apiDelete.mockReset()
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
})

describe('SignaturesActeurs — liste', () => {
  it('affiche les acteurs et filtre par recherche', () => {
    render(<SignaturesActeurs />)

    expect(screen.getByText('12520')).toBeInTheDocument()
    expect(screen.getByText('99999')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Rechercher un utilisateur'), { target: { value: 'Dupont' } })

    expect(screen.getByText('12520')).toBeInTheDocument()
    expect(screen.queryByText('99999')).not.toBeInTheDocument()
  })
})

describe('SignaturesActeurs — indicateur de statut (crayon)', () => {
  it('colore le crayon en vert si une signature est déposée, en rouge sinon', async () => {
    apiGet.mockImplementation((path: string) =>
      Promise.resolve(path === '/acteurs/12520/signature' ? { matricule: '12520', nomFichierOriginal: 'sig.png', tailleOctets: 900 } : null),
    )
    render(<SignaturesActeurs />)

    const rowAvecSignature = screen.getByText('12520').closest('tr')!
    const rowSansSignature = screen.getByText('99999').closest('tr')!

    await waitFor(() =>
      expect(within(rowAvecSignature).getByRole('button', { name: 'Gérer la signature' }).querySelector('svg')).toHaveStyle({
        color: 'var(--gp-success)',
      }),
    )
    expect(within(rowSansSignature).getByRole('button', { name: 'Gérer la signature' }).querySelector('svg')).toHaveStyle({
      color: 'var(--gp-danger)',
    })
  })

  it('passe le crayon au vert juste après un dépôt réussi, sans recharger toute la liste', async () => {
    apiPutForm.mockResolvedValue({ matricule: '12520', nomFichierOriginal: 'sig.png', tailleOctets: 900 })
    apiGetBlob.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    render(<SignaturesActeurs />)

    const row = screen.getByText('12520').closest('tr')!
    await waitFor(() => expect(within(row).getByRole('button', { name: 'Gérer la signature' }).querySelector('svg')).toHaveStyle({ color: 'var(--gp-danger)' }))

    fireEvent.click(within(row).getByRole('button', { name: 'Gérer la signature' }))
    const dialog = await screen.findByRole('dialog')
    selectFile(dialog, makeFile('sig.png', 'image/png', 500))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Déposer' }))

    await waitFor(() => expect(within(row).getByRole('button', { name: 'Gérer la signature' }).querySelector('svg')).toHaveStyle({ color: 'var(--gp-success)' }))
  })
})

describe('SignaturesActeurs — modale de gestion', () => {
  it("affiche « Aucune signature déposée » quand l'acteur n'en a pas", async () => {
    apiGet.mockResolvedValue(null)
    render(<SignaturesActeurs />)

    fireEvent.click(within(screen.getByText('12520').closest('tr')!).getByRole('button', { name: 'Gérer la signature' }))

    expect(apiGet).toHaveBeenCalledWith('/acteurs/12520/signature')
    expect(await screen.findByText('Aucune signature déposée pour cet utilisateur.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })

  it('affiche un aperçu de la signature existante', async () => {
    apiGet.mockResolvedValue({ matricule: '12520', nomFichierOriginal: 'sig.png', tailleOctets: 1200 })
    apiGetBlob.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    render(<SignaturesActeurs />)

    fireEvent.click(within(screen.getByText('12520').closest('tr')!).getByRole('button', { name: 'Gérer la signature' }))

    expect(await screen.findByText('sig.png')).toBeInTheDocument()
    expect(apiGetBlob).toHaveBeenCalledWith('/acteurs/12520/signature/fichier')
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remplacer' })).toBeInTheDocument()
  })

  it('dépose une nouvelle signature (PUT multipart) et rafraîchit l\'aperçu', async () => {
    apiGet.mockResolvedValue(null)
    apiPutForm.mockResolvedValue({ matricule: '12520', nomFichierOriginal: 'sig.png', tailleOctets: 900 })
    apiGetBlob.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    render(<SignaturesActeurs />)

    fireEvent.click(within(screen.getByText('12520').closest('tr')!).getByRole('button', { name: 'Gérer la signature' }))
    const dialog = await screen.findByRole('dialog')

    selectFile(dialog, makeFile('sig.png', 'image/png', 500))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Déposer' }))

    await waitFor(() => expect(apiPutForm).toHaveBeenCalledWith('/acteurs/12520/signature', expect.any(FormData)))
    const formData = apiPutForm.mock.calls[0][1] as FormData
    expect(formData.get('fichier')).toBeInstanceOf(File)
    expect(await within(dialog).findByText('sig.png')).toBeInTheDocument()
  })

  it('affiche le message d\'erreur serveur si le dépôt échoue', async () => {
    const { ApiError } = await import('../services/api')
    apiGet.mockResolvedValue(null)
    apiPutForm.mockRejectedValue(new ApiError('Seuls les fichiers PNG ou JPEG sont acceptés.', 400))
    render(<SignaturesActeurs />)

    fireEvent.click(within(screen.getByText('12520').closest('tr')!).getByRole('button', { name: 'Gérer la signature' }))
    const dialog = await screen.findByRole('dialog')

    selectFile(dialog, makeFile('sig.png', 'image/png', 500))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Déposer' }))

    expect(await within(dialog).findByText('Seuls les fichiers PNG ou JPEG sont acceptés.')).toBeInTheDocument()
  })

  it('supprime la signature existante après confirmation', async () => {
    apiGet.mockResolvedValue({ matricule: '12520', nomFichierOriginal: 'sig.png', tailleOctets: 1200 })
    apiGetBlob.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    apiDelete.mockResolvedValue(undefined)
    render(<SignaturesActeurs />)

    fireEvent.click(within(screen.getByText('12520').closest('tr')!).getByRole('button', { name: 'Gérer la signature' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('sig.png')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/acteurs/12520/signature'))
    expect(await within(dialog).findByText('Aucune signature déposée pour cet utilisateur.')).toBeInTheDocument()
  })
})
