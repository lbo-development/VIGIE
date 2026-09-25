import type { NextFunction, Request, Response } from 'express'
import * as certificatServiceFaitService from '../services/certificatServiceFait.service.js'
import { AppError } from '../middlewares/errorHandler.js'

function parseId(raw: string): number {
  const id = Number(raw)
  return Number.isFinite(id) ? id : NaN
}

export async function postCertificatServiceFait(req: Request, res: Response, next: NextFunction) {
  try {
    const idDemandeAchatRaw = req.body?.idDemandeAchat
    const idDemandeAchat = Number(idDemandeAchatRaw)
    if (!Number.isFinite(idDemandeAchat)) throw new AppError('idDemandeAchat requis.', 400)
    const csf = await certificatServiceFaitService.createCertificatServiceFait(req.matricule ?? null, idDemandeAchat)
    res.status(201).json(csf)
  } catch (err) {
    next(err)
  }
}

/** GET /certificats-service-fait — ?idDemandeAchat=123 (liste sous une FAD) ou ?scope=RC|CB (file de suivi). */
export async function getCertificatsServiceFait(req: Request, res: Response, next: NextFunction) {
  try {
    const idDemandeAchatRaw = req.query.idDemandeAchat
    const scopeRaw = req.query.scope

    if (typeof idDemandeAchatRaw === 'string' && idDemandeAchatRaw.trim() !== '') {
      const idDemandeAchat = Number(idDemandeAchatRaw)
      if (!Number.isFinite(idDemandeAchat)) throw new AppError('idDemandeAchat invalide.', 400)
      const csf = await certificatServiceFaitService.listCertificatsServiceFait(req.matricule ?? null, idDemandeAchat)
      res.json(csf)
      return
    }

    if (scopeRaw === 'CB') {
      const csf = await certificatServiceFaitService.listPourCb(req.matricule ?? null)
      res.json(csf)
      return
    }

    // Défaut : file RC (scope=RC ou absent).
    const csf = await certificatServiceFaitService.listPourRc(req.matricule ?? null)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

/** GET /certificats-service-fait/synthese-facturation — ?scope=RC|CB, défaut Demandeur (voir pages/Home.tsx, SuiviCsfRc.tsx, SuiviCsfCb.tsx). */
export async function getSyntheseFacturation(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = req.query.scope
    if (scope === 'RC') {
      res.json(await certificatServiceFaitService.getSyntheseFacturationRc(req.matricule ?? null))
      return
    }
    if (scope === 'CB') {
      res.json(await certificatServiceFaitService.getSyntheseFacturationCb(req.matricule ?? null))
      return
    }
    res.json(await certificatServiceFaitService.getSyntheseFacturationDemandeur(req.matricule ?? null))
  } catch (err) {
    next(err)
  }
}

export async function getCertificatServiceFaitById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.getCertificatServiceFait(req.matricule ?? null, id)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function putCertificatServiceFait(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.updateBrouillon(req.matricule ?? null, id, req.body)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function putCertificatServiceFaitRc(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.editerEnPlaceRc(req.matricule ?? null, id, req.body)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitTransmettreRc(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.transmettreRc(req.matricule ?? null, id, req.body)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitTransmettreBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.transmettreBudget(req.matricule ?? null, id)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitComplementRc(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.demanderComplementRc(req.matricule ?? null, id, req.body)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitRetransmettreBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.retransmettreBudget(req.matricule ?? null, id, req.body)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitValiderBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const result = await certificatServiceFaitService.validerBudget(req.matricule ?? null, id)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitComplementBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.demanderComplementBudget(req.matricule ?? null, id, req.body)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitLiquidation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const csf = await certificatServiceFaitService.constaterLiquidation(req.matricule ?? null, id)
    res.json(csf)
  } catch (err) {
    next(err)
  }
}

export async function deleteCertificatServiceFait(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    await certificatServiceFaitService.supprimer(req.matricule ?? null, id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function getCertificatServiceFaitHistorique(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const historique = await certificatServiceFaitService.getHistoriqueStatuts(req.matricule ?? null, id)
    res.json(historique)
  } catch (err) {
    next(err)
  }
}

export async function getCertificatServiceFaitPieces(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const pieces = await certificatServiceFaitService.listPieces(req.matricule ?? null, id)
    res.json(pieces)
  } catch (err) {
    next(err)
  }
}

export async function postCertificatServiceFaitPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const file = req.file ? { buffer: req.file.buffer, size: req.file.size, originalname: req.file.originalname } : undefined
    const piece = await certificatServiceFaitService.addPiece(req.matricule ?? null, id, req.body, file)
    res.status(201).json(piece)
  } catch (err) {
    next(err)
  }
}

export async function deleteCertificatServiceFaitPiece(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idPiece = parseId(req.params.idPiece)
    await certificatServiceFaitService.removePiece(req.matricule ?? null, id, idPiece)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function getCertificatServiceFaitPieceFichier(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id)
    const idPiece = parseId(req.params.idPiece)
    const { buffer, nomFichier } = await certificatServiceFaitService.downloadPiece(req.matricule ?? null, id, idPiece)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`)
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}
