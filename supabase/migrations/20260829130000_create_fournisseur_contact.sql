-- FOURNISSEUR + CONTACT — sécurisation, pas création (référentiel rattaché à
-- un SERVICE — voir ForClaude/CDC/mld-phases-1-2.md §2.2). Décision du
-- 29/08/2026 sur les droits d'accès : ADMIN_APP (transverse) + ADMIN_SERVICE
-- (scopé à son service) en écriture — voir ForClaude/CDC/mot-phases-1-2.md
-- l.68 (l'acteur documenté est admin_service, étendu à admin_app par
-- cohérence avec SITE/SECTEUR/SEUIL_VALIDATION_DS). Lecture : ouverte à
-- ADMIN_APP (transverse) et scopée au service de l'acteur pour ADMIN_SERVICE
-- et Demandeur (qui n'a pas de rôle dédié — voir MOT l.15) — voir
-- ForClaude/SECURITY.md §2.5.
--
-- IMPORTANT : finances.fournisseur et finances.contact existaient déjà
-- physiquement avant cette migration (schéma préexistant, hors du dépôt de
-- migrations trackées) — ce script ne les crée PAS, seulement GRANT/RLS/
-- policies, absents jusqu'ici (`select * from pg_policies where
-- schemaname='finances' and tablename in ('fournisseur','contact')` ne
-- renvoyait aucune ligne au 29/08/2026). Une première version de ce fichier
-- contenait par erreur un CREATE TABLE — corrigé après découverte du schéma
-- réel : NATUREFONCTION (CONTACT) a une contrainte CHECK déjà en place avec
-- des valeurs différentes de celles initialement documentées ici (DIRIGEANT,
-- JURIDIQUE, COMMERCIAL, RESPONSABLE D'AFFAIRE, RESPONSABLE TECHNIQUE,
-- TECHNICIEN, RESPONSABLE FINANCIER/COMPTABILITE — tout en majuscules), et
-- FOURNISSEUR.SIRET est NOT NULL (pas optionnel comme initialement codé).
--
-- Pas de suppression physique sur FOURNISSEUR (ETATFOURNISSEUR Actif/Inactif,
-- même principe que SITE/SECTEUR/MARCHE — référencé par DEMANDE_ACHAT,
-- DEVIS_CONSULTE, MARCHE, cf. MLD §2.2/§2.4). CONTACT n'est référencé par
-- aucune autre table du modèle : suppression physique autorisée (pas de
-- champ d'état documenté au MCD pour CONTACT).

-- GRANT ≠ POLICY (ForClaude/SECURITY.md §2.2) : préalable indispensable avant les policies.
grant usage on schema finances to authenticated;
grant select, insert, update, delete on finances.fournisseur to authenticated;
grant select, insert, update, delete on finances.contact to authenticated;

alter table finances.fournisseur enable row level security;
alter table finances.contact enable row level security;

-- Lecture : ouverte à tout authenticated rattaché (matricule non null) — le
-- scoping fin par service (ADMIN_SERVICE et Demandeur ne voient que leur
-- service, ADMIN_APP voit tout) est appliqué côté Express, pas en RLS : le
-- backend utilise service_role, qui contourne le RLS de toute façon (voir
-- SECURITY.md §2.4/§6) — même principe que SITE/SECTEUR.
create policy "fournisseur_select_authenticated"
  on finances.fournisseur
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

-- Ne couvre pas la création par un Demandeur pour son propre service (voir
-- assertManagesServiceOrIsOwnActor côté backend, SECURITY.md §2.5) : écart
-- assumé, le backend reste seul juge en pratique (service_role).
create policy "fournisseur_insert_admin"
  on finances.fournisseur
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

create policy "fournisseur_update_admin"
  on finances.fournisseur
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
-- Policy DELETE sur fournisseur : ajoutée plus tard, voir
-- 20260829140000_fournisseur_delete_policy.sql (suppression conditionnelle,
-- non référencé par MARCHE/DEMANDE_ACHAT/DEVIS_CONSULTE).

create policy "contact_select_authenticated"
  on finances.contact
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

create policy "contact_insert_admin"
  on finances.contact
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

create policy "contact_update_admin"
  on finances.contact
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

create policy "contact_delete_admin"
  on finances.contact
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );
