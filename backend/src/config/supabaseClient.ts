import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

// Client Supabase côté serveur, avec la clé service_role.
// Ne jamais exposer ce client ou cette clé côté frontend.
//
// Des valeurs de repli syntaxiquement valides sont utilisées quand les
// variables d'environnement sont absentes (ex: avant configuration, ou en
// test) afin que la construction du client ne fasse jamais planter l'appli :
// les vrais appels Supabase échoueront proprement à l'exécution avec un
// message d'erreur clair, plutôt qu'un crash au chargement du module.
export const supabase = createClient(
  env.supabaseUrl || 'http://localhost:54321',
  env.supabaseServiceRoleKey || 'placeholder-service-role-key',
)
