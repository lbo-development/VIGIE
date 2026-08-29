import { z } from 'zod'
import * as sousSiteRepository from '../repositories/sousSite.repository.js'
import { assertManagesSite } from './site.service.js'
import { AppError } from '../middlewares/errorHandler.js'

const createSousSiteSchema = z.object({
  codeSousSite: z.string().trim().min(1).max(20),
  libSousSite: z.string().trim().min(1).max(200),
  ordreSousSite: z.number().int().min(0).default(0),
  actif: z.boolean().default(true),
})

const updateSousSiteSchema = z.object({
  libSousSite: z.string().trim().min(1).max(200).optional(),
  ordreSousSite: z.number().int().min(0).optional(),
  actif: z.boolean().optional(),
})

const reorderSousSitesSchema = z.object({
  codeSousSites: z.array(z.string().min(1)).min(1),
})

export async function createSousSite(matricule: string | null, codeSite: string, input: unknown) {
  const result = createSousSiteSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesSite(matricule, codeSite)

  return sousSiteRepository.create({
    code_site: codeSite,
    code_sous_site: result.data.codeSousSite,
    lib_sous_site: result.data.libSousSite,
    ordre_sous_site: result.data.ordreSousSite,
    actif: result.data.actif,
  })
}

export async function updateSousSite(matricule: string | null, codeSite: string, codeSousSite: string, input: unknown) {
  const result = updateSousSiteSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesSite(matricule, codeSite)

  return sousSiteRepository.update(codeSite, codeSousSite, {
    lib_sous_site: result.data.libSousSite,
    ordre_sous_site: result.data.ordreSousSite,
    actif: result.data.actif,
  })
}

/** Réordonne les sous-sites d'un site (glisser-déposer côté écran). */
export async function reorderSousSites(matricule: string | null, codeSite: string, input: unknown) {
  const result = reorderSousSitesSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesSite(matricule, codeSite)

  await sousSiteRepository.reorder(codeSite, result.data.codeSousSites)
}
