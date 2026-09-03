-- Resserre la policy SELECT de finances.marche_tiers (décision du 02/09/2026, suite au même
-- audit de sécurité que 20260902130000_marche_piece_add_id_service.sql). La policy initiale
-- (marche_tiers_select_authenticated, créée dans 20260901130000_create_marche_tiers.sql)
-- n'exigeait que current_user_matricule() IS NOT NULL, sans scoping par service — un agent
-- authentifié pouvait lire, via l'API REST Supabase directe (en contournant Express), les
-- marchés tiers de TOUS les services, pas seulement le sien.
--
-- Contrairement à marche_piece, aucune colonne à ajouter ici : finances.marche_tiers porte
-- ID_SERVICE en propre depuis sa création (pas de résolution CUG/fournisseur nécessaire), et
-- finances.current_user_id_service() existe déjà (créée par la migration marche_piece
-- précédente) — simple remplacement de policy.

drop policy if exists "marche_tiers_select_authenticated" on finances.marche_tiers;

create policy "marche_tiers_select_scoped"
  on finances.marche_tiers
  for select
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or id_service = finances.current_user_id_service()
  );
