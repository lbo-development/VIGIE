---
MCT (Modèle Conceptuel des Traitements) - Phases 1 & 2
Décrit le « quoi » des traitements (événements, opérations, règles, résultats), indépendamment du qui/quand/comment (réservé au MOT). Dérivé du CDG (acteurs), des exigences Phase 1, du MCD consolidé (mcd-phases-1-2.md) et des décisions Phase 2 (D1–D9).
Découpage validé : 3 processus reliés — (1) Demande d'achat, (2) Service fait, (3) Imports de référentiels PGI.
Statut : premier jet complet, à valider.
---

# Formalisme et conventions

Chaque **opération** est décrite par : événement(s) déclencheur(s) → synchronisation (garde/condition d'entrée) → actions → règles d'émission (conditions de sortie) → résultat(s). Les **résultats** d'une opération sont, en mode pull, les **événements internes** qui rendent l'objet disponible à l'opération suivante (pas de notification — relève du MOT). Les **acteurs** ne figurent qu'à titre indicatif (le « qui » est du MOT).

**Acteurs / entités externes** : Demandeur, RC, CDS, CB, DS, et le **PGI** (outil transversal de comptabilité) en frontière. Le PGI reçoit les messages sortants (autorisation de commande, déclenchement de paiement) et ses retours (commande passée, facture liquidée) reviennent sous forme d'**événements externes** constatés par la CB.

**Hors périmètre MCT (→ MOT)** : mode pull, gestes de saisie manuelle de statut, mécanique de suppléance, écrans et profils.

**Choix de modélisation retenus** : (i) une opération par point de décision ; (ii) rejet = résultat, reprise = nouvel événement ré-entrant ; (iii) import = une opération unique automatique (option a).

═══════════════════════════════════════════
# PROCESSUS 1 — DEMANDE D'ACHAT (DA → autorisation/commande)
═══════════════════════════════════════════

## OP1.1 — Créer la demande d'achat
- **Événement** : « Besoin d'achat exprimé » (externe, Demandeur).
- **Synchronisation** : —
- **Actions** : saisie objet, description, montant demandé, procédure (marché/hors marché), imputation, dépôt des devis/pièces.
- **Règles d'émission** : demande complète soumise au RC.
- **Résultat** : **DA_ENREGISTREE**.

## OP1.2 — Statuer sur l'opportunité d'achat (RC)
- **Événements** : DA_ENREGISTREE ; *ou* « DA resoumise » (reprise après rejet).
- **Synchronisation** : —
- **Actions** : reformulation objet/description, confirmation du n° de marché, validation du montant, proposition d'imputation, saisie gisements et TYPE_FAD ; décision.
- **Règles d'émission** :
  - validé → transmission au CDS ;
  - rejeté (information manquante / opportunité non retenue) → DA rejetée, ouverte à resoumission par le Demandeur.
- **Résultats** : **FAD_TRANSMISE_CDS** | **DA_REJETEE**.

## OP1.3 — Statuer sur la FAD (CDS)
- **Événement** : FAD_TRANSMISE_CDS.
- **Synchronisation** : —
- **Actions** : contrôle de la FAD ; décision.
- **Règles d'émission** : validé → transmission à la CB ; rejeté → FAD rejetée (recréation par duplication).
- **Résultats** : **FAD_TRANSMISE_BUDGET** | **FAD_REJETEE_CDS**.

## OP1.4 — Contrôler les éléments financiers et budgétaires (CB)
- **Événement** : FAD_TRANSMISE_BUDGET.
- **Synchronisation** : lecture du SEUIL_VALIDATION_DS du service de la FAD, colonne correspondant à l'imputation (SEUIL_FONCTIONNEMENT ou SEUIL_INVESTISSEMENT) — plus de notion de date/historique depuis le 28/08/2026 (MCD/MLD). **Absence de ligne pour ce service = seuil considéré à 0** pour les deux imputations (donc `montant ≥ seuil` presque toujours vrai en pratique → transmission systématique au DS tant qu'aucun seuil n'a été paramétré, jamais d'exemption automatique par défaut).
- **Actions** : contrôle des budgets alloués, validité/plafond des marchés, cohérence de l'imputation ; décision.
- **Règles d'émission** :
  - rejeté (budget non alloué, marché périmé/saturé, incohérence) → FAD rejetée (duplication) ;
  - validé **et** montant ≥ seuil → transmission au DS ;
  - validé **et** montant < seuil → **exemption DS** : la FAD est réputée autorisée ; la CB pourra passer commande (le chemin saute directement à la commande, sans FAD_TRANSMISE_DS / FAD_VALIDEE_DS).
