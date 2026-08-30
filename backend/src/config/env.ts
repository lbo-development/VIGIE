import 'dotenv/config'

/**
 * Centralise la lecture des variables d'environnement.
 * Toute nouvelle variable doit être ajoutée ici (et dans .env.example),
 * jamais lue directement via process.env ailleurs dans le code.
 */
export const env = {
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  // .trim() : une valeur d'URL collée dans un dashboard (Railway, etc.) peut
  // embarquer un retour à la ligne invisible en fin de chaîne, ce qui fait
  // planter helmet au moment de construire le header Content-Security-Policy.
  supabaseUrl: (process.env.SUPABASE_URL ?? '').trim(),
  supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Liste blanche CORS : une ou plusieurs origines séparées par des virgules
  // (ex: "http://localhost:5173,https://mon-app.vercel.app"). Jamais de '*'
  // sur une route authentifiée — voir ForClaude/SECURITY.md.
  corsOrigins: (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}

if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
  const message =
    '[config] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant(e) — copie .env.example vers .env et renseigne tes clés Supabase.'
  // En production, une clé manquante ne doit jamais dégénérer en une cascade
  // d'échecs réseau opaques (audit de sécurité du 30/08/2026, voir
  // ForClaude/SECURITY.md) — on préfère un crash immédiat et explicite au
  // démarrage. En dev/test, on garde le repli tolérant (voir
  // config/supabaseClient.ts) pour ne pas bloquer un poste pas encore
  // configuré ou l'exécution des tests.
  if (env.nodeEnv === 'production') {
    throw new Error(message)
  }
  console.warn(message)
}
