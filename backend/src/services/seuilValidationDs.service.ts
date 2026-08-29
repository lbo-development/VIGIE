import { z } from 'zod'
import * as seuilRepository from '../repositories/seuilValidationDs.repository.js'
import * as serviceRepository from '../repositories/service.repository.js'
import { assertManagesService } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Écriture ouverte à ADMIN_APP (transverse) ou ADMIN_SERVICE scopé au
 * service visé — même règle que SITE/SOUS_SITE et SECTEUR/SOUS_SECTEUR (voir
 * assertManagesService), décision du 29/08/2026 qui remplace la restriction
 * ADMIN_APP seul du 28/08/2026 (voir ForClaude/CDC/mld-phases-1-2.md §2.6).
 */

// Nombres entiers uniquement (décision utilisateur, saisie sans virgule ni
// point côté écran — voir SeuilsValidationDs.tsx) : validé aussi côté
// backend, la validation client n'étant jamais une garantie suffisante
// (ForClaude/SECURITY.md §3).
const upsertSeuilSchema = z.object({
  seuilFonctionnement: z.number().int().min(0),
  seuilInvestissement: z.number().int().min(0),
})

export function listSeuils() {
  return seuilRepository.findAll()
}

export async function upsertSeuil(matricule: string | null, idService: number, input: unknown) {
  const result = upsertSeuilSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const service = await serviceRepository.findById(idService)
  if (!service) throw new AppError('Service introuvable', 404)

  await assertManagesService(matricule, idService)

  return seuilRepository.upsert({
    id_service: idService,
    seuil_fonctionnement: result.data.seuilFonctionnement,
    seuil_investissement: result.data.seuilInvestissement,
  })
}
