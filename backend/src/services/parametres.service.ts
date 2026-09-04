import { z } from 'zod'
import * as parametresRepository from '../repositories/parametres.repository.js'
import * as parametreDefinitionRepository from '../repositories/parametreDefinition.repository.js'
import * as acteurRepository from '../repositories/acteur.repository.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Schémas de validation des paramètres applicatifs connus. Le libellé, la
 * description et la valeur par défaut vivent désormais en base
 * (finances.parametre_definition, voir parametreDefinition.repository.ts) —
 * seule la logique de validation (type, bornes) reste ici : elle ne peut pas
 * être pilotée par des données sans un mini-DSL dédié, hors scope.
 *
 * Ajouter un paramètre = ajouter une entrée ici ET la ligne de définition
 * correspondante en base (migration), voir docs/ARCHITECTURE.md
 * ("Paramétrage applicatif").
 */
const PARAMETRE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'auth.inactivite_delai_minutes': z.number().int().min(1).max(240),
  // Date ISO (YYYY-MM-DD) de la dernière importation des marchés PGI pour un
  // service, ou JSON null (jamais SQL NULL, la colonne valeur est NOT NULL —
  // voir ForClaude/Importation-marches/import-marches-pgi.md §7) si ce
  // service n'a encore jamais importé.
  'last.import.marche.pgi': z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
    .nullable(),
  // Même mécanique que last.import.marche.pgi, pour l'import des commandes PGI — voir
  // commandePgiImport.service.ts.
  'last.import.commande.pgi': z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
    .nullable(),
  // Même mécanique déclarative, pour l'import des opérations d'investissement PGI — mais
  // purement informative (bandeau écran) : le fichier PGI ne porte aucune date de génération
  // fiable, cette valeur ne sert jamais de garde bloquante (voir
  // investissementImport.service.ts et ForClaude/importation-investissementsPGI/).
  'last.import.investissement.pgi': z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
    .nullable(),
}

function getSchema(cle: string): z.ZodTypeAny {
  const schema = PARAMETRE_SCHEMAS[cle]
  if (!schema) {
    throw new AppError(`Schéma de validation manquant pour le paramètre "${cle}" (registre backend non à jour)`, 500)
  }
  return schema
}

async function assertCleConnue(cle: string) {
  const definition = await parametreDefinitionRepository.findByCle(cle)
  if (!definition) throw new AppError(`Paramètre inconnu : "${cle}"`, 404)
  return definition
}

/** Métadonnées des paramètres connus (pour un écran d'administration). */
export async function listParametreKeys() {
  const definitions = await parametreDefinitionRepository.findAll()
  return definitions.map((d) => ({ cle: d.cle, libelle: d.libelle, defaut: d.valeur_defaut }))
}

/** Toutes les lignes existantes (une par portée) pour une clé connue. */
export async function listRows(cle: string) {
  await assertCleConnue(cle)
  return parametresRepository.findAllRows(cle)
}

export async function getParametreEffectif(matricule: string, cle: string) {
  const definition = await assertCleConnue(cle)
  const idService = await acteurRepository.findIdServiceByMatricule(matricule)
  const valeurBrute = await parametresRepository.findValeurEffective(cle, idService)
  const schema = getSchema(cle)
  const valeur = schema.parse(valeurBrute ?? definition.valeur_defaut)
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
  await assertCleConnue(cle)

  const result = scopeSchema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)
  }

  const schema = getSchema(cle)
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
