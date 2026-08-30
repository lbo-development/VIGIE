import { z } from 'zod'
import * as fournisseurRepository from '../repositories/fournisseur.repository.js'
import * as contactRepository from '../repositories/contact.repository.js'
import * as serviceRepository from '../repositories/service.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as marcheRepository from '../repositories/marche.repository.js'
import * as demandeAchatRepository from '../repositories/demandeAchat.repository.js'
import * as devisConsulteRepository from '../repositories/devisConsulte.repository.js'
import { assertManagesService, assertManagesServiceOrIsOwnActor } from './authorization.service.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Fournisseur } from '../repositories/fournisseur.repository.js'
import type { Contact } from '../repositories/contact.repository.js'

/**
 * Clé de contrôle du SIREN (algorithme de Luhn sur 9 chiffres, INSEE) : un
 * chiffre sur deux (positions 2/4/6/8 en partant de la droite — index
 * impairs en partant de la gauche pour un nombre à 9 chiffres) est doublé,
 * réduit à un chiffre (-9 si >9) ; valide si la somme de tous les chiffres
 * est un multiple de 10. Décision du 29/08/2026 : le SIREN doit être
 * renseigné ET valide (create ET update). Exception connue, non couverte
 * ici : quelques SIREN historiques (ex. La Poste, 356000000) ne respectent
 * pas cette règle mais restent valides administrativement.
 */
function isValidSiren(value: string): boolean {
  const numero = value.replace(/\s/g, '')
  if (!/^\d{9}$/.test(numero)) return false

  let somme = 0
  for (let i = 0; i < 9; i++) {
    let chiffre = Number(numero[i])
    if (i % 2 === 1) {
      chiffre *= 2
      if (chiffre > 9) chiffre -= 9
    }
    somme += chiffre
  }
  return somme % 10 === 0
}

// SIREN est NOT NULL sur la table physique finances.fournisseur (schéma
// préexistant, colonne renommée depuis SIRET le 29/08/2026 — voir MLD §2.2) :
// obligatoire ET valide (clé de Luhn), à la création comme en modification.
// Espaces de saisie tolérés, retirés avant stockage (comme pour les
// numéros de téléphone).
const sirenField = z
  .string()
  .trim()
  .min(1, 'Le SIREN est obligatoire.')
  .transform((v) => v.replace(/\s/g, ''))
  .refine((v) => isValidSiren(v), { message: 'SIREN invalide (clé de contrôle incorrecte).' })

const createFournisseurSchema = z.object({
  idService: z.number().int(),
  raisonSocialeService: z.string().trim().min(1).max(200),
  siren: sirenField,
  adr1: z.string().trim().max(200).optional().nullable(),
  adr2: z.string().trim().max(200).optional().nullable(),
  cp: z.string().trim().max(10).optional().nullable(),
  ville: z.string().trim().max(100).optional().nullable(),
  cedex: z.string().trim().max(100).optional().nullable(),
  actif: z.boolean().default(true),
})

const updateFournisseurSchema = z.object({
  raisonSocialeService: z.string().trim().min(1).max(200).optional(),
  siren: sirenField,
  adr1: z.string().trim().max(200).optional().nullable(),
  adr2: z.string().trim().max(200).optional().nullable(),
  cp: z.string().trim().max(10).optional().nullable(),
  ville: z.string().trim().max(100).optional().nullable(),
  cedex: z.string().trim().max(100).optional().nullable(),
  actif: z.boolean().optional(),
})

export interface FournisseurWithContacts extends Omit<Fournisseur, 'etatfournisseur'> {
  actif: boolean
  contacts: Contact[]
}

function toApi(fournisseur: Fournisseur, contacts: Contact[]): FournisseurWithContacts {
  const { etatfournisseur, ...rest } = fournisseur
  return { ...rest, actif: etatfournisseur === 'Actif', contacts }
}

/**
 * Périmètre de lecture de l'appelant : ADMIN_APP voit tout (transverse).
 * Tout le monde d'autre — ADMIN_SERVICE **et** Demandeur, qui n'a pas de rôle
 * dédié (voir ForClaude/CDC/mot-phases-1-2.md l.15) — ne voit que son propre
 * service : celui de son rôle ADMIN_SERVICE s'il en a un, sinon celui de son
 * rattachement ACTEUR → CELLULE → SERVICE (voir acteur.repository.ts). Décision
 * du 29/08/2026 (voir ForClaude/SECURITY.md §2.5).
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const adminServiceRole = roles.find((r) => r.type_role === 'ADMIN_SERVICE' && r.id_service !== null)
  const ownIdService = adminServiceRole?.id_service ?? (await acteurRepository.findIdServiceByMatricule(matricule))
  return { isAdminApp: false, ownIdService }
}

export async function listFournisseurs(matricule: string | null, idService?: number): Promise<FournisseurWithContacts[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)

  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (!isAdminApp && effectiveIdService === undefined) return []

  const fournisseurs = await fournisseurRepository.findAll(effectiveIdService)
  const contacts = await contactRepository.findByFournisseurs(fournisseurs.map((f) => f.id_fournisseur))

  const byFournisseur = new Map<number, Contact[]>()
  for (const contact of contacts) {
    const list = byFournisseur.get(contact.id_fournisseur) ?? []
    list.push(contact)
    byFournisseur.set(contact.id_fournisseur, list)
  }

  return fournisseurs.map((f) => toApi(f, byFournisseur.get(f.id_fournisseur) ?? []))
}

/**
 * Création ouverte à ADMIN_APP, ADMIN_SERVICE (scopé) ou tout Demandeur créant
 * pour son propre service (décision du 29/08/2026, voir
 * assertManagesServiceOrIsOwnActor) — plus large que la modification, qui
 * reste ADMIN_APP/ADMIN_SERVICE seuls (assertManagesFournisseur ci-dessous).
 */
