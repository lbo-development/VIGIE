-- RLS finances.statut (référentiel des 25 statuts DA/FAD, voir
-- ForClaude/CDC/code_statut.pdf et la migration 20260914100000_rebuild_statut_depuis_code_statut_pdf.sql
-- qui a recréé la table). Chantier écran d'accueil/workflow FAD (OP1.2 à OP1.6) — cette table
-- fait partie de la liste révoquée à `authenticated` par 20260830100000_harden_finances_grants.sql
-- (RLS activée, sans policy = accès refusé par défaut). Aucun accès direct frontend/Supabase
-- n'est utilisé aujourd'hui (tout passe par le backend Express, service_role), mais une policy
-- explicite est ajoutée par défense en profondeur, même principe que
-- 20260905090000_create_libelle_referentiel.sql (libelle_referentiel_select_authenticated).

grant usage on schema finances to authenticated;
grant select on finances.statut to authenticated;

alter table finances.statut enable row level security;

-- Lecture ouverte à tout utilisateur authentifié — référentiel transverse, aucune notion de
-- périmètre (comme libelle_referentiel).
drop policy if exists "statut_select_authenticated" on finances.statut;
create policy "statut_select_authenticated"
  on finances.statut
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

-- Aucune policy insert/update/delete pour authenticated : le référentiel des 25 statuts est figé
-- par migration (source de vérité ForClaude/CDC/code_statut.pdf), jamais modifié par l'application.
