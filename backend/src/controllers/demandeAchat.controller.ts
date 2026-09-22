import type { NextFunction, Request, Response } from 'express'
import * as demandeAchatService from '../services/demandeAchat.service.js'
import { AppError } from '../middlewares/errorHandler.js'

function parseId(raw: string): number {
  const id = Number(raw)
  return Number.isFinite(id) ? id : NaN
}

export async function postDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const demandeAchat = await demandeAchatService.createDemandeAchat(req.matricule ?? null, req.body)
    res.status(201).json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

const ACCUEIL_SCOPES = new Set([
  'A_FINALISER',
  'SUIVI_FAD',
  'A_TRAITER',
  'EN_COURS',
  'A_TRAITER_CDS',
  'EN_COURS_CDS',
  'A_TRAITER_CB',
  'EN_COURS_CB',
  'A_TRAITER_DS',
  'EN_COURS_DS',
  'FAD_COMMANDEES',
  'REJETEES_ANNULEES',
])

/** Écrans de suivi CDS/CB/DS (décisions du 16/09/2026, 18/09/2026 puis 22/09/2026) — voir demandeAchat.service.ts#resolveAccessContext. */
function parseRoleHint(raw: unknown): 'CDS' | 'CB' | 'DS' | undefined {
  return raw === 'CDS' || raw === 'CB' || raw === 'DS' ? raw : undefined
}

