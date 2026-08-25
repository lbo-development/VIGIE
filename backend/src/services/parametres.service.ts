import { z } from 'zod'
import * as parametresRepository from '../repositories/parametres.repository.js'
import * as acteursRepository from '../repositories/acteurs.repository.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Registre des paramètres applicatifs connus : une entrée par clé, avec son
 * schéma de validation et sa valeur par défaut (utilisée si aucune ligne —
 * pas même globale — n'existe encore en base). Voir docs/ARCHITECTURE.md
 * ("Paramétrage applicatif") pour le modèle de portée (global/direction/service).
 *
 * Ajouter un paramètre = ajouter une entrée ici (et l'insérer en base via
 * PUT /parametres/:cle, réservé ADMIN_APP).
 */
const PARAMETRES = {
  'auth.inactivite_delai_minutes': {
    schema: z.number().int().min(1).max(240),
    defaut: 30,
  },
} as const

type CleParametre = keyof typeof PARAMETRES

function assertCleConnue(cle: string): asserts cle is CleParametre {
  if (!(cle in PARAMETRES)) {
    throw new AppError(`Paramètre inconnu : "${cle}"`, 404)
  }
}

export async function getParametreEffectif(matricule: string, cle: string) {
  assertCleConnue(cle)
  const idService = await acteursRepository.findIdServiceByMatricule(matricule)
  const valeurBrute = await parametresRepository.findValeurEffective(cle, idService)
  const { schema, defaut } = PARAMETRES[cle]
  const valeur = schema.parse(valeurBrute ?? defaut)
  return { cle, valeur }
}

const scopeSchema = z
  .object({
    valeur: z.unknown(),
    idDirection: z.number().int().nullable().optional(),
    idService: z.number().int().nullable().optional(),
    description: z.string().max(500).optional(),
  })
  .refine((input) => !(input.idDirection && input.idService), {
    message: 'idDirection et idService sont mutuellement exclusifs (portée service ou direction, pas les deux)',
  })

export async function setParametre(matricule: string, cle: string, input: unknown) {
  assertCleConnue(cle)

  const result = scopeSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  const { schema } = PARAMETRES[cle]
  const valeurResult = schema.safeParse(result.data.valeur)
  if (!valeurResult.success) {
    throw new AppError(valeurResult.error.issues[0]?.message ?? 'Valeur invalide pour ce paramètre', 400)
  }

  return parametresRepository.upsert({
    cle,
    valeur: valeurResult.data,
    idDirection: result.data.idDirection ?? null,
    idService: result.data.idService ?? null,
    matriculeMaj: matricule,
    description: result.data.description,
  })
}
