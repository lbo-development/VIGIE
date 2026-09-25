import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ValiderCommandeCdsModal } from './ValiderCommandeCdsModal'
import type { DemandeAchat as DemandeAchatRow, ConsultationCandidat } from '../../hooks/useDemandeAchat'

const DA: DemandeAchatRow = {
  id_demande_achat: 1,
  numero: '2026-09-08-001',
  id_service: 10,
  objet_demandeur: 'Achat de fournitures diverses',
  description_demandeur: 'Description demandeur',
  objet_rc: 'Achat de fournitures diverses',
  description_rc: 'Description demandeur',
  montant_demande: 1200,
  imputation_comptable: 'FONCTIONNEMENT',
  procedure_achat: 'HORS_MARCHE',
  type_achat: 'FOURNITURES',
  type_fad: 'FERMEE',
  motif_choix: null,
  libelle_motif_choix: null,
  montant_retenu: null,
  montant_commande: null,
  numero_commande: null,
  validee_sur_seuil_ds: false,
  date_creation: '2026-09-08',
  matricule_demandeur: '10001',
  code_site: 'S1',
  code_sous_site: null,
  code_secteur: 'SEC1',
  code_sous_secteur: null,
  code_cug: 'CUG1',
  numero_operation: null,
  nummarche: null,
  id_marche_tiers: null,
  id_fournisseur_retenu: 42,
  code_statut: 'FAD_TRANSMISE_RC_CDS',
  created_at: '2026-09-08T10:00:00Z',
  updated_at: '2026-09-08T10:00:00Z',
}

const decisionCdsMock = vi.fn()
const transmettreCbMock = vi.fn()
const getConsultationMock = vi.fn()
const getPiecesMock = vi.fn()

vi.mock('../../hooks/useDemandeAchat', () => ({
  decisionCds: (...args: unknown[]) => decisionCdsMock(...args),
  transmettreCb: (...args: unknown[]) => transmettreCbMock(...args),
  getConsultationDemandeAchat: (...args: unknown[]) => getConsultationMock(...args),
  // GestionDocumentaireModal (ouverte en consultation seule depuis cette modale) importe tout ce
  // module — voir TraiterFadRcModal.test.tsx pour la même remarque.
  updateDemandeAchat: vi.fn(),
  selectMarcheDemandeAchat: vi.fn(),
  addConsultationCandidat: vi.fn(),
  removeConsultationCandidat: vi.fn(),
  saveConsultationDemandeAchat: vi.fn(),
  getOrCreateMarcheDevis: vi.fn(),
  uploadDevisFile: vi.fn(),
  downloadDevisFileBlob: vi.fn(),
  deleteDevisFile: vi.fn(),
  getPiecesDemandeAchat: (...args: unknown[]) => getPiecesMock(...args),
  addPieceDemandeAchat: vi.fn(),
  removePieceDemandeAchat: vi.fn(),
  downloadPieceDemandeAchatBlob: vi.fn(),
  deleteDemandeAchat: vi.fn(),
}))

vi.mock('../../hooks/useFournisseurs', () => ({
  useFournisseurs: () => ({
    fournisseurs: [
      { id_fournisseur: 42, id_service: 10, raison_sociale_service: 'ACME', etatfournisseur: 'Actif' },
      { id_fournisseur: 43, id_service: 10, raison_sociale_service: 'BETA SERVICES', etatfournisseur: 'Actif' },
    ],
    loading: false,
  }),
}))
vi.mock('../../hooks/useMarches', () => ({
  useMarches: () => ({
    marches: [{ nummarche: 'M2026001', libelle_service: 'Fourniture de bureau', actif: true, completude: true, utilisable: true, typeproc: 'AO', typedecompoprix: null, naturepresta: null, libpgi: null, titulaire: null, fournisseur_raison_sociale: 'ACME', agentgestion: null, planpreventionactif: null, code_cug: null, dtevalid: null, dtenotif: null, dtedebut: null, dtefinmax: null, mtmaxi: null, mt_solde: null, alertemt: 0.8, alertedate: 30, nombre_pieces: 0 }],
    loading: false,
  }),
}))
vi.mock('../../hooks/useMarcheTiers', () => ({
  useMarcheTiers: () => ({ marcheTiers: [], loading: false }),
}))
vi.mock('../../hooks/useServices', () => ({
  useServices: () => ({ services: [{ id_service: 10, code_service: 'S1', libelle_service: 'Service Voyageurs', id_direction: 1, actif: true }], loading: false }),
}))
vi.mock('../../hooks/useLibelleReferentiel', () => ({
  useLibelleReferentiel: () => ({ items: [], loading: false }),
}))

const CANDIDATS: ConsultationCandidat[] = [
  { idDevis: 1, idFournisseur: 42, montantDevis: 980, delaiLivraison: null, ordre: 1, retenu: true, nomFichierOriginal: 'devis-acme.pdf', tailleOctets: 1000 },
  { idDevis: 2, idFournisseur: 43, montantDevis: 1200, delaiLivraison: null, ordre: 2, retenu: false, nomFichierOriginal: 'devis-beta.pdf', tailleOctets: 1200 },
]

