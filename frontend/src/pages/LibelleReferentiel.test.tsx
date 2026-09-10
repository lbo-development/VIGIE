import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { LibelleReferentiel } from './LibelleReferentiel'
import { api, ApiError } from '../services/api'
import type { LibelleReferentiel as LibelleReferentielRow } from '../hooks/useLibelleReferentiel'

const MARCHE_ROWS: LibelleReferentielRow[] = [
  { domaine: 'TYPE_PIECE_MARCHE', code: 'CCAP', libelle: 'CCAP', ordre: 1, actif: true },
  { domaine: 'TYPE_PIECE_MARCHE', code: 'AUTRE', libelle: 'Autre', ordre: 6, actif: false },
]

const INVESTISSEMENT_ROWS: LibelleReferentielRow[] = [
  { domaine: 'TYPE_PIECE_INVESTISSEMENT', code: 'RAPPORT_CODIR', libelle: 'Rapport CODIR', ordre: 1, actif: true },
]

const refetch = vi.fn()

vi.mock('../hooks/useLibelleReferentiel', () => ({
  useLibelleReferentiel: (domaine: string) => ({
    items: domaine === 'TYPE_PIECE_MARCHE' ? MARCHE_ROWS : INVESTISSEMENT_ROWS,
    loading: false,
    refetch,
  }),
}))
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

function selectComboboxOption(ariaLabel: string, optionText: string) {
  const trigger = screen.getByRole('button', { name: ariaLabel })
  fireEvent.click(trigger)
  const menu = document.querySelector('.gp-menu') as HTMLElement
  fireEvent.click(within(menu).getByText(optionText))
}

/** Le libellé de départ vaut le code lui-même (placeholder de seed) : getByText('CCAP') est ambigu (colonne Code ET Libellé), on cible la cellule "mono" du code (2e cellule, la 1re est la poignée de glisser-déposer). */
function getRowByCode(code: string): HTMLElement {
  const cell = screen.getAllByText(code).find((el) => el.classList.contains('mono'))
  if (!cell) throw new Error(`Ligne introuvable pour le code ${code}`)
  return cell.closest('tr') as HTMLElement
}

describe('LibelleReferentiel', () => {
  beforeEach(() => {
    refetch.mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  it('affiche les valeurs du domaine "Types de pièce — Marché" par défaut', () => {
    render(<LibelleReferentiel />)

    expect(screen.getAllByText('CCAP').length).toBeGreaterThan(0)
    expect(screen.getByText('Autre')).toBeInTheDocument()
    expect(screen.queryByText('Rapport CODIR')).not.toBeInTheDocument()
  })

  it('bascule sur le domaine investissement au changement de sélecteur', () => {
    render(<LibelleReferentiel />)

    selectComboboxOption('Domaine', 'Types de pièce — Investissement')

    expect(screen.getByText('Rapport CODIR')).toBeInTheDocument()
    expect(screen.queryByText('CCAP')).not.toBeInTheDocument()
  })

  it('affiche le statut Actif/Inactif par ligne', () => {
    render(<LibelleReferentiel />)

    const rowCcap = getRowByCode('CCAP')
    const rowAutre = getRowByCode('AUTRE')
    expect(within(rowCcap).getByText('Actif')).toBeInTheDocument()
    expect(within(rowAutre).getByText('Inactif')).toBeInTheDocument()
  })

  it('affiche une poignée de glisser-déposer par ligne, pas de colonne "Ordre" (position dans le tableau = ordre)', () => {
    render(<LibelleReferentiel />)

    expect(screen.queryByText('Ordre')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Glisser pour réordonner').length).toBe(MARCHE_ROWS.length)
  })

  it('création : envoie domaine/code/libellé/actif via POST (pas d\'ordre, position 0 puis glisser-déposer)', async () => {
    vi.mocked(api.post).mockResolvedValue({ domaine: 'TYPE_PIECE_MARCHE', code: 'DEVIS', libelle: 'Devis', ordre: 0, actif: true })

    render(<LibelleReferentiel />)
    fireEvent.click(screen.getByRole('button', { name: /nouvelle valeur/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText(/ordre/i)).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'DEVIS' } })
    fireEvent.change(within(dialog).getByLabelText('Libellé'), { target: { value: 'Devis' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post).toHaveBeenCalledWith('/libelles-referentiel', {
      domaine: 'TYPE_PIECE_MARCHE',
      code: 'DEVIS',
      libelle: 'Devis',
      actif: true,
    })
    await waitFor(() => expect(refetch).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('modification : le code n\'est pas modifiable, PUT porte sur libellé/actif uniquement', async () => {
    vi.mocked(api.put).mockResolvedValue({ ...MARCHE_ROWS[0], libelle: 'CCAP renommé' })

    render(<LibelleReferentiel />)
    fireEvent.click(within(getRowByCode('CCAP')).getByRole('button', { name: 'Modifier' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText('Code')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Code\s*:\s*CCAP/)).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Libellé'), { target: { value: 'CCAP renommé' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledWith('/libelles-referentiel/TYPE_PIECE_MARCHE/CCAP', {
      libelle: 'CCAP renommé',
      actif: true,
    })
  })

  it('suppression : confirme puis appelle DELETE /libelles-referentiel/:domaine/:code', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined)

    render(<LibelleReferentiel />)
    fireEvent.click(within(getRowByCode('CCAP')).getByRole('button', { name: 'Supprimer' }))

    const confirmDialog = screen.getByRole('dialog', { name: 'Supprimer la valeur' })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/libelles-referentiel/TYPE_PIECE_MARCHE/CCAP'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('suppression bloquée (409, code utilisé) : affiche le message métier renvoyé par le backend, la modale reste ouverte', async () => {
    vi.mocked(api.delete).mockRejectedValue(
      new ApiError('Ce code est utilisé par au moins une pièce existante — désactivez-le au lieu de le supprimer.', 409),
    )

    render(<LibelleReferentiel />)
    fireEvent.click(within(getRowByCode('CCAP')).getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Supprimer la valeur' })).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText(/désactivez-le au lieu de le supprimer/)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Supprimer la valeur' })).toBeInTheDocument()
  })

  it('glisser-déposer : glisser CCAP sur AUTRE appelle PUT /libelles-referentiel/reorder avec le nouvel ordre', async () => {
    vi.mocked(api.put).mockResolvedValue(undefined)

    render(<LibelleReferentiel />)
    const rowCcap = getRowByCode('CCAP')
    const rowAutre = getRowByCode('AUTRE')

    fireEvent.dragStart(rowCcap)
    fireEvent.dragOver(rowAutre)
    fireEvent.drop(rowAutre)

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/libelles-referentiel/reorder', { domaine: 'TYPE_PIECE_MARCHE', codes: ['AUTRE', 'CCAP'] }),
    )
    await waitFor(() => expect(refetch).toHaveBeenCalled())
  })

  it("glisser-déposer en échec : affiche un message d'erreur plutôt que de silencieusement garder l'ordre optimiste", async () => {
    vi.mocked(api.put).mockRejectedValue(new ApiError("Impossible d'enregistrer le nouvel ordre.", 500))

    render(<LibelleReferentiel />)
    const rowCcap = getRowByCode('CCAP')
    const rowAutre = getRowByCode('AUTRE')

    fireEvent.dragStart(rowCcap)
    fireEvent.dragOver(rowAutre)
    fireEvent.drop(rowAutre)

    expect(await screen.findByText("Impossible d'enregistrer le nouvel ordre.")).toBeInTheDocument()
  })
})
