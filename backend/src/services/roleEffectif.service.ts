import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as suppleanceRepository from '../repositories/suppleance.repository.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { TypeRole } from '../repositories/roleAttribution.repository.js'

/**
 * Résolution du rôle effectif (titulaire ou suppléant) d'un acteur, avec son
 * périmètre — brique commune aux transitions de statut OP1.2 à OP1.5
 * (ForClaude/CDC/mct-phases-1-2.md). Contrairement à
 * auth.repository.ts#hasActiveRole/hasActiveRoleForService (booléen seul),
 * expose le périmètre exact (id_cellule/id_service/id_direction) et
 * l'ID_SUPPLEANCE à tracer dans HISTORIQUE_STATUT.ID_SUPPLEANCE quand
 * l'acteur agit en tant que suppléant.
 *
 * Décision validée le 15/09/2026 (chantier écran d'accueil/workflow FAD) :
 * aucun override ADMIN_APP sur ces décisions métier (contrairement à OP1.1,
 * où ADMIN_APP/ADMIN_SERVICE peuvent agir pour un tiers) — assertHasEffectiveRole
 * ne matche donc jamais que le type de rôle demandé (RC/CDS/CB/DS),
 * strictement le titulaire ou son suppléant désigné.
 */

export interface EffectiveRole {
  idRole: number
  typeRole: TypeRole
  idCellule: number | null
  idService: number | null
  idDirection: number | null
  /** ID_SUPPLEANCE si l'acteur agit en tant que suppléant, `null` s'il agit en tant que titulaire. */
  idSuppleance: number | null
}

/** Rôles directement détenus (role_attribution actifs) + rôles hérités par suppléance active — un acteur peut cumuler les deux (ex. titulaire RC d'une cellule, suppléant RC d'une autre). */
export async function findEffectiveRoles(matricule: string): Promise<EffectiveRole[]> {
  const direct = await roleAttributionRepository.findActiveByMatricule(matricule)
  const directRoles: EffectiveRole[] = direct.map((r) => ({
    idRole: r.id_role,
    typeRole: r.type_role,
    idCellule: r.id_cellule,
    idService: r.id_service,
    idDirection: r.id_direction,
    idSuppleance: null,
  }))

  // CB exclue du dispositif de suppléance (verrouillé en base, migration 20260914170000) —
  // findActiveForSuppleant ne renverra jamais type_role='CB', pas besoin de l'exclure ici.
  const suppleances = await suppleanceRepository.findActiveForSuppleant(matricule)
  const suppleeRoles: EffectiveRole[] = suppleances.map((s) => ({
    idRole: s.id_role,
    typeRole: s.type_role,
    idCellule: s.id_cellule,
    idService: s.id_service,
    idDirection: s.id_direction,
    idSuppleance: s.id_suppleance,
  }))

  return [...directRoles, ...suppleeRoles]
}

function perimeterField(typeRole: TypeRole): 'idCellule' | 'idService' | 'idDirection' {
  if (typeRole === 'RC') return 'idCellule'
  if (typeRole === 'DS') return 'idDirection'
  return 'idService' // CDS, CB, ADMIN_SERVICE
}

/**
 * Lève 403 si aucun rôle effectif de `typeRole` ne couvre `perimeterId`
 * (id_cellule pour RC, id_service pour CDS/CB, id_direction pour DS) —
 * retourne le rôle trouvé (pour en extraire idSuppleance à tracer).
 */
export async function assertHasEffectiveRole(matricule: string | null, typeRole: TypeRole, perimeterId: number): Promise<EffectiveRole> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await findEffectiveRoles(matricule)
  const field = perimeterField(typeRole)
  const match = roles.find((r) => r.typeRole === typeRole && r[field] === perimeterId)
  if (!match) throw new AppError('Droits insuffisants', 403)
  return match
}
