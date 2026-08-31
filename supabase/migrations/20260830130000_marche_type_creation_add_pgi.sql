-- finances.marche.type_creation n'autorisait que 'SERVICE'/'AUTRE' (contrainte
-- préexistante, avant l'import PGI des marchés) — l'import échouait
-- systématiquement dès la première création (violation de
-- marche_type_creation_check) car tout le code utilise 'PGI' pour marquer
-- l'origine d'un marché importé (voir
-- ForClaude/Importation-marches/import-marches-pgi.md §3), par analogie avec
-- finances.fournisseur.type_creation qui autorise déjà 'PGI'.
alter table finances.marche drop constraint marche_type_creation_check;
alter table finances.marche add constraint marche_type_creation_check
  check (type_creation = any (array['SERVICE'::text, 'AUTRE'::text, 'PGI'::text]));
