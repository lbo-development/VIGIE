import { supabase } from '../config/supabaseClient.js'

/**
 * finances.suppleance — dispositif de suppléance (RC/CDS/DS), géré ailleurs
 * dans l'application (hors périmètre du chantier CRUD gestion des
 * utilisateurs, décision du 10/09/2026). Seule une vérification de lecture
 * est nécessaire ici, en garde-fou de suppression d'un ACTEUR — voir
 * acteur.service.ts#deleteActeur.
 */

export async function existsForMatriculeSuppleant(matricule: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema('finances')
    .from('suppleance')
    .select('id_suppleance')
    .eq('matricule_suppleant', matricule)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