export async function getDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const idCelluleRaw = req.query.idCellule
    const idCellule = typeof idCelluleRaw === 'string' && idCelluleRaw.trim() !== '' ? Number(idCelluleRaw) : undefined
    const idFournisseurRetenuRaw = req.query.idFournisseurRetenu
    const idFournisseurRetenu = typeof idFournisseurRetenuRaw === 'string' && idFournisseurRetenuRaw.trim() !== '' ? Number(idFournisseurRetenuRaw) : undefined
    const scopeRaw = req.query.scope
    const scope = typeof scopeRaw === 'string' && ACCUEIL_SCOPES.has(scopeRaw) ? (scopeRaw as demandeAchatService.AccueilScope) : undefined
    // Écrans de suivi CDS/CB (décisions du 16/09/2026 puis 18/09/2026) — voir demandeAchat.service.ts#resolveAccessContext.
    const role = parseRoleHint(req.query.role)

    const demandesAchat = await demandeAchatService.listDemandeAchat(req.matricule ?? null, {
      idCellule: idCellule !== undefined && Number.isFinite(idCellule) ? idCellule : undefined,
      matriculeDemandeur: typeof req.query.matriculeDemandeur === 'string' ? req.query.matriculeDemandeur : undefined,
      statut: typeof req.query.statut === 'string' ? req.query.statut : undefined,
      scope,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      idFournisseurRetenu: idFournisseurRetenu !== undefined && Number.isFinite(idFournisseurRetenu) ? idFournisseurRetenu : undefined,
      role,
    })
    res.json(demandesAchat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatSynthese(req: Request, res: Response, next: NextFunction) {
  try {
    const role = parseRoleHint(req.query.role)
    const synthese = await demandeAchatService.getSynthese(req.matricule ?? null, role)
    res.json(synthese)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.getDemandeAchat(req.matricule ?? null, id)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function putDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.updateDemandeAchat(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatHistorique(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    // Écrans de suivi CDS/CB (décisions du 17/09/2026 puis 18/09/2026) — voir demandeAchat.service.ts#getHistoriqueStatuts.
    const role = parseRoleHint(req.query.role)
    const historique = await demandeAchatService.getHistoriqueStatuts(req.matricule ?? null, id, role)
    res.json(historique)
  } catch (err) {
    next(err)
  }
}

export async function putDemandeAchatMarche(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.selectMarcheDemandeAchat(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatConsultation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    // Écran de suivi CB (décision du 18/09/2026) — GestionDocumentaireModal.tsx en a besoin pour
    // construire sa liste de fournisseurs, voir demandeAchat.service.ts#listConsultationDemandeAchat.
    const role = parseRoleHint(req.query.role)
    const candidats = await demandeAchatService.listConsultationDemandeAchat(req.matricule ?? null, id, role)
    res.json(candidats)
  } catch (err) {
    next(err)
  }
}

export async function putDemandeAchatConsultation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.saveConsultationDemandeAchat(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatTransmettreRc(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.transmettreRc(req.matricule ?? null, id)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatDecisionRc(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.decisionRc(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatDevaliderRc(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.devaliderRc(req.matricule ?? null, id)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatTransmettreFad(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.transmettreFad(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function putDemandeAchatFad(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.enregistrerFad(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatDecisionCds(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.decisionCds(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatTransmettreCb(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.transmettreCb(req.matricule ?? null, id)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatDecisionCb(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.decisionCb(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatRetransmettreCb(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.retransmettreCb(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatTransmettreDsOuSeuil(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.transmettreDsOuSeuil(req.matricule ?? null, id)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatDecisionDs(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.decisionDs(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatTransmettreOrdreCb(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.transmettreOrdreCb(req.matricule ?? null, id)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatCompleterCb(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.completerCb(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatCommander(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const demandeAchat = await demandeAchatService.commander(req.matricule ?? null, id, req.body)
    res.json(demandeAchat)
  } catch (err) {
    next(err)
  }
}

export async function deleteDemandeAchat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    await demandeAchatService.deleteDemandeAchat(req.matricule ?? null, id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function postConsultationCandidat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const candidat = await demandeAchatService.addConsultationCandidat(req.matricule ?? null, id, req.body)
    res.status(201).json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function deleteConsultationCandidat(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    await demandeAchatService.removeConsultationCandidat(req.matricule ?? null, id, idDevis)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function postMarcheDevis(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const candidat = await demandeAchatService.getOrCreateMarcheDevis(req.matricule ?? null, id)
    res.json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function postDevisFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    if (!req.file) throw new AppError('Aucun fichier reçu.', 400)
    const file = { buffer: req.file.buffer, size: req.file.size, originalname: req.file.originalname }
    const candidat = await demandeAchatService.uploadDevisFile(req.matricule ?? null, id, idDevis, file)
    res.json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function getDevisFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    // Écran de suivi CB (décision du 18/09/2026) — le devis reste verrouillé pour la CB mais le
    // téléchargement doit rester accessible, voir demandeAchat.service.ts#downloadDevisFile.
    const role = parseRoleHint(req.query.role)
    const { buffer, nomFichier } = await demandeAchatService.downloadDevisFile(req.matricule ?? null, id, idDevis, role)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

export async function deleteDevisFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idDevis = parseId(req.params.idDevis)
    const candidat = await demandeAchatService.deleteDevisFile(req.matricule ?? null, id, idDevis)
    res.json(candidat)
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatPieces(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idFournisseurRaw = req.query.idFournisseur
    const idFournisseur = typeof idFournisseurRaw === 'string' ? Number(idFournisseurRaw) : NaN
    if (!Number.isFinite(idFournisseur)) throw new AppError('idFournisseur requis.', 400)
    const role = parseRoleHint(req.query.role)
    const pieces = await demandeAchatService.listPiecesDemandeAchat(req.matricule ?? null, id, idFournisseur, role)
    res.json(pieces)
  } catch (err) {
    next(err)
  }
}

export async function postDemandeAchatPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const file = req.file ? { buffer: req.file.buffer, size: req.file.size, originalname: req.file.originalname } : undefined
    // Écran de suivi CB (décision du 18/09/2026) — pièces éditables tant que la CB est « pour
    // action », voir demandeAchat.service.ts#STATUTS_PIECES_MODIFIABLES.
    const role = parseRoleHint(req.query.role)
    const piece = await demandeAchatService.addPieceDemandeAchat(req.matricule ?? null, id, req.body, file, role)
    res.status(201).json(piece)
  } catch (err) {
    next(err)
  }
}

export async function deleteDemandeAchatPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idPiece = parseId(req.params.idPiece)
    const role = parseRoleHint(req.query.role)
    await demandeAchatService.removePieceDemandeAchat(req.matricule ?? null, id, idPiece, role)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function getDemandeAchatPieceFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idPiece = parseId(req.params.idPiece)
    const role = parseRoleHint(req.query.role)
    const { buffer, nomFichier } = await demandeAchatService.downloadPieceDemandeAchat(req.matricule ?? null, id, idPiece, role)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

/** Fiche FAD papier (PDF) — bouton réservé au rôle CB, décision du 19/09/2026. Jamais stockée, générée à la volée à chaque appel — voir demandeAchat.service.ts#genererFadPdf. */
export async function getDemandeAchatFadPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const { buffer, nomFichier } = await demandeAchatService.genererFadPdf(req.matricule ?? null, id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}
