-- Import des opérations d'investissement PGI (voir
-- ForClaude/importation-investissementsPGI/import-investissements-pgi.md, nouvelle
-- fonctionnalité non prévue au CDC initial sous cette forme). finances.operation_investissement
-- existe déjà (créée hors migration versionnée, cf. ForClaude/SECURITY.md — note sur le GRANT
-- global non documenté) avec les 8 colonnes du MCD/MLD initial (NUMERO_OPERATION, LIBELLE,
-- MT_AP1, MT_AP8, MT_CP1, MT_CP8, DATE_CREATION, MT_INITIAL) et est vide à ce jour (vérifié en
-- lecture seule). Cette migration l'étend pour supporter l'import :
--   - id_service / code_cug : scoping RLS et contrôle d'éligibilité (CUG affecté au service
--     cible), même choix que finances.commande_pgi/marche_piece — id_service stampé depuis le
--     service cible de l'import, jamais dérivé du CUG.
--   - statut (texte brut A/F) + actif (booléen) : deux notions distinctes. Le fichier PGI ne
--     porte que les opérations au statut A ou F (§7 de la spec) ; `actif` bascule à false quand
--     une opération disparaît du nouveau lot éligible pour son service (fichier ou statut réel
--     alors inconnus) sans que `statut` soit modifié — jamais de suppression physique, même
--     principe que ETATMARCHE/ACTIF sur finances.marche.
--   - mt_ap1/mt_ap8/mt_cp1/mt_cp8 (une valeur unique par tranche) remplacées par 16 colonnes
--     (Budget/Engagement/Réel/Disponible x AP.1/AP.8/CP.1/CP.8) : les 4 tranches du schéma
--     initial sont confirmées dans le périmètre (§3/§4 de la spec), mais chacune détaillée en
--     ses 4 sous-montants plutôt qu'une seule valeur.
-- Table vide -> pas de backfill nécessaire pour les colonnes NOT NULL ajoutées.

-- Sécurité : numero_operation est déjà documenté comme clé (MCD "NUMERO_OPERATION (id)") mais sa
-- contrainte n'a pas pu être vérifiée en lecture seule depuis l'application (PostgREST ne
-- l'expose pas) — on s'assure ici qu'une clé primaire existe, sans erreur si elle est déjà en
-- place.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'finances.operation_investissement'::regclass
      and contype = 'p'
  ) then
    alter table finances.operation_investissement
      add primary key (numero_operation);
  end if;
end $$;

alter table finances.operation_investissement
  add column if not exists id_service bigint references finances.service(id_service),
  add column if not exists code_cug   text   references finances.cug(code_cug),
  add column if not exists statut     text,
  add column if not exists actif      boolean not null default true;

alter table finances.operation_investissement
  alter column id_service set not null,
  alter column code_cug   set not null,
  alter column statut     set not null;

alter table finances.operation_investissement
  add constraint operation_investissement_statut_check check (statut in ('A', 'F'));

comment on column finances.operation_investissement.code_cug is
  'CUG coordinateur (feuille OP) — contrôle d''éligibilité : doit être affecté au service cible de l''import.';
comment on column finances.operation_investissement.statut is
  'Valeur brute A/F de la feuille OP — dernière valeur connue lors du dernier import où l''opération était éligible (non modifiée quand actif passe à false).';
comment on column finances.operation_investissement.actif is
  'Flag d''inactivation à l''import (opération absente du dernier fichier éligible pour son service) — jamais de suppression physique.';

-- Remplacement des 4 colonnes de montant unique par les 16 colonnes détaillées (§11 de la spec).
alter table finances.operation_investissement
  drop column if exists mt_ap1,
  drop column if exists mt_ap8,
  drop column if exists mt_cp1,
  drop column if exists mt_cp8;

