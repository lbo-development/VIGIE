-- Ajoute le flag actif/inactif sur finances.direction, sur le même modèle
-- que finances.site / finances.secteur (désactivation, jamais de suppression
-- physique — voir ForClaude/CDC/mld-phases-1-2.md §2.2 et §"Intégrité référentielle").
-- DEFAULT true couvre le backfill : les directions existantes deviennent actives.

alter table finances.direction add column actif boolean not null default true;
