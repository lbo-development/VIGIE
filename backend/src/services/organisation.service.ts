import { z } from 'zod'
import * as directionRepository from '../repositories/direction.repository.js'
import * as serviceRepository from '../repositories/service.repository.js'
import * as celluleRepository from '../repositories/cellule.repository.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Référentiel organisationnel (DIRECTION/SERVICE/CELLULE). Lecture ouverte à
 * tout authenticated rattaché (déjà consommé ailleurs pour peupler des
 * filtres/sélecteurs) ; écriture réservée ADMIN_APP (requireRole('ADMIN_APP')
 * sur les routes POST/PUT — voir directions.routes.ts, services.routes.ts,
 * cellules.routes.ts) — contrairement à SITE/SECTEUR, pas de périmètre
 * ADMIN_SERVICE : DIRECTION/SERVICE/CELLULE sont la hiérarchie elle-même,
 * leur gestion est nécessairement transverse.
 *
 * Nommé "organisation" plutôt que "service" pour éviter la confusion avec la
 * couche services/ elle-même — voir docs/ARCHITECTURE.md. CODE_* est une clé
 * métier UNIQUE mutable (pas la PK — voir ForClaude/CDC/mld-phases-1-2.md
 * §2.1), donc éditable en modification, contrairement à SITE/SOUS_SITE dont
 * le code est la clé primaire immuable.
 */

const createDirectionSchema = z.object({
  codeDirection: z.string().trim().min(1).max(20),
  libelleDirection: z.string().trim().min(1).max(200),
})

const updateDirectionSchema = z.object({
  codeDirection: z.string().trim().min(1).max(20).optional(),
  libelleDirection: z.string().trim().min(1).max(200).optional(),
})

const createServiceSchema = z.object({
  codeService: z.string().trim().min(1).max(20),
  libelleService: z.string().trim().min(1).max(200),
  idDirection: z.number().int(),
})

const updateServiceSchema = z.object({
  codeService: z.string().trim().min(1).max(20).optional(),
  libelleService: z.string().trim().min(1).max(200).optional(),
  idDirection: z.number().int().optional(),
})

const createCelluleSchema = z.object({
  codeCellule: z.string().trim().min(1).max(20),
  libelleCellule: z.string().trim().min(1).max(200),
  idService: z.number().int(),
})

const updateCelluleSchema = z.object({
  codeCellule: z.string().trim().min(1).max(20).optional(),
  libelleCellule: z.string().trim().min(1).max(200).optional(),
  idService: z.number().int().optional(),
})

export function listDirections() {
  return directionRepository.findAll()
}

export function listServices() {
  return serviceRepository.findAll()
}

export function listCellules() {
  return celluleRepository.findAll()
}

export async function createDirection(input: unknown) {
  const result = createDirectionSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await directionRepository.findByCode(result.data.codeDirection)
  if (existing) throw new AppError(`La direction "${result.data.codeDirection}" existe déjà`, 409)

  return directionRepository.create({
    code_direction: result.data.codeDirection,
    libelle_direction: result.data.libelleDirection,
  })
}

export async function updateDirection(idDirection: number, input: unknown) {
  const result = updateDirectionSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const direction = await directionRepository.findById(idDirection)
  if (!direction) throw new AppError('Direction introuvable', 404)

  if (result.data.codeDirection !== undefined && result.data.codeDirection !== direction.code_direction) {
    const existing = await directionRepository.findByCode(result.data.codeDirection)
    if (existing) throw new AppError(`La direction "${result.data.codeDirection}" existe déjà`, 409)
  }

  return directionRepository.update(idDirection, {
    code_direction: result.data.codeDirection,
    libelle_direction: result.data.libelleDirection,
  })
}

export async function createService(input: unknown) {
  const result = createServiceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await serviceRepository.findByCode(result.data.codeService)
  if (existing) throw new AppError(`Le service "${result.data.codeService}" existe déjà`, 409)

  const direction = await directionRepository.findById(result.data.idDirection)
  if (!direction) throw new AppError('Direction introuvable', 404)

  return serviceRepository.create({
    code_service: result.data.codeService,
    libelle_service: result.data.libelleService,
    id_direction: result.data.idDirection,
  })
}

export async function updateService(idService: number, input: unknown) {
  const result = updateServiceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const service = await serviceRepository.findById(idService)
  if (!service) throw new AppError('Service introuvable', 404)

  if (result.data.codeService !== undefined && result.data.codeService !== service.code_service) {
    const existing = await serviceRepository.findByCode(result.data.codeService)
    if (existing) throw new AppError(`Le service "${result.data.codeService}" existe déjà`, 409)
  }

  if (result.data.idDirection !== undefined) {
    const direction = await directionRepository.findById(result.data.idDirection)
    if (!direction) throw new AppError('Direction introuvable', 404)
  }

  return serviceRepository.update(idService, {
    code_service: result.data.codeService,
    libelle_service: result.data.libelleService,
    id_direction: result.data.idDirection,
  })
}

export async function createCellule(input: unknown) {
  const result = createCelluleSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const existing = await celluleRepository.findByCode(result.data.codeCellule)
  if (existing) throw new AppError(`La cellule "${result.data.codeCellule}" existe déjà`, 409)

  const service = await serviceRepository.findById(result.data.idService)
  if (!service) throw new AppError('Service introuvable', 404)

  return celluleRepository.create({
    code_cellule: result.data.codeCellule,
    libelle_cellule: result.data.libelleCellule,
    id_service: result.data.idService,
  })
}

export async function updateCellule(idCellule: number, input: unknown) {
  const result = updateCelluleSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const cellule = await celluleRepository.findById(idCellule)
  if (!cellule) throw new AppError('Cellule introuvable', 404)

  if (result.data.codeCellule !== undefined && result.data.codeCellule !== cellule.code_cellule) {
    const existing = await celluleRepository.findByCode(result.data.codeCellule)
    if (existing) throw new AppError(`La cellule "${result.data.codeCellule}" existe déjà`, 409)
  }

  if (result.data.idService !== undefined) {
    const service = await serviceRepository.findById(result.data.idService)
    if (!service) throw new AppError('Service introuvable', 404)
  }

  return celluleRepository.update(idCellule, {
    code_cellule: result.data.codeCellule,
    libelle_cellule: result.data.libelleCellule,
    id_service: result.data.idService,
  })
}
