-- Import des commandes PGI (voir ForClaude/importation-commandePGI/, nouvelle fonctionnalité non
-- prévue au CDC initial). Table neuve : contrairement à finances.marche (NUMMARCHE unique dans le
-- fichier PGI), le couple (Commande, Ligne de commande) n'est PAS unique dans l'export commandes —
-- des lignes dupliquées avec des quantités différentes ont été observées sur le fichier réel, sans
-- qu'aucune autre colonne ne les distingue. Décision utilisateur : NUMCMD devient la clé unique de
-- cette table, les lignes valides d'une même commande étant agrégées à l'import (MTACTUEL/
-- MTENGAGE/MTLIQUIDE sommés, les autres champs pris sur la ligne au MTACTUEL le plus élevé — voir
-- commandePgiImport.service.ts).
--
-- Chaque import est un "annule et remplace" complet par service (pas de création/modification/
-- archivage ligne à ligne comme finances.marche) : ID_SERVICE stampé à l'écriture depuis le
-- service cible de l'import (pas dérivé de CODE_CUG), même choix que finances.marche_piece/
-- marche_tiers (RLS scoping simple et fiable, cf. 20260902130000_marche_piece_add_id_service.sql).
create table finances.commande_pgi (
  numcmd             text primary key,
  code_cug           text not null references finances.cug(code_cug),
  id_service         bigint not null references finances.service(id_service),
  acheteur           text not null,
  dtecmd             date not null,
  -- Nullable : le fichier PGI utilise parfois la valeur 0 comme marqueur "vide" pour ces deux
  -- colonnes (voir commandePgiImport.service.ts, normalisation à l'import).
  compte_budgetaire  integer,
  catop              text,
  libfournisseur     text not null,
  -- Texte libre, sans clé étrangère vers finances.marche (décision explicite de l'utilisateur :
  -- pas de dépendance d'ordre entre l'import marchés et l'import commandes).
  marche             text,
  mtactuel           numeric not null default 0,
  mtengage           numeric not null default 0,
  mtliquide          numeric not null default 0,
  -- Date du fichier PGI ayant produit cette ligne (cellule AA1, voir commandePgiImport.service.ts).
  dtelastimport      date not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table finances.commande_pgi is
  'Commandes PGI agrégées par numéro de commande (NUMCMD) — import "annule et remplace" par service, voir ForClaude/importation-commandePGI/.';

grant select, insert, delete on finances.commande_pgi to authenticated;

alter table finances.commande_pgi enable row level security;

-- Lecture scopée service (finances.current_user_id_service(), déjà créée pour marche_piece/
-- marche_tiers) + ADMIN_APP libre — même patron que marche_piece_select_scoped/
-- marche_tiers_select_scoped.
create policy "commande_pgi_select_scoped"
  on finances.commande_pgi
  for select
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or id_service = finances.current_user_id_service()
  );

-- Écriture (insert/delete, pas d'update — l'import ne fait jamais que supprimer puis réinsérer)
-- réservée ADMIN_APP/ADMIN_SERVICE/CB — traduction RLS de assertManagesServiceOrHasRoleCb, même
-- triplet que finances.marche_piece/marche_tiers. Filet de sécurité : le backend écrit en
-- service_role et contourne le RLS de toute façon, le périmètre réel est vérifié côté Express.
create policy "commande_pgi_insert_admin"
  on finances.commande_pgi
  for insert
  to authenticated
  with check (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

create policy "commande_pgi_delete_admin"
  on finances.commande_pgi
  for delete
  to authenticated
  using (
    finances.current_user_has_role('ADMIN_APP')
    or finances.current_user_has_role('ADMIN_SERVICE')
    or finances.current_user_has_role('CB')
  );

create trigger commande_pgi_set_updated_at
  before update on finances.commande_pgi
  for each row execute function finances.set_updated_at();

-- Catalogue du paramètre applicatif last.import.commande.pgi (portée par service — doit être
-- créée manuellement par ADMIN_APP pour un service avant son premier import, même mécanique que
-- last.import.marche.pgi, voir 20260830120000_marche_import_prerequisites.sql).
insert into finances.parametre_definition (cle, libelle, description, valeur_defaut)
values (
  'last.import.commande.pgi',
  'Date de la dernière importation des commandes PGI',
  'Portée par service — doit être créée manuellement par ADMIN_APP pour un service avant son premier import.',
  'null'::jsonb
)
on conflict (cle) do nothing;
