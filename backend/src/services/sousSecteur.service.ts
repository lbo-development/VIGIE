import { z } from 'zod'
import * as sousSecteurRepository from '../repositories/sousSecteur.repository.js'
import { assertManagesSecteur } from './secteur.service.js'
import { AppError } from '../middlewares/errorHandler.js'

const createSousSecteurSchema = z.object({
  codeSousSecteur: z.string().trim().min(1).max(20),
  ordreSousSecteur: z.number().int().min(0).default(0),
  actif: z.boolean().default(true),
})

const updateSousSecteurSchema = z.object({
  ordreSousSecteur: z.number().int().min(0).optional(),
  actif: z.boolean().optional(),
})

const reorderSousSecteursSchema = z.object({
  codeSousSecteurs: z.array(z.string().min(1)).min(1),
})

export async function createSousSecteur(matricule: string | null, codeSecteur: string, input: unknown) {
  const result = createSousSecteurSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesSecteur(matricule, codeSecteur)

  return sousSecteurRepository.create({
    code_secteur: codeSecteur,
    code_sous_secteur: result.data.codeSousSecteur,
    ordre_sous_secteur: result.data.ordreSousSecteur,
    actif: result.data.actif,
  })
}

export async function updateSousSecteur(
  matricule: string | null,
  codeSecteur: string,
  codeSousSecteur: string,
  input: unknown,
) {
  const result = updateSousSecteurSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesSecteur(matricule, codeSecteur)

  return sousSecteurRepository.update(codeSecteur, codeSousSecteur, {
    ordre_sous_secteur: result.data.ordreSousSecteur,
    actif: result.data.actif,
  })
}

/** Réordonne les sous-secteurs d'un secteur (glisser-déposer côté écran). */
export async function reorderSousSecteurs(matricule: string | null, codeSecteur: string, input: unknown) {
  const result = reorderSousSecteursSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesSecteur(matricule, codeSecteur)

  await sousSecteurRepository.reorder(codeSecteur, result.data.codeSousSecteurs)
}
