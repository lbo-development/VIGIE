import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as suppleanceRepository from '../repositories/suppleance.repository.js'
import { AppError } from '../middlewares/errorHandler.js'
import { formatDateFr } from '../utils/dates.js'
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
 *
 * Décision du 20/09/2026 : un titulaire actuellement suppléé est en LECTURE
 * SEULE sur ce rôle (`lectureSeule`). Il le voit toujours dans ses rôles
 * effectifs (la consultation de son périmètre est conservée), mais
 * assertHasEffectiveRole — utilisée par toutes les écritures métier — le refuse.
 */

export interface EffectiveRole {
  idRole: number
  typeRole: TypeRole
  idCellule: number | null
  idService: number | null
  idDirection: number | null
  /** ID_SUPPLEANCE si l'acteur agit en tant que suppléant, `null` s'il agit en tant que titulaire. */
  idSuppleance: number | null
  /** `true` : titulaire actuellement suppléé, donc en lecture seule sur ce rôle. Toujours `false` pour un suppléant. */
  lectureSeule: boolean
  /** Titulaire suppléé : matricule de son suppléant. `null` sinon. */
  matriculeSuppleant: string | null
  /** Suppléant : matricule du titulaire qu'il supplée. `null` pour un rôle détenu en propre. */
  matriculeTitulaire: string | null
  /** Date de fin (AAAA-MM-JJ, incluse) de la suppléance active qui concerne ce rôle — côté titulaire suppléé comme côté suppléant. */
  suppleanceDateFin: string | null
}

const SUPPLEABLE: readonly TypeRole[] = ['RC', 'CDS', 'DS']

/** Rôles directement détenus (role_attribution actifs) + rôles hérités par suppléance active — un acteur peut cumuler les deux (ex. titulaire RC d'une cellule, suppléant RC d'une autre). */
export async function findEffectiveRoles(matricule: string): Promise<EffectiveRole[]> {
  const direct = await roleAttributionRepository.findActiveByMatricule(matricule)

  // Un titulaire dont le rôle est couvert par une suppléance active passe en lecture seule.
  const supleableIds = direct.filter((r) => SUPPLEABLE.includes(r.type_role)).map((r) => r.id_role)
  const activeOnDirect = await suppleanceRepository.findActiveByRoles(supleableIds)
  const activeByRole = new Map(activeOnDirect.map((s) => [s.id_role, s]))

  const directRoles: EffectiveRole[] = direct.map((r) => {
    const suppleance = activeByRole.get(r.id_role)
    return {
      idRole: r.id_role,
      typeRole: r.type_role,
      idCellule: r.id_cellule,
      idService: r.id_service,
      idDirection: r.id_direction,
      idSuppleance: null,
      lectureSeule: suppleance !== undefined,
      matriculeSuppleant: suppleance?.matricule_suppleant ?? null,
      matriculeTitulaire: null,
      suppleanceDateFin: suppleance?.date_fin ?? null,
    }
  })

  // CB exclue du dispositif de suppléance (verrouillé en base, trigger check_suppleance) —
  // findActiveForSuppleant ne renverra jamais type_role='CB', pas besoin de l'exclure ici.
  const suppleances = await suppleanceRepository.findActiveForSuppleant(matricule)
  const suppleeRoles: EffectiveRole[] = suppleances.map((s) => ({
    idRole: s.id_role,
    typeRole: s.type_role,
    idCellule: s.id_cellule,
    idService: s.id_service,
    idDirection: s.id_direction,
    idSuppleance: s.id_suppleance,
    lectureSeule: false,
    matriculeSuppleant: null,
    matriculeTitulaire: s.matricule_titulaire,
    suppleanceDateFin: s.date_fin,
  }))

  return [...directRoles, ...suppleeRoles]
}

function perimeterField(typeRole: TypeRole): 'idCellule' | 'idService' | 'idDirection' {
  if (typeRole === 'RC') return 'idCellule'
  if (typeRole === 'DS') return 'idDirection'
  return 'idService' // CDS, CB, ADMIN_SERVICE
}

/** Message 403 d'un titulaire suppléé qui tente une écriture — partagé avec demandeAchat.service.ts. */
export function lectureSeuleMessage(typeRole: TypeRole, suppleanceDateFin: string | null): string {
  const jusquAu = suppleanceDateFin ? ` jusqu'au ${formatDateFr(suppleanceDateFin)}` : ''
  return `Votre rôle ${typeRole} est en lecture seule : vous êtes suppléé${jusquAu}. Retirez la suppléance pour reprendre la main.`
}

/**
 * Lève 403 si aucun rôle effectif de `typeRole` ne couvre `perimeterId`
 * (id_cellule pour RC, id_service pour CDS/CB, id_direction pour DS) —
 * retourne le rôle trouvé (pour en extraire idSuppleance à tracer). Réservée
 * aux ÉCRITURES : un titulaire actuellement suppléé (lecture seule) est refusé
 * avec un message dédié, sa consultation passe par findEffectiveRoles.
 */
export async function assertHasEffectiveRole(matricule: string | null, typeRole: TypeRole, perimeterId: number): Promise<EffectiveRole> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await findEffectiveRoles(matricule)
  const field = perimeterField(typeRole)
  const candidates = roles.filter((r) => r.typeRole === typeRole && r[field] === perimeterId)
  if (candidates.length === 0) throw new AppError('Droits insuffisants', 403)

  const writable = candidates.find((r) => !r.lectureSeule)
  if (!writable) throw new AppError(lectureSeuleMessage(typeRole, candidates[0].suppleanceDateFin), 403)
  return writable
}
