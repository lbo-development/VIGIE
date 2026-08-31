-- Ajoute à SECTEUR/SOUS_SECTEUR les policies INSERT/UPDATE déjà en place sur
-- SITE/SOUS_SITE (repérées via pg_policies le 30/08/2026, jamais capturées
-- dans une migration suivie par ce dépôt — voir ForClaude/SECURITY.md) —
-- décision du 30/08/2026 : même modèle d'habilitation pour les deux
-- référentiels (ADMIN_APP transverse, ou ADMIN_SERVICE scopé à son propre
-- service). Les policies SELECT (*_select_authenticated) existent déjà sur
-- les deux tables, non recréées ici. SOUS_SECTEUR n'a pas de colonne
-- id_service propre (comme SOUS_SITE) : la portée ADMIN_SERVICE se résout
-- par jointure sur SECTEUR via code_secteur, jamais dupliquée sur la ligne.

drop policy if exists "secteur_insert_admin" on finances.secteur;
create policy "secteur_insert_admin"
  on finances.secteur
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE', id_service)
  );

drop policy if exists "secteur_update_admin" on finances.secteur;
create policy "secteur_update_admin"
  on finances.secteur
  for update
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE', id_service)
  )
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE', id_service)
  );

drop policy if exists "sous_secteur_insert_admin" on finances.sous_secteur;
create policy "sous_secteur_insert_admin"
  on finances.sous_secteur
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or exists (
      select 1 from finances.secteur s
      where s.code_secteur = sous_secteur.code_secteur
        and finances.current_user_has_role('ADMIN_SERVICE', s.id_service)
    )
  );

drop policy if exists "sous_secteur_update_admin" on finances.sous_secteur;
create policy "sous_secteur_update_admin"
  on finances.sous_secteur
  for update
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or exists (
      select 1 from finances.secteur s
      where s.code_secteur = sous_secteur.code_secteur
        and finances.current_user_has_role('ADMIN_SERVICE', s.id_service)
    )
  )
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or exists (
      select 1 from finances.secteur s
      where s.code_secteur = sous_secteur.code_secteur
        and finances.current_user_has_role('ADMIN_SERVICE', s.id_service)
    )
  );
