-- Création progressive du CSF (décision du 24/09/2026, même modèle que
-- finances.creer_demande_achat_brouillon pour la DA — migrations
-- 20260907160000/20260907170000) : le brouillon (CSF_EN_PREPARATION) est
-- créé immédiatement au clic « Nouveau CSF », avant tout dépôt de
-- justificatif — un upload Storage ne peut de toute façon pas faire partie
-- d'une transaction SQL. Aucune règle métier ici (R1 : FAD au statut
-- FAD_COMMANDEE) — la validation reste entièrement côté service TypeScript,
-- qui appelle cette fonction une fois la garde vérifiée, comme pour la DA.
--
-- NUMERO_CSF = NUMERO de la FAD + suffixe séquentiel -Cnn (ex.
-- 2026-08-23-014-C01) — MCD/MLD §3. Verrou consultatif transactionnel par
-- FAD (pas globalement) : deux CSF créés en même temps pour deux FAD
-- différentes ne se bloquent pas entre eux, seule la concurrence sur une
-- même FAD est sérialisée. Même mécanique que le verrou par (service, jour)
-- de creer_demande_achat_brouillon.

create or replace function finances.creer_csf_brouillon(
  p_id_demande_achat bigint,
  p_matricule_redacteur text
)
returns finances.certificat_service_fait
language plpgsql
security definer
set search_path = finances, pg_temp
as $$
declare
  v_numero_fad text;
  v_next int;
  v_numero_csf text;
  v_row finances.certificat_service_fait;
begin
  perform pg_advisory_xact_lock(hashtextextended('csf|' || p_id_demande_achat::text, 0));

  select numero into v_numero_fad
  from finances.demande_achat
  where id_demande_achat = p_id_demande_achat;

  if v_numero_fad is null then
    raise exception 'Demande d''achat % introuvable.', p_id_demande_achat;
  end if;

  select coalesce(max(substring(numero_csf from '-C(\d{2,})$')::int), 0) + 1
    into v_next
  from finances.certificat_service_fait
  where id_demande_achat = p_id_demande_achat;

  v_numero_csf := v_numero_fad || '-C' || lpad(v_next::text, 2, '0');

  insert into finances.certificat_service_fait (
    numero_csf, id_demande_achat, matricule_redacteur, date_creation, code_statut_csf
  ) values (
    v_numero_csf, p_id_demande_achat, p_matricule_redacteur, current_date, 'CSF_EN_PREPARATION'
  )
  returning * into v_row;

  -- Une ligne HISTORIQUE_STATUT_CSF systématique dès la création (même
  -- garantie que DEMANDE_ACHAT (1,1) — suit — (1,N) HISTORIQUE_STATUT côté
  -- FAD, oubliée puis corrigée par 20260907170000 — posée ici directement,
  -- pas d'oubli initial cette fois).
  insert into finances.historique_statut_csf (id_csf, code_statut_csf, matricule_acteur, date_heure)
  values (v_row.id_csf, 'CSF_EN_PREPARATION', p_matricule_redacteur, now());

  return v_row;
end;
$$;

-- Durcissement du 30/08/2026 (20260830100000_harden_finances_grants.sql) :
-- toute nouvelle fonction doit recevoir explicitement GRANT EXECUTE, sans
-- quoi l'appel via service_role échoue en "permission denied" (oubli déjà
-- rencontré sur creer_demande_achat_brouillon, corrigé par 20260908090000 —
-- corrigé ici dès l'origine).
grant execute on function finances.creer_csf_brouillon(bigint, text) to service_role;
