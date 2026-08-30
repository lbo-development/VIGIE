import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'

export interface MeRole {
  typeRole: string
  perimeterLabel: string | null
  idService: number | null
}

export interface MeResponse {
  matricule: string | null
  nom: string | null
  prenom: string | null
  /** Rattachement propre de l'acteur (ACTEUR.ID_CELLULE → CELLULE.ID_SERVICE), indépendant des rôles applicatifs — voir acteur.repository.ts. Permet à un Demandeur (sans rôle dédié) de connaître son propre service, ex. création de FOURNISSEUR (voir fournisseur.service.ts). */
  idService: number | null
  roles: MeRole[]
}

/**
 * Vue « qui suis-je » pour l'utilisateur authentifié courant : identité et
 * rôles actifs. matricule est déjà résolu par requireAuth (peut être null
 * tant que le compte n'est pas rattaché à un ACTEUR, voir
 * ForClaude/SECURITY.md §2.1) — ce service ne le re-résout pas.
 */
export async function getCurrentUser(matricule: string | null): Promise<MeResponse> {
  if (!matricule) {
    return { matricule: null, nom: null, prenom: null, idService: null, roles: [] }
  }

  const [acteur, roleRows, idService] = await Promise.all([
    acteurRepository.findByMatricule(matricule),
    roleAttributionRepository.findActiveByMatricule(matricule),
    acteurRepository.findIdServiceByMatricule(matricule),
  ])

  const roles = await Promise.all(
    roleRows.map(async (row) => ({
      typeRole: row.type_role,
      perimeterLabel: await roleAttributionRepository.resolvePerimeterLabel(row),
      idService: row.id_service,
    })),
  )

  return { matricule, nom: acteur?.nom ?? null, prenom: acteur?.prenom ?? null, idService, roles }
}
