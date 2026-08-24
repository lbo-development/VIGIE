---
MOT (Modèle Organisationnel des Traitements) - Phases 1 & 2
Reprend chaque opération du MCT (mct-phases-1-2.md) et précise le qui / quand / comment : poste de travail, nature de la tâche, temporalité. Intègre les décisions d'organisation recueillies (mode pull, suppléance, retours PGI manuels, postes d'administration, import synchrone).
Statut : premier jet complet, à valider.
---

# Conventions

**Nature des tâches** : TI = tâche interactive (agent + application) ; TA = tâche automatique (application seule, sans intervention) ; TM = tâche manuelle externe (hors application, ex. action dans le PGI).
**Temporalité** : TR = temps réel ; les enchaînements se font en **mode pull** (aucune notification ; chaque poste consulte dans l'application les objets qui le concernent selon son rôle et son périmètre).

**Postes de travail** :
| Poste | Rattachement | Rôle (TYPE_ROLE) |
|---|---|---|
| Demandeur | agent autorisé d'un service | — (pas de rôle dédié) |
| RC | cellule | RC |
| CDS | service | CDS |
| CB | service (collectif) | CB |
| DS | direction | DS |
| admin_service | service | ADMIN_SERVICE |
| admin_app | transverse | ADMIN_APP |
| PGI | externe | — |

**Suppléance** : dispositif organisationnel. Le suppléant (même rôle, autre périmètre) accède, pendant la période déclarée, à la file de travail du titulaire absent ; l'action est tracée sous l'identité réelle du suppléant avec renvoi « en suppléance de… » (HISTORIQUE). Déclarée par le titulaire lui-même (auto-déclaration, sans validation d'un tiers).

**Accès en mode pull** : chaque poste dispose d'une file filtrée — DA/FAD/CSF à l'état correspondant à son rôle, sur son périmètre. Les rejets et reprises réapparaissent dans la file du poste concerné (pas de relance active).

═══════════════════════════════════════════
# PROCESSUS 1 — DEMANDE D'ACHAT
═══════════════════════════════════════════

| Opération (MCT) | Poste | Nature | Temporalité | Précisions organisationnelles |
|---|---|---|---|---|
| OP1.1 Créer la DA | Demandeur | TI | TR | Saisie + dépôt devis/pièces. Objet apparaît ensuite dans la file du RC. |
| OP1.2 Statuer opportunité | RC (ou suppléant) | TI | TR | File RC de la cellule. Rejet → réapparaît en file Demandeur pour resoumission. |
| OP1.3 Statuer FAD | CDS (ou suppléant) | TI | TR | File CDS du service. Rejet → duplication (nouvelle DA/FAD). |
| OP1.4 Contrôle financier | CB (collectif service) | TI | TR | File CB du service. Lecture du seuil (service, imputation) → oriente vers DS ou exemption. |
| OP1.5 Autoriser commande | DS (ou suppléant) | TI | TR | Uniquement si montant ≥ seuil. File DS de la direction. Rejet motivé → duplication. |
| OP1.5b Générer la fiche récap. FAD (PDF) | (automatique, système) | TA | TR | Déclenchée à l'autorisation (FAD_VALIDEE_DS ou exemption). PDF ajouté aux pièces jointes (ORIGINE=SYSTEME, FICHE_FAD), non supprimable. |
| OP1.6 Constater commande PGI | CB | TM puis TI | TR | La CB passe la commande **dans le PGI** (TM, hors application), puis saisit FAD_COMMANDEE + MONTANT_COMMANDE (TI). |
| OP1.7 Clôturer / rouvrir FAD | Demandeur ou CB | TI | TR | Bascule réversible de l'indicateur « plus de CSF attendu ». |

═══════════════════════════════════════════
# PROCESSUS 2 — SERVICE FAIT
═══════════════════════════════════════════

| Opération (MCT) | Poste | Nature | Temporalité | Précisions organisationnelles |
|---|---|---|---|---|
| OP2.1 Élaborer le CSF | Demandeur initial ou RC | TI | TR | Accès conditionné : FAD FAD_COMMANDEE + ≥ 1 justificatif. Objet entre en file RC. |
| OP2.2 Statuer sur le CSF | RC (ou suppléant) | TI | TR | File RC. Rejet → modification en place par le rédacteur, resoumission ; suppression possible tant que rejeté. |
| OP2.3 Valider + déclencher paiement | CB (collectif service) | TI puis TM | TR | Validation (TI) ; alerte si cumul CSF validés > MONTANT_COMMANDE ; déclenchement du paiement **dans le PGI** (TM). Rejet → reprise ouverte au rédacteur et au RC. |
| OP2.4 Constater la liquidation PGI | CB | TM puis TI | TR | Liquidation de la facture **dans le PGI** (TM), puis saisie de CSF_LIQUIDE (TI). État terminal, verrouille le CSF. |

═══════════════════════════════════════════
# PROCESSUS 3 — IMPORTS DE RÉFÉRENTIELS PGI
═══════════════════════════════════════════

| Opération (MCT) | Poste | Nature | Temporalité | Précisions organisationnelles |
|---|---|---|---|---|
| OP3.1 Intégrer un référentiel PGI | admin_service | TI (dépôt) + TA (intégration) | TR **synchrone** | L'agent dépose le fichier de son service et **attend à l'écran** le compte-rendu (validation, consolidation, intégration, auto-création fournisseurs pour les marchés, anomalies). Un import = un seul service. Aucune étape de confirmation intermédiaire. |

═══════════════════════════════════════════
# TÂCHES D'ADMINISTRATION (hors circuit métier)
═══════════════════════════════════════════

| Tâche | Poste | Nature | Temporalité | Précisions |
|---|---|---|---|---|
| Gérer le référentiel fournisseurs (création/màj, état Actif/Inactif) | admin_service | TI | TR | Périmètre : son service. |
| Lancer les imports PGI (marchés, CUG, opérations) | admin_service | TI | TR | Cf. OP3.1. |
| Déclarer les rôles et leur validité (RC/CDS/CB du service) et les suppléances | admin_service | TI | TR | Alimente ROLE (DATE_DEBUT/FIN/ACTIF) et SUPPLEANCE. |
| Paramétrer les seuils DS (par service) | DS | TI | TR | Déjà acté : responsabilité DS ; historisé. |
| Gérer les paramètres transverses | admin_app | TI | TR | Ex. libellés paramétrables (longueurs OBJET/DESCRIPTION), référentiels transverses. |
| Gérer les comptes utilisateurs | admin_app | TI | TR | Création/désactivation des comptes (authentification propre à l'application). |

# Points d'attention MOT
- **Séparation des tâches** : le cumul de rôles étant accepté sans garde-fou (Phase 1), un même agent peut occuper plusieurs postes du circuit ; le MOT ne l'interdit pas mais le signale comme risque de contrôle interne (à couvrir éventuellement par du reporting).
- **Retours PGI** : les tâches TM (commande, paiement, liquidation) s'exécutent dans le PGI ; l'application ne les orchestre pas, elle enregistre leur constat (OP1.6, OP2.4).
- **Import synchrone** : dimensionnement à surveiller si la volumétrie des fichiers augmente sensiblement (bascule éventuelle en différé — décision réversible, sans impact données).

# Points à valider
- Affectation des tâches d'administration au poste admin_service vs admin_app conforme à l'organisation réelle du GPMM.
- Qui déclare les rôles : admin_service pour tous les rôles du service (RC/CDS/CB), ou le DS pour certains ? (proposé : admin_service.)
- OP1.6 / OP2.3 / OP2.4 : la part « action dans le PGI » (TM) est-elle réalisée par la CB elle-même, comme supposé ?

# Historique
- 23/08/2026 : premier jet du MOT Phases 1 & 2, après validation du périmètre CB (service), des postes d'administration (admin_service / admin_app, extension TYPE_ROLE), et de la temporalité d'import (synchrone temps réel).