- **Résultats** : **FAD_TRANSMISE_DS** | *(exemptée)* prête pour commande | **FAD_REJETEE_BUDGET**.

## OP1.5 — Autoriser la commande (DS) — uniquement si montant ≥ seuil
- **Événement** : FAD_TRANSMISE_DS.
- **Synchronisation** : —
- **Actions** : examen de la FAD ; autorisation ou refus motivé.
- **Règles d'émission** : validé → FAD renvoyée à la CB pour émission de commande ; rejeté (motif) → FAD rejetée (duplication).
- **Résultats** : **FAD_VALIDEE_DS** | **FAD_REJETEE_DS**.

## OP1.5b — Générer la fiche récapitulative de la FAD (PDF) — automatique
- **Événement** : « FAD autorisée » — FAD_VALIDEE_DS (circuit complet) *ou* FAD exemptée de DS (feu vert CB, cf. OP1.4).
- **Synchronisation** : —
- **Actions** : génération automatique d'un PDF récapitulant les éléments de la FAD ; ajout en PIECE_JOINTE (ORIGINE=SYSTEME, TYPE_PIECE=FICHE_FAD), non supprimable par l'utilisateur.
- **Règles d'émission** : —
- **Résultat** : **fiche récapitulative FAD attachée**.

## OP1.6 — Constater la commande passée dans le PGI (retour PGI)
- **Événement** : « Commande passée dans le PGI » (**externe**, constatée par la CB) — s'applique aux deux chemins : après FAD_VALIDEE_DS, ou directement après contrôle CB en cas d'exemption.
- **Synchronisation** : la FAD est autorisée (FAD_VALIDEE_DS) *ou* exemptée de DS.
- **Actions** : mise à jour du statut ; saisie du MONTANT_COMMANDE.
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
- OP1.4 (seuil) : SEUIL_VALIDATION_DS (service, SEUIL_FONCTIONNEMENT/SEUIL_INVESTISSEMENT — plus d'historisation depuis le 28/08/2026) ✔
- OP1.6 : MONTANT_COMMANDE sur DEMANDE_ACHAT ✔
- OP1.5b : PIECE_JOINTE.ORIGINE (SYSTEME) + TYPE_PIECE (FICHE_FAD) — support de la fiche générée ✔
- OP2.1 : rattachement FAD + rédacteur (ACTEUR) + PIECE_JOINTE (justificatif) ✔
- OP2.3 (alerte R2) : MONTANT_CSF (cumul) vs MONTANT_COMMANDE ✔
- OP3.1 : ETATMARCHE/ETATFOURNISSEUR, TYPE_CREATION, clés de rapprochement ✔
Aucune donnée manquante identifiée à ce stade.

# Points à valider
- Granularité et découpage des opérations (une par point de décision) — à confirmer.
- OP1.7 (clôture) : opération à part entière au MCT, ou simple bascule d'indicateur reléguée au MOT ? (proposée ici a minima).
- Représentation de la reprise après rejet : modélisée comme événement ré-entrant (retenu) plutôt qu'opérations distinctes.

# Historique
- 23/08/2026 : premier jet du MCT Phases 1 & 2, après validation du découpage (3 processus), de l'inventaire évènementiel (retours PGI en événements externes ; création CSF = entrée du P2) et du mode d'import (opération unique automatique).
- 28/08/2026 (simplification SEUIL_VALIDATION_DS) : OP1.4 mise à jour — la synchronisation ne lit plus un seuil "en vigueur à la date" (l'historisation est abandonnée, voir MCD/MLD) mais directement SEUIL_FONCTIONNEMENT/SEUIL_INVESTISSEMENT du service, avec un service sans ligne traité comme seuil 0 pour les deux imputations.
