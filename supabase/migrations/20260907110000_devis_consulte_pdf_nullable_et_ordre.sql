-- Décision du 07/09/2026 (deux changements liés à la refonte de l'écran
-- FournisseurDA — cf. ForClaude/CDC/mcd-phases-1-2.md §1/§8).

-- 1) FICHIER_PDF devient nullable. Le dépôt du PDF du devis se fait
-- désormais depuis l'écran documentaire de la page DemandeAchat, après la
-- création de la DA et de ses lignes DEVIS_CONSULTE (créées, elles, à
-- l'action « Fournisseurs consultés »). FICHIER_PDF était NOT NULL, ce qui
-- rendait l'INSERT de la ligne DEVIS_CONSULTE impossible tant qu'aucun PDF
-- n'était disponible. Même traitement que les colonnes de DEMANDE_ACHAT
-- corrigées par 20260907100000 (arbitrage 2) : nullable en base,
-- obligatoire par règle applicative avant transmission au RC (exigence
-- déjà documentée : « les devis de tous les candidats si hors marché »).
alter table finances.devis_consulte
  alter column fichier_pdf drop not null;

-- 2) Ajout d'un rang (ORDRE) sur les candidats consultés — le Demandeur
-- classe les entreprises du meilleur au moins bon (glisser-déposer dans
-- FournisseurDA) ; le candidat en position 1 est le retenu. Table vide en
-- production à ce jour (aucune ligne DEVIS_CONSULTE, phase pas encore
-- implémentée), NOT NULL ajouté directement, sans backfill nécessaire.
--
-- RETENU (booléen) est conservé tel quel plutôt que remplacé par ORDRE=1 :
-- il reste la colonne de référence pour toutes les règles déjà écrites
-- ailleurs (transmission « un candidat retenu », contrainte d'unicité
-- ci-dessous, MCD/MLD/MCT). ORDRE porte le classement affiché à l'écran ;
-- l'application maintient RETENU = (ORDRE = 1) à chaque changement d'ordre
-- — cohérence non portée par contrainte base pour l'instant (même logique
-- « obligation applicative » que le reste du projet), à documenter dans
-- demandeAchat.service.ts.
alter table finances.devis_consulte
  add column if not exists ordre smallint not null;

comment on column finances.devis_consulte.ordre is
  'Rang du candidat au sein de sa DA (1 = meilleur), fixé par glisser-déposer dans FournisseurDA. Le candidat en position 1 doit être celui avec RETENU=true (cohérence maintenue par l''application).';

-- Un rang unique par DA (pas deux candidats à la même position).
alter table finances.devis_consulte
  add constraint uq_devis_ordre_par_da unique (numero, ordre);
