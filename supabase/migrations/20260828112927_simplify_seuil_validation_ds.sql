-- Simplification de finances.seuil_validation_ds (décision du 28/08/2026,
-- annule et remplace l'historisation décrite dans ForClaude/CDC/mld-phases-1-2.md
-- §2.6 — à répercuter dans le MLD/MCD une fois ce script exécuté) :
--   - Plus d'historisation ni de TYPE_IMPUTATION en ligne séparée : une seule
--     ligne par SERVICE, avec un seuil FONCTIONNEMENT et un seuil
--     INVESTISSEMENT en colonnes.
--   - Plus de DATE_APPLICATION.
--   - Un service sans seuil défini est traité comme seuil = 0 (porté par
--     DEFAULT 0 + NOT NULL, jamais de NULL à interpréter côté application).
--
-- Destructeur : suppose qu'aucune donnée réelle n'existe encore dans l'ancienne
-- table (confirmé) — pas d'étape de reprise de données. Si ce n'est plus vrai
-- au moment d'exécuter ce script, ne pas l'appliquer tel quel.

drop table if exists finances.seuil_validation_ds;

create table finances.seuil_validation_ds (
  id_service bigint primary key references finances.service (id_service),
  seuil_fonctionnement numeric not null default 0,
  seuil_investissement numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table finances.seuil_validation_ds is
  'Seuils de dispense de validation DS, un par service (FONCTIONNEMENT + '
  'INVESTISSEMENT en colonnes) — plus d''historisation. Absence de ligne pour '
  'un service = seuils considérés à 0 (toujours transmis au DS, jamais '
  'd''exemption automatique par défaut).';

-- GRANT ≠ POLICY (ForClaude/SECURITY.md §2.2) : préalable indispensable avant les policies.
grant usage on schema finances to authenticated;
grant select, insert, update, delete on finances.seuil_validation_ds to authenticated;

alter table finances.seuil_validation_ds enable row level security;

-- Lecture : ouverte à tout authenticated rattaché à un ACTEUR (matricule non
-- null), même règle que les autres référentiels (site/secteur/direction/...).
create policy "seuil_validation_ds_select_authenticated"
  on finances.seuil_validation_ds
  for select
  to authenticated
  using (public.current_user_matricule() is not null);

-- Écriture : réservée à ADMIN_APP (décision du 28/08/2026 — simplification
-- assumée par rapport au MLD, qui documentait un droit DS scopé à sa propre
-- direction ; non implémenté côté application, voir seuilValidationDs.service.ts).
create policy "seuil_validation_ds_insert_admin_app"
  on finances.seuil_validation_ds
  for insert
  to authenticated
  with check (finances.current_user_has_role('ADMIN_APP'));

create policy "seuil_validation_ds_update_admin_app"
  on finances.seuil_validation_ds
  for update
  to authenticated
  using (finances.current_user_has_role('ADMIN_APP'))
  with check (finances.current_user_has_role('ADMIN_APP'));

create policy "seuil_validation_ds_delete_admin_app"
  on finances.seuil_validation_ds
  for delete
  to authenticated
  using (finances.current_user_has_role('ADMIN_APP'));
