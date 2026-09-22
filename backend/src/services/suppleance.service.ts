import { z } from 'zod'
import * as suppleanceRepository from '../repositories/suppleance.repository.js'
import * as suppleanceAuditRepository from '../repositories/suppleanceAudit.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as celluleRepository from '../repositories/cellule.repository.js'
import * as serviceRepository from '../repositories/service.repository.js'
import * as authRepository from '../repositories/auth.repository.js'
import { assertManagesService } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import { todayParis } from '../utils/dates.js'
import type { Suppleance } from '../repositories/suppleance.repository.js'
import type { RoleAttributionRow, TypeRole } from '../repositories/roleAttribution.repository.js'
import type { Acteur } from '../repositories/acteur.repository.js'

/**
 * Suppléance (finances.suppleance) — refonte du 20/09/2026 (voir
 * ForClaude/CDC/mcd-phases-1-2.md entité SUPPLEANCE, ForClaude/SECURITY.md §2.10) :
 *   - réservée à RC/CDS/DS (verrouillé en base, trigger check_suppleance) ;
 *   - "auto-déclarée" : seul le titulaire du rôle peut désigner ET retirer un
 *     suppléant, pour son propre rôle — jamais ADMIN_SERVICE/ADMIN_APP à sa place
 *     (comparaison du matricule appelant à role_attribution.matricule, pas via
 *     assertManagesService) ;
 *   - pas de suppléance en chaîne : un suppléant qui n'est pas lui-même
 *     titulaire du rôle échoue naturellement à la vérification ci-dessus ;
 *   - le suppléant est un acteur ACTIF du service (RC, CDS) ou de la direction
 *     (DS) du titulaire — son rôle actuel n'est plus un critère ;
 *   - pas de rétroactivité, pas de durée maximale, fin inclusive, pas de
 *     chevauchement sur un même rôle ;
 *   - substitution complète pendant la période ; le titulaire passe en lecture
 *     seule (voir roleEffectif.service.ts) ;
 *   - une suppléance ne se supprime jamais : le retrait renseigne date_retrait
 *     (HISTORIQUE_STATUT.ID_SUPPLEANCE peut la référencer).
 */

const SUPPLEABLE_TYPES: readonly TypeRole[] = ['RC', 'CDS', 'DS']

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ attendu)')

const createSuppleanceSchema = z
  .object({
    idRole: z.number().int(),
    matriculeSuppleant: z.string().trim().min(1),
    dateDebut: dateSchema,
    dateFin: dateSchema,
  })
  .superRefine((data, ctx) => {
    if (data.dateFin < data.dateDebut) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La date de fin doit être postérieure ou égale à la date de début.' })
    }
  })

export type SuppleanceStatut = 'A_VENIR' | 'EN_COURS' | 'TERMINEE' | 'RETIREE'

export interface SuppleanceView {
  idSuppleance: number
  idRole: number
  typeRole: TypeRole | null
  perimeterLabel: string | null
  matriculeSuppleant: string
  suppleantNomPrenom: string | null
  dateDebut: string
  dateFin: string
  dateRetrait: string | null
  statut: SuppleanceStatut
}

export interface SuppleanceRoleOption {
  idRole: number
  typeRole: TypeRole
  perimeterLabel: string | null
}

export interface MesSuppleances {
  /** Rôles RC/CDS/DS actifs de l'appelant — ceux pour lesquels il peut déclarer une suppléance. */
  roles: SuppleanceRoleOption[]
  suppleances: SuppleanceView[]
}

export interface SuppleantCandidat {
  matricule: string
  nom: string
  prenom: string
  fonction: string
}

export interface SuppleanceAuditView {
  action: 'CREATION' | 'RETRAIT'
  matriculeActeur: string
  acteurNomPrenom: string | null
  dateHeure: string
}

export interface SuppleanceSupervisionView extends SuppleanceView {
  audit: SuppleanceAuditView[]
}

function statutOf(row: Suppleance, today: string): SuppleanceStatut {
  if (row.date_retrait !== null) return 'RETIREE'
  if (row.date_fin < today) return 'TERMINEE'
  if (row.date_debut > today) return 'A_VENIR'
  return 'EN_COURS'
}

function nomPrenom(acteur: Pick<Acteur, 'nom' | 'prenom'> | undefined): string | null {
  return acteur ? `${acteur.prenom} ${acteur.nom}` : null
}

