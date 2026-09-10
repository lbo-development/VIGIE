-- Décision du 07/09/2026 : CODE_SITE, CODE_SECTEUR, CODE_CUG et
-- IMPUTATION_COMPTABLE (avec NUMERO_OPERATION associé) ne sont pas saisis par
-- le Demandeur à la création de la DA (OP1.1) mais par le RC lors de la
-- finalisation de la FAD (OP1.2b, cf. ForClaude/CDC/mct-phases-1-2.md). Ces
-- quatre colonnes étaient pourtant NOT NULL en base, ce qui rendait
-- l'insertion d'une DA à l'état DA_EN_PREPARATION impossible : aucune de ces
-- valeurs n'existe encore à ce stade.
--
-- Correction : même traitement que ID_FOURNISSEUR_RETENU et
-- MARCHE.ID_FOURNISSEUR (arbitrage 2, déjà en place) — nullable en base,
-- rendu obligatoire par règle applicative au bon stade du cycle (ici :
-- avant transmission de la FAD au CDS, OP1.2b, côté demandeAchat.service.ts
-- à venir). TYPE_ACHAT est déjà nullable en base, aucun changement requis
-- pour cette colonne.
--
-- Aucun changement requis sur les CHECK existants : chk_da_imputation et
-- demande_achat_imputation_comptable_check évaluent à NULL (donc non
-- violés) quand IMPUTATION_COMPTABLE est NULL — comportement standard
-- Postgres pour une contrainte CHECK. Les FK composites vers SOUS_SITE et
-- SOUS_SECTEUR sont MATCH SIMPLE (déjà documenté MLD §2.4) : si CODE_SITE
-- (ou CODE_SECTEUR) est NULL, la FK correspondante n'est simplement pas
-- vérifiée pour cette ligne.
--
-- Point d'attention à confirmer avant exécution : le MCD documente
-- CODE_CUG comme « obligatoire en toutes circonstances » (arbitrage 1,
-- décision client du 22/08/2026). Ce changement ne revient pas sur cet
-- arbitrage (CUG reste obligatoire quel que soit le type d'imputation),
-- il déplace seulement le moment où l'obligation est *vérifiée* — du tout
-- premier INSERT vers la transmission au CDS. Voir ForClaude/CDC/mld-phases-1-2.md §2.4.
alter table finances.demande_achat
  alter column code_site drop not null;

alter table finances.demande_achat
  alter column code_secteur drop not null;

alter table finances.demande_achat
  alter column code_cug drop not null;

alter table finances.demande_achat
  alter column imputation_comptable drop not null;