beforeEach(() => {
  decisionCdsMock.mockReset()
  transmettreCbMock.mockReset()
  getConsultationMock.mockReset().mockResolvedValue(CANDIDATS)
  getPiecesMock.mockReset().mockResolvedValue([])
})

describe('ValiderCommandeCdsModal — FAD_TRANSMISE_RC_CDS (décision)', () => {
  it('affiche le résumé (objet, montant) et la liste des entreprises consultées (Hors Marché)', async () => {
    render(<ValiderCommandeCdsModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('Achat de fournitures diverses')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1 200,00 €')).toBeInTheDocument()
    expect(await screen.findByText('ACME')).toBeInTheDocument()
    expect(screen.getByText('BETA SERVICES')).toBeInTheDocument()
    expect(screen.getByText('980,00 €')).toBeInTheDocument()
    expect(screen.getByText('1 200,00 €')).toBeInTheDocument()
    expect(screen.getByText('Retenu')).toBeInTheDocument()
  })

  it('affiche numéro et libellé du marché (Marché)', () => {
    const daMarche: DemandeAchatRow = { ...DA, procedure_achat: 'MARCHE', nummarche: 'M2026001' }
    render(<ValiderCommandeCdsModal demandeAchat={daMarche} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByDisplayValue('M2026001')).toBeInTheDocument()
    expect(screen.getByText('Fourniture de bureau')).toBeInTheDocument()
  })

  it('propose Valider/Compléter/Rejeter/Annuler, jamais de bouton Transmettre à la CB', () => {
    render(<ValiderCommandeCdsModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Demander un complément' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejeter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transmettre à la CB' })).not.toBeInTheDocument()
  })

  it('refuse Rejeter sans commentaire', async () => {
    render(<ValiderCommandeCdsModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))

    expect(await screen.findByText('Un commentaire est requis pour justifier ce choix.')).toBeInTheDocument()
    expect(decisionCdsMock).not.toHaveBeenCalled()
  })

  it('Valider ne nécessite aucun commentaire et appelle decisionCds', async () => {
    const onSaved = vi.fn()
    decisionCdsMock.mockResolvedValue(DA)
    render(<ValiderCommandeCdsModal demandeAchat={DA} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    await waitFor(() => expect(decisionCdsMock).toHaveBeenCalledWith(1, { decision: 'VALIDER', commentaireStatut: undefined }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('Rejeter avec commentaire transmet le motif', async () => {
    decisionCdsMock.mockResolvedValue(DA)
    render(<ValiderCommandeCdsModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Commentaire (obligatoire sauf pour Valider)'), { target: { value: 'Hors budget' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }))

    await waitFor(() => expect(decisionCdsMock).toHaveBeenCalledWith(1, { decision: 'REJETER', commentaireStatut: 'Hors budget' }))
  })

  it('Gestion documentaire (consultation seule) est désactivée sans fournisseur retenu, activée sinon', () => {
    const sansFournisseur: DemandeAchatRow = { ...DA, id_fournisseur_retenu: null }
    render(<ValiderCommandeCdsModal demandeAchat={sansFournisseur} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Gestion documentaire' })).toBeDisabled()
  })

  it('Gestion documentaire ouvre en consultation seule (pas de bouton Ajouter/Supprimer)', async () => {
    render(<ValiderCommandeCdsModal demandeAchat={DA} onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Gestion documentaire' }))

    expect(await screen.findByRole('dialog', { name: 'Gestion documentaire' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ajouter le devis|Remplacer le devis/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer le devis' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Télécharger le devis — ACME' })).toBeInTheDocument()
  })
})

describe('ValiderCommandeCdsModal — FAD_VALIDEE_CDS (transmettre à la CB)', () => {
  const FAD_VALIDEE: DemandeAchatRow = { ...DA, code_statut: 'FAD_VALIDEE_CDS' }

  it('propose uniquement Transmettre à la CB, pas les 4 boutons de décision ni de commentaire', () => {
    render(<ValiderCommandeCdsModal demandeAchat={FAD_VALIDEE} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Transmettre à la CB' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejeter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Commentaire (obligatoire sauf pour Valider)')).not.toBeInTheDocument()
  })

  it('Transmettre à la CB appelle transmettreCb sans commentaire', async () => {
    const onSaved = vi.fn()
    transmettreCbMock.mockResolvedValue(FAD_VALIDEE)
    render(<ValiderCommandeCdsModal demandeAchat={FAD_VALIDEE} onClose={vi.fn()} onSaved={onSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Transmettre à la CB' }))

    await waitFor(() => expect(transmettreCbMock).toHaveBeenCalledWith(1))
    expect(onSaved).toHaveBeenCalled()
  })
})
