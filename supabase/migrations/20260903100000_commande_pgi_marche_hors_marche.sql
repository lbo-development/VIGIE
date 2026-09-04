-- Correction du 03/09/2026 : quand la colonne "Marché" du fichier PGI est vide, l'import
-- (commandePgiImport.service.ts#MARCHE_HORS_MARCHE) retient désormais "HM" (Hors Marché) au
-- lieu de NULL — décision utilisateur. Colonne toujours en texte libre, sans FK vers
-- finances.marche (inchangé, voir 20260903090000_create_commande_pgi.sql).
update finances.commande_pgi set marche = 'HM' where marche is null;

alter table finances.commande_pgi
  alter column marche set default 'HM',
  alter column marche set not null;
