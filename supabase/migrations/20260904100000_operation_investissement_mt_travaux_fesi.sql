-- Ajoute MT_TRAVAUX et MT_FESI à finances.operation_investissement (décision du 04/09/2026, voir
-- ForClaude/importation-investissementsPGI/import-investissements-pgi.md) :
--   - MT_TRAVAUX : alimenté par l'import depuis la colonne "Montant travaux" de la feuille OP
--     (même statut que MT_INITIAL, issu de "Montant FC").
--   - MT_FESI : purement calculé (MT_INITIAL - MT_TRAVAUX), jamais écrit par l'import — colonne
--     générée Postgres, même mécanique que finances.marche.utilisable (voir
--     20260830090000_marche_actif_completude_utilisable.sql). Une colonne générée ne peut
--     recevoir aucune valeur explicite à l'INSERT/UPDATE (erreur Postgres sinon) : le backend
--     (investissement.repository.ts#OperationInvestissementUpsert) l'exclut donc de la charge de
--     l'upsert, comme LIB_SERVICE (mais pour une raison différente : LIB_SERVICE peut recevoir
--     une valeur, juste jamais depuis l'import — MT_FESI ne peut techniquement jamais en recevoir
--     une).
alter table finances.operation_investissement
  add column if not exists mt_travaux numeric not null default 0;

alter table finances.operation_investissement
  add column if not exists mt_fesi numeric generated always as (mt_initial - mt_travaux) stored;
