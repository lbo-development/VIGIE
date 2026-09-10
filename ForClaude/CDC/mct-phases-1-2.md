# MCT (Modèle Conceptuel des Traitements) — Phases 1 & 2

*Décrit le « quoi » des traitements (événements, opérations, règles, résultats), indépendamment du qui/quand/comment (réservé au MOT). Dérivé du CDG (acteurs), des exigences Phase 1, du MCD consolidé (mcd-phases-1-2.md) et des décisions Phase 2 (D1–D9).*

*Découpage validé : 3 processus reliés — (1) Demande d'achat, (2) Service fait, (3) Imports de référentiels PGI.*

*Statut : premier jet complet, à valider.*

___

# Formalisme et conventions

Chaque **opération** est décrite par : événement(s) déclencheur(s) → synchronisation (garde/condition d'entrée) → actions → règles d'émission (conditions de sortie) → résultat(s). Les **résultats** d'une opération sont, en mode pull, les **événements internes** qui rendent l'objet disponible à l'opération suivante (pas de notification — relève du MOT). Les **acteurs** ne figurent qu'à titre indicatif (le « qui » est du MOT).

**Acteurs / entités externes** : Demandeur, RC, CDS, CB, DS, et le **PGI** (outil transversal de comptabilité) en frontière. Le PGI reçoit les messages sortants (autorisation de commande, déclenchement de paiement) et ses retours (commande passée, facture liquidée) reviennent sous forme d'**événements externes** constatés par la CB.

**Hors périmètre MCT (→ MOT)** : mode pull, gestes de saisie manuelle de statut, mécanique de suppléance, écrans et profils.

**Choix de modélisation retenus** : (i) une opération par point de décision ; (ii) rejet et annulation = résultats **terminaux** (fin de cycle, aucune duplication automatique — refonte du 06/09/2026, remplace l'ancien mécanisme de duplication après rejet), reprise (à compléter / à modifier) = nouvel événement ré-entrant **sur le même enregistrement** ; (iii) import = une opération unique automatique (option a).

═══════════════════════════════════════════
# PROCESSUS 1 — DEMANDE D'ACHAT (DA → autorisation/commande)
═══════════════════════════════════════════

> **Refonte du 06/09/2026 (validation client du cycle DA/FAD).** Les opérations du Processus 1 ci-dessous remplacent intégralement la version précédente, pour coller au tableau détaillé « Cycle de vie d'une FAD » validé par le client (20 indices numérotés — le renvoi `n°X` dans chaque opération pointe vers ce tableau). Changements structurants : distinction explicite Rejeté/Annulé à chaque palier (sauf CB, qui n'a pas d'Annulé) ; trois mécaniques de reprise **en place, sans duplication** (à compléter / à compléter / à modifier, chacune avec son acteur et sa destination propres) ; nouvelles opérations OP1.2b, OP1.3b, OP1.4b isolant des actions auparavant fusionnées avec une décision. Voir Historique en fin de document et MCD §8.

## OP1.1 — Créer, finaliser et transmettre la demande d'achat (Demandeur)
- **Événements** : « Besoin d'achat exprimé » (externe, Demandeur) ; *ou* « DA à compléter, reprise après demande du RC » (depuis DA_A_COMPLETER).
- **Synchronisation** : si PROCEDURE_ACHAT = MARCHE, sélection restreinte aux marchés UTILISABLE (ACTIF ET COMPLETUDE — voir MCD, entité MARCHE ; décision du 30/08/2026, `ForClaude/Importation-marches/import-marches-pgi.md` Historique).
- **Actions** — *(modèle de création progressive, décision du 07/09/2026, remplace l'idée d'une écriture unique et atomique en fin de parcours)* : dès le clic « Nouvelle demande », un brouillon DEMANDE_ACHAT est créé **immédiatement** (état DA_EN_PREPARATION, NUMERO alloué à ce moment, PROCEDURE_ACHAT par défaut MARCHE) — pas d'attente d'un « Enregistrer » final ; CreationDA n'est ensuite qu'un écran d'édition de ce brouillon déjà existant, comme le sera plus tard « Modifier une DA ». Saisie ensuite, à mesure que l'utilisateur remplit l'écran : objet, description, montant demandé, procédure (marché/hors marché) — chaque écran fille (MarcheDA, FournisseurDA, PiecesDevisDA, PiecesComplementairesDA) écrit sa donnée immédiatement à son propre « Enregistrer » (DEVIS_CONSULTE, PIECE_JOINTE et dépôt de fichier compris), pas en différé ni en une seule transaction globale. Transmission au RC (n°3, ou n°5 après complément). *(Correction du 07/09/2026 : « imputation » retiré de cette liste — le Demandeur ne saisit ni CODE_SITE, ni CODE_SECTEUR, ni CODE_CUG, ni IMPUTATION_COMPTABLE/NUMERO_OPERATION, ni TYPE_ACHAT, tous saisis par le RC à OP1.2b ; la mention ici était une redondance jamais corrigée depuis la refonte du 06/09/2026.)* *(Décision du 07/09/2026)* Si HORS_MARCHE : à l'action « Fournisseurs consultés », dépôt de 1 à 5 DEVIS_CONSULTE (une entreprise consultée par devis) avec référence fournisseur et montant ; classement des candidats par glisser-déposer du meilleur au moins bon (ORDRE) — le candidat en position 1 devient le RETENU, re-désignable à tout moment tant que la DA n'est pas transmise ; motif du choix (MOTIF_CHOIX/LIBELLE_MOTIF_CHOIX) saisi à cette même action, réellement écrit en base. *(Refonte du 09/09/2026, annule la mention initiale d'écrans filles PiecesDevisDA/PiecesComplementairesDA dédiés)* Le PDF de chaque devis et les pièces complémentaires par fournisseur se déposent depuis l'écran unique « Gestion documentaire » (ouvert depuis CreationDA une fois un fournisseur identifié), à mesure de la saisie — plus « après création de la DA » au sens d'une étape séparée, puisque la DA existe déjà dès le premier écran. Si MARCHE : montant du devis BPU du titulaire **facultatif** (0 ou 1 DEVIS_CONSULTE, MONTANT_DEVIS non significatif — NULL) saisi dans « Marché concerné » ; motif du choix systématiquement `Prix`, écrit en base au même titre que le cas Hors marché. **MONTANT_DEMANDE (renversement du 09/09/2026, annule la correction du 07/09/2026 ci-dessous conservée pour mémoire)** : saisi directement par l'utilisateur sur MarcheDA pour MARCHE ; pour HORS_MARCHE, désormais **dérivé** du MONTANT_DEVIS du candidat retenu (ORDRE=1), recopié à l'action « Fournisseurs consultés » — plus aucune saisie de montant dans CreationDA, quelle que soit la procédure. *(Ancienne version, 07/09/2026 : « saisie manuelle indépendante — sur CreationDA pour HORS_MARCHE, sur MarcheDA pour MARCHE — sans lien automatique avec MONTANT_DEVIS dans aucun des deux cas ; incohérence assumée par le client entre MONTANT_DEMANDE et le montant du candidat retenu en HORS_MARCHE ».)*
- **Règles d'émission** : demande complète transmise au RC — HORS_MARCHE exige au moins 1 (et au plus 5) DEVIS_CONSULTE et un candidat retenu désigné ; MARCHE n'exige aucun devis.
- **Résultat** : **DA_TRANSMISE_RC** *(remplace DA_ENREGISTREE)*. *(Précision du 07/09/2026)* Le NUMERO généré à la création (AAAA-MM-JJ-XXX) n'est unique que **par service** — le SERVICE de la DA est celui du demandeur cible (soi-même, ou un tiers choisi par un RC/ADMIN_SERVICE créant pour son compte), figé dès cet instant, cf. MCD/MLD.

## OP1.2 — Statuer sur l'opportunité d'achat (RC)
- **Événement** : DA_TRANSMISE_RC (n°6).
- **Synchronisation** : —
- **Actions** : contrôle de l'objet, de la description, des pièces jointes et du montant demandé ; décision.
- **Règles d'émission** :
  - validé → le RC enchaîne avec OP1.2b (finalisation de la FAD) ;
  - rejeté (achat jugé non pertinent) → DA rejetée, **terminal** ;
  - annulé (opportunité d'achat devenue caduque) → DA annulée, **terminal** ;
  - complément demandé (information manquante) → DA à compléter, reprise en place par le Demandeur (retour à OP1.1, n°4-5) — **pas de duplication**.
- **Résultats** : **DA_VALIDEE_RC** | **DA_REJETEE_RC** | **DA_ANNULEE_RC** | **DA_A_COMPLETER**.

## OP1.2b — Finaliser et transmettre la FAD au CDS (RC) — bascule DA → FAD
- **Événement** : DA_VALIDEE_RC (n°7).
- **Synchronisation** : —
- **Actions** : reformulation de l'objet et de la description, définition des critères de choix du fournisseur, saisie de la localisation (CODE_SITE/CODE_SOUS_SITE, CODE_SECTEUR/CODE_SOUS_SECTEUR) et de l'imputation (CODE_CUG ; TYPE_ACHAT : travaux/fournitures/services ; IMPUTATION_COMPTABLE : fonctionnement/investissement, avec NUMERO_OPERATION si investissement) — *(précisé le 07/09/2026 : ces quatre champs, absents du Demandeur à OP1.1, sont exclusivement saisis ici)* ; transmission au CDS avec les pièces associées (n°8).
- **Règles d'émission** : transmission systématique — pas de décision à cette étape (mise en forme puis envoi, même acteur).
- **Résultat** : **FAD_TRANSMISE_CDS**. *(À partir d'ici l'enregistrement DEMANDE_ACHAT est qualifié de FAD — même ligne, pas de nouvelle entité ni de nouveau statut pour la bascule elle-même : DA_VALIDEE_RC est le statut porté pendant toute cette opération.)*
- *(Nouvelle opération, auparavant fusionnée avec OP1.2.)*

## OP1.3 — Statuer sur la FAD (CDS)
- **Événements** : FAD_TRANSMISE_CDS (n°8, ou n°10 après complément) ; *ou* « FAD à compléter, reprise après demande du CDS » (depuis FAD_A_COMPLETER, complétée par le **RC** — pas par le CDS lui-même, n°9-10).
- **Synchronisation** : —
- **Actions** : contrôle de la FAD ; décision (n°13).
- **Règles d'émission** :
  - validé → le CDS enchaîne avec OP1.3b (transmission à la CB) ;
  - rejeté → FAD rejetée, **terminal** ;
  - annulé → FAD annulée, **terminal** ;
  - complément demandé → FAD à compléter, reprise en place **par le RC** — **pas de duplication**.
- **Résultats** : **FAD_VALIDEE_CDS** | **FAD_REJETEE_CDS** | **FAD_ANNULEE_CDS** | **FAD_A_COMPLETER**.

## OP1.3b — Transmettre la FAD à la CB (CDS)
- **Événement** : FAD_VALIDEE_CDS (n°14).
- **Synchronisation** : —
- **Actions** : transmission de la FAD et de ses pièces à la CB.
- **Règles d'émission** : transmission systématique.
- **Résultat** : **FAD_TRANSMISE_CB**.
- *(Nouvelle opération. FAD_TRANSMISE_CB est aussi atteint directement par le RC depuis FAD_A_MODIFIER (n°11-12), sans repasser par cette opération ni par le CDS — voir OP1.4.)*

## OP1.4 — Contrôler les éléments financiers et budgétaires, statuer (CB)
- **Événements** : FAD_TRANSMISE_CB (n°14) ; *ou* « FAD modifiée, retransmise directement par le RC » (depuis FAD_A_MODIFIER, n°11-12 — **sans repasser par le CDS**).
- **Synchronisation** : —
- **Actions** : ajout et validation des éléments comptables — imputation budgétaire, mise en place des crédits (n°15) ; contrôle des budgets alloués, de la validité/du plafond du marché mentionné, cohérence de l'imputation ; décision (n°16).
- **Règles d'émission** :
  - validé → le CB enchaîne avec OP1.4b (routage selon le seuil) ;
  - rejeté (crédits insuffisants, marché inactif, plafond atteint) → FAD rejetée, **terminal** — la CB ne juge jamais l'opportunité de l'achat, uniquement la conformité budgétaire/comptable : elle ne dispose donc **pas** d'issue « annulé » ;
  - modification demandée → FAD à modifier, reprise en place **par le RC**, qui retransmet **directement à la CB** (pas de nouveau passage par le CDS) — **pas de duplication**.
- **Résultats** : **FAD_VALIDEE_CB** | **FAD_REJETEE_CB** | **FAD_A_MODIFIER**.

## OP1.4b — Router selon le seuil de validation DS (automatique)
- **Événement** : FAD_VALIDEE_CB (n°17).
- **Synchronisation** : lecture du SEUIL_VALIDATION_DS du service de la FAD, colonne correspondant à l'imputation (SEUIL_FONCTIONNEMENT ou SEUIL_INVESTISSEMENT) — plus de notion de date/historique depuis le 28/08/2026 (MCD/MLD). **Absence de ligne pour ce service = seuil considéré à 0** pour les deux imputations (donc `montant ≥ seuil` presque toujours vrai en pratique → transmission systématique au DS tant qu'aucun seuil n'a été paramétré, jamais d'exemption par défaut).
- **Actions** : évaluation automatique, immédiatement après la validation CB — aucune saisie, aucune décision humaine.
- **Règles d'émission** :
  - montant ≥ seuil → transmission au DS ;
  - montant < seuil → exemption automatique, la FAD est réputée autorisée sans intervention du DS.
- **Résultats** : **FAD_TRANSMISE_DS** | **FAD_VALIDEE_DS_SEUIL**.
- *(Nouvelle opération, isole le routage automatique auparavant imbriqué dans la décision de la CB. FAD_VALIDEE_DS_SEUIL remplace la précédente notion, non nommée dans le référentiel STATUT, d'« exemption ».)*

## OP1.5 — Autoriser la commande (DS) — uniquement si FAD_TRANSMISE_DS
- **Événement** : FAD_TRANSMISE_DS (n°20).
- **Synchronisation** : —
- **Actions** : examen de la FAD ; décision.
- **Règles d'émission** :
  - validé → FAD renvoyée à la CB pour élaboration de la commande ;
  - rejeté (achat jugé non pertinent) → FAD rejetée, **terminal** ;
  - annulé (opportunité d'achat devenue caduque) → FAD annulée, **terminal**.
- **Résultats** : **FAD_VALIDEE_DS** | **FAD_REJETEE_DS** | **FAD_ANNULEE_DS**.

## OP1.5b — Générer la fiche récapitulative de la FAD (PDF) — automatique
- **Événement** : « FAD autorisée » — FAD_VALIDEE_DS (circuit complet) *ou* FAD_VALIDEE_DS_SEUIL (exemption automatique, cf. OP1.4b).
- **Synchronisation** : —
- **Actions** : génération automatique d'un PDF récapitulant les éléments de la FAD ; ajout en PIECE_JOINTE (ORIGINE=SYSTEME, TYPE_PIECE=FICHE_FAD), non supprimable par l'utilisateur.
- **Règles d'émission** : —
- **Résultat** : **fiche récapitulative FAD attachée**.

## OP1.6 — Élaborer et constater la commande (CB)
- **Événement** : « FAD autorisée » — FAD_VALIDEE_DS *ou* FAD_VALIDEE_DS_SEUIL.
- **Synchronisation** : —
- **Actions** : saisie des informations de la FAD dans le PGI (**TM**, hors application, n°18) ; puis édition du bon de commande et saisie du MONTANT_COMMANDE dans l'application (**TI**, n°19).
- **Règles d'émission** : —
- **Résultat** : **FAD_COMMANDEE**. *(Message sortant vers le PGI = émission effective de la commande, réalisée dans le PGI, hors application.)*

## OP1.7 — Clôturer / rouvrir la FAD (indicateur réversible)
- **Événement** : décision de (dé)clôture (Demandeur ou CB).
- **Synchronisation** : FAD au statut FAD_COMMANDEE.
- **Actions** : pose/retrait de l'indicateur « aucun CSF supplémentaire attendu ».
- **Résultat** : **FAD_CLOTUREE** (réversible). Lien avec le processus 2 : conditionne la fin d'attente de CSF.

═══════════════════════════════════════════
# PROCESSUS 2 — SERVICE FAIT (CSF → liquidation/paiement)
═══════════════════════════════════════════

## OP2.1 — Élaborer le certificat de service fait (rédacteur)
- **Événement** : « Création d'un CSF » (externe, rédacteur = demandeur initial ou RC du demandeur) — **point d'entrée du processus 2**.
- **Synchronisation (gardes)** : FAD au statut FAD_COMMANDEE (R1) ; au moins un justificatif joint (R5).
- **Actions** : saisie montant constaté, date de service fait, description ; dépôt des justificatifs (PV réception, bon de livraison).
- **Règles d'émission** : transmission au RC.
- **Résultat** : **CSF_A_TRAITER**.

## OP2.2 — Statuer sur le CSF (RC)
- **Événements** : CSF_A_TRAITER ; *ou* « CSF resoumis » (reprise après rejet).
- **Synchronisation** : —
- **Actions** : contrôle du service fait ; décision.
- **Règles d'émission** : validé → transmission à la CB ; rejeté → CSF rejeté (modification en place possible, puis resoumission ; suppression physique permise tant que rejeté — R4).
- **Résultats** : **CSF_TRANSMIS_BUDGET** | **CSF_REJETE_RC**.

## OP2.3 — Valider le CSF et déclencher le paiement (CB / Budget)
- **Événement** : CSF_TRANSMIS_BUDGET.
- **Synchronisation** : calcul du cumul des CSF validés de la FAD.
- **Actions** : contrôle budgétaire/comptable ; décision.
- **Règles d'émission** :
  - validé → paiement déclenché dans le PGI (message sortant) ; **si** cumul des CSF validés > MONTANT_COMMANDE → **alerte** (non bloquant, R2) ;
  - rejeté → CSF rejeté ; reprise ouverte **au rédacteur et au RC** (R4).
- **Résultats** : **CSF_VALIDE_BUDGET** | **CSF_REJETE_BUDGET**.

## OP2.4 — Constater la liquidation de la facture (retour PGI)
- **Événement** : « Facture liquidée dans le PGI » (**externe**, constatée par la CB).
- **Synchronisation** : CSF au statut CSF_VALIDE_BUDGET.
- **Actions** : mise à jour du statut.
- **Règles d'émission** : —
- **Résultat** : **CSF_LIQUIDE** — statut **terminal**, verrouille définitivement le CSF (R6). *(La facture reste dans le PGI, non stockée dans l'application — D8.)*

═══════════════════════════════════════════
# PROCESSUS 3 — IMPORTS DE RÉFÉRENTIELS PGI
═══════════════════════════════════════════

## OP3.1 — Intégrer un référentiel PGI (opération unique, automatique)
- **Événement** : « Dépôt d'un fichier de référentiel PGI » (externe, par un service ; un import = un seul service). Types : marchés, fournisseurs, CUG, opérations d'investissement.
- **Synchronisation** : —
- **Actions (routine embarquant tous les contrôles, sans étape de confirmation — option a)** :
  1. **Validation** : rejet des lignes sans clé (ex. NUMMARCHE vide), listées en anomalie.
  2. **Consolidation** : doublons de clé dans le fichier traités « dernier gagne », signalés en anomalie.
  3. **Intégration** : ajout (nouvelle clé), modification (réécriture des champs pilotés par l'import), archivage (clé absente du fichier → ETAT = Inactif, jamais de suppression physique). Cas particulier marché « AUTRE » retrouvé → réinitialisé comme un ajout, signalé en anomalie.
  4. **Variante import marchés** : si le NUM_TITULAIRE est inconnu du service, **auto-création d'une fiche FOURNISSEUR** (TYPE_CREATION = PGI), listée dans « fournisseurs ajoutés ».
  5. **Compte-rendu** : marchés ajoutés, archivés, fournisseurs ajoutés, anomalies.
- **Règles d'émission** : intégration **partielle** (les anomalies n'annulent pas l'import).
- **Résultats** : **référentiel mis à jour** + **compte-rendu d'import**.

═══════════════════════════════════════════
# ENCHAÎNEMENT INTER-PROCESSUS
═══════════════════════════════════════════

- **P1 → P2** : le résultat **FAD_COMMANDEE** (OP1.6) est la précondition d'entrée de l'élaboration du CSF (OP2.1, garde R1). Une FAD peut donner lieu à 0..N CSF ; FAD_CLOTUREE (OP1.7) borne cette attente.
- **P3 → P1/P2** : OP3.1 alimente les référentiels (MARCHE, FOURNISSEUR, CUG, OPERATION_INVESTISSEMENT) consommés par OP1.1–OP1.5. Processus autonome, déclenché à la demande.
- **Frontière PGI** : messages sortants (émission de commande après OP1.6 ; paiement après OP2.3) et événements externes de retour (OP1.6, OP2.4).

# Contrôle croisé avec le MCD (couverture des données)

Chaque opération dispose des données requises dans le MCD consolidé :
- OP1.4b (seuil) : SEUIL_VALIDATION_DS (service, SEUIL_FONCTIONNEMENT/SEUIL_INVESTISSEMENT — plus d'historisation depuis le 28/08/2026) ✔
- OP1.6 : MONTANT_COMMANDE sur DEMANDE_ACHAT ✔
- OP1.5b : PIECE_JOINTE.ORIGINE (SYSTEME) + TYPE_PIECE (FICHE_FAD) — support de la fiche générée ✔
- OP1.1 (devis) : DEVIS_CONSULTE (HORS_MARCHE 1-5 obligatoires, MARCHE 0-1 facultatif — décision du 07/09/2026) + PIECE_JOINTE.ID_FOURNISSEUR (documents complémentaires par fournisseur, pas par devis — décision du 07/09/2026) ✔
- OP2.1 : rattachement FAD + rédacteur (ACTEUR) + PIECE_JOINTE (justificatif) ✔
- OP2.3 (alerte R2) : MONTANT_CSF (cumul) vs MONTANT_COMMANDE ✔
- OP3.1 : ACTIF (MARCHE, ex-ETATMARCHE)/ETATFOURNISSEUR, TYPE_CREATION, clés de rapprochement ✔
Aucune donnée manquante identifiée à ce stade.

# Points à valider
- Granularité et découpage des opérations (une par point de décision) — à confirmer.
- OP1.7 (clôture) : opération à part entière au MCT, ou simple bascule d'indicateur reléguée au MOT ? (proposée ici a minima).
- OP1.4b (routage automatique du seuil) : l'évaluation immédiate après FAD_VALIDEE_CB est-elle instantanée/synchrone (aucun état intermédiaire visible), ou doit-elle être modélisée comme un traitement TA distinct au MOT (avec un très léger délai de traitement) ? Modélisée ici comme instantanée.
- Rejet/annulation devenus terminaux sans resoumission assistée (refonte du 06/09/2026) : à confirmer que c'est bien l'intention — un nouveau besoin repart d'une DA créée manuellement (OP1.1), sans lien conservé avec la DA/FAD rejetée ou annulée.

# Historique
- 09/09/2026 (refonte de la gestion documentaire — écran unifié dans CreationDA) : OP1.1 corrigée — toute la gestion documentaire (devis et pièces complémentaires) est retirée de MarcheDA/FournisseurDA (boutons « Ajouter Devis »/icônes « Devis »/« PC » supprimés) et centralisée dans un nouvel écran unique ouvert depuis CreationDA (bouton « Gestion documentaire », actif une fois un fournisseur identifié — marché enregistré ou premier candidat consulté). Cet écran liste, par fournisseur choisi dans un sélecteur dédié (le titulaire seul en Marché, chaque candidat consulté en Hors marché), le devis (ajout/remplacement/suppression du fichier/téléchargement) et les pièces complémentaires (ajout avec type de pièce obligatoire/suppression/téléchargement) de ce fournisseur pour cette DA. Nettoyage documentaire étendu aux pièces complémentaires (jusqu'ici seul le devis était purgé) : changement de procédure, changement de marché sélectionné et retrait d'un candidat consulté purgent désormais devis **et** pièces complémentaires, fichiers Storage compris. Voir MLD (§7) pour le détail (CRUD complet de PIECE_JOINTE, nouveau bucket Storage `piece-jointe-fad`, domaine référentiel `TYPE_PIECE_FAD` exposé).
- 09/09/2026 (construction de PiecesDevisDA — dépôt de fichier par ligne DEVIS_CONSULTE, abandon du delete-then-recreate) : OP1.1 corrigée sur deux points, tous deux motivés par le dépôt de fichier (croquis DA.pdf page 5) : (1) MarcheDA (« Montant & marché ») ne purge plus systématiquement les candidats déjà consultés à chaque enregistrement — seulement si le marché sélectionné change réellement, pour ne pas détruire un devis déjà déposé au moindre ajustement de montant ; (2) FournisseurDA (« Éléments de consultation ») abandonne le remplacement intégral de la liste à l'« Enregistrer » — ajouter/retirer un candidat écrit désormais immédiatement en base (avant tout enregistrement), pour que le bouton « Devis » de chaque candidat fonctionne dès son ajout ; « Enregistrer » ne fait plus que fixer l'ordre final et le montant des candidats déjà existants. Voir MLD (§7) pour le détail (nouveau bucket Storage `devis-consulte-pieces`, réassignation ORDRE/RETENU par valeurs négatives temporaires).
- 09/09/2026 (MONTANT_DEMANDE — retour à la dérivation pour HORS_MARCHE, renverse la décision du 07/09/2026 juste en dessous) : OP1.1 corrigée — pour HORS_MARCHE, MONTANT_DEMANDE est désormais recopié depuis MONTANT_DEVIS du candidat retenu (ORDRE=1) à l'action « Fournisseurs consultés », plus saisi dans CreationDA. Motivation du client : « le montant demandé pour une procédure hors marché, c'est le montant défini pour l'entreprise retenue ». CreationDA.Montant DA devient un champ d'affichage seul dans les deux procédures — la saisie a désormais toujours lieu dans l'écran dédié à la procédure (MarcheDA pour MARCHE, saisie manuelle inchangée ; FournisseurDA pour HORS_MARCHE, dérivé). Répercuté dans le MLD (§2.4).
- 07/09/2026 (modèle de création progressive de la DA) : OP1.1 réécrite — abandon de l'idée d'une écriture unique et atomique de la DA à un « Enregistrer » final (fonction Postgres englobante envisagée puis écartée), au profit d'un brouillon créé immédiatement au clic « Nouvelle demande » (NUMERO alloué à ce moment via une fonction dédiée à l'allocation seule, sans logique métier) ; CreationDA et ses écrans filles (MarcheDA, FournisseurDA, PiecesDevisDA, PiecesComplementairesDA) opèrent ensuite sur une DA déjà existante, chaque sous-écran écrivant sa donnée à son propre « Enregistrer ». Décidé pour éviter le risque de fichiers orphelins dans le Storage (un upload ne peut de toute façon pas faire partie d'une transaction SQL) et rester cohérent avec le reste du backend, qui n'utilise que des écritures séquentielles simples. Migration `20260907160000_devis_montant_nullable_et_creation_brouillon.sql`. Répercuté dans le MLD (§2.4, §7) et le MOT.
- 07/09/2026 (MONTANT_DEMANDE — retour à une saisie manuelle indépendante) : OP1.1 corrigée — MONTANT_DEMANDE saisi manuellement dans les deux procédures, sans dérivation depuis DEVIS_CONSULTE (annule une décision prise plus tôt le même jour). Incohérence assumée par le client entre MONTANT_DEMANDE et le montant du candidat retenu en HORS_MARCHE. Voir MCD/MLD.
- 07/09/2026 (PIECE_JOINTE rattachée au fournisseur, pas au devis) : contrôle croisé corrigé — les documents complémentaires se rattachent à `PIECE_JOINTE.ID_FOURNISSEUR` (FK directe vers FOURNISSEUR), pas à `ID_DEVIS`/DEVIS_CONSULTE comme documenté un temps plus tôt le même jour. Voir MCD/MLD pour le détail.
- 07/09/2026 (numérotation DA/FAD distincte par service) : OP1.1 précisée — NUMERO unique par service seulement (plus globalement), SERVICE dérivé du demandeur cible et figé à la création. Voir MCD/MLD pour le détail (clé technique ID_DEMANDE_ACHAT).
- 07/09/2026 (écran FournisseurDA — dépôt différé du PDF et classement des candidats) : OP1.1 précisée — le classement des candidats (ORDRE, glisser-déposer) détermine désormais le RETENU, en remplacement d'une désignation directe ; PDF du devis et pièces complémentaires déposés a posteriori depuis l'écran documentaire de la page DemandeAchat, plus à l'action « Fournisseurs consultés »/« Marché concerné » elles-mêmes ; MONTANT_DEMANDE devient un champ dérivé du montant Marché ou du devis en ORDRE=1. Répercuté dans le MCD (§1, §8) et le MLD (§2.4, §4, §7).
- 07/09/2026 (partage des responsabilités de saisie DA/FAD — clarification wireframe DemandeAchat) : OP1.1 corrigée — retrait de « imputation » de la liste des actions du Demandeur (redondance erronée avec OP1.2b, jamais corrigée depuis la refonte du 06/09/2026) ; précision que MOTIF_CHOIX/LIBELLE_MOTIF_CHOIX et le candidat retenu sont saisis à l'action « Fournisseurs consultés », re-désignables jusqu'à la transmission ; MOTIF_CHOIX étendu à MARCHE (valeur `Prix` systématique, réellement écrite en base). OP1.2b précisée — CODE_SITE/CODE_SECTEUR/CODE_CUG rejoignent explicitement TYPE_ACHAT/IMPUTATION_COMPTABLE comme champs saisis par le RC, jamais par le Demandeur. Répercuté dans le MCD (§1, §8) et le MLD (§2.4, §7).
- 07/09/2026 (devis et pièces jointes — clarification cycle de saisie de la DA) : OP1.1 précisée — DEVIS_CONSULTE ouvert au cas MARCHE (0 ou 1 ligne facultative, devis BPU du titulaire), en plus du cas HORS_MARCHE (1 à 5 lignes obligatoires, déjà en vigueur mais borne haute non documentée jusqu'ici). PIECE_JOINTE rattachable à un DEVIS_CONSULTE en plus de la DA, pour les documents complémentaires propres à une entreprise consultée. Contrôle croisé MCD mis à jour. Répercuté dans le MCD (§1, §2, §8) et le MLD (§2.4, §4, §7).
- 23/08/2026 : premier jet du MCT Phases 1 & 2, après validation du découpage (3 processus), de l'inventaire évènementiel (retours PGI en événements externes ; création CSF = entrée du P2) et du mode d'import (opération unique automatique).
- 28/08/2026 (simplification SEUIL_VALIDATION_DS) : OP1.4 mise à jour — la synchronisation ne lit plus un seuil "en vigueur à la date" (l'historisation est abandonnée, voir MCD/MLD) mais directement SEUIL_FONCTIONNEMENT/SEUIL_INVESTISSEMENT du service, avec un service sans ligne traité comme seuil 0 pour les deux imputations.
- 02/09/2026 (répercussion différée — renommage ETATMARCHE → ACTIF, règle UTILISABLE) : OP1.1 précisée — si PROCEDURE_ACHAT = MARCHE, seuls les marchés UTILISABLE (ACTIF ET COMPLETUDE) sont proposables à la sélection. Contrôle croisé MCD (OP3.1) mis à jour : ETATMARCHE → ACTIF. Décisions prises le 30/08/2026 (voir `ForClaude/Importation-marches/import-marches-pgi.md`, Historique), signalées comme dette explicite dans le MLD (§2.2) et restées non répercutées ici jusqu'à ce jour.
- 06/09/2026 (refonte du cycle DA/FAD — validation client) : Processus 1 entièrement réécrit pour coller au tableau détaillé « Cycle de vie d'une FAD » validé par le client (20 indices). OP1.1 renommée et son résultat devient DA_TRANSMISE_RC (remplace DA_ENREGISTREE). OP1.2 n'a plus deux issues (validé/rejeté) mais quatre (validé/rejeté/annulé/à compléter), sans duplication en cas de rejet. Nouvelle OP1.2b isolant la finalisation de la FAD par le RC (bascule DA → FAD), auparavant fusionnée avec OP1.2. OP1.3 gagne également l'annulation et la reprise « à compléter » portée par le RC (pas le CDS) ; nouvelle OP1.3b isolant la transmission à la CB. OP1.4 perd le routage vers le DS (déplacé vers la nouvelle OP1.4b, automatique) et gagne la reprise « à modifier » portée par le RC avec retransmission directe à la CB (sans repasser par le CDS) ; confirmé que la CB n'a pas d'issue « annulé ». OP1.5 gagne l'annulation, distincte du rejet. OP1.5b et OP1.6 mis à jour pour référencer FAD_VALIDEE_DS_SEUIL (remplace « exemption », non nommée jusqu'ici dans STATUT). Répercuté dans le MCD (§1, §8), le MLD (§2.5, §4, §7) et le MOT (Processus 1).
