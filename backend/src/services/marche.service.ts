import * as marcheRepository from '../repositories/marche.repository.js'
import * as cugRepository from '../repositories/cug.repository.js'
import * as fournisseurRepository from '../repositories/fournisseur.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import { AppError } from '../middlewares/errorHandler.js'
import type { Marche } from '../repositories/marche.repository.js'

export interface MarcheWithFournisseur extends Marche {
  /** FOURNISSEUR.RAISON_SOCIALE_SERVICE du titulaire (via MARCHE.ID_FOURNISSEUR), pas MARCHE.TITULAIRE_SERVICE (figé à la création, cf. import-marches-pgi.md §3). */
  fournisseur_raison_sociale: string | null
}

/**
 * États des marchés (/marches, voir Marches.tsx) — lecture ouverte à tout
 * utilisateur authentifié, scopée à son propre service (ACTEUR.ID_CELLULE →
 * CELLULE.ID_SERVICE) sauf ADMIN_APP, qui choisit librement le service cible.
 * Même principe que fournisseur.service.ts#resolveReadScope, en plus simple :
 * pas de priorité au rôle ADMIN_SERVICE ici (décision du 30/08/2026, voir
 * Marches.tsx — la page reste ouverte à tout acteur, pas seulement
 * ADMIN_SERVICE/CB comme l'import).
 */
async function resolveReadScope(matricule: string | null): Promise<{ isAdminApp: boolean; ownIdService: number | null }> {
  if (!matricule) throw new AppError('Authentification requise', 401)

  const roles = await roleAttributionRepository.findActiveByMatricule(matricule)
  if (roles.some((r) => r.type_role === 'ADMIN_APP')) return { isAdminApp: true, ownIdService: null }

  const ownIdService = await acteurRepository.findIdServiceByMatricule(matricule)
  return { isAdminApp: false, ownIdService }
}

/**
 * Tous les marchés (actifs et archivés confondus — le filtre Statut se fait
 * côté frontend, comme Fournisseurs.tsx) du service donné. `idService` n'a
 * d'effet que pour ADMIN_APP ; pour tout autre acteur, le service transmis
 * est ignoré au profit de son propre service (défense en profondeur, même
 * logique que fournisseur.service.ts).
 *
 * Chaque marché est enrichi de `fournisseur_raison_sociale`, résolu via
 * MARCHE.ID_FOURNISSEUR → FOURNISSEUR.RAISON_SOCIALE_SERVICE — décision du
 * 30/08/2026, affiché à côté de NUMMARCHE dans Marches.tsx. FOURNISSEUR est
 * scopé au même service (ID_SERVICE) que les marchés listés, donc un seul
 * `fournisseurRepository.findAll(effectiveIdService)` suffit à résoudre tous
 * les titulaires en une requête.
 */
export async function listMarches(matricule: string | null, idService?: number): Promise<MarcheWithFournisseur[]> {
  const { isAdminApp, ownIdService } = await resolveReadScope(matricule)

  const effectiveIdService = isAdminApp ? idService : (ownIdService ?? undefined)
  if (effectiveIdService === undefined) return []

  const cugs = await cugRepository.findAll(effectiveIdService)
  const cugCodes = cugs.map((c) => c.code_cug)
  const [marches, fournisseurs] = await Promise.all([
    marcheRepository.findByCugCodes(cugCodes),
    fournisseurRepository.findAll(effectiveIdService),
  ])

  const raisonSocialeById = new Map(fournisseurs.map((f) => [f.id_fournisseur, f.raison_sociale_service]))
  return marches.map((m) => ({
    ...m,
    fournisseur_raison_sociale: m.id_fournisseur !== null ? (raisonSocialeById.get(m.id_fournisseur) ?? null) : null,
  }))
}
