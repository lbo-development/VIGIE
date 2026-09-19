-- Corrige l'asymétrie NOT NULL entre OBJET_RC et DESCRIPTION_RC introduite par la migration
-- 20260915120000_demande_achat_double_objet_description.sql : celle-ci applique NOT NULL sur
-- OBJET_RC mais pas sur DESCRIPTION_RC, alors que son propre commentaire de colonne les décrit
-- comme symétriques ("Idem OBJET_RC, pour la description"). Sans ce verrou, rien n'empêche en
-- base une DA transmise au RC avec DESCRIPTION_RC NULL si un futur code (ou une écriture directe)
-- contourne le contrôle applicatif (backend/src/services/demandeAchat.service.ts).

-- Backfill défensif — en pratique DESCRIPTION_RC est toujours recopié depuis
-- DESCRIPTION_DEMANDEUR tant que la DA reste modifiable (updateDemandeAchat), mais une ligne
-- orpheline en environnement de développement pourrait en être dépourvue.
update finances.demande_achat
set description_rc = coalesce(description_rc, description_demandeur, '')
where description_rc is null;

alter table finances.demande_achat alter column description_rc set not null;

comment on column finances.demande_achat.description_rc is
  'Idem OBJET_RC, pour la description — NOT NULL depuis le 16/09/2026 (aligné sur OBJET_RC, corrige l''asymétrie de la migration 20260915120000).';

-- finances.creer_demande_achat_brouillon (dernière définition : migration 20260915120000) ne
-- renseignait ni DESCRIPTION_DEMANDEUR ni DESCRIPTION_RC à la création (colonnes absentes de
-- l'INSERT, donc NULL par défaut) — invisible tant que DESCRIPTION_RC restait nullable, désormais
-- bloquant (violation NOT NULL) à chaque création de brouillon. Correctif : les deux colonnes
-- sont seedées à '' comme OBJET_DEMANDEUR/OBJET_RC juste au-dessus dans le même INSERT.
-- Signature inchangée — les GRANT déjà en place (migration 20260908090000) survivent au CREATE OR
-- REPLACE.
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
    objet_demandeur, objet_rc, description_demandeur, description_rc,
    montant_demande, date_creation, code_statut
  ) values (
    v_numero, p_id_service, p_matricule_demandeur, 'MARCHE',
    '', '', '', '',
    0, current_date, 'DA_EN_PREPARATION'
  )
  returning * into v_row;

  insert into finances.historique_statut (id_demande_achat, code_statut, matricule_acteur, date_heure)
  values (v_row.id_demande_achat, 'DA_EN_PREPARATION', p_matricule_demandeur, now());

  return v_row;
end;
$$;
