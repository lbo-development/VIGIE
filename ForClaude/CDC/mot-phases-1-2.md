# MOT (Modèle Organisationnel des Traitements) — Phases 1 & 2

*Reprend chaque opération du MCT (mct-phases-1-2.md) et précise le qui / quand / comment : poste de travail, nature de la tâche, temporalité. Intègre les décisions d'organisation recueillies (mode pull, suppléance, retours PGI manuels, postes d'administration, import synchrone).*

*Statut : premier jet complet, à valider.*

___

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

**Suppléance** : dispositif organisationnel, réservé aux rôles RC/CDS/DS (jamais CB, collective — voir remplacement temporaire ci-dessous). Le suppléant (même rôle, autre périmètre) accède, pendant la période déclarée, à la file de travail du titulaire absent, en substitution complète et sans restriction ; l'action est tracée sous l'identité réelle du suppléant avec renvoi « en suppléance de… » (HISTORIQUE). Déclarée par le titulaire lui-même exclusivement (auto-déclaration, sans validation d'un tiers ni délégation possible par ADMIN_SERVICE/ADMIN_APP) — décision du 14/09/2026, corrige l'incohérence avec la ligne « Déclarer les rôles… et les suppléances » du tableau ci-dessous, qui attribuait par erreur cette déclaration à ADMIN_SERVICE. **Remplacement CB** : pas de suppléance possible ; en cas d'absence, ADMIN_SERVICE attribue directement un rôle CB temporaire via ROLE_ATTRIBUTION.

**Accès en mode pull** : chaque poste dispose d'une file filtrée — DA/FAD/CSF à l'état correspondant à son rôle, sur son périmètre. Les rejets et reprises réapparaissent dans la file du poste concerné (pas de relance active).

═══════════════════════════════════════════
# PROCESSUS 1 — DEMANDE D'ACHAT
═══════════════════════════════════════════

> **Refonte du 06/09/2026** : table alignée sur le MCT réécrit (validation client du cycle DA/FAD, tableau « Cycle de vie d'une FAD », 20 indices). Trois nouvelles opérations (OP1.2b, OP1.3b, OP1.4b) et un mécanisme de reprise revu — plus de duplication après rejet/annulation, trois boucles « en place » distinctes.

| Opération (MCT) | Poste | Nature | Temporalité | Précisions organisationnelles |
|---|---|---|---|---|
| OP1.1 Créer, finaliser et transmettre la DA | Demandeur | TI | TR | **Création progressive** (décision du 07/09/2026) : la DA existe en base dès le clic « Nouvelle demande » (DA_EN_PREPARATION), pas seulement à un enregistrement final — saisie + dépôt devis/pièces au fil de l'écran, puis transmission au RC. Objet apparaît dans la file du RC. Boucle DA_A_COMPLETER : réapparaît dans la file du **même poste** (Demandeur) pour complément, puis retransmission — pas une nouvelle DA. **Suppression physique** (décision du 07/09/2026) : possible uniquement à l'état DA_EN_PREPARATION (icône grisée pour DA_A_COMPLETER, déjà transmise une première fois) — voir MCD/MLD pour la cascade applicative. |
| OP1.2 Statuer opportunité | RC (ou suppléant) | TI | TR | File RC de la cellule. **Rejeté** ou **Annulé** → fin de cycle, aucune resoumission assistée (un nouveau besoin repart d'OP1.1). **DA à compléter** → réapparaît en file Demandeur. Validé → enchaîne immédiatement sur OP1.2b (même poste, pas d'attente). |
| OP1.2b Finaliser et transmettre la FAD | RC (ou suppléant) | TI | TR | Enchaînée sans coupure après OP1.2 (même poste). Reformulation objet/description, critères fournisseur, imputation budgétaire. Objet apparaît ensuite dans la file du CDS. |
| OP1.3 Statuer FAD | CDS (ou suppléant) | TI | TR | File CDS du service. **Rejeté** ou **Annulé** → fin de cycle. **FAD à compléter** → réapparaît en file **RC** (pas Demandeur) : c'est le RC qui apporte le complément et retransmet au CDS. Validé → enchaîne immédiatement sur OP1.3b. |
| OP1.3b Transmettre la FAD à la CB | CDS (ou suppléant) | TI | TR | Enchaînée sans coupure après OP1.3 (même poste). Objet apparaît ensuite dans la file de la CB. |
| OP1.4 Contrôle financier et budgétaire | CB (collectif service) | TI | TR | File CB du service. **Rejeté** → fin de cycle (la CB ne dispose **pas** d'« Annulé » : elle ne juge jamais l'opportunité, seulement crédits/marché/plafond). **FAD à modifier** → réapparaît en file **RC**, qui modifie puis retransmet **directement à la CB** (la FAD ne repasse pas par le CDS). Validé → enchaîne sur OP1.4b. |
| OP1.4b Router selon le seuil | (automatique, système) | TA | TR | Immédiatement après OP1.4, sans intervention humaine. Lecture du seuil (service, imputation) → si atteint, objet apparaît en file DS (Transmise DS) ; sinon bascule automatique en FAD_VALIDEE_DS_SEUIL, sans passage par la file DS. |
| OP1.5 Autoriser commande | DS (ou suppléant) | TI | TR | Uniquement si FAD_TRANSMISE_DS (seuil atteint). File DS de la direction. **Rejeté** ou **Annulé** → fin de cycle, aucune resoumission assistée. |
| OP1.5b Générer la fiche récap. FAD (PDF) | (automatique, système) | TA | TR | Déclenchée à l'autorisation (FAD_VALIDEE_DS ou FAD_VALIDEE_DS_SEUIL). PDF ajouté aux pièces jointes (ORIGINE=SYSTEME, FICHE_FAD), non supprimable. |
| OP1.6 Élaborer et constater la commande | CB | TM puis TI | TR | La CB saisit la FAD **dans le PGI** (TM, hors application), puis édite le bon de commande et saisit MONTANT_COMMANDE dans l'application (TI) → FAD_COMMANDEE. |
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
| Gérer le référentiel fournisseurs (màj, état Actif/Inactif) | admin_service (son service) / admin_app (transverse) | TI | TR | Décision du 29/08/2026 : admin_app étendu en plus de admin_service (son service), même modèle que Gisement géographique/technique et Seuils de validation DS. Lecture (hors administration) scopée au service de l'acteur pour tout le monde sauf admin_app, y compris un Demandeur (pas de rôle dédié). |
| Créer un fournisseur (pour son service) | Demandeur / admin_service (son service) / admin_app (transverse) | TI | TR | Décision du 29/08/2026 : la CRÉATION seule (pas la mise à jour ni l'état Actif/Inactif) est ouverte au Demandeur — le fournisseur hérite directement de son propre service, pas de choix de direction/service à l'écran pour lui. |
| Supprimer un fournisseur (si non utilisé) | admin_service (son service) / admin_app (transverse) | TI | TR | Décision du 29/08/2026 : suppression physique du fournisseur et de ses contacts, autorisée uniquement si aucun marché, aucune demande d'achat (fournisseur retenu) ni aucun devis consulté (même non retenu) ne le référence encore — sinon message d'erreur invitant à le passer en Inactif à la place. Exception au principe général d'archivage (ETATFOURNISSEUR). |
| Gérer le référentiel CUG (màj libellé, état Actif/Inactif) | admin_service (son service) / admin_app (transverse) | TI | TR | Décision du 29/08/2026 : gestion manuelle en complément de l'import PGI (OP3.1) — même modèle d'habilitation que FOURNISSEUR/SITE/SECTEUR/SEUIL_VALIDATION_DS, mais **sans** périmètre Demandeur (contrairement à FOURNISSEUR). CODE_CUG est une clé naturelle non modifiable après création. |
| Lancer les imports PGI (CUG, opérations) | admin_service | TI | TR | Cf. OP3.1. |
| Importer les marchés PGI (upload Excel, glisser-déposer) | admin_service (son service) / admin_app (choix direction/service) / CB (son service) | TI | TR | Décision du 30/08/2026 : modèle propre à MARCHE, distinct de la ligne ci-dessus — élargi à admin_app et CB (Contrôle Budgétaire), et **avec une étape de confirmation bloquante** (aperçu des marchés à créer/archiver avant écriture réelle), contrairement à OP3.1 qui reste automatique sans confirmation pour CUG/opérations. Voir `ForClaude/Importation-marches/import-marches-pgi.md`. |
| Déclarer les rôles et leur validité (RC/CDS/CB du service) | admin_service | TI | TR | Alimente ROLE (DATE_DEBUT/FIN/ACTIF). Ne couvre pas les suppléances (auto-déclarées par le titulaire lui-même, cf. ci-dessus — décision du 14/09/2026). |
| Paramétrer les seuils DS (par service) | admin_service (son service) / admin_app (transverse) | TI | TR | Décision du 29/08/2026 : même modèle que Gisement géographique/technique (SITE/SECTEUR), pas le DS par direction envisagé le 22/08, ni l'ADMIN_APP seul du 28/08/2026. Sans historisation (un seuil FONCTIONNEMENT + un seuil INVESTISSEMENT par service, absence = 0). Voir MLD §2.6. |
| Gérer les paramètres transverses | admin_app | TI | TR | Ex. libellés paramétrables (longueurs OBJET/DESCRIPTION), référentiels transverses. |
| Gérer les comptes utilisateurs | admin_app | TI | TR | Création (fiche acteur + compte d'authentification propre à l'application + rattachement à une cellule), désactivation (ACTIF=false, voie normale) et, à titre résiduel, suppression physique — uniquement si l'acteur ne présente aucune relation en base (décision du 10/09/2026, cf. MCD/MLD). Mot de passe initial défini par admin_app et communiqué hors application ; changement obligatoire à la première connexion. |

# Points d'attention MOT
- **Séparation des tâches** : le cumul de rôles étant accepté sans garde-fou (Phase 1), un même agent peut occuper plusieurs postes du circuit ; le MOT ne l'interdit pas mais le signale comme risque de contrôle interne (à couvrir éventuellement par du reporting).
- **Retours PGI** : les tâches TM (commande, paiement, liquidation) s'exécutent dans le PGI ; l'application ne les orchestre pas, elle enregistre leur constat (OP1.6, OP2.4).
- **Import synchrone** : dimensionnement à surveiller si la volumétrie des fichiers augmente sensiblement (bascule éventuelle en différé — décision réversible, sans impact données).

# Points à valider
- Affectation des tâches d'administration au poste admin_service vs admin_app conforme à l'organisation réelle du GPMM.
- Qui déclare les rôles : admin_service pour tous les rôles du service (RC/CDS/CB), ou le DS pour certains ? (proposé : admin_service.)
- OP1.6 / OP2.3 / OP2.4 : la part « action dans le PGI » (TM) est-elle réalisée par la CB elle-même, comme supposé ?

# Historique
- 10/09/2026 (ACTIF sur ACTEUR + suppression conditionnelle, chantier CRUD gestion des utilisateurs) : tâche « Gérer les comptes utilisateurs » précisée — création réservée à admin_app (fiche acteur, compte, rattachement cellule, mot de passe initial communiqué hors application, changement obligatoire à la première connexion) ; désactivation via ACTIF (ajouté sur ACTEUR, cf. MCD/MLD) comme voie normale ; suppression physique limitée au cas résiduel d'un acteur sans aucune relation en base. Répercuté dans le MCD (§1, §7, §8) et le MLD (§2.1, §4, §7).
- 07/09/2026 (création progressive de la DA) : OP1.1 précisée — la DA existe en base dès « Nouvelle demande », pas seulement à un enregistrement final. Voir MCD/MLD/MCT.
- 07/09/2026 (suppression physique DA) : OP1.1 précisée — suppression physique d'une DA autorisée uniquement à DA_EN_PREPARATION, jamais DA_A_COMPLETER. Voir MCD/MLD.
- 23/08/2026 : premier jet du MOT Phases 1 & 2, après validation du périmètre CB (service), des postes d'administration (admin_service / admin_app, extension TYPE_ROLE), et de la temporalité d'import (synchrone temps réel).
- 28/08/2026 (simplification SEUIL_VALIDATION_DS) : tâche "Paramétrer les seuils DS" reposée sur admin_app (implémentation réelle) plutôt que DS (voir MLD §2.6 pour l'écart avec la décision du 22/08) ; retrait de la mention "historisé", abandonnée le même jour.
- 29/08/2026 (habilitation SEUIL_VALIDATION_DS) : tâche "Paramétrer les seuils DS" ouverte à admin_service (son propre service) en plus d'admin_app (transverse) — même modèle que les tâches de gestion SITE/SECTEUR, remplace la restriction admin_app seul du 28/08/2026. Voir MLD/MCD.
- 29/08/2026 (habilitation FOURNISSEUR/CONTACT) : tâche "Gérer le référentiel fournisseurs" étendue à admin_app (transverse) en plus d'admin_service (son service, déjà documenté) — même modèle que SITE/SECTEUR et SEUIL_VALIDATION_DS. CONTACT (rattaché à FOURNISSEUR, 0..N) suit le même droit d'écriture que son fournisseur parent, non listé séparément dans ce tableau. Voir MLD §2.2 et SECURITY.md §2.5.
- 29/08/2026 (création FOURNISSEUR ouverte au Demandeur) : nouvelle tâche "Créer un fournisseur (pour son service)" — seule la création est ouverte au Demandeur, la mise à jour/l'état Actif-Inactif restent admin_service/admin_app. Voir MLD §2.2 et SECURITY.md §2.5.
- 29/08/2026 (suppression conditionnelle FOURNISSEUR) : nouvelle tâche "Supprimer un fournisseur (si non utilisé)" — admin_service/admin_app uniquement (pas le Demandeur, contrairement à la création), conditionnée à l'absence de référence dans MARCHE/DEMANDE_ACHAT/DEVIS_CONSULTE. Voir MLD §2.2/§4 et SECURITY.md §2.5.
- 29/08/2026 (gestion manuelle CUG) : nouvelle tâche "Gérer le référentiel CUG" — admin_service (son service) / admin_app (transverse), en complément de l'import PGI existant (OP3.1). Pas de périmètre Demandeur (à la différence de FOURNISSEUR). Voir MLD §2.2 et SECURITY.md §2.6.
- 06/09/2026 (refonte du cycle DA/FAD — validation client) : table du Processus 1 réécrite pour suivre le MCT réécrit le même jour. Ajout d'OP1.2b (RC, finalisation FAD, enchaînée sans coupure après OP1.2), OP1.3b (CDS, transmission à la CB, enchaînée sans coupure après OP1.3) et OP1.4b (automatique/TA, routage seuil, remplace le routage auparavant imbriqué dans OP1.4). Les trois boucles de reprise sont désormais distinguées par poste de destination : DA_A_COMPLETER → file Demandeur ; FAD_A_COMPLETER → file **RC** (pas CDS) ; FAD_A_MODIFIER → file RC avec retransmission **directe à la CB** (pas de repassage par le CDS). Rejeté/Annulé ne réapparaissent plus nulle part (suppression de la resoumission par duplication). Voir MCT (Historique) et MCD §8.
