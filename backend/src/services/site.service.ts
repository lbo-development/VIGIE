import { z } from 'zod'
import * as siteRepository from '../repositories/site.repository.js'
import * as sousSiteRepository from '../repositories/sousSite.repository.js'
import type { SousSite } from '../repositories/sousSite.repository.js'
import { assertManagesService } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'

const createSiteSchema = z.object({
  codeSite: z.string().trim().min(1).max(20),
  libSite: z.string().trim().min(1).max(200),
  ordreSite: z.number().int().min(0).default(0),
  idService: z.number().int(),
  actif: z.boolean().default(true),
})

const updateSiteSchema = z.object({
  libSite: z.string().trim().min(1).max(200).optional(),
  ordreSite: z.number().int().min(0).optional(),
  idService: z.number().int().optional(),
  actif: z.boolean().optional(),
})

const reorderSitesSchema = z.object({
  idService: z.number().int(),
  codeSites: z.array(z.string().min(1)).min(1),
})

export interface SiteWithSousSites extends siteRepository.Site {
  sous_sites: SousSite[]
}

export async function listSites(idService?: number): Promise<SiteWithSousSites[]> {
  const sites = await siteRepository.findAll(idService)
  const sousSites = await sousSiteRepository.findBySites(sites.map((site) => site.code_site))

  const byCodeSite = new Map<string, SousSite[]>()
  for (const sousSite of sousSites) {
    const list = byCodeSite.get(sousSite.code_site) ?? []
    list.push(sousSite)
    byCodeSite.set(sousSite.code_site, list)
  }

  return sites.map((site) => ({ ...site, sous_sites: byCodeSite.get(site.code_site) ?? [] }))
}

export async function createSite(matricule: string | null, input: unknown) {
  const result = createSiteSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesService(matricule, result.data.idService)

  const existing = await siteRepository.findByCode(result.data.codeSite)
  if (existing) throw new AppError(`Le site "${result.data.codeSite}" existe déjà`, 409)

  return siteRepository.create({
    code_site: result.data.codeSite,
    lib_site: result.data.libSite,
    ordre_site: result.data.ordreSite,
    id_service: result.data.idService,
    actif: result.data.actif,
  })
}

export async function updateSite(matricule: string | null, codeSite: string, input: unknown) {
  const result = updateSiteSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  const site = await siteRepository.findByCode(codeSite)
  if (!site) throw new AppError('Site introuvable', 404)

  // Droit sur le service actuel, et sur le service cible aussi si on déplace le site.
  await assertManagesService(matricule, site.id_service)
  if (result.data.idService !== undefined && result.data.idService !== site.id_service) {
    await assertManagesService(matricule, result.data.idService)
  }

  return siteRepository.update(codeSite, {
    lib_site: result.data.libSite,
    ordre_site: result.data.ordreSite,
    id_service: result.data.idService,
    actif: result.data.actif,
  })
}

/**
 * Réordonne des sites d'un même service (glisser-déposer côté écran — voir
 * frontend/src/hooks/useDragReorder.ts). Le glisser-déposer n'est proposé
 * côté écran que sur une vue filtrée par service : cette fonction refuse
 * explicitement tout site qui n'appartient pas au service annoncé plutôt que
 * de faire confiance à l'ordre reçu (le payload pourrait avoir été manipulé).
 */
export async function reorderSites(matricule: string | null, input: unknown) {
  const result = reorderSitesSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesService(matricule, result.data.idService)

  const sites = await Promise.all(result.data.codeSites.map((code) => siteRepository.findByCode(code)))
  const allBelongToService = sites.every((site) => site && site.id_service === result.data.idService)
  if (!allBelongToService) {
    throw new AppError("Un des sites ne correspond pas au service indiqué.", 400)
  }

  await siteRepository.reorder(result.data.codeSites)
}

/**
 * Vérifie le droit de gestion sur le service auquel appartient codeSite —
 * réutilisé par sousSite.service.ts (un sous-site hérite du périmètre de son
 * site parent, il n'a pas de service propre).
 */
export async function assertManagesSite(matricule: string | null, codeSite: string): Promise<siteRepository.Site> {
  const site = await siteRepository.findByCode(codeSite)
  if (!site) throw new AppError('Site introuvable', 404)
  await assertManagesService(matricule, site.id_service)
  return site
}