async function toViews(rows: Suppleance[], roles: RoleAttributionRow[]): Promise<SuppleanceView[]> {
  const today = todayParis()
  const roleById = new Map(roles.map((r) => [r.id_role, r]))
  const acteurs = await acteurRepository.findByMatricules([...new Set(rows.map((r) => r.matricule_suppleant))])
  const acteurByMatricule = new Map(acteurs.map((a) => [a.matricule, a]))
  const labelByRole = new Map<number, string | null>()
  for (const role of roles) {
    if (rows.some((r) => r.id_role === role.id_role)) {
      labelByRole.set(role.id_role, await roleAttributionRepository.resolvePerimeterLabel(role))
    }
  }

  return rows.map((row) => ({
    idSuppleance: row.id_suppleance,
    idRole: row.id_role,
    typeRole: roleById.get(row.id_role)?.type_role ?? null,
    perimeterLabel: labelByRole.get(row.id_role) ?? null,
    matriculeSuppleant: row.matricule_suppleant,
    suppleantNomPrenom: nomPrenom(acteurByMatricule.get(row.matricule_suppleant)),
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    dateRetrait: row.date_retrait,
    statut: statutOf(row, today),
  }))
}

/** Charge le rôle visé et vérifie qu'il est éligible et détenu par l'appelant — jamais un admin, jamais un suppléant. */
async function loadOwnRole(matricule: string, idRole: number): Promise<RoleAttributionRow> {
  const role = await roleAttributionRepository.findById(idRole)
  if (!role) throw new AppError('Rôle introuvable', 404)
  if (!SUPPLEABLE_TYPES.includes(role.type_role)) {
    throw new AppError("La suppléance n'est possible que pour les rôles RC, CDS ou DS", 400)
  }
  // Auto-déclaré : seul le titulaire du rôle peut agir. Un suppléant (qui n'a pas cette ligne
  // role_attribution à son nom) échoue ici automatiquement — pas de suppléance en chaîne.
  if (role.matricule !== matricule) throw new AppError('Seul le titulaire de ce rôle peut gérer ses suppléances', 403)
  return role
}

/** Acteurs actifs du périmètre du rôle (service pour RC/CDS, direction pour DS), titulaire exclu. */
async function findScopeActeurs(role: RoleAttributionRow): Promise<Acteur[]> {
  let acteurs: Acteur[] = []
  if (role.type_role === 'RC' && role.id_cellule !== null) {
    const cellule = await celluleRepository.findById(role.id_cellule)
    if (cellule) acteurs = await acteurRepository.findAllByService(cellule.id_service)
  } else if (role.type_role === 'CDS' && role.id_service !== null) {
    acteurs = await acteurRepository.findAllByService(role.id_service)
  } else if (role.type_role === 'DS' && role.id_direction !== null) {
    acteurs = await acteurRepository.findAllByDirection(role.id_direction)
  }
  return acteurs.filter((a) => a.actif && a.matricule !== role.matricule)
}

const SCOPE_LABEL: Record<string, string> = {
  RC: 'au service de la cellule du RC',
  CDS: 'au service du CDS',
  DS: 'à la direction du DS',
}

/** Lecture réservée au titulaire : ses rôles RC/CDS/DS et toutes leurs suppléances (passées, en cours, à venir, retirées). */
export async function listMesSuppleances(matricule: string | null): Promise<MesSuppleances> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const ownRoles = (await roleAttributionRepository.findActiveByMatricule(matricule)).filter((r) => SUPPLEABLE_TYPES.includes(r.type_role))
  const rows = await suppleanceRepository.findByRoles(ownRoles.map((r) => r.id_role))
  const suppleances = await toViews(rows, ownRoles)
  const roles = await Promise.all(
    ownRoles.map(async (r) => ({
      idRole: r.id_role,
      typeRole: r.type_role,
      perimeterLabel: await roleAttributionRepository.resolvePerimeterLabel(r),
    })),
  )
  return { roles, suppleances }
}

/** Suppléants possibles pour un rôle — liste construite côté serveur, jamais fournie par le client. */
export async function listCandidats(matricule: string | null, idRole: number): Promise<SuppleantCandidat[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const role = await loadOwnRole(matricule, idRole)
  if (!role.actif) throw new AppError("Ce rôle n'est plus actif", 409)

  const acteurs = await findScopeActeurs(role)
  return acteurs.map((a) => ({ matricule: a.matricule, nom: a.nom, prenom: a.prenom, fonction: a.fonction }))
}

export async function createSuppleance(matricule: string | null, input: unknown): Promise<SuppleanceView> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = createSuppleanceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const { idRole, matriculeSuppleant, dateDebut, dateFin } = result.data

  if (dateDebut < todayParis()) throw new AppError('Une suppléance ne peut pas commencer dans le passé.', 400)

  const role = await loadOwnRole(matricule, idRole)
  if (!role.actif) throw new AppError("Ce rôle n'est plus actif", 409)

  if (matriculeSuppleant === matricule) {
    throw new AppError('Un titulaire ne peut pas être son propre suppléant', 400)
  }

  const suppleantActeur = await acteurRepository.findByMatricule(matriculeSuppleant)
  if (!suppleantActeur) throw new AppError('Acteur suppléant introuvable', 404)
  if (!suppleantActeur.actif) throw new AppError('Le suppléant doit être un acteur actif', 409)

  const scope = await findScopeActeurs(role)
  if (!scope.some((a) => a.matricule === matriculeSuppleant)) {
    throw new AppError(`Le suppléant doit appartenir ${SCOPE_LABEL[role.type_role]}`, 409)
  }

  const overlapping = await suppleanceRepository.findOverlapping(idRole, dateDebut, dateFin)
  if (overlapping) {
    throw new AppError('Une suppléance existe déjà sur une période chevauchante pour ce rôle', 409)
  }

  let created: Suppleance
  try {
    created = await suppleanceRepository.create({
      id_role: idRole,
      matricule_suppleant: matriculeSuppleant,
      date_debut: dateDebut,
      date_fin: dateFin,
    })
  } catch (err) {
    // Accès concurrent : la contrainte d'exclusion en base (excl_suppleance_role_periode) tranche.
    if ((err as { code?: string }).code === '23P01') {
      throw new AppError('Une suppléance existe déjà sur une période chevauchante pour ce rôle', 409)
    }
    throw err
  }

  const [view] = await toViews([created], [role])
  return view
}

