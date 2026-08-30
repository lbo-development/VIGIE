-- finances.marche : remplace ETATMARCHE par ACTIF (booléen, aligné sur le
-- reste du référentiel : DIRECTION/SERVICE/CELLULE/SITE/SECTEUR/CUG),
-- ajoute COMPLETUDE (booléen, calculé applicativement) et UTILISABLE
-- (colonne générée Postgres = ACTIF ET COMPLETUDE).
-- Décision du 30/08/2026 — voir ForClaude/CDC/mld-phases-1-2.md §2.2 et
-- ForClaude/Importation-marches/import-marches-pgi.md §3.
--
-- ATTENTION : si etatmarche contient déjà des données réelles ('Actif'/'Inactif'
-- ou autre), adapter la clause `using` ci-dessous pour convertir plutôt que
-- réinitialiser à true. Écrit ici en supposant qu'aucune donnée réelle
-- n'existe encore sur cette colonne (import PGI marchés pas encore implémenté).

alter table finances.marche
  drop column if exists etatmarche;

alter table finances.marche
  add column if not exists actif boolean not null default true;

alter table finances.marche
  add column if not exists completude boolean not null default false;

alter table finances.marche
  add column if not exists utilisable boolean generated always as (actif and completude) stored;
