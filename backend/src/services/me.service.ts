import * as acteurRepository from '../repositories/acteur.repository.js'
import * as roleAttributionRepository from '../repositories/roleAttribution.repository.js'
import * as roleEffectifService from './roleEffectif.service.js'
import type { RoleAttributionRow } from '../repositories/roleAttribution.repository.js'

export interface MeRole {
  typeRole: string
  perimeterLabel: string | null
  idService: number | null
  /** ID_CELLULE du rôle (RC) — ajouté le 15/09/2026 (écran de suivi RC) pour construire l'entrée de sidebar "FAD — <cellule>" et interroger la bonne cellule sans dépendre du libellé texte. */
  idCellule: number | null
}

export interface MeResponse {
  matricule: string | null
  nom: string | null
  prenom: string | null
  /** Rattachement propre de l'acteur (ACTEUR.ID_CELLULE → CELLULE.ID_SERVICE), indépendant des rôles applicatifs — voir acteur.repository.ts. Permet à un Demandeur (sans rôle dédié) de connaître son propre service, ex. création de FOURNISSEUR (voir fournisseur.service.ts). */
  idService: number | null
  /** ACTEUR.ID_CELLULE directement — ajouté le 08/09/2026 pour verrouiller Direction/Service/Cellule sur les siens dans la page DemandeAchat (RC, dont le périmètre de rôle ne porte que ID_CELLULE, jamais ID_SERVICE), quel que soit le rôle actif. */
  idCellule: number | null
  roles: MeRole[]
}

/**
 * Vue « qui suis-je » pour l'utilisateur authentifié courant : identité et
 * rôles actifs. matricule est déjà résolu par requireAuth (peut être null
 * tant que le compte n'est pas rattaché à un ACTEUR, voir
 * ForClaude/SECURITY.md §2.1) — ce service ne le re-résout pas.
 *
 * Correction du 15/09/2026 (écran de suivi RC) : source des rôles basculée
 * sur roleEffectifService.findEffectiveRoles (titulaire + suppléance RC/CDS/
 * DS) — roleAttributionRepository.findActiveByMatricule seul ne voyait
 * jamais un rôle hérité par suppléance pure (aucune ligne role_attribution à
 * son nom), même trou que demandeAchat.service.ts#resolveAccessContext.
 */
export async function getCurrentUser(matricule: string | null): Promise<MeResponse> {
  if (!matricule) {
    return { matricule: null, nom: null, prenom: null, idService: null, idCellule: null, roles: [] }
  }

  const [acteur, effectiveRoles, idService] = await Promise.all([
    acteurRepository.findByMatricule(matricule),
    roleEffectifService.findEffectiveRoles(matricule),
    acteurRepository.findIdServiceByMatricule(matricule),
  ])

  const roles = await Promise.all(
    effectiveRoles.map(async (role) => {
      // resolvePerimeterLabel ne lit que id_cellule/id_service/id_direction — les autres champs de
      // RoleAttributionRow (id_role/matricule/date_debut/date_fin/actif) ne sont jamais utilisés,
      // safe à défaut ici plutôt que de changer sa signature pour un simple objet adapté.
      const perimeterLabel = await roleAttributionRepository.resolvePerimeterLabel({
        id_cellule: role.idCellule,
        id_service: role.idService,
        id_direction: role.idDirection,
      } as RoleAttributionRow)
      return { typeRole: role.typeRole, perimeterLabel, idService: role.idService, idCellule: role.idCellule }
    }),
  )

  return { matricule, nom: acteur?.nom ?? null, prenom: acteur?.prenom ?? null, idService, idCellule: acteur?.id_cellule ?? null, roles }
}
