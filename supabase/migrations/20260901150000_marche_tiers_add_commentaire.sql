-- Champ libre pour préciser le contexte d'usage d'un marché tiers (ex. conditions
-- d'autorisation par le service propriétaire) — décision du 01/09/2026.
alter table finances.marche_tiers add column if not exists commentaire text;
