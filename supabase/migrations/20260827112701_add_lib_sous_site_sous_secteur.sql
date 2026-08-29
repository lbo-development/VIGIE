-- Ajoute lib_sous_site / lib_sous_secteur (libellé), sur le même modèle que
-- lib_site / lib_secteur sur les tables parentes — voir ForClaude/CDC/mld-phases-1-2.md §2.2.
-- Backfill initial depuis le code existant, à affiner manuellement ensuite si besoin.

alter table finances.sous_site add column lib_sous_site text;
update finances.sous_site set lib_sous_site = code_sous_site;
alter table finances.sous_site alter column lib_sous_site set not null;

alter table finances.sous_secteur add column lib_sous_secteur text;
update finances.sous_secteur set lib_sous_secteur = code_sous_secteur;
alter table finances.sous_secteur alter column lib_sous_secteur set not null;
