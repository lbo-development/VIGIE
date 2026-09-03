-- Suppression physique d'un marché tiers (icône corbeille, MarchesTiers.tsx,
-- décision du 02/09/2026) — réservée ADMIN_APP/ADMIN_SERVICE/CB, même triplet
-- de rôles que insert/update (voir 20260901130000_create_marche_tiers.sql).
-- Le contrôle "pas encore référencé par une demande d'achat" est applicatif
-- (marcheTiers.service.ts#deleteMarcheTiers, via
-- demandeAchat.repository.ts#existsForMarcheTiers) — désormais possible grâce
-- à finances.demande_achat.id_marche_tiers, voir migration précédente
-- (20260902090000_demande_achat_add_marche_tiers_ref.sql). Filet de sécurité :
-- la FK correspondante n'a pas de ON DELETE CASCADE, Postgres refuserait de
-- toute façon la suppression en cas de bug applicatif.
grant delete on finances.marche_tiers to authenticated;

create policy "marche_tiers_delete_admin"
  on finances.marche_tiers
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );
