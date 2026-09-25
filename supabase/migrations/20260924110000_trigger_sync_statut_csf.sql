-- Garantit au niveau base (pas seulement par convention applicative) que
-- certificat_service_fait.code_statut_csf reflète toujours le statut le
-- plus récent de historique_statut_csf — même mécanique que
-- finances.trg_sync_statut_courant pour demande_achat.code_statut
-- (migrations 20260914120000 et 20260914130000). Transforme la promesse
-- « CODE_STATUT_CSF maintenu par déclencheur applicatif » du MLD (§4) en
-- garantie réelle de la base, dès le démarrage de ce chantier d'implémentation
-- — plutôt que de répéter la dette laissée sur demande_achat jusqu'au 14/09.
--
-- security definer + search_path fixé : la fonction doit pouvoir mettre à
-- jour certificat_service_fait quel que soit l'appelant de l'INSERT sur
-- historique_statut_csf (y compris sous RLS) — elle appartient au
-- propriétaire des tables (postgres), non soumis à RLS.

create or replace function finances.sync_statut_courant_csf()
returns trigger
language plpgsql
security definer
set search_path = finances, pg_catalog
as $$
begin
  update finances.certificat_service_fait
    set code_statut_csf = new.code_statut_csf
    where id_csf = new.id_csf;
  return new;
end;
$$;

-- DROP ... IF EXISTS avant CREATE (CREATE TRIGGER seul n'est pas rejouable —
-- "trigger already exists" en cas de deuxième exécution de cette migration).
drop trigger if exists trg_sync_statut_courant_csf on finances.historique_statut_csf;
create trigger trg_sync_statut_courant_csf
after insert on finances.historique_statut_csf
for each row
execute function finances.sync_statut_courant_csf();

-- Verrouille la seule porte de contournement restante : sans ce REVOKE, un
-- futur bout de code pourrait faire évoluer code_statut_csf par un UPDATE
-- direct, sans ligne correspondante dans historique_statut_csf. Après cette
-- migration, le seul moyen de faire évoluer certificat_service_fait.code_statut_csf
-- est d'insérer une ligne dans historique_statut_csf.
revoke update (code_statut_csf) on finances.certificat_service_fait from service_role;
