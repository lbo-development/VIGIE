-- Renomme finances.historique_statut.commentaire_motif en commentaire_statut
-- (le champ "navette" évoqué pour la gestion des statuts DA/FAD — cf. discussion
-- sur historique_statut). Vérifié en lecture seule via claude_readonly : la colonne
-- existe sous ce nom dans finances.historique_statut, sans contrainte CHECK ni
-- index qui la référence nommément — un simple RENAME COLUMN suffit, aucune donnée
-- affectée (la table est vide à ce jour).

alter table finances.historique_statut
  rename column commentaire_motif to commentaire_statut;
