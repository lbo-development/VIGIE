---
MCD (Modèle Conceptuel de Données) - CONSOLIDÉ Phases 1 & 2
Synthèse de notation Merise (entités, associations, cardinalités). Phase 1 issue du MCD validé les 20-21/08/2026 (claude_mcd-phase1.md), avec la correction du seuil DS du 22/08. Phase 2 validée le 23/08/2026 (9 décisions D1–D9).
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

- **DIRECTION** : CODE_DIRECTION (id), LIBELLE_DIRECTION, ACTIF _(archivage/désactivation — décision du 28/08/2026, cf. §7)_
- **SERVICE** : CODE_SERVICE (id), LIBELLE_SERVICE, ACTIF _(idem DIRECTION)_
- **CELLULE** : CODE_CELLULE (id), LIBELLE_CELLULE, ACTIF _(idem DIRECTION)_
- **ACTEUR** : MATRICULE (id), NOM, PRENOM, FONCTION (métier réel ; le rôle applicatif est porté par ROLE)

## Référentiels métier (import PGI ou gestion autonome)

- **SITE** : CODE_SITE (id), LIB_SITE, ORDRE_SITE, ACTIF — gisement géographique (BI) ; rattaché à un SERVICE
- **SOUS_SITE** : CODE_SOUS_SITE (id partiel, avec CODE_SITE), LIB_SOUS_SITE, ORDRE_SOUS_SITE, ACTIF — déclinaison d'un SITE (ex. poste, quai) ; identifiant conceptuel = (CODE_SITE, CODE_SOUS_SITE) _(LIB_SOUS_SITE ajouté le 28/08/2026 — auparavant seul le code servait d'affichage)_
- **SECTEUR** : CODE_SECTEUR (id), LIB_SECTEUR, ORDRE_SECTEUR, ACTIF — gisement technique (BI) ; rattaché à un SERVICE
- **SOUS_SECTEUR** : CODE_SOUS_SECTEUR (id partiel, avec CODE_SECTEUR), LIB_SOUS_SECTEUR, ORDRE_SOUS_SECTEUR, ACTIF — déclinaison d'un SECTEUR ; identifiant conceptuel = (CODE_SECTEUR, CODE_SOUS_SECTEUR) _(LIB_SOUS_SECTEUR ajouté le 28/08/2026, idem SOUS_SITE)_
- **CUG** : CODE_CUG (id), LIBELLE_CUG, ACTIF _(ajouté le 29/08/2026, archivage par flag)_ — rattaché à un SERVICE (Compte Unitaire de Gestion, analytique)
- **OPERATION_INVESTISSEMENT** : NUMERO_OPERATION (id), LIBELLE, MT_AP1, MT_AP8, MT_CP1, MT_CP8, DATE_CREATION, MT_INITIAL
- **MARCHE** : NUMMARCHE (id), ETATMARCHE (Actif | Inactif), TYPE_CREATION (SERVICE | AUTRE), TYPEPROC, TYPEDECOMPOPRIX, NATUREPRESTA, LIBPGI, LIBELLE_SERVICE, TITULAIRE, NUM_TITULAIRE, TITULAIRE_SERVICE, AGENTGESTION, CUGGestion (réf. CUG), DTENOTIF, DTEVALID, DTEDEBUT, DTEFINMAX, MTMINI, MTMAXI, ALERTEMT, ALERTEDATE, LASTMTREALISE, LASTMTENGAGE, DTELASTSOLDE, PLANPREVENTIONACTIF. MT_SOLDE = attribut calculé non stocké (MTMAXI − (LASTMTREALISE + LASTMTENGAGE)). Un seul titulaire par marché ; NUM_TITULAIRE = clé de rapprochement avec FOURNISSEUR.NUMPGI.
- **FOURNISSEUR** : ID (id technique), SERVICE (réf.), ETATFOURNISSEUR (Actif | Inactif — arbitrage 4), RAISON_SOCIALE_PGI, RAISON_SOCIALE_SERVICE, SIREN *(colonne renommée depuis SIRET le 29/08/2026 — confusion de terminologie, c'est l'identifiant entreprise à 9 chiffres qui était visé, pas l'identifiant établissement à 14 chiffres)*, NUMPGI, ADR1, ADR2, CP, VILLE, CEDEX, TYPE_CREATION (PGI | SERVICE). Clé métier conceptuelle = (SERVICE, SIREN) ; référentiel autonome par service — non enforcée par une contrainte UNIQUE physique à ce jour (voir MLD §4). SIREN obligatoire et validé par sa clé de contrôle (algorithme de Luhn, décision du 29/08/2026). Droit d'écriture (décision du 29/08/2026) : mise à jour/état réservés à ADMIN_SERVICE (son service)/ADMIN_APP (transverse) ; la **création** est en plus ouverte au Demandeur pour son propre service (sans rôle dédié, l'écran ne lui propose alors ni direction ni service — hérités automatiquement). **Suppression** (décision du 29/08/2026, exception au principe général d'archivage par ETATFOURNISSEUR) : ADMIN_SERVICE/ADMIN_APP peuvent supprimer physiquement un fournisseur — et ses CONTACT — uniquement si aucun MARCHE, DEMANDE_ACHAT (fournisseur retenu) ni DEVIS_CONSULTE (même non retenu) ne le référence encore.
- **CONTACT** : ID_CONTACT (id), NOM, PRENOM, MAIL, TELFIXE, TELMOBILE, FONCTION (texte libre), NATUREFONCTION (liste fermée — DIRIGEANT | JURIDIQUE | COMMERCIAL | RESPONSABLE D'AFFAIRE | RESPONSABLE TECHNIQUE | TECHNICIEN | RESPONSABLE FINANCIER/COMPTABILITE, contrainte CHECK déjà en place sur le schéma physique préexistant, découverte le 29/08/2026 — corrige une liste erronée un temps documentée ici) — rattaché à un FOURNISSEUR (0..N par fournisseur). Pas de champ d'état (contrairement à FOURNISSEUR) : suppression physique autorisée, aucune autre table ne référence CONTACT. Obligatoires (décision du 29/08/2026, validation applicative — pas de contrainte NOT NULL en base) : NOM, PRENOM, NATUREFONCTION, et au moins un des deux numéros de téléphone (TELFIXE ou TELMOBILE). NOM normalisé en MAJUSCULES à l'enregistrement. TELFIXE/TELMOBILE, quand renseignés, doivent respecter une structure valide (local `0` + 9 chiffres, ou international `+` suivi de 8 à 15 chiffres) et sont stockés normalisés sans séparateur.

## Rôles applicatifs

- **ROLE** _(niveau physique/MLD : table `ROLE_ATTRIBUTION`, pour éviter la collision avec la notion native de rôle Postgres/Supabase — cf. MLD §2.3, décision du 24/08/2026 ; l'entité conceptuelle reste ROLE ici)_ : ID_ROLE (id), TYPE_ROLE (RC | CDS | DS | CB | ADMIN_SERVICE | ADMIN_APP), DATE_DEBUT, DATE_FIN, ACTIF (historisation — arbitrage 3). Instance d'attribution d'un rôle à un ACTEUR sur un périmètre : CELLULE pour RC ; SERVICE pour CDS, CB et ADMIN_SERVICE ; DIRECTION pour DS ; **sans périmètre pour ADMIN_APP** (habilitation transverse). Unicité d'un actif par périmètre pour RC/CDS/DS ; CB collective par service ; ADMIN_SERVICE et ADMIN_APP sans contrainte d'unicité. L'historisation conserve la trace des titulaires successifs. _(ADMIN_SERVICE : administration locale au service — référentiel fournisseurs, imports, déclaration des rôles/suppléances, référentiel géographique SITE/SOUS_SITE et technique SECTEUR/SOUS_SECTEUR de son service (décision du 26/08/2026, pas de rôle ADMIN_DATA distinct) ; ADMIN_APP : paramètres transverses et comptes utilisateurs, avec les mêmes droits que ADMIN_SERVICE sur SITE/SOUS_SITE, SECTEUR/SOUS_SECTEUR **et FOURNISSEUR/CONTACT** (étendu le 29/08/2026) mais sans restriction de service.)_
- **SUPPLEANCE** : ID_SUPPLEANCE (id), DATE_DEBUT, DATE_FIN — relie un ROLE (titulaire absent, RC/CDS/DS) à un ACTEUR suppléant détenant un rôle de même TYPE_ROLE. Modèle horizontal, auto-déclaré, une suppléance active à la fois.

## Cœur métier : la demande

- **DEMANDE_ACHAT** (cycle DA → FAD, un seul numéro) : NUMERO (id, AAAA-MM-JJ-XXX par service), OBJET (80 car.), DESCRIPTION (256 car.), MONTANT_DEMANDE, IMPUTATION_COMPTABLE (FONCTIONNEMENT | INVESTISSEMENT), PROCEDURE_ACHAT (MARCHE | HORS_MARCHE), TYPE_ACHAT (TRAVAUX | FOURNITURES | SERVICES, BI), TYPE_FAD (CONTRAT | OUVERTE | FERMEE), MOTIF_CHOIX (Prix | Délai | Technique | Autre, si HORS_MARCHE), LIBELLE_MOTIF_CHOIX, MONTANT_RETENU, MONTANT_COMMANDE (saisi par la CB), DATE_CREATION, STATUT_COURANT (réf. STATUT).
- **DEVIS_CONSULTE** (uniquement si HORS_MARCHE) : ID_DEVIS (id), MONTANT_DEVIS, FICHIER_PDF, RETENU (un seul RETENU=vrai par demande).
- **PIECE_JOINTE** : ID_PIECE (id), TYPE_PIECE, ORIGINE (UTILISATEUR | SYSTEME), FICHIER (PDF, 10 Mo max), NOM_FICHIER. En Phase 2, rattachable aussi à un CSF (cf. Partie 2). À l'autorisation de la FAD, une **fiche récapitulative PDF** est générée automatiquement et ajoutée en PIECE_JOINTE (ORIGINE=SYSTEME, TYPE_PIECE=FICHE_FAD), non supprimable par l'utilisateur.
- **STATUT** (référentiel) : CODE_STATUT (id) — DA_ENREGISTREE, DA_REJETEE, FAD_TRANSMISE_CDS, FAD_REJETEE_CDS, FAD_TRANSMISE_BUDGET, FAD_REJETEE_BUDGET, FAD_TRANSMISE_DS, FAD_REJETEE_DS, FAD_VALIDEE_DS, FAD_COMMANDEE, FAD_CLOTUREE ; LIBELLE, COMMENTAIRE.
- **HISTORIQUE_STATUT** : ID_HISTO (id), DATE_HEURE, COMMENTAIRE / MOTIF (notamment rejet).
- **SEUIL_VALIDATION_DS** (paramétrage, **un au plus par service, plus d'historisation** — simplification du 28/08/2026, annule "historisé" ci-avant) : SEUIL_FONCTIONNEMENT, SEUIL_INVESTISSEMENT. Identifiant conceptuel = SERVICE (rattachement 1:1 optionnel, pas d'id propre). Un service sans ligne est considéré à seuil 0 pour les deux types d'imputation. Prévu au 22/08 comme fixé/modifié par le DS pour les services de sa direction ; décision définitive du 29/08/2026 : écriture ouverte à ADMIN_APP (transverse) ou **ADMIN_SERVICE scopé à son propre service** — même modèle que SITE/SECTEUR, pas le rôle DS envisagé au 22/08 (voir MLD §2.6).

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
- **SERVICE (1,1) — définit — (0,1) SEUIL_VALIDATION_DS** _(seuil d'exemption DS propre à chaque service ; cardinalité revue de (0,N) à (0,1) le 28/08/2026 avec l'abandon de l'historisation)_
- **SERVICE (1,1) — agrège — (0,N) SITE** _(chaque site est géré par un service — rattachement géographique BI)_
- **SITE (1,1) — comprend — (1,N) SOUS_SITE**
- **SERVICE (1,1) — agrège — (0,N) SECTEUR** _(chaque secteur est géré par un service — rattachement technique BI)_
- **SECTEUR (1,1) — comprend — (1,N) SOUS_SECTEUR**
- ACTEUR (1,1) — dépose — (0,N) DEMANDE_ACHAT (rôle Demandeur, sans entité ROLE dédiée)
- DEMANDE_ACHAT (1,1) — localisée sur — (0,1) SOUS_SITE _(identifiant composite CODE_SITE + CODE_SOUS_SITE — décision du 28/08/2026 : CODE_SITE reste obligatoire, mais le sous-niveau CODE_SOUS_SITE est optionnel, une FAD peut être positionnée sur un SITE sans préciser de sous-site)_ ; DEMANDE_ACHAT (1,1) — relève de — (0,1) SOUS_SECTEUR _(idem, CODE_SECTEUR obligatoire / CODE_SOUS_SECTEUR optionnel)_
- **DEMANDE_ACHAT (1,1) — imputée analytiquement sur — (1,1) CUG** _(arbitrage 1 : CUG obligatoire en toutes circonstances)_
- DEMANDE_ACHAT (0,1) — imputée sur — (0,1) OPERATION_INVESTISSEMENT _(si INVESTISSEMENT)_
- DEMANDE_ACHAT (0,1) — s'appuie sur — (0,N) MARCHE _(si PROCEDURE_ACHAT = MARCHE)_
- DEMANDE_ACHAT (1,1) — génère — (0,N) DEVIS_CONSULTE _(si HORS_MARCHE)_ ; DEVIS_CONSULTE (1,1) — émis par — (1,1) FOURNISSEUR
- DEMANDE_ACHAT (1,1) — retient — (1,1) FOURNISSEUR _(fournisseur retenu ; nullable jusqu'au stade FAD au niveau logique)_
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

- DEMANDE_ACHAT (1,1) — donne lieu à — (0,N) CERTIFICAT_SERVICE_FAIT _(FAD au statut FAD_COMMANDEE — R1)_
- ACTEUR (0,N) — élabore — (1,1) CERTIFICAT_SERVICE_FAIT _(rédacteur = demandeur initial ou RC du demandeur — D4/R3)_
- CERTIFICAT_SERVICE_FAIT (1,1) — a pour statut courant — (1,1) STATUT_CSF
- CERTIFICAT_SERVICE_FAIT (1,1) — suit — (1,N) HISTORIQUE_STATUT_CSF ; HISTORIQUE_STATUT_CSF (1,1) — référence — (1,1) STATUT_CSF et (1,1) — réalisé par — (1,1) ACTEUR (suppléant le cas échéant)
- CERTIFICAT_SERVICE_FAIT (1,1) — comporte — (1,N) PIECE_JOINTE _(au moins un justificatif à la transmission — D7/R5)_

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

- Organisation : décision A/B sur l'archivage tranchée **partiellement** le 28/08/2026 — ACTIF ajouté sur DIRECTION, SERVICE et CELLULE (désactivation, jamais de suppression physique, même principe que SITE/SECTEUR et MARCHE/FOURNISSEUR). **ACTEUR reste sans ACTIF à ce stade** (non traité, toujours à trancher si un besoin d'archivage des comptes utilisateurs émerge). Le figeage du rattachement organisationnel de la FAD à sa création (protection contre les réorganisations) reste également à trancher.
- Points résiduels mineurs Phase 1 (referentiel-fournisseurs-phase1.md, fichier absent du dépôt) : doublon ADR1, vocabulaire TYPE_CREATION — encore ouverts. La redondance FONCTION/NATUREFONCTION, listée ici jusqu'au 29/08/2026, est tranchée (voir §1, CONTACT) : les deux champs sont conservés (FONCTION texte libre, NATUREFONCTION liste fermée, valeurs de la contrainte CHECK réelle — DIRIGEANT, JURIDIQUE, COMMERCIAL, RESPONSABLE D'AFFAIRE, RESPONSABLE TECHNIQUE, TECHNICIEN, RESPONSABLE FINANCIER/COMPTABILITE).

# 8. Historique de validation

- 20-21/08/2026 : MCD Phase 1 validé (entités, MARCHE, FOURNISSEUR/CONTACT).
- 22/08/2026 : arbitrages MLD (CUG obligatoire, rôles historisés, ETATFOURNISSEUR) ; correction seuil DS rattaché au service (gouvernance DS confirmée) ; clés techniques DIRECTION/SERVICE/CELLULE (niveau MLD).
- 23/08/2026 : MCD Phase 2 validé (décisions D1–D9) ; consolidation Phases 1 & 2 dans le présent document.
- 23/08/2026 (correction CB) : périmètre du rôle CB déplacé de DIRECTION vers SERVICE (conforme au CDG). CB collective par service. Répercuté sur le MLD et le dictionnaire.
- 26/08/2026 (normalisation SITE / SECTEUR) : SITE et SECTEUR chacun décomposés en deux entités. Ajout de SOUS_SITE (déclinaison d'un SITE : CODE_SOUS_SITE, ORDRE_SOUS_SITE, ACTIF) et de SOUS_SECTEUR (déclinaison d'un SECTEUR : CODE_SOUS_SECTEUR, ORDRE_SOUS_SECTEUR, ACTIF). Ajout de l'attribut ORDRE_SITE / ORDRE_SECTEUR sur les entités parent. Nouvelles associations : SERVICE (1,1) — agrège — (0,N) SITE ; SITE (1,1) — comprend — (1,N) SOUS_SITE ; SERVICE (1,1) — agrège — (0,N) SECTEUR ; SECTEUR (1,1) — comprend — (1,N) SOUS_SECTEUR. Association DEMANDE_ACHAT — localisée sur modifiée : cible désormais SOUS_SITE ; association — relève de modifiée : cible désormais SOUS_SECTEUR. Répercuté dans le MLD (§2.2, §2.4, §5, §7).
- 26/08/2026 (habilitation SITE/SOUS_SITE et SECTEUR/SOUS_SECTEUR) : pas de rôle ADMIN_DATA distinct — la gestion de ces référentiels (création/modification) est une responsabilité supplémentaire d'ADMIN_SERVICE (périmètre service, cohérent avec sa description existante) et d'ADMIN_APP (transverse, tous services). TYPE_ROLE, `chk_role_perimetre` et la table `ROLE_ATTRIBUTION` restent inchangés.
- 28/08/2026 (relecture schéma physique) : ajout de **ACTIF** sur DIRECTION, SERVICE, CELLULE (tranche partiellement le point ouvert §7 — ACTEUR non concerné) ; ajout de **LIB_SOUS_SITE** sur SOUS_SITE et **LIB_SOUS_SECTEUR** sur SOUS_SECTEUR (affichage propre du sous-niveau, indépendant du code) ; confirmation que le sous-niveau de DEMANDE_ACHAT est **optionnel** — CODE_SITE/CODE_SECTEUR restent obligatoires, CODE_SOUS_SITE/CODE_SOUS_SECTEUR passent en (0,1). Constat fait en confrontant ce MCD au schéma physique Supabase réel (`finances.*`) ; répercuté dans le MLD (§2.1, §2.2, §2.4, §4).
- 28/08/2026 (simplification SEUIL_VALIDATION_DS) : abandon de l'historisation, jugée trop complexe à administrer. SEUIL_VALIDATION_DS passe de "un ID_SEUIL par changement daté (TYPE_IMPUTATION, MONTANT_SEUIL, DATE_APPLICATION)" à "un au plus par SERVICE, deux attributs SEUIL_FONCTIONNEMENT/SEUIL_INVESTISSEMENT en colonnes, pas d'id propre". Association SERVICE — définit — SEUIL_VALIDATION_DS revue de (0,N) à (0,1). Absence de ligne = seuils à 0 pour les deux imputations (règle de gestion nouvelle, à retenir pour l'implémentation du contrôle CB — OP1.4 du MCT). Répercuté dans le MLD (§2.6) et le MCT (OP1.4).
- 29/08/2026 (habilitation SEUIL_VALIDATION_DS) : même principe que l'habilitation SITE/SOUS_SITE et SECTEUR/SOUS_SECTEUR du 26/08 — la gestion de SEUIL_VALIDATION_DS devient une responsabilité d'ADMIN_SERVICE (périmètre service) et d'ADMIN_APP (transverse), plutôt que du rôle DS par direction envisagé au 22/08. Remplace la restriction ADMIN_APP seul actée le 28/08/2026. TYPE_ROLE inchangé. Répercuté dans le MLD (§2.6) et le MOT.
- 29/08/2026 (habilitation FOURNISSEUR/CONTACT + résolution FONCTION/NATUREFONCTION) : ADMIN_APP étendu en plus d'ADMIN_SERVICE (déjà documenté, périmètre son service) sur le référentiel fournisseurs — même principe que SITE/SECTEUR et SEUIL_VALIDATION_DS. Lecture (hors administration) scopée au service de l'acteur pour tout le monde sauf ADMIN_APP, y compris un Demandeur (pas de rôle dédié). Résolution du point résiduel §7 : FONCTION et NATUREFONCTION sont conservés distincts. Répercuté dans le MLD (§2.2), le MOT et SECURITY.md (§2.5).
- 29/08/2026 (correction — schéma FOURNISSEUR/CONTACT préexistant) : découverte, via le schéma physique réel transmis par l'utilisateur, que `finances.fournisseur`/`finances.contact` existaient déjà avant l'implémentation du jour (contrairement à ce qui avait été noté juste au-dessus — aucune création physique n'a eu lieu). Deux écarts corrigés en conséquence : NATUREFONCTION suit la contrainte CHECK réelle (DIRIGEANT, JURIDIQUE, COMMERCIAL, RESPONSABLE D'AFFAIRE, RESPONSABLE TECHNIQUE, TECHNICIEN, RESPONSABLE FINANCIER/COMPTABILITE — pas la liste initialement inventée) et FOURNISSEUR.SIRET est NOT NULL (obligatoire à la création, pas optionnel). Migration `20260829130000_...sql` corrigée pour ne plus contenir de CREATE TABLE (GRANT/RLS/policies seulement, absents jusqu'ici). Répercuté dans le MLD (§2.2) et SECURITY.md (§2.5).
- 29/08/2026 (création FOURNISSEUR ouverte au Demandeur) : au-delà d'ADMIN_APP/ADMIN_SERVICE, un Demandeur (sans rôle dédié) peut désormais créer un FOURNISSEUR pour son propre service — seule la création est concernée, la mise à jour/l'état Actif-Inactif restent ADMIN_APP/ADMIN_SERVICE. Répercuté dans le MLD (§2.2), le MOT et SECURITY.md (§2.5).
- 29/08/2026 (suppression conditionnelle FOURNISSEUR) : exception au principe général d'archivage par ETATFOURNISSEUR — ADMIN_APP/ADMIN_SERVICE peuvent désormais supprimer physiquement un FOURNISSEUR et ses CONTACT, uniquement si aucun MARCHE, DEMANDE_ACHAT (fournisseur retenu) ni DEVIS_CONSULTE (même non retenu) ne le référence encore ; sinon rejeté (409), invitant à passer en Inactif à la place. Répercuté dans le MLD (§2.2, §4), le MOT et SECURITY.md (§2.5).
- 29/08/2026 (champs obligatoires CONTACT) : NOM, PRENOM et NATUREFONCTION deviennent obligatoires (auparavant optionnels) et au moins un des deux numéros de téléphone doit être renseigné — validation applicative uniquement, pas de contrainte NOT NULL ajoutée en base. Répercuté dans le MLD §2.2.
- 29/08/2026 (NOM en majuscules + structure téléphone) : NOM normalisé en MAJUSCULES à l'enregistrement. TELFIXE/TELMOBILE, quand renseignés, doivent respecter une structure valide (local ou international, limite E.164) et sont stockés sans séparateur. Validation applicative uniquement. Répercuté dans le MLD §2.2.
- 29/08/2026 (renommage FOURNISSEUR.SIRET → SIREN) : confusion de terminologie corrigée — c'est l'identifiant entreprise (SIREN, 9 chiffres) qui était visé, pas l'identifiant établissement (SIRET, 14 chiffres). Simple renommage de colonne, aucune donnée modifiée. Constat associé : la contrainte UNIQUE (SERVICE, SIREN) documentée jusqu'ici n'existe pas sur le schéma physique réel — (SERVICE, SIREN) reste la clé métier conceptuelle, non enforcée en base. Répercuté dans le MLD (§2.2, §4) et SECURITY.md (§2.5).
- 29/08/2026 (validation clé de contrôle SIREN) : le SIREN doit être renseigné et valide (clé de Luhn INSEE sur 9 chiffres), vérifié à la création et en modification. Validation applicative uniquement. Répercuté dans le MLD §2.2.
- 29/08/2026 (gestion manuelle CUG + ajout ACTIF) : ajout de l'attribut ACTIF sur CUG (archivage par flag, même principe que SITE/SECTEUR/FOURNISSEUR — pas de suppression physique). Nouvelle tâche de gestion manuelle du référentiel CUG (créer/modifier libellé et état), en complément de l'import PGI existant : droit d'écriture ADMIN_APP (transverse) ou ADMIN_SERVICE (son service) — même principe que SITE/SECTEUR/SEUIL_VALIDATION_DS/FOURNISSEUR, mais **sans** extension au Demandeur (à la différence de FOURNISSEUR : la lecture elle-même reste réservée à ADMIN_APP/ADMIN_SERVICE). Répercuté dans le MLD (§2.2), le MOT et SECURITY.md (§2.6).
