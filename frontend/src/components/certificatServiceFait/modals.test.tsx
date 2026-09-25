import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CertificatServiceFaitFormModal } from './modals'
import type { CertificatServiceFait } from '../../hooks/useCertificatServiceFait'

const CSF_EN_PREPARATION: CertificatServiceFait = {
  id_csf: 1,
  numero_csf: '2026-09-25-001',
  id_demande_achat: 10,
  matricule_redacteur: '10001',
  date_creation: '2026-09-25',
  date_service_fait: null,
  montant_csf: null,
  description: null,
  code_statut_csf: 'CSF_EN_PREPARATION',
  created_at: '2026-09-25T09:00:00Z',
  updated_at: '2026-09-25T09:00:00Z',
}

const CSF_A_COMPLETER_RC: CertificatServiceFait = { ...CSF_EN_PREPARATION, code_statut_csf: 'CSF_A_COMPLETER_RC' }

const updateMock = vi.fn()
const transmettreRcMock = vi.fn()
const getHistoriqueMock = vi.fn()
const getPiecesMock = vi.fn()
const supprimerMock = vi.fn()

vi.mock('../../hooks/useCertificatServiceFait', () => ({
  updateCertificatServiceFait: (...args: unknown[]) => updateMock(...args),
  transmettreRc: (...args: unknown[]) => transmettreRcMock(...args),
  getHistoriqueStatutsCsf: (...args: unknown[]) => getHistoriqueMock(...args),
  getPiecesCertificatServiceFait: (...args: unknown[]) => getPiecesMock(...args),
  supprimerCertificatServiceFait: (...args: unknown[]) => supprimerMock(...args),
}))
vi.mock('../../hooks/useLibelleReferentiel', () => ({
  useLibelleReferentiel: () => ({ items: [], loading: false, refetch: vi.fn() }),
}))

describe('CertificatServiceFaitFormModal — reprise CSF_A_COMPLETER_RC (réponse libre au motif du RC, décision du 25/09/2026)', () => {
  beforeEach(() => {
    updateMock.mockReset()
    transmettreRcMock.mockReset()
    getHistoriqueMock.mockReset()
    getPiecesMock.mockReset()
    supprimerMock.mockReset()
    getPiecesMock.mockResolvedValue([])
    getHistoriqueMock.mockResolvedValue([])
  })

  it('aucun motif/réponse affiché pour la transmission initiale (CSF_EN_PREPARATION)', async () => {
    render(<CertificatServiceFaitFormModal certificat={CSF_EN_PREPARATION} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />)

    await waitFor(() => expect(getPiecesMock).toHaveBeenCalled())
    expect(getHistoriqueMock).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText('Votre réponse…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Transmettre au RC' })).toBeInTheDocument()
  })

  it('affiche le motif du RC et permet une réponse libre facultative avant de retransmettre', async () => {
    getHistoriqueMock.mockResolvedValue([
      {
        idHistoCsf: 1,
        codeStatutCsf: 'CSF_A_COMPLETER_RC',
        libelleStatut: 'À compléter',
        dateHeure: '2026-09-25T10:00:00Z',
        matriculeActeur: '20002',
        acteurNomPrenom: 'Jean DUPONT',
        commentaireStatut: 'Merci de joindre le justificatif complet.',
      },
    ])
    transmettreRcMock.mockResolvedValue({ ...CSF_A_COMPLETER_RC, code_statut_csf: 'CSF_A_TRAITER' })
    const onSaved = vi.fn()
    render(<CertificatServiceFaitFormModal certificat={CSF_A_COMPLETER_RC} onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} />)

    expect(await screen.findByText('Merci de joindre le justificatif complet.')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Votre réponse…'), { target: { value: 'Justificatif ajouté.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retransmettre au RC' }))

    await waitFor(() => expect(transmettreRcMock).toHaveBeenCalledWith(1, 'Justificatif ajouté.'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('la réponse reste facultative — retransmet sans en avoir saisi une', async () => {
    transmettreRcMock.mockResolvedValue({ ...CSF_A_COMPLETER_RC, code_statut_csf: 'CSF_A_TRAITER' })
    render(<CertificatServiceFaitFormModal certificat={CSF_A_COMPLETER_RC} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Retransmettre au RC' }))

    await waitFor(() => expect(transmettreRcMock).toHaveBeenCalledWith(1, undefined))
  })
})
