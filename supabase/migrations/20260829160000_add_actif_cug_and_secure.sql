-- CUG : ajout du flag ACTIF (décision du 29/08/2026, voir
-- ForClaude/CDC/mld-phases-1-2.md §2.2) — même principe que
-- DIRECTION/SERVICE/CELLULE/SITE/SECTEUR : désactivation, jamais de
-- suppression physique (CUG est référencé par MARCHE.CUGGestion et
-- DEMANDE_ACHAT.CODE_CUG, imputation obligatoire — arbitrage 1).
alter table finances.cug add column if not exists actif boolean not null default true;

-- Sécurisation (GRANT/RLS/policies) — écrit défensivement avec DROP POLICY
-- IF EXISTS car l'état RLS actuel de cette table n'a pas été vérifié avant
-- écriture de ce script (contrairement à fournisseur/contact, où
-- `pg_policies` avait été interrogée au préalable) : ce script est donc
-- sûr à exécuter que des policies existent déjà ou non, mais si des
-- policies différentes de celles ci-dessous existent, vérifie après coup
-- qu'aucune ne reste en doublon avec un nom différent.
grant usage on schema finances to authenticated;
grant select, insert, update on finances.cug to authenticated;

alter table finances.cug enable row level security;

-- Lecture ET écriture réservées à ADMIN_APP (transverse) ou ADMIN_SERVICE
-- (scopé à son service) — contrairement à SITE/SECTEUR/FOURNISSEUR, la
-- lecture n'est PAS ouverte à tout authenticated ici : CUG est un
-- référentiel d'administration limité à ces deux rôles (décision du
-- 29/08/2026), pas de périmètre Demandeur. Comme d'habitude, la policy RLS
-- ne vérifie que le rôle ; le scoping fin par service pour ADMIN_SERVICE
-- est appliqué côté Express (assertManagesService), le backend utilisant
-- service_role qui contourne le RLS de toute façon (voir SECURITY.md §6).
drop policy if exists "cug_select_admin" on finances.cug;
create policy "cug_select_admin"
  on finances.cug
  for select
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

drop policy if exists "cug_insert_admin" on finances.cug;
create policy "cug_insert_admin"
  on finances.cug
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
  );

drop policy if exists "cug_update_admin" on finances.cug;
create policy "cug_update_admin"
  on finances.cug
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
-- Pas de policy DELETE : pas de suppression physique (ACTIF sert d'archivage).
