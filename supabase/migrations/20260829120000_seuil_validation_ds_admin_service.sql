-- Ouvre l'écriture sur finances.seuil_validation_ds à ADMIN_SERVICE, en plus
-- d'ADMIN_APP (décision du 29/08/2026 — voir ForClaude/CDC/mld-phases-1-2.md
-- §2.6). Remplace la restriction ADMIN_APP seul posée le 28/08/2026 dans
-- 20260828112927_simplify_seuil_validation_ds.sql.
--
-- Même règle RLS que finances.site / finances.secteur (ForClaude/SECURITY.md
-- §2.4) : la policy ne vérifie que le rôle (ADMIN_APP OU ADMIN_SERVICE), pas
-- que le service visé correspond à celui de l'ADMIN_SERVICE courant — ce
-- scoping fin est appliqué côté Express (assertManagesService), le backend
-- utilisant service_role qui contourne le RLS de toute façon.

drop policy if exists "seuil_validation_ds_insert_admin_app" on finances.seuil_validation_ds;
drop policy if exists "seuil_validation_ds_update_admin_app" on finances.seuil_validation_ds;
drop policy if exists "seuil_validation_ds_delete_admin_app" on finances.seuil_validation_ds;

create policy "seuil_validation_ds_insert_admin"
  on finances.seuil_validation_ds
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

create policy "seuil_validation_ds_update_admin"
  on finances.seuil_validation_ds
  for update
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  )
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

create policy "seuil_validation_ds_delete_admin"
  on finances.seuil_validation_ds
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );
