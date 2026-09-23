-- Correctif suite à l'alerte Security Advisor Supabase du 19/09/2026
-- ("Table accessible au public" / rls_disabled_in_public sur public.profiles).
--
-- public.profiles est une table partagée avec d'autres applications GPMM
-- (ex. escales — voir ForClaude/SECURITY.md §2.7), pas propre à VIGIE.
-- SECURITY.md documentait déjà cette table comme ayant la RLS activée et une
-- policy saine (profiles_select_self, lecture de sa propre ligne uniquement) :
-- vérifié le 23/09/2026 via l'éditeur SQL du dashboard, la policy existe
-- toujours intacte (SELECT, qual (id = auth.uid())) mais la RLS elle-même
-- était désactivée sur la table — régression par rapport à l'état documenté,
-- pas une modification introduite par ce dépôt (aucune migration suivie ici
-- n'a jamais touché à profiles). Ce correctif se contente de réactiver la
-- RLS ; la policy existante s'applique alors de nouveau sans rien recréer.
--
-- Coordination : cette table n'appartenant pas qu'à VIGIE, prévenir qui gère
-- escales de cette réactivation (comportement déjà documenté comme l'état
-- attendu, donc a priori sans impact, mais par précaution sur une ressource
-- partagée).

alter table public.profiles enable row level security;
