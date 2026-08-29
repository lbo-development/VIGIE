-- Ajoute le flag actif/inactif sur finances.cellule, sur le même modèle que
-- finances.direction / finances.service (désactivation, jamais de
-- suppression physique — voir ForClaude/CDC/mld-phases-1-2.md §2.2 et
-- §"Intégrité référentielle"). DEFAULT true couvre le backfill : les
-- cellules existantes deviennent actives.

alter table finances.cellule add column actif boolean not null default true;
