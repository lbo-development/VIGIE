import { z } from 'zod'
import * as contactRepository from '../repositories/contact.repository.js'
import { assertManagesFournisseur } from './fournisseur.service.js'
import { AppError } from '../middlewares/errorHandler.js'

/**
 * Valeurs alignées sur la contrainte CHECK déjà en place dans la table
 * physique finances.contact (schéma préexistant, pas une liste inventée le
 * 29/08/2026 comme documenté un temps par erreur — voir MLD §2.2).
 */
const NATURE_FONCTION_VALUES = [
  'DIRIGEANT',
  'JURIDIQUE',
  'COMMERCIAL',
  "RESPONSABLE D'AFFAIRE",
  'RESPONSABLE TECHNIQUE',
  'TECHNICIEN',
  'RESPONSABLE FINANCIER/COMPTABILITE',
] as const

/**
 * Structure d'un numéro de téléphone (espaces/points/tirets tolérés comme
 * séparateurs de saisie, retirés avant validation ET avant stockage — le
 * numéro est conservé normalisé, sans séparateur) : soit un format local
 * français (0 suivi de 9 chiffres, ex. "06 83 09 58 81" → "0683095881"),
 * soit un format international (+ suivi de 8 à 15 chiffres au total — reprend
 * la limite E.164 sans imposer un découpage précis par pays, impossible à
 * valider strictement avec un seul motif, ex. "+33 6 83 09 58 81" →
 * "+33683095881", "+254 6 83 09 58 81" → "+254683095881").
 */
const PHONE_REGEX = /^(?:0\d{9}|\+\d{8,15})$/
const PHONE_ERROR_MESSAGE = 'Numéro de téléphone invalide (ex. 06 83 09 58 81 ou +33 6 83 09 58 81).'

const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => v === '' || PHONE_REGEX.test(v), { message: PHONE_ERROR_MESSAGE })
  .nullable()
  .optional()

// Nom, prénom et nature de fonction obligatoires ; au moins un des deux
// numéros de téléphone (fixe ou mobile) doit être renseigné — décision
// utilisateur du 29/08/2026, appliquée à la création ET à la modification
// (même schéma pour les deux, pour ne pas laisser un contact retomber dans
// un état incomplet après une modification). NOM toujours normalisé en
// majuscules (décision utilisateur), y compris si l'appelant envoie autre
// chose que le formulaire (ex. futur import).
const contactSchema = z
  .object({
    nom: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .transform((v) => v.toUpperCase()),
    prenom: z.string().trim().min(1).max(200),
    mail: z.string().trim().email().max(200).optional().nullable().or(z.literal('')),
    telfixe: phoneField,
    telmobile: phoneField,
    fonction: z.string().trim().max(200).optional().nullable(),
    naturefonction: z.enum(NATURE_FONCTION_VALUES),
  })
  .refine((data) => Boolean(data.telfixe) || Boolean(data.telmobile), {
    message: 'Renseignez au moins un numéro de téléphone (fixe ou mobile).',
    path: ['telfixe'],
  })

const createContactSchema = contactSchema
const updateContactSchema = contactSchema

/** Réutilisé par le contrôleur pour proposer les options de la combobox Nature de fonction. */
export const NATUREFONCTION_OPTIONS = NATURE_FONCTION_VALUES

export async function createContact(matricule: string | null, idFournisseur: number, input: unknown) {
  const result = createContactSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  await assertManagesFournisseur(matricule, idFournisseur)

  return contactRepository.create({
    id_fournisseur: idFournisseur,
    nom: result.data.nom,
    prenom: result.data.prenom || null,
    mail: result.data.mail || null,
    telfixe: result.data.telfixe || null,
    telmobile: result.data.telmobile || null,
    fonction: result.data.fonction || null,
    naturefonction: result.data.naturefonction ?? null,
  })
}

export async function updateContact(matricule: string | null, idContact: number, input: unknown) {
  const result = updateContactSchema.safeParse(input)
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? 'Requête invalide', 400)

  const contact = await contactRepository.findById(idContact)
  if (!contact) throw new AppError('Contact introuvable', 404)

  await assertManagesFournisseur(matricule, contact.id_fournisseur)

  return contactRepository.update(idContact, {
    nom: result.data.nom,
    prenom: result.data.prenom || null,
    mail: result.data.mail || null,
    telfixe: result.data.telfixe || null,
    telmobile: result.data.telmobile || null,
    fonction: result.data.fonction || null,
    naturefonction: result.data.naturefonction ?? null,
  })
}

/** CONTACT n'a pas de champ d'état (contrairement à FOURNISSEUR) : suppression physique, aucune autre table ne le référence. */
export async function deleteContact(matricule: string | null, idContact: number): Promise<void> {
  const contact = await contactRepository.findById(idContact)
  if (!contact) throw new AppError('Contact introuvable', 404)

  await assertManagesFournisseur(matricule, contact.id_fournisseur)

  await contactRepository.remove(idContact)
}
