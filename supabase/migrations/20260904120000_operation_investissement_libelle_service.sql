-- Ajoute LIBELLE_SERVICE à finances.operation_investissement (décision du 04/09/2026, voir
-- ForClaude/importation-investissementsPGI/import-investissements-pgi.md) — remplace le champ
-- LIB_SERVICE conçu le 03/09/2026 mais jamais appliqué en base (migration abandonnée) : même
-- principe (libellé propre au service, distinct de LIBELLE — issu de l'import PGI, colonne
-- "Intitule" de la feuille OP), mais avec une règle de calcul par défaut plus précise.
--
-- Règle : à la création d'une opération (premier import), si LIBELLE commence par NUMERO_OPERATION
-- (colonne "Code" de la feuille OP, §2.1/§4 de la spec — ex. LIBELLE = "IN025393 - REAMENAGEMENT
-- DU POSTE RORO 93-94", NUMERO_OPERATION = "IN025393"), LIBELLE_SERVICE reçoit LIBELLE amputé de
-- ce préfixe et des séparateurs qui suivent (espaces, tirets — ex. "REAMENAGEMENT DU POSTE RORO
-- 93-94"). Sinon, LIBELLE_SERVICE reçoit LIBELLE tel quel. Un trigger BEFORE INSERT s'en charge
-- (impossible via un simple DEFAULT, qui ne peut ni référencer une autre colonne de la ligne ni
-- appliquer une logique conditionnelle). Une fois modifié manuellement (hors périmètre de ce
-- chantier), LIBELLE_SERVICE ne doit plus jamais être écrasé par un import suivant — garanti côté
-- backend (investissement.repository.ts#OperationInvestissementUpsert) en ne l'incluant jamais
-- dans la charge de l'upsert, donc jamais présent dans la clause ON CONFLICT ... DO UPDATE SET
-- générée par PostgREST (le trigger BEFORE INSERT, lui, ne se déclenche jamais à la mise à jour).
alter table finances.operation_investissement
  add column if not exists libelle_service text;

create or replace function finances.operation_investissement_set_libelle_service()
returns trigger
language plpgsql
as $$
declare
  v_reste text;
begin
  if new.libelle_service is null then
    if left(new.libelle, length(new.numero_operation)) = new.numero_operation then
      v_reste := substring(new.libelle from length(new.numero_operation) + 1);
      -- Retire les séparateurs en tête du reste (espaces, tirets — ex. " - ").
      v_reste := regexp_replace(v_reste, '^[[:space:]-]+', '');
      new.libelle_service := nullif(v_reste, '');
    end if;

    if new.libelle_service is null then
      new.libelle_service := new.libelle;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists operation_investissement_set_libelle_service on finances.operation_investissement;
create trigger operation_investissement_set_libelle_service
  before insert on finances.operation_investissement
  for each row
  execute function finances.operation_investissement_set_libelle_service();
