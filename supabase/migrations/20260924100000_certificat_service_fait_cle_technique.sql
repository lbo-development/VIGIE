-- Clé technique de substitution sur CERTIFICAT_SERVICE_FAIT (décision du
-- 24/09/2026, résout le point ouvert laissé par le MLD depuis le 07/09/2026)
-- — même raisonnement que la migration 20260907130000 pour DEMANDE_ACHAT :
-- NUMERO_CSF (NUMERO de la FAD + suffixe -Cnn) hériterait du risque de
-- collision inter-services de la FAD si on continuait à s'appuyer dessus
-- comme identifiant physique. Voir ForClaude/CDC/mld-phases-1-2.md §3.
--
-- Vérifié en lecture seule avant d'écrire cette migration (résultat collé
-- par l'utilisateur) : finances.certificat_service_fait et
-- finances.historique_statut_csf sont vides (0 ligne) — bascule de clé sans
-- donnée à migrer, comme pour demande_achat en son temps.
--
-- Au passage, deux anomalies du schéma pré-existant (jamais exploité par du
-- code applicatif) corrigées ici :
--   - historique_statut_csf.id_histo_csf n'avait aucun DEFAULT (ni identity
--     ni séquence) malgré son rôle de clé primaire — un INSERT applicatif
--     sans valeur explicite aurait échoué (NOT NULL sans défaut). Corrigé en
--     identity, sur le modèle de historique_statut.id_histo.
--   - finances.piece_jointe.numero_csf n'avait qu'une contrainte CHECK
--     d'exclusivité (chk_pj_rattachement_exclusif) documentée, mais aussi
--     une FK piece_jointe_numero_csf_fkey non documentée (découverte au
--     premier essai d'exécution) — reconstruit ici en id_csf, avec sa FK.
--
-- Réécrite en version IDEMPOTENTE (chaque étape gardée par une vérification
-- d'existence) : les tentatives précédentes de cette migration ont échoué à
-- mi-parcours à deux reprises (FK piece_jointe non prévue, puis
-- "id_histo_csf is already an identity column"), et l'éditeur SQL Supabase
-- valide chaque instruction indépendamment plutôt que tout-ou-rien — l'état
-- réel en base était donc un mélange partiel imprévisible. Cette version
-- peut être rejouée autant de fois que nécessaire, quel que soit l'état de
-- départ, jusqu'à ce qu'elle passe entièrement.

do $$
begin
  -- 1) certificat_service_fait : ajout de la clé technique, bascule de la PK.
  if exists (
    select 1 from pg_constraint
    where conname = 'historique_statut_csf_numero_csf_fkey'
      and conrelid = 'finances.historique_statut_csf'::regclass
  ) then
    alter table finances.historique_statut_csf drop constraint historique_statut_csf_numero_csf_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'piece_jointe_numero_csf_fkey'
      and conrelid = 'finances.piece_jointe'::regclass
  ) then
    alter table finances.piece_jointe drop constraint piece_jointe_numero_csf_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'certificat_service_fait_pkey'
      and conrelid = 'finances.certificat_service_fait'::regclass
      and contype = 'p'
      -- ne s'applique que si la PK porte encore sur numero_csf (ancienne PK) —
      -- si elle porte déjà sur id_csf, ne rien faire.
      and conkey = (select array_agg(attnum) from pg_attribute
                    where attrelid = 'finances.certificat_service_fait'::regclass and attname = 'numero_csf')
  ) then
    alter table finances.certificat_service_fait drop constraint certificat_service_fait_pkey;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'finances' and table_name = 'certificat_service_fait' and column_name = 'id_csf'
  ) then
    alter table finances.certificat_service_fait add column id_csf bigint generated always as identity;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'certificat_service_fait_pkey' and conrelid = 'finances.certificat_service_fait'::regclass
  ) then
    alter table finances.certificat_service_fait add constraint certificat_service_fait_pkey primary key (id_csf);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_csf_demande_achat_numero' and conrelid = 'finances.certificat_service_fait'::regclass
  ) then
    alter table finances.certificat_service_fait add constraint uq_csf_demande_achat_numero unique (id_demande_achat, numero_csf);
  end if;

  -- 2) historique_statut_csf : id_csf remplace numero_csf comme FK.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'finances' and table_name = 'historique_statut_csf' and column_name = 'id_csf'
  ) then
    alter table finances.historique_statut_csf add column id_csf bigint;
  end if;

  -- Table vide (0 ligne vérifiée) : SET NOT NULL sans risque, et sans effet
  -- si déjà en place (relançable).
  alter table finances.historique_statut_csf alter column id_csf set not null;

  if not exists (
    select 1 from pg_constraint
    where conname = 'historique_statut_csf_id_csf_fkey' and conrelid = 'finances.historique_statut_csf'::regclass
  ) then
    alter table finances.historique_statut_csf
      add constraint historique_statut_csf_id_csf_fkey
      foreign key (id_csf) references finances.certificat_service_fait(id_csf) on delete restrict;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'finances' and table_name = 'historique_statut_csf' and column_name = 'numero_csf'
  ) then
    alter table finances.historique_statut_csf drop column numero_csf;
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'finances' and c.relname = 'ix_hscsf_csf'
  ) then
    create index ix_hscsf_csf on finances.historique_statut_csf (id_csf);
  end if;

  -- Correction de l'anomalie id_histo_csf sans DEFAULT.
  if not exists (
    select 1 from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'finances' and c.relname = 'historique_statut_csf'
      and a.attname = 'id_histo_csf' and a.attidentity <> ''
  ) then
    alter table finances.historique_statut_csf alter column id_histo_csf add generated always as identity;
  end if;

  -- Réponse libre à une reprise (même mécanique que HISTORIQUE_STATUT côté
  -- FAD) : renommage reflétant l'usage élargi, aucun changement de type.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'finances' and table_name = 'historique_statut_csf' and column_name = 'commentaire_motif'
  ) then
    alter table finances.historique_statut_csf rename column commentaire_motif to commentaire_statut;
  end if;

  -- 3) piece_jointe : id_csf remplace numero_csf comme rattachement CSF.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'finances' and table_name = 'piece_jointe' and column_name = 'id_csf'
  ) then
    alter table finances.piece_jointe add column id_csf bigint references finances.certificat_service_fait(id_csf) on delete restrict;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'chk_pj_rattachement_exclusif' and conrelid = 'finances.piece_jointe'::regclass
  ) then
    alter table finances.piece_jointe drop constraint chk_pj_rattachement_exclusif;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'finances' and table_name = 'piece_jointe' and column_name = 'numero_csf'
  ) then
    alter table finances.piece_jointe drop column numero_csf;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_pj_rattachement_exclusif' and conrelid = 'finances.piece_jointe'::regclass
  ) then
    alter table finances.piece_jointe add constraint chk_pj_rattachement_exclusif check (num_nonnulls(id_demande_achat, id_csf) = 1);
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'finances' and c.relname = 'ix_pj_csf'
  ) then
    create index ix_pj_csf on finances.piece_jointe (id_csf);
  end if;
end $$;

comment on column finances.certificat_service_fait.id_csf is
  'Clé technique de substitution (décision du 24/09/2026) — remplace numero_csf comme clé primaire, même raisonnement que demande_achat.id_demande_achat (numero_csf hérite du risque de collision inter-services de la FAD). Référencée par historique_statut_csf et piece_jointe.';
