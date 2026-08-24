---
MLD (Modèle Logique de Données) - CONSOLIDÉ Phases 1 & 2
Dérivé de mcd-phase1.md (validé) et mcd-phase2.md (validé le 23/08), par application des règles de passage Merise MCD → MLD. Intègre les 4 arbitrages client du 22/08 et les 9 décisions Phase 2 du 23/08.
Statut : Phase 1 complète et arbitrée ; Phase 2 validée (MCD Phase 2 arbitré, cf. mcd-phase2.md).
Remplace mld-phase1.md (qui devient obsolète).
Cible d'implémentation : Web App + base dédiée type Supabase/PostgreSQL — index uniques partiels et contraintes CHECK ci-dessous y sont implémentables.
---

# 0. Delta par rapport à mld-phase1.md (arbitrages du 22/08)

1. **CUG obligatoire en toutes circonstances** (analytique systématique) : `DEMANDE_ACHAT.CODE_CUG` devient **NOT NULL**, y compris en INVESTISSEMENT. `NUMERO_OPERATION` reste requis uniquement en INVESTISSEMENT. → CHECK d'imputation revu (§4).
2. **`FOURNISSEUR_RETENU` et `MARCHE.ID_FOURNISSEUR`** : confirmés **nullables en base**, rendus obligatoires par règle applicative au bon stade du cycle (pas de `NOT NULL` strict).
3. **ROLE historisé** : ajout de `DATE_DEBUT`, `DATE_FIN`, `ACTIF`. L'unicité « un seul RC/CDS/DS actif par périmètre » porte sur `ACTIF = true` ; l'historique des titulaires est conservé (lignes passées avec `ACTIF=false`).
4. **FOURNISSEUR** : ajout de `ETATFOURNISSEUR` (Actif | Inactif), sur le modèle d'`ETATMARCHE` (désactivation/archivage, jamais de suppression physique).

Ajout Phase 2 : entités **CERTIFICAT_SERVICE_FAIT**, **STATUT_CSF**, **HISTORIQUE_STATUT_CSF** ; **PIECE_JOINTE** rendue polymorphe (rattachable à une DA **ou** à un CSF).

# 1. Conventions de notation
- **Clé primaire** en **gras** ; **clé étrangère** préfixée `#`, cible `→ TABLE` ; `(N)` = nullable.
- Passage MCD→MLD : entité → table ; association 1:N → migration de FK côté « N » ; aucune association N:M (donc aucune table de jointure) ; attribut calculé non stocké → vue/colonne générée.

---

# 2. Schéma relationnel — Phase 1 (arbitré)

