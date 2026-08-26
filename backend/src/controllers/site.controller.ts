import type { NextFunction, Request, Response } from 'express'
import * as siteService from '../services/site.service.js'
import * as sousSiteService from '../services/sousSite.service.js'

export async function getSites(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.query.idService
    const idService = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : undefined
    const sites = await siteService.listSites(idService !== undefined && Number.isFinite(idService) ? idService : undefined)
    res.json(sites)
  } catch (err) {
    next(err)
  }
}

export async function postSite(req: Request, res: Response, next: NextFunction) {
  try {
    const site = await siteService.createSite(req.matricule ?? null, req.body)
    res.status(201).json(site)
  } catch (err) {
    next(err)
  }
}

export async function putSite(req: Request, res: Response, next: NextFunction) {
  try {
    const site = await siteService.updateSite(req.matricule ?? null, req.params.codeSite, req.body)
    res.json(site)
  } catch (err) {
    next(err)
  }
}

export async function putSitesReorder(req: Request, res: Response, next: NextFunction) {
  try {
    await siteService.reorderSites(req.matricule ?? null, req.body)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function postSousSite(req: Request, res: Response, next: NextFunction) {
  try {
    const sousSite = await sousSiteService.createSousSite(req.matricule ?? null, req.params.codeSite, req.body)
    res.status(201).json(sousSite)
  } catch (err) {
    next(err)
  }
}

export async function putSousSite(req: Request, res: Response, next: NextFunction) {
  try {
    const sousSite = await sousSiteService.updateSousSite(
      req.matricule ?? null,
      req.params.codeSite,
      req.params.codeSousSite,
      req.body,
    )
    res.json(sousSite)
  } catch (err) {
    next(err)
  }
}

export async function putSousSitesReorder(req: Request, res: Response, next: NextFunction) {
  try {
    await sousSiteService.reorderSousSites(req.matricule ?? null, req.params.codeSite, req.body)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
