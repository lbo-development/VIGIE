-- Complément à finances.creer_demande_achat_brouillon (migration
-- 20260907160000) : le MCD exige qu'une DEMANDE_ACHAT ait toujours au moins
-- une ligne HISTORIQUE_STATUT (DEMANDE_ACHAT (1,1) — suit — (1,N)
-- HISTORIQUE_STATUT) — oublié dans la première version de la fonction.
-- Ajoutée dans la même transaction que l'INSERT du brouillon, pour ne
-- jamais laisser exister une DA sans sa première ligne d'historique.
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
    objet, montant_demande, date_creation, code_statut
  ) values (
    v_numero, p_id_service, p_matricule_demandeur, 'MARCHE',
    '', 0, current_date, 'DA_EN_PREPARATION'
  )
  returning * into v_row;

  insert into finances.historique_statut (id_demande_achat, code_statut, matricule_acteur, date_heure)
  values (v_row.id_demande_achat, 'DA_EN_PREPARATION', p_matricule_demandeur, now());

  return v_row;
end;
$$;
