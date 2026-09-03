-- Complète 20260902100000_marche_tiers_champs_obligatoires.sql : DTEDEBUT devient lui aussi
-- obligatoire (décision du 02/09/2026, même jour, quelques heures après le premier lot de
-- champs obligatoires). Voir marcheTiers.service.ts pour le contrôle applicatif (Zod).
alter table finances.marche_tiers
  alter column dtedebut set not null;
