import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'

export interface MeRole {
  typeRole: string
  perimeterLabel: string | null
}

export interface MeResponse {
  matricule: string | null
  nom: string | null
  prenom: string | null
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
    return { matricule: null, nom: null, prenom: null, roles: [] }
  }

  const [acteur, roleRows] = await Promise.all([
    acteurRepository.findByMatricule(matricule),
    roleAttributionRepository.findActiveByMatricule(matricule),
  ])

  const roles = await Promise.all(
    roleRows.map(async (row) => ({
      typeRole: row.type_role,
      perimeterLabel: await roleAttributionRepository.resolvePerimeterLabel(row),
    })),
  )

  return { matricule, nom: acteur?.nom ?? null, prenom: acteur?.prenom ?? null, roles }
}
