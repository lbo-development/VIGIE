-- Prérequis pour l'import PGI des marchés (voir
-- ForClaude/Importation-marches/import-marches-pgi.md).

-- 1. Trace, par marché, la date du dernier fichier PGI l'ayant importé/modifié
-- (distinct du paramètre applicatif last.import.marche.pgi ci-dessous, qui
-- lui est par service).
alter table finances.marche add column if not exists dtelastimport date;

-- 2. Catalogue du nouveau paramètre applicatif (portée par service — doit
-- être créée manuellement par ADMIN_APP pour un service avant son premier
-- import, voir import-marches-pgi.md §7 : absence de ligne = import bloqué,
-- pas "aucune borne").
insert into finances.parametre_definition (cle, libelle, description, valeur_defaut)
values (
  'last.import.marche.pgi',
  'Date de la dernière importation des marchés PGI',
  'Portée par service — doit être créée manuellement par ADMIN_APP pour un service avant son premier import (voir ForClaude/Importation-marches/import-marches-pgi.md §7).',
  'null'::jsonb
)
on conflict (cle) do nothing;

-- 3. SIREN devient nullable pour les fournisseurs auto-créés par l'import PGI
-- des marchés (variante déjà prévue par OP3.1 : si NUM_TITULAIRE est inconnu
-- du service, auto-création d'une fiche FOURNISSEUR) — le fichier d'import
-- des marchés ne fournit aucun SIREN (colonnes disponibles : nom et numéro du
-- fournisseur uniquement). Reste obligatoire pour une création manuelle
-- (TYPE_CREATION='SERVICE') : imposé applicativement
-- (fournisseur.service.ts#createFournisseurSchema, inchangé), et garanti ici
-- par une contrainte CHECK plutôt qu'un simple retrait du NOT NULL.
alter table finances.fournisseur alter column siren drop not null;
alter table finances.fournisseur add constraint fournisseur_siren_pgi_check
  check (siren is not null or type_creation = 'PGI');