alter table finances.operation_investissement
  add column if not exists mt_budget_ap1  numeric not null default 0,
  add column if not exists mt_engage_ap1  numeric not null default 0,
  add column if not exists mt_liquide_ap1 numeric not null default 0,
  add column if not exists mt_solde_ap1   numeric not null default 0,
  add column if not exists mt_budget_ap8  numeric not null default 0,
  add column if not exists mt_engage_ap8  numeric not null default 0,
  add column if not exists mt_liquide_ap8 numeric not null default 0,
  add column if not exists mt_solde_ap8   numeric not null default 0,
  add column if not exists mt_budget_cp1  numeric not null default 0,
  add column if not exists mt_engage_cp1  numeric not null default 0,
  add column if not exists mt_liquide_cp1 numeric not null default 0,
  add column if not exists mt_solde_cp1   numeric not null default 0,
  add column if not exists mt_budget_cp8  numeric not null default 0,
  add column if not exists mt_engage_cp8  numeric not null default 0,
  add column if not exists mt_liquide_cp8 numeric not null default 0,
  add column if not exists mt_solde_cp8   numeric not null default 0;

comment on table finances.operation_investissement is
  'Opérations d''investissement PGI — upsert par numero_operation (jamais de suppression, voir actif), scopées par service, voir ForClaude/importation-investissementsPGI/.';

-- Table déjà couverte par la révocation globale authenticated de
-- 20260830100000_harden_finances_grants.sql — on ré-accorde ce qui est nécessaire à l'usage
-- applicatif (pas de delete : l'import ne fait qu'upserter et flaguer inactif).
grant select, insert, update on finances.operation_investissement to authenticated;

alter table finances.operation_investissement enable row level security;

-- Lecture scopée service + ADMIN_APP libre — même patron que
-- commande_pgi_select_scoped/marche_piece_select_scoped.
drop policy if exists "operation_investissement_select_scoped" on finances.operation_investissement;
create policy "operation_investissement_select_scoped"
  on finances.operation_investissement
  for select
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or id_service = finances.current_user_id_service()
  );

-- Écriture (insert/update, pas de delete — l'import upserte et flague inactif) réservée
-- ADMIN_APP/ADMIN_SERVICE/CB, même triplet que finances.commande_pgi/marche_piece/marche_tiers
-- (traduction RLS de assertManagesServiceOrHasRoleCb). Filet de sécurité : le backend écrit en
-- service_role et contourne le RLS de toute façon, le périmètre réel est vérifié côté Express.
drop policy if exists "operation_investissement_insert_admin" on finances.operation_investissement;
create policy "operation_investissement_insert_admin"
  on finances.operation_investissement
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

drop policy if exists "operation_investissement_update_admin" on finances.operation_investissement;
create policy "operation_investissement_update_admin"
  on finances.operation_investissement
  for update
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  )
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

-- updated_at (colonne déjà existante) tenu à jour automatiquement, même trigger que les autres
-- tables finances.* — recréé au cas où il n'aurait jamais été posé (table créée hors migration).
drop trigger if exists operation_investissement_set_updated_at on finances.operation_investissement;
create trigger operation_investissement_set_updated_at
  before update on finances.operation_investissement
  for each row execute function finances.set_updated_at();

-- Catalogue du paramètre applicatif last.import.investissement.pgi (portée par service — doit
-- être créée manuellement par ADMIN_APP pour un service avant son premier import, même mécanique
-- que last.import.marche.pgi/last.import.commande.pgi).
insert into finances.parametre_definition (cle, libelle, description, valeur_defaut)
values (
  'last.import.investissement.pgi',
  'Date de la dernière importation des investissements PGI',
  'Portée par service — doit être créée manuellement par ADMIN_APP pour un service avant son premier import. Purement informative (bandeau écran) : contrairement aux imports marchés/commandes, le fichier PGI ne porte aucune date de génération fiable, cette valeur ne sert donc pas de garde bloquante.',
  'null'::jsonb
)
on conflict (cle) do nothing;
