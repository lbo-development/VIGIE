-- Ajoute UTILISABLE à finances.operation_investissement (déjà appliqué directement par
-- l'utilisateur en base le 04/09/2026 — cette migration ne fait que le documenter dans
-- l'historique versionné, voir ForClaude/importation-investissementsPGI/import-investissements-pgi.md
-- §16 : contrairement à finances.marche (UTILISABLE = ACTIF ET COMPLETUDE, colonne générée),
-- aucun second critère n'a jamais été documenté pour les investissements côté consignes PGI —
-- UTILISABLE est donc ici un simple champ booléen manuel, sur le même principe que LIB_SERVICE
-- (migration 20260904090000_operation_investissement_lib_service.sql) : jamais alimenté ni
-- écrasé par l'import (voir investissement.repository.ts#OperationInvestissementUpsert), à
-- éditer manuellement si un écran de modification est construit pour ce champ.
alter table finances.operation_investissement
  add column if not exists utilisable boolean not null default true;
