-- Suppression en masse des DA/FAD d'un service, réservée à ADMIN_APP
-- (décision du 25/09/2026, demande client) — fonctionnalité destructive la
-- plus large de l'application à ce jour : purge TOUTES les DEMANDE_ACHAT
-- d'un service, sans exception de statut (y compris FAD_COMMANDEE, y
-- compris avec des CERTIFICAT_SERVICE_FAIT déjà liquidés), avec toutes leurs
-- dépendances — aucune trace conservée après coup (décision explicite,
-- assumée : ni piste d'audit dédiée, ni exception de statut).
--
-- Fonction Postgres plutôt qu'une séquence de DELETE applicatifs (comme pour
-- la suppression d'une seule DA_EN_PREPARATION, cf.
-- demandeAchat.repository.ts#remove) : le volume potentiel (tout un service)
-- rend une boucle d'appels JS lente et fragile face à une coupure en cours
-- de route — la fonction s'exécute dans une seule transaction Postgres,
-- tout ou rien. Les fichiers Storage (piece_jointe/devis_consulte) ne
-- peuvent pas être supprimés depuis Postgres : c'est à l'appelant
-- (purgeDaFad.service.ts) de lister les storage_path AVANT d'appeler cette
-- fonction, puis de les supprimer du bucket après son succès.
--
-- Ordre des suppressions : PIECE_JOINTE (CSF puis DA) → HISTORIQUE_STATUT_CSF
-- → CERTIFICAT_SERVICE_FAIT → DEVIS_CONSULTE → HISTORIQUE_STATUT →
-- DEMANDE_ACHAT — même ordre que la cascade applicative documentée dans
-- ForClaude/CDC/mld-phases-1-2.md §4 (FK ON DELETE RESTRICT partout, jamais
-- de CASCADE en base — cette fonction reproduit l'ordre correct plutôt que
-- de s'appuyer sur un CASCADE qui n'existe pas).

create or replace function finances.purger_da_fad_service(p_id_service bigint)
returns integer
language plpgsql
security definer
set search_path = finances, pg_catalog
as $$
declare
  v_nombre integer;
begin
  select count(*) into v_nombre from finances.demande_achat where id_service = p_id_service;

  delete from finances.piece_jointe
    where id_csf in (
      select csf.id_csf
      from finances.certificat_service_fait csf
      join finances.demande_achat da on da.id_demande_achat = csf.id_demande_achat
      where da.id_service = p_id_service
    );

  delete from finances.piece_jointe
    where id_demande_achat in (select id_demande_achat from finances.demande_achat where id_service = p_id_service);

  delete from finances.historique_statut_csf
    where id_csf in (
      select csf.id_csf
      from finances.certificat_service_fait csf
      join finances.demande_achat da on da.id_demande_achat = csf.id_demande_achat
      where da.id_service = p_id_service
    );

  delete from finances.certificat_service_fait
    where id_demande_achat in (select id_demande_achat from finances.demande_achat where id_service = p_id_service);

  delete from finances.devis_consulte
    where id_demande_achat in (select id_demande_achat from finances.demande_achat where id_service = p_id_service);

  delete from finances.historique_statut
    where id_demande_achat in (select id_demande_achat from finances.demande_achat where id_service = p_id_service);

  delete from finances.demande_achat where id_service = p_id_service;

  return v_nombre;
end;
$$;

comment on function finances.purger_da_fad_service(bigint) is
  'Suppression en masse (ADMIN_APP uniquement, décision du 25/09/2026) — TOUTES les DEMANDE_ACHAT d''un service et leurs dépendances (devis, pièces jointes, historiques, CSF), sans exception de statut. Irréversible, aucune piste d''audit conservée en base — voir purgeDaFad.service.ts pour les 2 confirmations côté applicatif (question + ré-authentification) et le nettoyage Storage associé.';

-- Durcissement du 30/08/2026 : toute nouvelle fonction doit recevoir
-- explicitement GRANT EXECUTE (oubli déjà rencontré deux fois sur ce projet,
-- creer_demande_achat_brouillon puis creer_csf_brouillon — corrigé ici dès
-- l'origine).
grant execute on function finances.purger_da_fad_service(bigint) to service_role;
