-- Suppression conditionnelle de FOURNISSEUR (ADMIN_APP/ADMIN_SERVICE),
-- décision du 29/08/2026 — voir ForClaude/CDC/mld-phases-1-2.md §2.2. La
-- condition métier ("aucun MARCHE/DEMANDE_ACHAT/DEVIS_CONSULTE ne référence
-- ce fournisseur") est vérifiée côté Express
-- (fournisseur.service.ts#deleteFournisseur), pas en RLS — cette policy ne
-- couvre que le rôle, comme les policies INSERT/UPDATE existantes.
--
-- Filet de sécurité : les FK marche_id_fournisseur_fkey,
-- demande_achat_id_fournisseur_retenu_fkey et devis_consulte_id_fournisseur_fkey
-- n'ont aucun ON DELETE CASCADE (RESTRICT par défaut) — Postgres refuse déjà
-- physiquement une suppression si l'une de ces tables référence encore le
-- fournisseur, même en cas de bug dans la vérification applicative.
--
-- finances.contact n'a pas besoin d'une nouvelle policy DELETE : elle existe
-- déjà (contact_delete_admin, migration 20260829130000).
create policy "fournisseur_delete_admin"
  on finances.fournisseur
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );
