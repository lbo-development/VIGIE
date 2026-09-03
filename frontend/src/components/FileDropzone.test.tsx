import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropzone } from './FileDropzone'

function makeFile(name: string, type: string, sizeOctets: number): File {
  return new File([new Uint8Array(sizeOctets)], name, { type })
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('FileDropzone', () => {
  it('accepte un fichier valide (bon type, taille sous la limite)', () => {
    const onFileSelected = vi.fn()
    render(<FileDropzone accept="application/pdf" maxSizeOctets={1024} file={null} onFileSelected={onFileSelected} />)

    selectFile(makeFile('ccap.pdf', 'application/pdf', 100))

    expect(onFileSelected).toHaveBeenCalledTimes(1)
    expect(onFileSelected.mock.calls[0][0].name).toBe('ccap.pdf')
  })

  it('rejette un fichier dont le type ne correspond pas à accept', () => {
    const onFileSelected = vi.fn()
    render(<FileDropzone accept="application/pdf" maxSizeOctets={1024} file={null} onFileSelected={onFileSelected} />)

    selectFile(makeFile('note.txt', 'text/plain', 100))

    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByText('Format de fichier non accepté.')).toBeInTheDocument()
  })

  it('rejette un fichier dépassant la taille maximale', () => {
    const onFileSelected = vi.fn()
    render(<FileDropzone accept="application/pdf" maxSizeOctets={1024} file={null} onFileSelected={onFileSelected} />)

    selectFile(makeFile('gros.pdf', 'application/pdf', 2048))

    expect(onFileSelected).not.toHaveBeenCalled()
    expect(screen.getByText(/dépasse la taille maximale/)).toBeInTheDocument()
  })

  it('affiche le nom et le poids du fichier déjà sélectionné', () => {
    const file = makeFile('ccap.pdf', 'application/pdf', 2048)
    render(<FileDropzone accept="application/pdf" maxSizeOctets={10 * 1024 * 1024} file={file} onFileSelected={vi.fn()} />)

    expect(screen.getByText(/ccap\.pdf/)).toBeInTheDocument()
  })
})