/** Retrait logique par le titulaire — à tout moment, y compris une suppléance à venir ; jamais une suppléance terminée. */
export async function retireSuppleance(matricule: string | null, idSuppleance: number): Promise<SuppleanceView> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const suppleance = await suppleanceRepository.findById(idSuppleance)
  if (!suppleance) throw new AppError('Suppléance introuvable', 404)

  const role = await loadOwnRole(matricule, suppleance.id_role)

  if (suppleance.date_retrait !== null) throw new AppError('Cette suppléance est déjà retirée', 409)
  if (suppleance.date_fin < todayParis()) throw new AppError('Cette suppléance est terminée, elle ne peut plus être retirée', 409)

  const retired = await suppleanceRepository.retire(idSuppleance)
  const [view] = await toViews([retired], [role])
  return view
}

/**
 * Lecture seule pour ADMIN_SERVICE (son service) et ADMIN_APP (tous services,
 * ou un service précis) — jamais de déclaration ni de retrait à la place du
 * titulaire. Couvre les rôles actifs : RC des cellules du service, CDS du
 * service, DS de la direction du service.
 */
export async function listSupervision(matricule: string | null, idService?: number): Promise<SuppleanceSupervisionView[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const isAdminApp = await authRepository.hasActiveRole(matricule, 'ADMIN_APP')

  let roles: RoleAttributionRow[]
  if (isAdminApp && idService === undefined) {
    roles = (await roleAttributionRepository.findAllActive()).filter((r) => SUPPLEABLE_TYPES.includes(r.type_role))
  } else {
    let serviceIds: number[]
    if (idService !== undefined) {
      await assertManagesService(matricule, idService)
      serviceIds = [idService]
    } else {
      const own = await roleAttributionRepository.findActiveByMatricule(matricule)
      serviceIds = own.filter((r) => r.type_role === 'ADMIN_SERVICE' && r.id_service !== null).map((r) => r.id_service as number)
      if (serviceIds.length === 0) throw new AppError('Droits insuffisants', 403)
    }
    roles = await findSupleableRolesOfServices(serviceIds)
  }

  const rows = await suppleanceRepository.findByRoles(roles.map((r) => r.id_role))
  const views = await toViews(rows, roles)

  const audits = await suppleanceAuditRepository.findBySuppleances(rows.map((r) => r.id_suppleance))
  const auteurs = await acteurRepository.findByMatricules([...new Set(audits.map((a) => a.matricule_acteur))])
  const auteurByMatricule = new Map(auteurs.map((a) => [a.matricule, a]))

  return views.map((view) => ({
    ...view,
    audit: audits
      .filter((a) => a.id_suppleance === view.idSuppleance)
      .map((a) => ({
        action: a.action,
        matriculeActeur: a.matricule_acteur,
        acteurNomPrenom: nomPrenom(auteurByMatricule.get(a.matricule_acteur)),
        dateHeure: a.date_heure,
      })),
  }))
}

async function findSupleableRolesOfServices(serviceIds: number[]): Promise<RoleAttributionRow[]> {
  const cellules = await celluleRepository.findAll()
  const celluleIds = cellules.filter((c) => serviceIds.includes(c.id_service)).map((c) => c.id_cellule)
  const rc = await roleAttributionRepository.findActiveByCellules(celluleIds)

  const cds: RoleAttributionRow[] = []
  for (const idService of serviceIds) {
    cds.push(...(await roleAttributionRepository.findActiveByService(idService)).filter((r) => r.type_role === 'CDS'))
  }

  const services = await Promise.all(serviceIds.map((id) => serviceRepository.findById(id)))
  const directionIds = [...new Set(services.flatMap((s) => (s ? [s.id_direction] : [])))]
  const ds: RoleAttributionRow[] = []
  for (const idDirection of directionIds) {
    const role = await roleAttributionRepository.findActiveForPerimeter('DS', { id_direction: idDirection })
    if (role) ds.push(role)
  }

  return [...rc.filter((r) => r.type_role === 'RC'), ...cds, ...ds]
}
