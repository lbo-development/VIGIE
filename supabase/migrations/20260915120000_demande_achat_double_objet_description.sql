-- Décision du 15/09/2026 (écran de suivi RC) : double champ OBJET/DESCRIPTION —
-- OBJET_DEMANDEUR/DESCRIPTION_DEMANDEUR (formulation d'origine du demandeur, OP1.1, jamais
-- modifiée après transmission au RC) et OBJET_RC/DESCRIPTION_RC (reformulation du RC, OP1.2b).
-- Jusqu'ici une seule colonne OBJET/DESCRIPTION existait, écrasée par la reformulation RC —
-- la formulation d'origine du demandeur disparaissait sans trace, y compris dans
-- HISTORIQUE_STATUT (qui ne porte que le statut et un commentaire, jamais objet/description).
--
-- Synchronisation applicative (backend/src/services/demandeAchat.service.ts) : tant que la DA
-- reste éditable par le demandeur (DA_EN_PREPARATION/DA_A_COMPLETER_RC — mêmes statuts que
-- STATUTS_MODIFIABLES), updateDemandeAchat (OP1.1) recopie OBJET_DEMANDEUR/DESCRIPTION_DEMANDEUR
-- dans OBJET_RC/DESCRIPTION_RC à chaque modification. À partir d'OP1.2b (transmettreFad) et de
-- sa reprise (retransmettreCb), seul le RC écrit OBJET_RC/DESCRIPTION_RC — OBJET_DEMANDEUR/
-- DESCRIPTION_DEMANDEUR restent figés à partir de là, trace de la formulation d'origine.
-- OBJET_RC fait foi partout ailleurs dans l'application une fois la FAD constituée (décision
-- explicite du 15/09/2026).

alter table finances.demande_achat rename column objet to objet_demandeur;
alter table finances.demande_achat rename column description to description_demandeur;

alter table finances.demande_achat
  add column objet_rc text,
  add column description_rc text;

-- Seed : toute DA déjà en base reçoit OBJET_RC/DESCRIPTION_RC = valeur demandeur actuelle (rien
-- à perdre, environnement de développement — tables vides ou brouillons récents en pratique).
update finances.demande_achat set objet_rc = objet_demandeur, description_rc = description_demandeur;

alter table finances.demande_achat alter column objet_rc set not null;

comment on column finances.demande_achat.objet_demandeur is
  'Formulation d''origine du demandeur (OP1.1) — jamais modifiée après transmission au RC (décision du 15/09/2026).';
comment on column finances.demande_achat.description_demandeur is
  'Idem OBJET_DEMANDEUR, pour la description.';
comment on column finances.demande_achat.objet_rc is
  'Reformulation du RC (OP1.2b) — synchronisée sur OBJET_DEMANDEUR tant que la DA reste éditable par le demandeur (DA_EN_PREPARATION/DA_A_COMPLETER_RC), fait foi ensuite partout ailleurs dans l''application.';
comment on column finances.demande_achat.description_rc is
  'Idem OBJET_RC, pour la description.';

-- finances.creer_demande_achat_brouillon (migrations 20260907160000/20260907170000) : adapte les
-- colonnes renommées, seed OBJET_RC='' dès la création (synchronisé avec OBJET_DEMANDEUR comme
-- le reste du cycle DA_EN_PREPARATION). Signature inchangée (mêmes paramètres/retour) : les GRANT
-- déjà en place (migration 20260908090000) survivent au CREATE OR REPLACE.
create or replace function finances.creer_demande_achat_brouillon(
  p_id_service bigint,
  p_matricule_demandeur text
)
returns finances.demande_achat
language plpgsql
security definer
set search_path = finances, pg_temp
as $$
declare
  v_prefix text := to_char(current_date, 'YYYY-MM-DD');
  v_next int;
  v_numero text;
  v_row finances.demande_achat;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id_service::text || '|' || v_prefix, 0));

  select coalesce(max(substring(numero from '-(\d{3})$')::int), 0) + 1
    into v_next
  from finances.demande_achat
  where id_service = p_id_service
    and numero like v_prefix || '-%';

  v_numero := v_prefix || '-' || lpad(v_next::text, 3, '0');

  insert into finances.demande_achat (
    numero, id_service, matricule_demandeur, procedure_achat,
    objet_demandeur, objet_rc, montant_demande, date_creation, code_statut
  ) values (
    v_numero, p_id_service, p_matricule_demandeur, 'MARCHE',
    '', '', 0, current_date, 'DA_EN_PREPARATION'
  )
  returning * into v_row;

  insert into finances.historique_statut (id_demande_achat, code_statut, matricule_acteur, date_heure)
  values (v_row.id_demande_achat, 'DA_EN_PREPARATION', p_matricule_demandeur, now());

  return v_row;
end;
$$;
