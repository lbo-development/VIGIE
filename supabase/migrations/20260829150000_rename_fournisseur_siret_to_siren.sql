-- Renomme finances.fournisseur.siret en siren (décision du 29/08/2026) :
-- SIRET (14 chiffres, identifie un établissement) était en réalité utilisé
-- ici pour SIREN (9 chiffres, identifie l'entreprise/le fournisseur au
-- niveau juridique) — confusion de terminologie corrigée. Simple
-- renommage de colonne, aucune donnée modifiée ; le type reste `text` (pas
-- de contrainte de longueur ajoutée, comme pour l'ancien SIRET).

alter table finances.fournisseur rename column siret to siren;