export async function createFournisseur(matricule: string | null, input: unknown): Promise<FournisseurWithContacts> {
  const result = createFournisseurSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  await assertManagesServiceOrIsOwnActor(matricule, result.data.idService)

  const service = await serviceRepository.findById(result.data.idService)
  if (!service) throw new AppError('Service introuvable', 404)

  const created = await fournisseurRepository.create({
    id_service: result.data.idService,
    etatfournisseur: result.data.actif ? 'Actif' : 'Inactif',
    raison_sociale_pgi: null,
    raison_sociale_service: result.data.raisonSocialeService,
    siren: result.data.siren ?? null,
    numpgi: null,
    adr1: result.data.adr1 ?? null,
    adr2: result.data.adr2 ?? null,
    cp: result.data.cp ?? null,
    ville: result.data.ville ?? null,
    cedex: result.data.cedex ?? null,
    type_creation: 'SERVICE',
  })

  return toApi(created, [])
}

/** Vérifie le droit de gestion sur le service du fournisseur — réutilisé par contact.service.ts. */
export async function assertManagesFournisseur(matricule: string | null, idFournisseur: number): Promise<Fournisseur> {
  const fournisseur = await fournisseurRepository.findById(idFournisseur)
  if (!fournisseur) throw new AppError('Fournisseur introuvable', 404)
  await assertManagesService(matricule, fournisseur.id_service)
  return fournisseur
}

export async function updateFournisseur(
  matricule: string | null,
  idFournisseur: number,
  input: unknown,
): Promise<FournisseurWithContacts> {
  const result = updateFournisseurSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  await assertManagesFournisseur(matricule, idFournisseur)

  const updated = await fournisseurRepository.update(idFournisseur, {
    raison_sociale_service: result.data.raisonSocialeService,
    siren: result.data.siren,
    adr1: result.data.adr1,
    adr2: result.data.adr2,
    cp: result.data.cp,
    ville: result.data.ville,
    cedex: result.data.cedex,
    etatfournisseur: result.data.actif === undefined ? undefined : result.data.actif ? 'Actif' : 'Inactif',
  })

  const contacts = await contactRepository.findByFournisseurs([idFournisseur])
  return toApi(updated, contacts)
}

/**
 * Suppression conditionnelle (décision du 29/08/2026) : ADMIN_APP/ADMIN_SERVICE
 * uniquement (assertManagesFournisseur, comme la modification — pas la règle
 * plus large de la création), et seulement si aucun MARCHE, DEMANDE_ACHAT
 * (fournisseur retenu) ni DEVIS_CONSULTE (même non retenu) ne référence
 * encore ce fournisseur. Filet de sécurité : les FK correspondantes n'ont
 * aucun ON DELETE CASCADE, Postgres refuserait de toute façon la suppression
 * en cas de bug ici (voir migration 20260829140000).
 *
 * Supprime d'abord les CONTACT du fournisseur, puis le fournisseur lui-même
 * — la FK contact→fournisseur bloquerait sinon. Pas de transaction
 * multi-instructions exposée par supabase-js (déjà le cas ailleurs dans ce
 * backend) : un échec entre les deux suppressions laisserait un fournisseur
 * sans contacts, risque accepté plutôt qu'ignoré.
 */
export async function deleteFournisseur(matricule: string | null, idFournisseur: number): Promise<void> {
  await assertManagesFournisseur(matricule, idFournisseur)

  const [usedByMarche, usedByDemandeAchat, usedByDevisConsulte] = await Promise.all([
    marcheRepository.existsForFournisseur(idFournisseur),
    demandeAchatRepository.existsForFournisseurRetenu(idFournisseur),
    devisConsulteRepository.existsForFournisseur(idFournisseur),
  ])
  if (usedByMarche || usedByDemandeAchat || usedByDevisConsulte) {
    throw new AppError(
      "Ce fournisseur est encore utilisé par un marché, une demande d'achat ou un devis — impossible de le supprimer. Passez-le en Inactif à la place.",
      409,
    )
  }

  await contactRepository.removeByFournisseur(idFournisseur)
  await fournisseurRepository.remove(idFournisseur)
}
