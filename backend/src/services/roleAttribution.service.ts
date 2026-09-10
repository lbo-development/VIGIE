import { z } from 'zod'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as celluleRepository from '../repositories/cellule.repository.js'
import * as serviceRepository from '../repositories/service.repository.js'
import * as directionRepository from '../repositories/direction.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import { assertManagesService } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { RoleAttributionRow, TypeRole } from '../repositories/roleAttribution.repository.js'

/**
 * Attribution / clôture des rôles applicatifs (finances.role_attribution) —
 * jusqu'ici seulement déclarée au MOT, jamais implémentée. Décision du
 * 10/09/2026 (ForClaude/CDC/mot-phases-1-2.md, résout le point ouvert §92) :
 * ADMIN_SERVICE gère RC/CDS/CB/ADMIN_SERVICE de son propre service ;
 * ADMIN_APP gère tout, y compris DS — jamais de délégation ADMIN_SERVICE sur
 * DS. Jamais de suppression physique d'une attribution (historisation,
 * ForClaude/SECURITY.md §2.1, arbitrage 3) : seulement clôture (ACTIF=false).
 */

const TYPE_ROLES = ['RC', 'CDS', 'DS', 'CB', 'ADMIN_SERVICE', 'ADMIN_APP'] as const

const createRoleAttributionSchema = z
  .object({
    matricule: z.string().trim().min(1),
    typeRole: z.enum(TYPE_ROLES),
    idCellule: z.number().int().optional(),
    idService: z.number().int().optional(),
    idDirection: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    // Reflète exactement la contrainte CHECK chk_role_perimetre en base
    // (ForClaude/CDC/mld-phases-1-2.md §4) — validé ici pour renvoyer un 400
    // clair plutôt qu'une violation de contrainte Postgres.
    const has = { cellule: data.idCellule !== undefined, service: data.idService !== undefined, direction: data.idDirection !== undefined }
    const valid =
      (data.typeRole === 'RC' && has.cellule && !has.service && !has.direction) ||
      (['CDS', 'CB', 'ADMIN_SERVICE'].includes(data.typeRole) && has.service && !has.cellule && !has.direction) ||
      (data.typeRole === 'DS' && has.direction && !has.cellule && !has.service) ||
      (data.typeRole === 'ADMIN_APP' && !has.cellule && !has.service && !has.direction)
    if (!valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Périmètre invalide pour le type de rôle ${data.typeRole}.` })
    }
  })

/** Résout l'ID_SERVICE à opposer à assertManagesService — null pour DS/ADMIN_APP (gérés à part, ADMIN_APP seul, jamais de délégation ADMIN_SERVICE). */
async function resolveIdServiceForPermission(
  typeRole: TypeRole,
  perimeter: { idCellule?: number; idService?: number },
): Promise<number | null> {
  if (typeRole === 'RC') {
    const cellule = await celluleRepository.findById(perimeter.idCellule as number)
    if (!cellule) throw new AppError('Cellule introuvable', 404)
    return cellule.id_service
  }
  if (typeRole === 'CDS' || typeRole === 'CB' || typeRole === 'ADMIN_SERVICE') {
    return perimeter.idService as number
  }
  return null
}

async function assertCanManage(matricule: string | null, typeRole: TypeRole, idServiceForPermission: number | null): Promise<void> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  if (typeRole === 'DS' || typeRole === 'ADMIN_APP') {
    if (!(await authRepository.hasActiveRole(matricule, 'ADMIN_APP'))) {
      throw new AppError('Droits insuffisants — l\'attribution de ce rôle est réservée à ADMIN_APP.', 403)
    }
    return
  }

  await assertManagesService(matricule, idServiceForPermission)
}

export interface RoleAttributionView {
  idRole: number
  matricule: string
  nom: string | null
  prenom: string | null
  typeRole: TypeRole
  perimeterLabel: string | null
  idCellule: number | null
  idService: number | null
  idDirection: number | null
  dateDebut: string
}

async function enrich(rows: RoleAttributionRow[]): Promise<RoleAttributionView[]> {
  const matricules = [...new Set(rows.map((r) => r.matricule))]
  const acteurs = await acteurRepository.findByMatricules(matricules)
  const acteurByMatricule = new Map(acteurs.map((a) => [a.matricule, a]))

  return Promise.all(
    rows.map(async (r) => ({
      idRole: r.id_role,
      matricule: r.matricule,
      nom: acteurByMatricule.get(r.matricule)?.nom ?? null,
      prenom: acteurByMatricule.get(r.matricule)?.prenom ?? null,
      typeRole: r.type_role,
      perimeterLabel: await roleAttributionRepository.resolvePerimeterLabel(r),
      idCellule: r.id_cellule,
      idService: r.id_service,
      idDirection: r.id_direction,
      dateDebut: r.date_debut,
    })),
  )
}

/**
 * Périmètre de lecture : ADMIN_APP voit toutes les attributions actives
 * (transverse) ; ADMIN_SERVICE ne voit que celles de son propre service
 * (CDS/CB/ADMIN_SERVICE) et des cellules de ce service (RC) ; tout autre
 * appelant (RC/CDS/CB/Demandeur) n'a pas accès à cet écran d'administration.
 */
export async function listAttributions(matricule: string | null): Promise<RoleAttributionView[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  if (await authRepository.hasActiveRole(matricule, 'ADMIN_APP')) {
    return enrich(await roleAttributionRepository.findAllActive())
  }

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  const adminService = roles.find((r) => r.type_role === 'ADMIN_SERVICE' && r.id_service !== null)
  if (!adminService) throw new AppError('Droits insuffisants', 403)

  const idService = adminService.id_service as number
  const cellules = await celluleRepository.findAll()
  const celluleIds = cellules.filter((c) => c.id_service === idService).map((c) => c.id_cellule)

  const [byService, byCellules] = await Promise.all([
    roleAttributionRepository.findActiveByService(idService),
    roleAttributionRepository.findActiveByCellules(celluleIds),
  ])

  return enrich([...byService, ...byCellules])
}

export async function createAttribution(matricule: string | null, input: unknown): Promise<RoleAttributionView> {
  const result = createRoleAttributionSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const { typeRole, matricule: targetMatricule, idCellule, idService, idDirection } = result.data

  const idServiceForPermission = await resolveIdServiceForPermission(typeRole, { idCellule, idService })
  await assertCanManage(matricule, typeRole, idServiceForPermission)

  const targetActeur = await acteurRepository.findByMatricule(targetMatricule)
  if (!targetActeur) throw new AppError('Acteur introuvable', 404)

  if (typeRole === 'DS') {
    const direction = await directionRepository.findById(idDirection as number)
    if (!direction) throw new AppError('Direction introuvable', 404)
  } else if (typeRole === 'CDS' || typeRole === 'CB' || typeRole === 'ADMIN_SERVICE') {
    const service = await serviceRepository.findById(idService as number)
    if (!service) throw new AppError('Service introuvable', 404)
  }

  if (typeRole === 'RC' || typeRole === 'CDS' || typeRole === 'DS') {
    const existingActive = await roleAttributionRepository.findActiveForPerimeter(typeRole, {
      id_cellule: typeRole === 'RC' ? idCellule : undefined,
      id_service: typeRole === 'CDS' ? idService : undefined,
      id_direction: typeRole === 'DS' ? idDirection : undefined,
    })
    if (existingActive) {
      throw new AppError('Un titulaire actif existe déjà pour ce périmètre — désactivez-le avant d\'en attribuer un nouveau.', 409)
    }
  }

  const created = await roleAttributionRepository.create({
    matricule: targetMatricule,
    type_role: typeRole,
    id_cellule: typeRole === 'RC' ? (idCellule as number) : null,
    id_service: typeRole === 'CDS' || typeRole === 'CB' || typeRole === 'ADMIN_SERVICE' ? (idService as number) : null,
    id_direction: typeRole === 'DS' ? (idDirection as number) : null,
  })

  const [view] = await enrich([created])
  return view
}

export async function deactivateAttribution(matricule: string | null, idRole: number): Promise<RoleAttributionView> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const row = await roleAttributionRepository.findById(idRole)
  if (!row) throw new AppError('Attribution introuvable', 404)
  if (!row.actif) throw new AppError('Cette attribution est déjà clôturée', 409)

  const idServiceForPermission =
    row.type_role === 'RC' && row.id_cellule !== null
      ? ((await celluleRepository.findById(row.id_cellule))?.id_service ?? null)
      : row.id_service

  await assertCanManage(matricule, row.type_role, idServiceForPermission)

  const updated = await roleAttributionRepository.deactivate(idRole)
  const [view] = await enrich([updated])
  return view
}
