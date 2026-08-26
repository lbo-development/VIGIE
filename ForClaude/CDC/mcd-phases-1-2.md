---
MCD (Modèle Conceptuel de Données) - CONSOLIDÉ Phases 1 & 2
Synthèse notation Merise (entités, associations, cardinalités). Phase 1 issue du MCD validé les 20-21/08/2026 (claude_mcd-phase1.md), avec la correction du seuil DS du 22/08. Phase 2 validée le 23/08/2026 (9 décisions D1–D9).
Statut : Phases 1 & 2 validées. Document de référence conceptuel unique. Le MLD consolidé (mld-phases-1-2.md) et le dictionnaire (MLD_Dictionnaire_Donnees_Phases1-2.xlsx) en découlent.
---

# Note de lecture

Ce MCD est conceptuel : il décrit les données indépendamment de leur implémentation. Deux décisions prises pendant les travaux relèvent du **niveau logique (MLD/MPD)** et ne sont donc **pas** représentées ici, mais le sont dans le MLD :
- Clés de substitution techniques (ID) pour DIRECTION, SERVICE, CELLULE et FOURNISSEUR — conceptuellement, ces entités restent identifiées par leur code/attributs métier.
- Dénormalisation du statut courant sur DEMANDE_ACHAT / CERTIFICAT_SERVICE_FAIT — la source d'autorité conceptuelle reste l'historique.

Décisions conceptuelles intégrées depuis le MCD Phase 1 initial : CUG analytique obligatoire (arbitrage 1) ; historisation des rôles (arbitrage 3) ; état sur FOURNISSEUR (arbitrage 4) ; seuil DS rattaché au service (correction 22/08) ; entités CSF (Phase 2).

═══════════════════════════════════════════
# PARTIE 1 — PHASE 1 (Demande → Autorisation de commande)
═══════════════════════════════════════════

# 1. Entités et attributs

## Référentiel organisationnel
- **DIRECTION** : CODE_DIRECTION (id), LIBELLE_DIRECTION
- **SERVICE** : CODE_SERVICE (id), LIBELLE_SERVICE
- **CELLULE** : CODE_CELLULE (id), LIBELLE_CELLULE
- **ACTEUR** : MATRICULE (id), NOM, PRENOM, FONCTION (métier réel ; le rôle applicatif est porté par ROLE)

## Référentiels métier (import PGI ou gestion autonome)
- **SITE** : CODE_SITE (id), LIB_SITE, ORDRE_SITE — gisement géographique (BI) ; rattaché à un SERVICE
- **SOUS_SITE** : CODE_SOUS_SITE (id partiel, avec CODE_SITE), ORDRE_SOUS_SITE, ACTIF — déclinaison d'un SITE (ex. poste, quai) ; identifiant conceptuel = (CODE_SITE, CODE_SOUS_SITE)
- **SECTEUR** : CODE_SECTEUR (id), LIB_SECTEUR, ORDRE_SECTEUR — gisement technique (BI) ; rattaché à un SERVICE
- **SOUS_SECTEUR** : CODE_SOUS_SECTEUR (id partiel, avec CODE_SECTEUR), ORDRE_SOUS_SECTEUR, ACTIF — déclinaison d'un SECTEUR ; identifiant conceptuel = (CODE_SECTEUR, CODE_SOUS_SECTEUR)
- **CUG** : CODE_CUG (id), LIBELLE_CUG — rattaché à un SERVICE (Compte Unitaire de Gestion, analytique)
- **OPERATION_INVESTISSEMENT** : NUMERO_OPERATION (id), LIBELLE, MT_AP1, MT_AP8, MT_CP1, MT_CP8, DATE_CREATION, MT_INITIAL
- **MARCHE** : NUMMARCHE (id), ETATMARCHE (Actif | Inactif), TYPE_CREATION (SERVICE | AUTRE), TYPEPROC, TYPEDECOMPOPRIX, NATUREPRESTA, LIBPGI, LIBELLE_SERVICE, TITULAIRE, NUM_TITULAIRE, TITULAIRE_SERVICE, AGENTGESTION, CUGGestion (réf. CUG), DTENOTIF, DTEVALID, DTEDEBUT, DTEFINMAX, MTMINI, MTMAXI, ALERTEMT, ALERTEDATE, LASTMTREALISE, LASTMTENGAGE, DTELASTSOLDE, PLANPREVENTIONACTIF. MT_SOLDE = attribut calculé non stocké (MTMAXI − (LASTMTREALISE + LASTMTENGAGE)). Un seul titulaire par marché ; NUM_TITULAIRE = clé de rapprochement avec FOURNISSEUR.NUMPGI.
- **FOURNISSEUR** : ID (id technique), SERVICE (réf.), ETATFOURNISSEUR (Actif | Inactif — arbitrage 4), RAISON_SOCIALE_PGI, RAISON_SOCIALE_SERVICE, SIRET, NUMPGI, ADR1, ADR2, CP, VILLE, CEDEX, TYPE_CREATION (PGI | SERVICE). Clé métier réelle = (SERVICE, SIRET) ; référentiel autonome par service.
- **CONTACT** : ID_CONTACT (id), NOM, PRENOM, MAIL, TELFIXE, TELMOBILE, FONCTION, NATUREFONCTION (liste fermée) — rattaché à un FOURNISSEUR (0..N par fournisseur).

