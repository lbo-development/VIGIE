import { z } from 'zod'
import * as suppleanceRepository from '../repositories/suppleance.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Suppleance } from '../repositories/suppleance.repository.js'

/**
 * Suppléance (finances.suppleance) — décisions du 14/09/2026 (point 7 de la
 * conception statuts) :
 *   - réservée à RC/CDS/DS (verrouillé en base, migration 20260914170000) ;
 *   - "auto-déclarée" (MCD) : seul le titulaire du rôle peut désigner un
 *     suppléant, jamais ADMIN_SERVICE/ADMIN_APP à sa place — vérifié en
 *     comparant le matricule appelant à role_attribution.matricule, pas via
 *     assertManagesService (contrairement à roleAttribution.service.ts) ;
 *   - pas de suppléance en chaîne : un suppléant qui n'est pas lui-même
 *     titulaire du rôle échoue naturellement à la vérification ci-dessus,
 *     sans logique de détection dédiée ;
 *   - le suppléant doit détenir un rôle actif de même type_role quelque part
 *     (MCD : "un ACTEUR suppléant détenant un rôle de même TYPE_ROLE") ;
 *   - substitution complète pendant la période (voir
 *     auth.repository.ts#hasActiveRole) ; le titulaire ne perd aucun droit
 *     techniquement — simple présomption d'absence, décision du 14/09/2026
 *     qui annule une version antérieure de cette règle.
 */

const createSuppleanceSchema = z
  .object({
    idRole: z.number().int(),
    matriculeSuppleant: z.string().trim().min(1),
    dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ attendu)'),
    dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ attendu)'),
  })
  .superRefine((data, ctx) => {
    if (data.dateFin < data.dateDebut) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La date de fin doit être postérieure ou égale à la date de début.' })
    }
  })

export interface SuppleanceView {
  idSuppleance: number
  idRole: number
  matriculeSuppleant: string
  dateDebut: string
  dateFin: string
}

function toView(row: Suppleance): SuppleanceView {
  return {
    idSuppleance: row.id_suppleance,
    idRole: row.id_role,
    matriculeSuppleant: row.matricule_suppleant,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
  }
}

/** Lecture réservée au titulaire du rôle concerné — pas d'écran d'administration transverse à ce jour. */
export async function listSuppleancesByRole(matricule: string | null, idRole: number): Promise<SuppleanceView[]> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const role = await roleAttributionRepository.findById(idRole)
  if (!role) throw new AppError('Rôle introuvable', 404)
  if (role.matricule !== matricule) throw new AppError('Droits insuffisants', 403)

  const rows = await suppleanceRepository.findByRole(idRole)
  return rows.map(toView)
}

export async function createSuppleance(matricule: string | null, input: unknown): Promise<SuppleanceView> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const result = createSuppleanceSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  const { idRole, matriculeSuppleant, dateDebut, dateFin } = result.data

  const role = await roleAttributionRepository.findById(idRole)
  if (!role) throw new AppError('Rôle introuvable', 404)
  if (!role.actif) throw new AppError('Ce rôle n\'est plus actif', 409)

  if (role.type_role !== 'RC' && role.type_role !== 'CDS' && role.type_role !== 'DS') {
    throw new AppError('La suppléance n\'est possible que pour les rôles RC, CDS ou DS', 400)
  }

  // Auto-déclaré : seul le titulaire du rôle peut désigner son suppléant.
  // Un suppléant (qui n'a pas cette ligne role_attribution à son nom) échoue
  // ici automatiquement — pas de suppléance en chaîne.
  if (role.matricule !== matricule) {
    throw new AppError('Seul le titulaire de ce rôle peut désigner un suppléant', 403)
  }

  if (matriculeSuppleant === matricule) {
    throw new AppError('Un titulaire ne peut pas être son propre suppléant', 400)
  }

  const suppleantActeur = await acteurRepository.findByMatricule(matriculeSuppleant)
  if (!suppleantActeur) throw new AppError('Acteur suppléant introuvable', 404)

  const suppleantRoles = await roleAttributionRepository.findActiveByMatricule(matriculeSuppleant)
  const hasSameTypeRole = suppleantRoles.some((r) => r.type_role === role.type_role)
  if (!hasSameTypeRole) {
    throw new AppError(`Le suppléant doit détenir un rôle actif de type ${role.type_role}`, 409)
  }

  const overlapping = await suppleanceRepository.findOverlapping(idRole, dateDebut, dateFin)
  if (overlapping) {
    throw new AppError('Une suppléance existe déjà sur une période chevauchante pour ce rôle', 409)
  }

  const created = await suppleanceRepository.create({
    id_role: idRole,
    matricule_suppleant: matriculeSuppleant,
    date_debut: dateDebut,
    date_fin: dateFin,
  })

  return toView(created)
}
