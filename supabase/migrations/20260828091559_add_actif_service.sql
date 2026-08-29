-- Ajoute le flag actif/inactif sur finances.service, sur le même modèle que
-- finances.direction (désactivation, jamais de suppression physique — voir
-- ForClaude/CDC/mld-phases-1-2.md §2.2 et §"Intégrité référentielle").
-- DEFAULT true couvre le backfill : les services existants deviennent actifs.

alter table finances.service add column actif boolean not null default true;
