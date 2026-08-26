import { z } from 'zod'
import * as secteurRepository from '../repositories/secteur.repository.js'
import * as sousSecteurRepository from '../repositories/sousSecteur.repository.js'
import type { SousSecteur } from '../repositories/sousSecteur.repository.js'
import { assertManagesService } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'

const createSecteurSchema = z.object({
  codeSecteur: z.string().trim().min(1).max(20),
  libSecteur: z.string().trim().min(1).max(200),
  ordreSecteur: z.number().int().min(0).default(0),
  idService: z.number().int(),
  actif: z.boolean().default(true),
})

const updateSecteurSchema = z.object({
  libSecteur: z.string().trim().min(1).max(200).optional(),
  ordreSecteur: z.number().int().min(0).optional(),
  idService: z.number().int().optional(),
  actif: z.boolean().optional(),
})

const reorderSecteursSchema = z.object({
  idService: z.number().int(),
  codeSecteurs: z.array(z.string().min(1)).min(1),
})

export interface SecteurWithSousSecteurs extends secteurRepository.Secteur {
  sous_secteurs: SousSecteur[]
}

export async function listSecteurs(idService?: number): Promise<SecteurWithSousSecteurs[]> {
  const secteurs = await secteurRepository.findAll(idService)
  const sousSecteurs = await sousSecteurRepository.findBySecteurs(secteurs.map((secteur) => secteur.code_secteur))

  const byCodeSecteur = new Map<string, SousSecteur[]>()
  for (const sousSecteur of sousSecteurs) {
    const list = byCodeSecteur.get(sousSecteur.code_secteur) ?? []
    list.push(sousSecteur)
    byCodeSecteur.set(sousSecteur.code_secteur, list)
  }

  return secteurs.map((secteur) => ({ ...secteur, sous_secteurs: byCodeSecteur.get(secteur.code_secteur) ?? [] }))
}

export async function createSecteur(matricule: string | null, input: unknown) {
  const result = createSecteurSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesService(matricule, result.data.idService)

  const existing = await secteurRepository.findByCode(result.data.codeSecteur)
  if (existing) throw new AppError(`Le secteur "${result.data.codeSecteur}" existe déjà`, 409)

  return secteurRepository.create({
    code_secteur: result.data.codeSecteur,
    lib_secteur: result.data.libSecteur,
    ordre_secteur: result.data.ordreSecteur,
    id_service: result.data.idService,
    actif: result.data.actif,
  })
}

export async function updateSecteur(matricule: string | null, codeSecteur: string, input: unknown) {
  const result = updateSecteurSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  const secteur = await secteurRepository.findByCode(codeSecteur)
  if (!secteur) throw new AppError('Secteur introuvable', 404)

  // Droit sur le service actuel, et sur le service cible aussi si on déplace le secteur.
  await assertManagesService(matricule, secteur.id_service)
  if (result.data.idService !== undefined && result.data.idService !== secteur.id_service) {
    await assertManagesService(matricule, result.data.idService)
  }

  return secteurRepository.update(codeSecteur, {
    lib_secteur: result.data.libSecteur,
    ordre_secteur: result.data.ordreSecteur,
    id_service: result.data.idService,
    actif: result.data.actif,
  })
}

/**
 * Réordonne des secteurs d'un même service (glisser-déposer côté écran — voir
 * frontend/src/hooks/useDragReorder.ts). Le glisser-déposer n'est proposé
 * côté écran que sur une vue filtrée par service : cette fonction refuse
 * explicitement tout secteur qui n'appartient pas au service annoncé plutôt
 * que de faire confiance à l'ordre reçu (le payload pourrait avoir été
 * manipulé).
 */
export async function reorderSecteurs(matricule: string | null, input: unknown) {
  const result = reorderSecteursSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  await assertManagesService(matricule, result.data.idService)

  const secteurs = await Promise.all(result.data.codeSecteurs.map((code) => secteurRepository.findByCode(code)))
  const allBelongToService = secteurs.every((secteur) => secteur && secteur.id_service === result.data.idService)
  if (!allBelongToService) {
    throw new AppError('Un des secteurs ne correspond pas au service indiqué.', 400)
  }

  await secteurRepository.reorder(result.data.codeSecteurs)
}

/**
 * Vérifie le droit de gestion sur le service auquel appartient codeSecteur —
 * réutilisé par sousSecteur.service.ts (un sous-secteur hérite du périmètre
 * de son secteur parent, il n'a pas de service propre).
 */
export async function assertManagesSecteur(
  matricule: string | null,
  codeSecteur: string,
): Promise<secteurRepository.Secteur> {
  const secteur = await secteurRepository.findByCode(codeSecteur)
  if (!secteur) throw new AppError('Secteur introuvable', 404)
  await assertManagesService(matricule, secteur.id_service)
  return secteur
}