## 2.1 Organisationnel
- **DIRECTION** (**ID_DIRECTION**, CODE_DIRECTION *(UNIQUE)*, LIBELLE_DIRECTION)
- **SERVICE** (**ID_SERVICE**, CODE_SERVICE *(UNIQUE)*, LIBELLE_SERVICE, #ID_DIRECTION → DIRECTION)
- **CELLULE** (**ID_CELLULE**, CODE_CELLULE *(UNIQUE)*, LIBELLE_CELLULE, #ID_SERVICE → SERVICE)
- **ACTEUR** (**MATRICULE**, NOM, PRENOM, FONCTION, #ID_CELLULE → CELLULE)

> **Clé technique pour DIRECTION / SERVICE / CELLULE.** PK = ID de substitution immuable ; le code métier (CODE_*) devient un attribut NOT NULL + UNIQUE, mutable en cas de réorganisation sans impact sur les FK. ACTEUR.MATRICULE et les référentiels PGI (CUG.CODE_CUG, MARCHE.NUMMARCHE, NUMERO_OPERATION) conservent leur clé naturelle (identifiant stable / clé de rapprochement à l'import).

## 2.2 Référentiels métier
- **SITE** (**CODE_SITE**, LIBELLE_SITE)
- **SECTEUR** (**CODE_SECTEUR**, LIBELLE_SECTEUR)
- **CUG** (**CODE_CUG**, LIBELLE_CUG, #ID_SERVICE → SERVICE)
- **OPERATION_INVESTISSEMENT** (**NUMERO_OPERATION**, LIBELLE, MT_AP1, MT_AP8, MT_CP1, MT_CP8, DATE_CREATION, MT_INITIAL)
- **FOURNISSEUR** (**ID_FOURNISSEUR**, #ID_SERVICE → SERVICE, **ETATFOURNISSEUR** *(Actif | Inactif — ajout arbitrage 4)*, RAISON_SOCIALE_PGI, RAISON_SOCIALE_SERVICE, SIRET, NUMPGI, ADR1, ADR2, CP, VILLE, CEDEX, TYPE_CREATION)
- **CONTACT** (**ID_CONTACT**, #ID_FOURNISSEUR → FOURNISSEUR, NOM, PRENOM, MAIL, TELFIXE, TELMOBILE, FONCTION, NATUREFONCTION)
- **MARCHE** (**NUMMARCHE**, ETATMARCHE, TYPE_CREATION, TYPEPROC, TYPEDECOMPOPRIX, NATUREPRESTA, LIBPGI, LIBELLE_SERVICE, TITULAIRE, NUM_TITULAIRE, TITULAIRE_SERVICE, AGENTGESTION, #CODE_CUG → CUG *(CUGGestion)*, DTENOTIF, DTEVALID, DTEDEBUT, DTEFINMAX, MTMINI, MTMAXI, ALERTEMT, ALERTEDATE, LASTMTREALISE, LASTMTENGAGE, DTELASTSOLDE, PLANPREVENTIONACTIF, #(N)ID_FOURNISSEUR → FOURNISSEUR)

> `MARCHE.MT_SOLDE` non stocké : vue/colonne générée `MTMAXI − (LASTMTREALISE + LASTMTENGAGE)`.
> `MARCHE.#ID_FOURNISSEUR` **nullable en base** (arbitrage 2), résolu à l'import via (service, NUM_TITULAIRE = FOURNISSEUR.NUMPGI), rendu obligatoire par règle applicative une fois l'import consolidé.

## 2.3 Rôles et suppléance (arbitrage 3)
- **ROLE** (**ID_ROLE**, #MATRICULE → ACTEUR, TYPE_ROLE *(RC | CDS | DS | CB | ADMIN_SERVICE | ADMIN_APP)*, #(N)ID_CELLULE → CELLULE, #(N)ID_SERVICE → SERVICE, #(N)ID_DIRECTION → DIRECTION, **DATE_DEBUT**, **DATE_FIN** *(N)*, **ACTIF** *(booléen)*)
- **SUPPLEANCE** (**ID_SUPPLEANCE**, #ID_ROLE → ROLE, #MATRICULE_SUPPLEANT → ACTEUR, DATE_DEBUT, DATE_FIN)

> DATE_DEBUT/DATE_FIN/ACTIF ajoutés pour porter l'unicité « un seul actif par périmètre » (RC/CDS/DS) et **conserver l'historique des titulaires** : un changement de titulaire clôt la ligne courante (DATE_FIN renseignée, ACTIF=false) et en crée une nouvelle. **Périmètres : RC→cellule ; CDS, CB, ADMIN_SERVICE→service ; DS→direction ; ADMIN_APP→sans périmètre (transverse)**. CB collective par service ; ADMIN_SERVICE et ADMIN_APP sans unicité (plusieurs possibles).

## 2.4 Cœur métier — la demande (FAD)
- **DEMANDE_ACHAT** (**NUMERO**, OBJET, DESCRIPTION, MONTANT_DEMANDE, IMPUTATION_COMPTABLE, PROCEDURE_ACHAT, TYPE_ACHAT, TYPE_FAD, MOTIF_CHOIX, LIBELLE_MOTIF_CHOIX, MONTANT_RETENU, MONTANT_COMMANDE, DATE_CREATION, #MATRICULE_DEMANDEUR → ACTEUR, #CODE_SITE → SITE, #CODE_SECTEUR → SECTEUR, **#CODE_CUG → CUG** *(NOT NULL — arbitrage 1)*, #(N)NUMERO_OPERATION → OPERATION_INVESTISSEMENT, #(N)NUMMARCHE → MARCHE, #(N)ID_FOURNISSEUR_RETENU → FOURNISSEUR, #CODE_STATUT → STATUT *(statut courant)*)
- **DEVIS_CONSULTE** (**ID_DEVIS**, #NUMERO → DEMANDE_ACHAT, #ID_FOURNISSEUR → FOURNISSEUR, MONTANT_DEVIS, FICHIER_PDF, RETENU)
- **PIECE_JOINTE** (**ID_PIECE**, #(N)NUMERO → DEMANDE_ACHAT, **#(N)NUMERO_CSF → CERTIFICAT_SERVICE_FAIT** *(Phase 2)*, TYPE_PIECE, **ORIGINE** *(UTILISATEUR | SYSTEME)*, FICHIER, NOM_FICHIER)

> `CODE_CUG` désormais **obligatoire** (imputation analytique systématique) ; `NUMERO_OPERATION` renseigné en sus lorsque INVESTISSEMENT (cf. CHECK §4).
> `ID_FOURNISSEUR_RETENU` **nullable en base** (arbitrage 2), obligatoire par règle applicative au stade FAD.
> **PIECE_JOINTE polymorphe** : rattachée à une DA **ou** à un CSF (exactement une des deux FK — CHECK §4). `ORIGINE` distingue les pièces déposées (UTILISATEUR) des pièces générées par l'application (SYSTEME). La **fiche récapitulative de la FAD** (PDF généré à l'autorisation de commande) est une pièce `ORIGINE=SYSTEME`, `TYPE_PIECE=FICHE_FAD`, rattachée à la DA, non supprimable par l'utilisateur.

## 2.5 Statuts et traçabilité (FAD)
- **STATUT** (**CODE_STATUT**, LIBELLE, COMMENTAIRE) — valeurs : DA_ENREGISTREE, DA_REJETEE, FAD_TRANSMISE_CDS, FAD_REJETEE_CDS, FAD_TRANSMISE_BUDGET, FAD_REJETEE_BUDGET, FAD_TRANSMISE_DS, FAD_REJETEE_DS, FAD_VALIDEE_DS, FAD_COMMANDEE, FAD_CLOTUREE
- **HISTORIQUE_STATUT** (**ID_HISTO**, #NUMERO → DEMANDE_ACHAT, #CODE_STATUT → STATUT, #MATRICULE_ACTEUR → ACTEUR, #(N)ID_SUPPLEANCE → SUPPLEANCE, DATE_HEURE, COMMENTAIRE_MOTIF)

## 2.6 Paramétrage
- **SEUIL_VALIDATION_DS** (**ID_SEUIL**, #ID_SERVICE → SERVICE, TYPE_IMPUTATION, MONTANT_SEUIL, DATE_APPLICATION) — historisé ; **seuil défini par service** (correction du 22/08). Seuil applicable à une FAD = pour le couple (SERVICE de rattachement de la FAD, TYPE_IMPUTATION), la DATE_APPLICATION la plus récente ≤ date d'évaluation.

> Rattachement : SERVICE (1,1) — définit — (0,N) SEUIL_VALIDATION_DS. **Confirmé (22/08)** : le paramétrage des seuils, à la maille service, reste de la responsabilité du **DS** — chaque DS fixe et modifie les seuils des services de sa direction.

---

# 3. Schéma relationnel — Phase 2 (validé, dérivé de mcd-phase2.md)

- **CERTIFICAT_SERVICE_FAIT** (**NUMERO_CSF**, #NUMERO → DEMANDE_ACHAT *(la FAD, statut FAD_COMMANDEE requis — règle de gestion)*, #MATRICULE_REDACTEUR → ACTEUR, DATE_CREATION, DATE_SERVICE_FAIT, MONTANT_CSF, DESCRIPTION, #CODE_STATUT_CSF → STATUT_CSF *(statut courant)*)
- **STATUT_CSF** (**CODE_STATUT_CSF**, LIBELLE, COMMENTAIRE) — valeurs : CSF_A_TRAITER, CSF_REJETE_RC, CSF_TRANSMIS_BUDGET, CSF_VALIDE_BUDGET, CSF_REJETE_BUDGET, **CSF_LIQUIDE** *(terminal)*
- **HISTORIQUE_STATUT_CSF** (**ID_HISTO_CSF**, #NUMERO_CSF → CERTIFICAT_SERVICE_FAIT, #CODE_STATUT_CSF → STATUT_CSF, #MATRICULE_ACTEUR → ACTEUR, #(N)ID_SUPPLEANCE → SUPPLEANCE, DATE_HEURE, COMMENTAIRE_MOTIF)

> `NUMERO_CSF` = NUMERO de la FAD + suffixe séquentiel `-Cnn` (ex. `2026-08-23-014-C01`).
> `MATRICULE_REDACTEUR` : le rédacteur est le demandeur initial de la DA **ou** le RC de ce demandeur (règle applicative R3).
> Les justificatifs du CSF passent par **PIECE_JOINTE** (FK `NUMERO_CSF`) ; au moins un est requis à la transmission (R5). La **facture n'est pas stockée** dans l'application (reste dans le PGI).
> Les acteurs du circuit CSF (RC, CB) et la suppléance RC réutilisent ROLE/SUPPLEANCE de la Phase 1 — aucune table de rôle nouvelle.
> `CSF_LIQUIDE` = statut terminal, positionné manuellement par la CB après liquidation de la facture dans le PGI ; verrouille définitivement le CSF.

---

# 4. Contraintes d'intégrité (consolidées)

**Unicité métier**
- `FOURNISSEUR` : `UNIQUE (ID_SERVICE, SIRET)` ; `UNIQUE (ID_SERVICE, NUMPGI) WHERE NUMPGI IS NOT NULL`.
- `ROLE` (unicité du titulaire **actif** par périmètre — arbitrage 3) :
  - `UNIQUE (ID_CELLULE) WHERE TYPE_ROLE='RC' AND ACTIF = true`
  - `UNIQUE (ID_SERVICE) WHERE TYPE_ROLE='CDS' AND ACTIF = true`
  - `UNIQUE (ID_DIRECTION) WHERE TYPE_ROLE='DS' AND ACTIF = true`
  - Pas d'unicité pour CB (collectif).
- `DEVIS_CONSULTE` : `UNIQUE (NUMERO) WHERE RETENU = true` (un seul devis retenu par demande).

**Exclusivité / cohérence conditionnelle (CHECK)**
- `DEMANDE_ACHAT` — imputation (arbitrage 1) :
  `CHECK (CODE_CUG IS NOT NULL)` *(CUG toujours obligatoire)* et
  `CHECK ( (IMPUTATION_COMPTABLE='INVESTISSEMENT' AND NUMERO_OPERATION IS NOT NULL) OR (IMPUTATION_COMPTABLE='FONCTIONNEMENT' AND NUMERO_OPERATION IS NULL) )`
- `ROLE` — cohérence périmètre / type :
  `CHECK ( (TYPE_ROLE='RC' AND ID_CELLULE IS NOT NULL AND ID_SERVICE IS NULL AND ID_DIRECTION IS NULL) OR (TYPE_ROLE IN ('CDS','CB','ADMIN_SERVICE') AND ID_SERVICE IS NOT NULL AND ID_CELLULE IS NULL AND ID_DIRECTION IS NULL) OR (TYPE_ROLE='DS' AND ID_DIRECTION IS NOT NULL AND ID_CELLULE IS NULL AND ID_SERVICE IS NULL) OR (TYPE_ROLE='ADMIN_APP' AND ID_CELLULE IS NULL AND ID_SERVICE IS NULL AND ID_DIRECTION IS NULL) )`
  et `CHECK (DATE_FIN IS NULL OR DATE_FIN >= DATE_DEBUT)`.
- `DEMANDE_ACHAT` — motif : `CHECK ( MOTIF_CHOIX <> 'Autre' OR LIBELLE_MOTIF_CHOIX IS NOT NULL )` ; MOTIF_CHOIX pertinent uniquement si HORS_MARCHE (règle applicative).
- `PIECE_JOINTE` — rattachement exclusif (DA ou CSF) :
  `CHECK ( (NUMERO IS NOT NULL) <> (NUMERO_CSF IS NOT NULL) )`. Côté CSF, au moins une PIECE_JOINTE est requise à la transmission (règle applicative R5, non portée par la base).
- `SUPPLEANCE` : `CHECK (DATE_FIN >= DATE_DEBUT)` ; le suppléant doit détenir un ROLE actif de même TYPE_ROLE (règle applicative / trigger).

**Règles applicatives (non portées par contrainte base)**
- `MARCHE.ID_FOURNISSEUR` et `DEMANDE_ACHAT.ID_FOURNISSEUR_RETENU` : obligatoires au bon stade du cycle (arbitrage 2).
- **CSF — création** : possible seulement si la FAD est FAD_COMMANDEE (R1).
- **CSF — dépassement** : la somme des MONTANT_CSF validés d'une FAD **peut** dépasser MONTANT_COMMANDE ; le dépassement déclenche une **alerte** (non bloquant). Solde restant = MONTANT_COMMANDE − Σ(CSF validés) (R2).
- **CSF — rédacteur** : demandeur initial de la DA, ou RC (rôle RC actif) de la cellule de ce demandeur (R3).
- **CSF — justificatif** : au moins une PIECE_JOINTE requise pour transmettre au RC / entrer en CSF_A_TRAITER (R5).
- **CSF — reprise/suppression** : modification et suppression physique possibles uniquement depuis un statut rejeté (CSF_REJETE_RC, CSF_REJETE_BUDGET) ; après rejet Budget, reprise ouverte au rédacteur et au RC (R4). Exception au principe de traçabilité, à consigner au CDC.
- **CSF — liquidation** : CSF_LIQUIDE positionné manuellement par la CB après liquidation dans le PGI ; état terminal verrouillant (R6).
- **Fiche récapitulative FAD** : à l'autorisation de commande (FAD_VALIDEE_DS ou exemption DS), l'application génère un PDF récapitulant les éléments de la FAD et l'ajoute en PIECE_JOINTE (ORIGINE=SYSTEME, TYPE_PIECE=FICHE_FAD). Les pièces ORIGINE=SYSTEME ne sont pas supprimables par l'utilisateur.

**Intégrité référentielle** : toutes les FK des §2/§3 en FOREIGN KEY ; `ON DELETE RESTRICT` sur référentiels ; pas de suppression physique sur MARCHE (ETATMARCHE) ni FOURNISSEUR (ETATFOURNISSEUR).

**Colonnes calculées / dénormalisées** : `MARCHE.MT_SOLDE` (vue) ; `DEMANDE_ACHAT.CODE_STATUT` et `CERTIFICAT_SERVICE_FAIT.CODE_STATUT_CSF` = pointeurs de statut courant, cohérents avec le dernier HISTORIQUE_* par déclencheur applicatif.

---

# 5. Inventaire des tables

**Phase 1 (19)** : DIRECTION, SERVICE, CELLULE, ACTEUR, SITE, SECTEUR, CUG, OPERATION_INVESTISSEMENT, FOURNISSEUR, CONTACT, MARCHE, ROLE, SUPPLEANCE, DEMANDE_ACHAT, DEVIS_CONSULTE, PIECE_JOINTE, STATUT, HISTORIQUE_STATUT, SEUIL_VALIDATION_DS.

**Phase 2 (3)** : CERTIFICAT_SERVICE_FAIT, STATUT_CSF, HISTORIQUE_STATUT_CSF.
*(PIECE_JOINTE est étendue, pas dupliquée.)*

**Total : 22 tables**, toujours sans aucune table de jointure (aucune association N:M sur l'ensemble des deux phases).

---

# 6. Points à valider avant figeage
- **Phase 1** : aucun point structurant ouvert (les 4 arbitrages du 22/08 sont intégrés ; seuil DS rattaché au service, gouvernance DS confirmée). Restent les points résiduels mineurs de referentiel-fournisseurs-phase1.md (doublon ADR1, harmonisation vocabulaire TYPE_CREATION, redondance FONCTION/NATUREFONCTION).
- **Phase 2** : validée (9 décisions D1–D9 du 23/08). Aucun point structurant ouvert. Le point CDC « facture en PIECE_JOINTE ? » est tranché : la facture n'est pas gérée dans l'application (reste dans le PGI).

# 7. Historique
- 22/08/2026 : MLD Phase 1 initial (mld-phase1.md).
- 22/08/2026 : MLD consolidé Phases 1 & 2. Intégration des 4 arbitrages client (CUG obligatoire ; FOURNISSEUR_RETENU / MARCHE.ID_FOURNISSEUR nullables base + obligation applicative ; ROLE historisé DATE_DEBUT/DATE_FIN/ACTIF ; ETATFOURNISSEUR ajouté). Ajout des tables CSF issues de mcd-phase2.md (provisoire) et extension polymorphe de PIECE_JOINTE. Remplace mld-phase1.md.
- 22/08/2026 (correction) : SEUIL_VALIDATION_DS rattaché au SERVICE (ajout FK CODE_SERVICE). Le seuil d'exemption DS est désormais défini par service ; la clé de recherche du seuil en vigueur devient (CODE_SERVICE, TYPE_IMPUTATION, DATE_APPLICATION). Impacte le MCD Phase 1 (nouvelle association SERVICE — définit — SEUIL_VALIDATION_DS) — à répercuter dans le MCD validé.
- 22/08/2026 (évolution) : DIRECTION, SERVICE et CELLULE passent en **clé technique** (ID de substitution immuable) ; le code métier (CODE_*) devient attribut NOT NULL + UNIQUE, mutable en cas de réorganisation. FK renommées en conséquence dans SERVICE, CELLULE, ACTEUR, CUG, FOURNISSEUR, ROLE (3 FK périmètre + CHECK + index d'unicité) et SEUIL_VALIDATION_DS ; unicités FOURNISSEUR portées sur ID_SERVICE. Décision de niveau MLD/MPD : MCD Phase 1 inchangé (cohérent avec le traitement de FOURNISSEUR).
- 23/08/2026 (Phase 2 validée) : intégration des 9 décisions D1–D9. Ajout de CSF_LIQUIDE (statut terminal) ; contrôle de dépassement MONTANT_COMMANDE en alerte (non bloquant) ; rédacteur CSF = demandeur ou RC ; ≥ 1 justificatif à la transmission ; reprise/suppression uniquement en statut rejeté, reprise après rejet Budget ouverte au rédacteur et au RC ; facture non stockée. Phase 2 du MLD figée.
- 23/08/2026 (correction CB) : périmètre du rôle CB déplacé de DIRECTION vers SERVICE (conforme au CDG : « la CB du service dont il a la charge »). CHECK cohérence ROLE mis à jour (CB avec CDS côté service) ; CB collective par service ; unicités RC/CDS/DS inchangées. À répercuter dans le MCD.
- 23/08/2026 (extension rôles) : TYPE_ROLE étendu à ADMIN_SERVICE (périmètre service) et ADMIN_APP (transverse, sans périmètre) pour porter les habilitations d'administration. CHECK cohérence complété ; admins sans unicité.