## Rôles applicatifs
- **ROLE** *(niveau physique/MLD : table `ROLE_ATTRIBUTION`, pour éviter la collision avec la notion native de rôle Postgres/Supabase — cf. MLD §2.3, décision du 24/08/2026 ; l'entité conceptuelle reste ROLE ici)* : ID_ROLE (id), TYPE_ROLE (RC | CDS | DS | CB | ADMIN_SERVICE | ADMIN_APP), DATE_DEBUT, DATE_FIN, ACTIF (historisation — arbitrage 3). Instance d'attribution d'un rôle à un ACTEUR sur un périmètre : CELLULE pour RC ; SERVICE pour CDS, CB et ADMIN_SERVICE ; DIRECTION pour DS ; **sans périmètre pour ADMIN_APP** (habilitation transverse). Unicité d'un actif par périmètre pour RC/CDS/DS ; CB collective par service ; ADMIN_SERVICE et ADMIN_APP sans contrainte d'unicité. L'historisation conserve la trace des titulaires successifs. *(ADMIN_SERVICE : administration locale au service — référentiel fournisseurs, imports, déclaration des rôles/suppléances ; ADMIN_APP : paramètres transverses et comptes utilisateurs.)*
- **SUPPLEANCE** : ID_SUPPLEANCE (id), DATE_DEBUT, DATE_FIN — relie un ROLE (titulaire absent, RC/CDS/DS) à un ACTEUR suppléant détenant un rôle de même TYPE_ROLE. Modèle horizontal, auto-déclaré, une suppléance active à la fois.

## Cœur métier : la demande
- **DEMANDE_ACHAT** (cycle DA → FAD, un seul numéro) : NUMERO (id, AAAA-MM-JJ-XXX par service), OBJET (80 car.), DESCRIPTION (256 car.), MONTANT_DEMANDE, IMPUTATION_COMPTABLE (FONCTIONNEMENT | INVESTISSEMENT), PROCEDURE_ACHAT (MARCHE | HORS_MARCHE), TYPE_ACHAT (TRAVAUX | FOURNITURES | SERVICES, BI), TYPE_FAD (CONTRAT | OUVERTE | FERMEE), MOTIF_CHOIX (Prix | Délai | Technique | Autre, si HORS_MARCHE), LIBELLE_MOTIF_CHOIX, MONTANT_RETENU, MONTANT_COMMANDE (saisi par la CB), DATE_CREATION, STATUT_COURANT (réf. STATUT).
- **DEVIS_CONSULTE** (uniquement si HORS_MARCHE) : ID_DEVIS (id), MONTANT_DEVIS, FICHIER_PDF, RETENU (un seul RETENU=vrai par demande).
- **PIECE_JOINTE** : ID_PIECE (id), TYPE_PIECE, ORIGINE (UTILISATEUR | SYSTEME), FICHIER (PDF, 10 Mo max), NOM_FICHIER. En Phase 2, rattachable aussi à un CSF (cf. Partie 2). À l'autorisation de la FAD, une **fiche récapitulative PDF** est générée automatiquement et ajoutée en PIECE_JOINTE (ORIGINE=SYSTEME, TYPE_PIECE=FICHE_FAD), non supprimable par l'utilisateur.
- **STATUT** (référentiel) : CODE_STATUT (id) — DA_ENREGISTREE, DA_REJETEE, FAD_TRANSMISE_CDS, FAD_REJETEE_CDS, FAD_TRANSMISE_BUDGET, FAD_REJETEE_BUDGET, FAD_TRANSMISE_DS, FAD_REJETEE_DS, FAD_VALIDEE_DS, FAD_COMMANDEE, FAD_CLOTUREE ; LIBELLE, COMMENTAIRE.
- **HISTORIQUE_STATUT** : ID_HISTO (id), DATE_HEURE, COMMENTAIRE / MOTIF (notamment rejet).
- **SEUIL_VALIDATION_DS** (paramétrage évolutif, historisé, **défini par service** — correction 22/08) : ID_SEUIL (id), TYPE_IMPUTATION (FONCTIONNEMENT | INVESTISSEMENT), MONTANT_SEUIL, DATE_APPLICATION. Fixé/modifié par le DS pour les services de sa direction.

# 2. Associations et cardinalités — Phase 1

- DIRECTION (1,N) — comporte — (1,1) SERVICE
- SERVICE (1,N) — comporte — (1,1) CELLULE
- CELLULE (1,N) — rattache — (1,1) ACTEUR
- SERVICE (1,1) — porte — (0,N) CUG
- SERVICE (1,1) — gère — (0,N) FOURNISSEUR
- FOURNISSEUR (1,1) — a pour contacts — (0,N) CONTACT
- CUG (1,1) — gère — (0,N) MARCHE (CUGGestion)
- MARCHE (0,N) — a pour titulaire — (1,1) FOURNISSEUR (via NUMPGI = NUM_TITULAIRE ; même SERVICE que le marché)
- ACTEUR (0,N) — titulaire de — (1,1) ROLE ; ROLE rattaché à CELLULE (RC), SERVICE (CDS, CB, ADMIN_SERVICE), DIRECTION (DS), ou sans périmètre (ADMIN_APP)
- ROLE (1,1, si RC/CDS/DS) — peut faire l'objet de — (0,N) SUPPLEANCE ; SUPPLEANCE (1,1) — désigne — (1,1) ACTEUR suppléant
- **SERVICE (1,1) — définit — (0,N) SEUIL_VALIDATION_DS** *(correction 22/08 : seuil d'exemption DS propre à chaque service ; paramétré par le DS)*
- **SERVICE (1,1) — agrège — (0,N) SITE** *(chaque site est géré par un service — rattachement géographique BI)*
- **SITE (1,1) — comprend — (1,N) SOUS_SITE**
- **SERVICE (1,1) — agrège — (0,N) SECTEUR** *(chaque secteur est géré par un service — rattachement technique BI)*
- **SECTEUR (1,1) — comprend — (1,N) SOUS_SECTEUR**
- ACTEUR (1,1) — dépose — (0,N) DEMANDE_ACHAT (rôle Demandeur, sans entité ROLE dédiée)
- DEMANDE_ACHAT (1,1) — localisée sur — (1,1) SOUS_SITE *(identifiant composite CODE_SITE + CODE_SOUS_SITE)* ; DEMANDE_ACHAT (1,1) — relève de — (1,1) SOUS_SECTEUR *(identifiant composite CODE_SECTEUR + CODE_SOUS_SECTEUR)*
- **DEMANDE_ACHAT (1,1) — imputée analytiquement sur — (1,1) CUG** *(arbitrage 1 : CUG obligatoire en toutes circonstances)*
- DEMANDE_ACHAT (0,1) — imputée sur — (0,1) OPERATION_INVESTISSEMENT *(si INVESTISSEMENT)*
- DEMANDE_ACHAT (0,1) — s'appuie sur — (0,N) MARCHE *(si PROCEDURE_ACHAT = MARCHE)*
- DEMANDE_ACHAT (1,1) — génère — (0,N) DEVIS_CONSULTE *(si HORS_MARCHE)* ; DEVIS_CONSULTE (1,1) — émis par — (1,1) FOURNISSEUR
- DEMANDE_ACHAT (1,1) — retient — (1,1) FOURNISSEUR *(fournisseur retenu ; nullable jusqu'au stade FAD au niveau logique)*
- DEMANDE_ACHAT (1,1) — comporte — (0,N) PIECE_JOINTE
- DEMANDE_ACHAT (1,1) — suit — (1,N) HISTORIQUE_STATUT ; HISTORIQUE_STATUT (1,1) — référence — (1,1) STATUT et (1,1) — réalisé par — (1,1) ACTEUR (le suppléant le cas échéant, renvoi vers la SUPPLEANCE)

═══════════════════════════════════════════
# PARTIE 2 — PHASE 2 (Service Fait → paiement fournisseur) — VALIDÉE 23/08
═══════════════════════════════════════════

# 3. Entités et attributs — Phase 2

- **CERTIFICAT_SERVICE_FAIT (CSF)** : NUMERO_CSF (id, = NUMERO de la FAD + suffixe -Cnn — D9), DATE_CREATION, DATE_SERVICE_FAIT, MONTANT_CSF (partiel possible — D3), DESCRIPTION (niveau global FAD — D2), STATUT_COURANT_CSF (réf. STATUT_CSF).
- **STATUT_CSF** (référentiel) : CODE_STATUT_CSF (id) — CSF_A_TRAITER, CSF_REJETE_RC, CSF_TRANSMIS_BUDGET, CSF_VALIDE_BUDGET, CSF_REJETE_BUDGET, CSF_LIQUIDE (terminal) ; LIBELLE, COMMENTAIRE.
- **HISTORIQUE_STATUT_CSF** : ID_HISTO_CSF (id), DATE_HEURE, COMMENTAIRE_MOTIF (motif de rejet RC / Budget).
- Réutilise DEMANDE_ACHAT (la FAD), ACTEUR, ROLE (RC, CB), SUPPLEANCE (RC), PIECE_JOINTE (justificatifs).

# 4. Associations et cardinalités — Phase 2

- DEMANDE_ACHAT (1,1) — donne lieu à — (0,N) CERTIFICAT_SERVICE_FAIT *(FAD au statut FAD_COMMANDEE — R1)*
- ACTEUR (0,N) — élabore — (1,1) CERTIFICAT_SERVICE_FAIT *(rédacteur = demandeur initial ou RC du demandeur — D4/R3)*
- CERTIFICAT_SERVICE_FAIT (1,1) — a pour statut courant — (1,1) STATUT_CSF
- CERTIFICAT_SERVICE_FAIT (1,1) — suit — (1,N) HISTORIQUE_STATUT_CSF ; HISTORIQUE_STATUT_CSF (1,1) — référence — (1,1) STATUT_CSF et (1,1) — réalisé par — (1,1) ACTEUR (suppléant le cas échéant)
- CERTIFICAT_SERVICE_FAIT (1,1) — comporte — (1,N) PIECE_JOINTE *(au moins un justificatif à la transmission — D7/R5)*

# 5. Circuit CSF (STATUT_CSF)

Élaboration (demandeur ou RC) → CSF_A_TRAITER → [RC] transmet (CSF_TRANSMIS_BUDGET) ou rejette (CSF_REJETE_RC) → [CB] valide (CSF_VALIDE_BUDGET, déclenche le paiement PGI) ou rejette (CSF_REJETE_BUDGET) → liquidation dans le PGI → CSF_LIQUIDE (terminal, verrouille).
- CSF_REJETE_RC → CSF_A_TRAITER (modification en place, resoumission).
- CSF_REJETE_BUDGET → CSF_A_TRAITER (reprise par le rédacteur ou le RC).

# 6. Règles de gestion — Phase 2

- **R1** : création d'un CSF autorisée seulement si la FAD est FAD_COMMANDEE.
- **R2** : le cumul des CSF validés d'une FAD peut dépasser MONTANT_COMMANDE → alerte (non bloquant). Solde restant = MONTANT_COMMANDE − Σ(CSF validés).
- **R3** : rédacteur = demandeur initial de la DA, ou RC (rôle RC actif) de la cellule de ce demandeur.
- **R4** : modification et suppression physique uniquement depuis un statut rejeté ; après CSF_REJETE_BUDGET, reprise ouverte au rédacteur et au RC. (Exception au principe de traçabilité — à consigner au CDC.)
- **R5** : ≥ 1 justificatif (PIECE_JOINTE) requis pour transmettre au RC.
- **R6** : CSF_LIQUIDE positionné manuellement par la CB après liquidation de la facture dans le PGI ; terminal, verrouille le CSF. La facture n'est pas stockée dans l'application.

# 7. Points ouverts (non structurants)
- Organisation : décision A/B en attente sur l'archivage (ETAT sur DIRECTION/SERVICE/CELLULE et ACTEUR) et le figeage du rattachement organisationnel de la FAD à sa création (protection contre les réorganisations). À trancher.
- Points résiduels mineurs Phase 1 (referentiel-fournisseurs-phase1.md) : doublon ADR1, vocabulaire TYPE_CREATION, redondance FONCTION/NATUREFONCTION.

# 8. Historique de validation
- 20-21/08/2026 : MCD Phase 1 validé (entités, MARCHE, FOURNISSEUR/CONTACT).
- 22/08/2026 : arbitrages MLD (CUG obligatoire, rôles historisés, ETATFOURNISSEUR) ; correction seuil DS rattaché au service (gouvernance DS confirmée) ; clés techniques DIRECTION/SERVICE/CELLULE (niveau MLD).
- 23/08/2026 : MCD Phase 2 validé (décisions D1–D9) ; consolidation Phases 1 & 2 dans le présent document.
- 23/08/2026 (correction CB) : périmètre du rôle CB déplacé de DIRECTION vers SERVICE (conforme au CDG). CB collective par service. Répercuté sur le MLD et le dictionnaire.
- 26/08/2026 (normalisation SITE / SECTEUR) : SITE et SECTEUR chacun décomposés en deux entités. Ajout de SOUS_SITE (déclinaison d'un SITE : CODE_SOUS_SITE, ORDRE_SOUS_SITE, ACTIF) et de SOUS_SECTEUR (déclinaison d'un SECTEUR : CODE_SOUS_SECTEUR, ORDRE_SOUS_SECTEUR, ACTIF). Ajout de l'attribut ORDRE_SITE / ORDRE_SECTEUR sur les entités parent. Nouvelles associations : SERVICE (1,1) — agrège — (0,N) SITE ; SITE (1,1) — comprend — (1,N) SOUS_SITE ; SERVICE (1,1) — agrège — (0,N) SECTEUR ; SECTEUR (1,1) — comprend — (1,N) SOUS_SECTEUR. Association DEMANDE_ACHAT — localisée sur modifiée : cible désormais SOUS_SITE ; association — relève de modifiée : cible désormais SOUS_SECTEUR. Répercuté dans le MLD (§2.2, §2.4, §5, §7).
