# Spécification fonctionnelle — Import des opérations d'investissement depuis le PGI (fichier Excel)

> **Statut** : construit (04/09/2026) — import (preview/confirm), page de consultation en cartes,
> modification manuelle (`libelle_service`/`actif`/`utilisable`), modale de filtre et système de
> pièces jointes (table `investissement_piece`, bucket Storage, backend, composants React) sont
> implémentés et testés (backend 73 tests, frontend 45 tests côté page + composants dédiés).
> Fonctionnalité non prévue au CDC initial sous cette forme (ajout demandé par l'utilisateur), mais
> la table cible `finances.operation_investissement` existe déjà et est référencée dans le MCD/MLD
> (`ForClaude/CDC/mcd-phases-1-2.md` §OPERATION_INVESTISSEMENT, `mld-phases-1-2.md` §2.2) — créée
> hors migration versionnée (voir `ForClaude/SECURITY.md`, note sur le GRANT global non documenté).
> Toutes les migrations listées en §11/§13 ont été exécutées par l'utilisateur (vérifié en lecture
> seule via introspection du schéma live). Rédigé à partir de l'inspection technique directe des
> fichiers réels de ce répertoire (`Modele importation investissement PGI.xlsx`, `consignes
> importation investissements PGI.xlsx`) et des décisions actées avec l'utilisateur les 03 et
> 04/09/2026 (voir §14).

# 1. Objectif

Alimenter `finances.operation_investissement` à partir d'un export PGI au format Excel composé de
**trois feuilles** (`OP`, `AP`, `CP`), pour disposer, par opération d'investissement, du montant
initial et des montants Autorisation de Programme (AP) / Crédit de Paiement (CP) utiles au suivi
budgétaire — en réutilisant l'ossature déjà validée pour les imports marchés et commandes (contrôle
structurel bloquant, aperçu avant confirmation, paramètre applicatif de verrouillage par service,
rôles ADMIN_APP/ADMIN_SERVICE/CB).

**Différence structurelle majeure avec les deux imports précédents** : il n'y a ni ligne de titre,
ni cellule « Édité le » / date de génération dans ce fichier (vérifié : les trois feuilles
commencent directement par leur ligne d'en-têtes en ligne 1, aucune métadonnée business
n'est présente ; les propriétés du classeur — auteur, date de dernière modification — ne sont que
des métadonnées de sauvegarde locale, pas une date d'export PGI fiable). **Conséquence** : le
contrôle bloquant « fichier plus ancien que le dernier import rejeté », présent sur les imports
marchés et commandes, n'est **pas transposable ici** — voir §7 et §16 (point à confirmer).

# 2. Structure réelle du fichier modèle (vérifiée)

Trois feuilles, chacune une simple table à une ligne d'en-têtes (ligne 1) suivie des données
(ligne 2+, sans ligne à sauter) :

| Feuille | Lignes de données | Colonnes | Contenu |
|---|---|---|---|
| **OP** | 3 928 | 77 | une ligne par opération d'investissement (référentiel) |
| **AP** | 5 236 | 5 | mouvements Autorisation de Programme, une ligne par (opération, indice, sous-projet) |
| **CP** | 12 461 | 5 | mouvements Crédit de Paiement, même structure que AP |

Aucune des trois feuilles ne comporte de cellule de titre ou de date à vérifier comme sur les
fichiers marchés/commandes — le contrôle structurel (§9) se limite à la présence des 3 feuilles et
à l'identité stricte de leurs lignes d'en-têtes.

## 2.1 Feuille OP (77 colonnes, ligne d'en-têtes en ligne 1)

Colonnes vérifiées par inspection directe (`exceljs`) — seules celles utilisées par l'import sont
listées ci-dessous et les colonnes `Sous op`/`Ctrl AP` (note plus bas) ; les 52 autres (Numero
projet, Code Projet, Intitule Projet, Type, Description Type, Categorie, Description, dates MD1-5,
dates validation 1-5, Location, Activite, Metier, Famille, UF, etc.) ne sont ni contrôlées ni
stockées :

| Col. (n°) | En-tête | Champ cible | Usage |
|---|---|---|---|
| 6 | Numero operation | — | **non utilisé** (correction du 03/09/2026, voir note ci-dessous) |
| 8 | Code | `numero_operation` | stocké, **clé unique** — correspond **exactement** au numéro d'opération complet des clés AP/CP (§3), aucune reconstitution nécessaire |
| 9 | Intitule | `libelle` | stocké (colonne 10 « Description » écartée le 03/09/2026 : des valeurs vides y ont été constatées sur le fichier réel) |
| 11 | CUG coordinateur | `code_cug` | stocké + contrôle d'éligibilité (§7) |
| 12 | Statut | `statut` | stocké (valeur brute `A`/`F` — seules valeurs possibles pour une ligne upsertée, §7) + filtre d'éligibilité |
| 17 | Montant FC | `mt_initial` | stocké |
| 18 | Montant travaux | `mt_travaux` | stocké (ajout du 04/09/2026, §11) |

**Correction du 03/09/2026** : la clé unique d'une opération n'est **pas** la colonne « Numero
operation » (col. 6, purement numérique, ex. `203`, `10096` — sans rapport avec le format des clés
AP/CP) mais la colonne **« Code »** (col. 8, ex. `VN000203`, `SU010096`). Vérifié sur le fichier
modèle : `Code` est renseignée et **unique sur les 3 928 lignes** (aucun doublon, aucune valeur
vide), et correspond **caractère pour caractère** au numéro d'opération complet décodé depuis les
clés AP/CP (§3) — ex. ligne `Numero operation=203` / `Code=VN000203`, retrouvé tel quel dans la clé
AP `PA-T-094-...-PVN000203.1-...`. Cette correction **simplifie fortement §4** : plus besoin de
reconstituer le préfixe alphabétique via les colonnes `Ctrl AP`, la jointure OP↔AP/CP se fait
directement sur `Code`.

**Distribution réelle du Statut** (3 928 lignes) : `T`=2198, `A`=901, `S`=553, `F`=250, `C`=20,
`I`=6. Seules `A` et `F` sont éligibles (règle donnée dans les consignes : *« si le statut de l'OP
est A ou F alors OP est éligible »*) — 1 151 opérations éligibles sur le fichier modèle, tous
services confondus.

**Colonnes `Sous op 1..9` / `Ctrl AP 1..9`** (18 colonnes, positions 59 à 76) : confirmées
**inutilisées par l'import** maintenant que la jointure passe directement par `Code` (§3/§4). Elles
contiennent, à titre indicatif, une référence par sous-opération (ex. `VN000203.1`, `VN000203.8`,
`VN000203.9` pour l'opération `VN000203`) accompagnée d'un indicateur `O`/`N` (`Sous op N`) dont le
sens exact n'est pas documenté — aucun besoin pour cet import.

## 2.2 Feuilles AP et CP (5 colonnes chacune, ligne d'en-têtes en ligne 1)

Structure identique pour les deux feuilles — une ligne par mouvement budgétaire :

| Col. | En-tête | Champ |
|---|---|---|
| A | `Fonds disponibles EUR ): Compte` | **clé composite** à décoder (§3) — pas de nom de colonne classique, la totalité de l'information est encodée dans cette seule cellule |
| B | `Fonds disponibles EUR ): Budget` | montant budgété |
| C | `Fonds disponibles EUR ): Engagement` | montant engagé |
| D | `Fonds disponibles EUR ): Réel` | montant liquidé |
| E | `Fonds disponibles EUR ):  Disponible` | montant disponible (solde) |

# 3. Décodage de la clé (colonne A de AP et CP)

Format vérifié sur les deux feuilles, tirets (`-`) comme séparateur, 12 segments — exemples réels :

```
CP : PA-C601-DAC.S-T-T-T-T-T-PFCT-T-T-PCP-T
CP : PA-T-0-T-T-T-T-T-PAV110137.R-T-T-PCP-T
AP : PA-T-094-T-T-T-T-T-PCE021856.1-PP1510616-T-PAP-T
```

Seul le **9ᵉ segment** (ex. `PSU025493.8`, `PAV110137.R`) est utilisé par l'import :
- retirer le `P` initial ;
- tout ce qui précède le premier `.` = **numéro d'opération complet** (8 caractères, ex.
  `SU025493`, `AV110137`) — c'est un identifiant préfixé (2 lettres + 6 chiffres) qui correspond
  **exactement** à la colonne `Code` de la feuille OP (§2.1) ;
- ce qui suit le `.` = **indice** (`1` à `9`, ou `R`, `A` — non numérique dans certains cas).

**Distribution réelle des indices** (fichier modèle) :
- CP : `1`=6382, `8`=1849, `9`=936, `R`=1390, `2`=115, `3`=61, `6`=31, `4`=42, `5`=28, `7`=20, `A`=29
- AP : `1`=3000, `8`=3, `2`=55, `3`=31, `4`=26, `5`=15, `6`=12, `7`=8, `A`=57

**Correction du 03/09/2026** : les deux tranches canoniques nommées dans les consignes
(`MTBUGETAP.1`, `MTBUGETCP.8`) ne signifient pas « AP uniquement à l'indice 1, CP uniquement à
l'indice 8 » mais bien **quatre tranches**, cohérentes avec les 4 colonnes du schéma CDC initial de
`finances.operation_investissement` (`mt_ap1`, `mt_ap8`, `mt_cp1`, `mt_cp8`, §11) : **AP à l'indice
`1` et `8`**, **CP à l'indice `1` et `8`**. Tous les autres indices (`2` à `7`, `9`, `R`, `A`), dans
les deux feuilles, restent **hors périmètre** de cet import, jamais lus. Les 4 tranches existent
bien dans les données réelles :

| Tranche | Lignes | Numéros d'opération distincts |
|---|---|---|
| AP.1 | 3 000 | 2 307 |
| AP.8 | 3 | 2 |
| CP.1 | 6 382 | 2 211 |
| CP.8 | 1 849 | 575 |

**Non-unicité vérifiée** : le couple (numéro d'opération complet, indice) n'est unique sur aucune
des 4 tranches (ex. 217 doublons sur les 2 307 combinaisons AP.1, 2 741 doublons sur les 575
combinaisons CP.8) — plusieurs sous-projets/CHAP peuvent alimenter la même tranche d'une opération.
Décision (§16) : les 4 montants sont **sommés** sur toutes les lignes du couple, comme pour
l'agrégation par `NUMCMD` de l'import commandes.

# 4. Jointure OP ↔ AP/CP — directe via `Code`

Correction du 03/09/2026 (voir §2.1) : la colonne `Code` de la feuille OP porte déjà le numéro
d'opération complet au format des clés AP/CP — **aucune reconstitution n'est nécessaire**. La
jointure est directe :

1. Décoder la clé (§3) de chaque ligne AP et CP → (numéro d'opération complet, indice).
2. Ne conserver que les lignes à l'indice `1` ou `8`, dans AP **et** dans CP (4 tranches : AP.1,
   AP.8, CP.1, CP.8 — hors périmètre sinon, §3).
3. Regrouper par (numéro d'opération complet, tranche), sommer les 4 montants (Budget/Engagement/
   Réel/Disponible) sur chaque groupe.
4. Retrouver la ligne OP correspondante par égalité stricte `OP.Code = numéro d'opération complet`.

Les colonnes `Ctrl AP 1..9` de la feuille OP ne sont plus utilisées par cet algorithme (§2.1).

**Vérifié sur le fichier modèle**, taux de correspondance à `OP.Code` (parmi les numéros
d'opération distincts de chaque tranche) :

| Tranche | Correspond à une opération éligible (A/F) | Sans aucune ligne OP (orpheline) |
|---|---|---|
| AP.1 | 775 / 2 307 | 59 / 2 307 (2,6 %) |
| AP.8 | 2 / 2 | 0 / 2 |
| CP.1 | 773 / 2 211 | 64 / 2 211 (2,9 %) |
| CP.8 | 329 / 575 | 15 / 575 (2,6 %) |

Les numéros restants (ni orphelins, ni rattachés à une opération éligible) correspondent à des
opérations OP existantes mais non éligibles (Statut ∉ {A, F} ou CUG hors service, §7) — décision du
03/09/2026 (§8) : dans les deux cas (orpheline ou non éligible), la ligne AP/CP est exclue
silencieusement.

# 5. Acteur et service cible

**ADMIN_APP** (transverse), **ADMIN_SERVICE** et **CB**, scopés à leur propre service — même
triplet que les imports marchés/commandes (`assertManagesServiceOrHasRoleCb`,
`backend/src/services/authorization.service.ts`, réutilisée telle quelle). Filtre Direction →
Service identique à `ImportMarches.tsx`/`ImportCommandes.tsx`.

# 6. Étape d'intégration — upsert par numéro d'opération (pas d'« annule et remplace »)

**Différence avec l'import commandes**, conforme à la règle donnée dans les consignes : chaque
opération d'investissement a une existence propre dans le temps (contrairement à une ligne de
commande), donc pas de suppression en masse. Séquence :

1. **Validation** (§7/§8) — identique en `preview()` et `confirm()`.
2. **Jointure et agrégation** OP ↔ AP/CP (§3/§4).
3. **Aperçu (bloquant)** — `POST /api/investissements/import/preview`, aucune écriture en base :
   liste des opérations qui seront créées/mises à jour (numéro, libellé, montant initial, les 4
   tranches AP.1/AP.8/CP.1/CP.8) et les anomalies (§7/§8). L'utilisateur doit cliquer sur
   « Confirmer l'import » pour poursuivre.
4. **Intégration réelle** (seulement après confirmation) — `POST /api/investissements/import/confirm`,
   revalide tout depuis zéro (même fichier ré-envoyé par le frontend, aucun état serveur entre les
   deux appels) puis, pour le service cible de l'import : pour chaque opération éligible du fichier,
   **upsert** par `numero_operation` — création si absente, mise à jour sinon (`libelle`,
   `code_cug`, `id_service`, `statut`, `mt_initial`, les 16 montants des 4 tranches
   AP.1/AP.8/CP.1/CP.8). Puis met à jour `last.import.investissement.pgi` avec la date/heure de
   l'import (§7 — ici l'horodatage serveur, pas une date extraite du fichier, cf. §1).

   **Correction du 04/09/2026** : contrairement à la conception initiale, une opération déjà en
   base mais absente du nouveau lot éligible (sortie du fichier, statut ∉ {A, F}, ou CUG hors
   service) **n'est plus automatiquement flaguée inactive**. `ACTIF` est devenu un champ purement
   manuel au même titre que `LIBELLE_SERVICE`/`UTILISABLE` (§11) — l'import ne le fixe qu'à la
   création (défaut de colonne `true`) et ne le touche plus jamais ensuite ; seule une
   modification manuelle (icône « Modifier », `investissement.service.ts#updateManagedFields`)
   change ce champ désormais. Le compte-rendu ne porte donc plus de compteur d'opérations
   désactivées.
5. **Compte-rendu final** — à l'écran et téléchargeable, même principe que les deux imports
   précédents.

# 7. Étape 2 — vérification de l'éligibilité

1. **Paramètre applicatif `last.import.investissement.pgi`**
   (`finances.parametre_application`), portée par service, même mécanique déclarative que
   `last.import.marche.pgi`/`last.import.commande.pgi` — mais **utilisé uniquement pour l'affichage**
   du bandeau « Dernière importation le [date] » (§10), **pas comme garde bloquante** (décision du
   03/09/2026) : en l'absence de date de génération fiable dans le fichier (§1), il n'y a rien de
   vérifiable pour rejeter un fichier « trop ancien » — le risque de réimporter un export périmé est
   accepté plutôt que d'ajouter une saisie manuelle de date à l'écran.
2. **CUG coordinateur — vérification PAR LIGNE OP** : pour chaque ligne OP dont le Statut ∈ {A, F},
   le CUG doit être affecté au service cible de l'import (`finances.cug`), sinon **anomalie
   signalée** dans le compte-rendu, opération exclue du lot (traitée comme absente, §6).
3. **Statut** : seules les lignes OP à Statut `A` ou `F` sont éligibles ; les autres (`T`, `S`, `C`,
   `I`) sont exclues silencieusement (pas d'anomalie, cohérent avec le volume important — 2 198
   lignes `T` sur 3 928, soit 56 % du fichier).

# 8. Filtrage / anomalies AP-CP

Décision du 03/09/2026 : les lignes AP/CP dont le numéro d'opération complet ne correspond à
aucune opération OP éligible (§4) sont **exclues silencieusement** du regroupement — même
traitement que les statuts non éligibles (`T`/`S`/`C`/`I`) de la feuille OP, aucune anomalie
signalée dans le compte-rendu. Seul le nombre total de lignes AP/CP ainsi exclues peut être compté
(`nbExclues`), pas le détail ligne par ligne — même logique que l'exclusion silencieuse de l'import
commandes (§8 de `import-commandes-pgi.md`).

# 9. Étape 1 — vérification structurelle du fichier

Contrôles bloquants (arrêt du processus + message d'erreur si l'un échoue) :

1. Présence des 3 feuilles nommées exactement `OP`, `AP`, `CP`.
2. Ligne d'en-têtes de `OP` (ligne 1, 77 cellules) strictement identique à la référence (§2.1).
3. Ligne d'en-têtes de `AP` (ligne 1, 5 cellules) strictement identique à la référence (§2.2).
4. Ligne d'en-têtes de `CP` (ligne 1, 5 cellules) strictement identique à la référence (§2.2).

Pas de contrôle de titre ni de date (absents du fichier, §1).

# 10. En-tête de la page d'import — rappel de la dernière importation

Même principe que `MarchesPGI.tsx`/`ImportMarches.tsx`/`ImportCommandes.tsx` : sous le titre de
`ImportInvestissements.tsx`, une fois un service sélectionné :
- Paramètre non initialisé pour ce service → message d'alerte dédié.
- Sinon, si une date d'import existe → `Dernière importation le JJ/MM/AAAA` ; sinon →
  `Dernière importation — aucun import effectué`.
- **Alerte de rappel** si la dernière importation date de **15 jours ou plus**
  (`IMPORT_STALE_JOURS`, même seuil que les deux imports précédents) ou si aucun import n'a encore
  été effectué.

Bandeau purement informatif ici (§7.1) — aucun blocage réel ne s'appuie sur cette date, contrairement
aux deux imports précédents où elle sert aussi de garde d'éligibilité du fichier déposé.

# 11. Table cible — `finances.operation_investissement` (migration nécessaire)

**Structure actuelle vérifiée en lecture seule** (table vide, créée hors migration versionnée) :

```
numero_operation, libelle, mt_ap1, mt_ap8, mt_cp1, mt_cp8, date_creation, mt_initial,
created_at, updated_at
```

**Modifications nécessaires** (décisions actées le 03/09/2026, voir §16) :

| Action | Colonne | Détail |
|---|---|---|
| Ajout | `id_service` | `bigint not null references finances.service(id_service)` — stampé depuis le service cible de l'import, pas dérivé du CUG (même choix que `commande_pgi`/`marche_piece`) |
| Ajout | `code_cug` | `text not null references finances.cug(code_cug)` |
| Ajout | `statut` | `text not null` — valeur brute `A`/`F` (correction du 03/09/2026 : conservée telle quelle, revient sur la simplification initialement proposée, voir §14) |
| Ajout | `actif` | `boolean not null default true` — **champ manuel depuis le 04/09/2026** (revient sur la conception initiale, §6) : l'import le fixe uniquement à la création (défaut de colonne), jamais réécrit ensuite, y compris quand une opération sort du lot éligible — modifiable uniquement via l'icône « Modifier » (`investissement.service.ts#updateManagedFields`), distinct de `statut` qui reste la dernière valeur PGI connue |
| Suppression | `mt_ap1`, `mt_ap8`, `mt_cp1`, `mt_cp8` | remplacées par les 16 colonnes ci-dessous — les 4 tranches du schéma CDC initial (AP.1, AP.8, CP.1, CP.8, §3/§4) sont conservées, mais chacune détaillée en 4 sous-montants (Budget/Engagement/Réel/Disponible) plutôt qu'une valeur unique |
| Ajout | `mt_budget_ap1`, `mt_engage_ap1`, `mt_liquide_ap1`, `mt_solde_ap1` | `numeric not null default 0` chacune |
| Ajout | `mt_budget_ap8`, `mt_engage_ap8`, `mt_liquide_ap8`, `mt_solde_ap8` | `numeric not null default 0` chacune |
| Ajout | `mt_budget_cp1`, `mt_engage_cp1`, `mt_liquide_cp1`, `mt_solde_cp1` | `numeric not null default 0` chacune |
| Ajout | `mt_budget_cp8`, `mt_engage_cp8`, `mt_liquide_cp8`, `mt_solde_cp8` | `numeric not null default 0` chacune |
| Inchangé | `mt_initial` | alimenté par `Montant FC` (OP) |
| Inchangé, non alimenté par cet import | `date_creation` | absente du mapping des consignes ; conservée telle quelle, jamais écrite par l'import (à confirmer, §16) |
| Ajout (04/09/2026) | `libelle_service` | `text`, nullable — libellé propre au service, distinct de `libelle` (PGI). À la création, un trigger `BEFORE INSERT` (impossible via un simple `DEFAULT`, qui ne peut ni référencer une autre colonne de la ligne ni appliquer une logique conditionnelle) calcule sa valeur : si `libelle` commence par `numero_operation` (ex. `libelle` = « IN025393 - REAMENAGEMENT DU POSTE RORO 93-94 », `numero_operation` = « IN025393 »), ce préfixe et les séparateurs qui suivent (espaces, tirets) sont retirés (→ « REAMENAGEMENT DU POSTE RORO 93-94 ») ; sinon `libelle_service` reçoit `libelle` tel quel. Modifiable ensuite via l'icône « Modifier » (§12) ; **jamais réécrit par un import suivant** — garanti côté backend en ne l'incluant jamais dans la charge de l'upsert, absent donc de la clause `ON CONFLICT ... DO UPDATE SET` générée par PostgREST (le trigger, lui, ne se déclenche qu'à l'insertion). Voir `20260904120000_operation_investissement_libelle_service.sql`. |
| Ajout (04/09/2026) | `mt_travaux` | `numeric not null default 0` — alimenté par `Montant travaux` (OP, col. 18, §2.1). Revient sur la décision du 03/09/2026 de ne pas le stocker (§14). |
| Ajout (04/09/2026) | `mt_fesi` | `numeric generated always as (mt_initial - mt_travaux) stored` — colonne **calculée par Postgres**, jamais écrite par l'import (impossible d'assigner explicitement une colonne générée), même mécanique que `finances.marche.utilisable`. Revient sur la décision du 03/09/2026 de ne pas le stocker (§14). |
| Ajout (04/09/2026) | `utilisable` | `boolean not null default true` — champ manuel, distinct d'`actif`, ajouté directement en base par l'utilisateur puis documenté par `20260904110000_operation_investissement_utilisable.sql` ; aucun second critère de calcul documenté (contrairement à `ACTIF`/`COMPLETUDE` → `UTILISABLE` sur `finances.marche`) — jamais alimenté ni réécrit par l'import (même mécanique que `libelle_service`), modifiable uniquement via l'icône « Modifier ». Revient sur la décision du 03/09/2026 de ne pas le stocker (§14). |

RLS proposée, sur le modèle de `commande_pgi` (`20260903090000_create_commande_pgi.sql`) :
- `select` : scopé service (`finances.current_user_id_service()`) + `ADMIN_APP` libre.
- `insert`/`update` (pas de `delete` — l'upsert ne supprime jamais) : réservés
  `ADMIN_APP`/`ADMIN_SERVICE`/`CB`, même traduction de `assertManagesServiceOrHasRoleCb`.

Catalogue du paramètre `last.import.investissement.pgi` à créer dans `finances.parametre_definition`,
même mécanique que les deux imports précédents.

**Champs des consignes délibérément non repris dans le schéma** (décision du 03/09/2026, §16,
simplification demandée par l'utilisateur par rapport à la liste littérale de `Consignes 2` — sauf
`MTTRAVAUX`/`MTFESI` et `UTILISABLE`, revenus dans le schéma le 04/09/2026, voir ci-dessus) :
- `LIBOPSERVICE` — présent dans la liste des consignes mais sans colonne source identifiée dans la
  feuille OP (aucune ligne de `Consignes 1` ne le mappe) ; probablement un intitulé alternatif
  (peut-être `Intitule Projet`, colonne 3, plutôt que `Intitule`, colonne 9) — non repris tant que
  la source n'est pas confirmée.

# 12. Page de consultation — `finances.operation_investissement` en lecture seule

`InvestissementsPGI.tsx` (montée `/investissements`), « État des investissements PGI du service »
dans la sidebar — lecture ouverte à tout utilisateur authentifié pour son propre service
(`ADMIN_APP` libre du service consulté), la table n'étant alimentée que par l'import (les champs
manuels `libelle_service`/`actif`/`utilisable` en sont l'exception, §11).

Représentation en **cartes** (maquette utilisateur du 04/09/2026, pas un tableau comme
`CommandesPGI.tsx`) : filtre Direction → Service + recherche texte (numéro d'opération/libellé)
sur la ligne principale, compteur « X sélectionnées sur Y » + modale de filtre (Statut
Activée/Future/Toutes sur A/F, Utilisable et Actif en Oui/Non/Tous) / « Supprimer les filtres ».
Chaque carte affiche le statut PGI, le numéro d'opération, `LIBELLE_SERVICE` (repli sur `LIBELLE`),
un point Actif et un point Utilisable, les montants Travaux/FESI, un mini-tableau des 4 montants
disponibles (AP.1/AP.8/CP.1/CP.8), et une rangée d'actions :
- **Visualiser** (icône œil, ouverte à tous) : détail complet en lecture seule, y compris les 4
  sous-montants (Budget/Engagement/Réel/Disponible) des 4 tranches.
- **Modifier** (icône crayon, réservée ADMIN_APP/ADMIN_SERVICE/CB) : seul point d'édition de
  `libelle_service`/`actif`/`utilisable` (§11), via `PUT /api/investissements/:numeroOperation`.
- **Visualiser les pièces** (icône dossier, ouverte à tous) / **Ajouter une pièce** (icône nuage,
  réservée ADMIN_APP/ADMIN_SERVICE/CB) : système de pièces jointes complet, même modèle que
  `MarchesPGI.tsx`/`finances.marche_piece`, simplifié (pas de dualité SERVICE/TIERS — clé simple
  `numero_operation`). Table `finances.investissement_piece` (`type_piece` — 16 valeurs fixes :
  rapports/décisions CODIR, Directoire, CS, fiche d'ouverture HO, projet technique, autre —
  `numero_reevaluation` entier ≥ 0, équivalent du `numero_avenant` d'un marché mais rattaché à une
  campagne de réévaluation budgétaire plutôt qu'à un avenant), bucket Storage privé
  `investissement-pieces` (PDF uniquement, 10 Mo max), RLS scopée service +
  `assertManagesServiceOrHasRoleCb` pour l'écriture — voir `20260904130000_create_investissement_
  piece.sql`. `PiecesInvestissementModal.tsx` (liste/édition/suppression/téléchargement) et
  `AddPieceInvestissementModal.tsx` (dépôt) ouverts depuis les icônes de la carte.

# 13. Fichiers (construits)

Backend : `repositories/investissement.repository.ts` (`findAll`, `findByNumeroOperation`,
`upsertMany`, `updateManagedFields` — pas de `deleteByService`/`insertMany` comme `commande_pgi`,
upsert par `numero_operation`, jamais de suppression), `services/investissementImport.service.ts`
(parsing des 3 feuilles, décodage de clé §3, jointure §4), `controllers/investissementImport.
controller.ts`, `routes/investissementImport.routes.ts` (montée `/api/investissements/import`),
`services/investissement.service.ts` (dont `updateManagedFields`, §6/§11), `controllers/
investissement.controller.ts`, `routes/investissement.routes.ts` (montée `/api/investissements`,
`PUT /:numeroOperation` pour la modification manuelle), extension de `services/parametres.
service.ts` (`PARAMETRE_SCHEMAS['last.import.investissement.pgi']`) ; pièces jointes (§12) :
`repositories/investissementPiece.repository.ts`, `services/investissementPiece.service.ts`,
`controllers/investissementPiece.controller.ts`, `routes/investissementPiece.routes.ts` (montée
`/api/investissements/pieces`). Tests : `test/investissementImport.service.test.ts`,
`test/investissement.service.test.ts`, `test/investissementPiece.service.test.ts`,
`test/investissementPiece.routes.test.ts` (73 tests au total sur le périmètre investissement).

Frontend : `hooks/useInvestissementImport.ts`, `hooks/useLastImportInvestissement.ts`,
`hooks/useInvestissementsPgi.ts`, `hooks/usePiecesInvestissement.ts`, `pages/
ImportInvestissements.tsx` (montée `/investissements/import`), `pages/InvestissementsPGI.tsx`
(montée `/investissements` — cartes avec icônes Visualiser/Modifier/Visualiser les
pièces/Ajouter une pièce, toutes actives, §12), `components/PiecesInvestissementModal.tsx`,
`components/AddPieceInvestissementModal.tsx` (réutilisent `FileDropzone.tsx`, dont les classes
`.gp-dropzone*` ont été déplacées de `styles/marche.css` vers `styles/gpmm.css` le 04/09/2026 pour
en faire un composant vraiment partagé entre pages, au même titre que `.gp-combobox`/`.gp-spin`),
`styles/investissement.css` (dont `.investissement-piece-row*`), section de navigation
« Investissements » (`config/navigation.ts`), câblée dans `AppShell.tsx`/`App.tsx`. 45 tests au
total sur le périmètre investissement (page + composants de pièces jointes dédiés).

Migrations, toutes exécutées par l'utilisateur (vérifié le 04/09/2026 par introspection en lecture
seule du schéma live) : `supabase/migrations/20260903110000_operation_investissement_import.sql`,
`20260904100000_operation_investissement_mt_travaux_fesi.sql`,
`20260904110000_operation_investissement_utilisable.sql`,
`20260904120000_operation_investissement_libelle_service.sql` et
`20260904130000_create_investissement_piece.sql` (table + bucket Storage `investissement-pieces`).

# 14. Décisions actées le 03/09/2026 (session de conception)

1. Migration de `finances.operation_investissement` : ajout de `id_service`, `code_cug`, `statut`
   (texte brut `A`/`F`) et `actif` (booléen, flag d'inactivation distinct de `statut`). Pas de
   colonne `mt_travaux`/`mt_fesi`.
2. Les 4 montants (Budget/Engagement/Réel/Disponible) sont conservés par tranche, remplaçant les 4
   colonnes uniques `mt_ap1`/`mt_ap8`/`mt_cp1`/`mt_cp8` du schéma initial par 16 colonnes détaillées,
   sur les 4 tranches AP.1, AP.8, CP.1 et CP.8 (correction du 03/09/2026 : les 4 tranches du schéma
   CDC initial sont bien toutes dans le périmètre — AP et CP chacune aux indices 1 **et** 8 — et non
   uniquement AP.1/CP.8 comme initialement compris à partir des deux seuls exemples donnés par les
   consignes).
3. Agrégation : sommation de toutes les lignes AP/CP partageant le même couple (numéro d'opération
   complet, indice).
4. Indices hors {1, 8} strictement hors périmètre — jamais lus, dans AP comme dans CP.
5. Pas de garde bloquante de fraîcheur du fichier (absence de date fiable) — bandeau informatif
   seul, risque de réimport d'un export périmé accepté.
6. Lignes AP/CP orphelines (numéro d'opération sans OP éligible correspondante) exclues
   silencieusement, comme les statuts non éligibles — pas d'anomalie signalée.
7. Correction : la clé unique d'une opération est la colonne `Code` de la feuille OP (pas
   `Numero operation`, purement numérique et sans rapport avec le format des clés AP/CP) — la
   jointure OP↔AP/CP en est fortement simplifiée (§4, plus de reconstitution via `Ctrl AP`).
8. Tentative avortée : `libelle` alimenté un temps par la colonne 10 « Description » plutôt que la
   colonne 9 « Intitule » — annulée le 03/09/2026, des valeurs vides ayant été constatées en
   colonne « Description » sur le fichier réel. `libelle` reste sourcé sur `Intitule` (§2.1).

**Ajout du 04/09/2026** : nouveau champ `libelle_service` (§11), libellé propre au service distinct
de `libelle` (PGI) — modifiable via l'icône « Modifier » des cartes (§6/§12), et **jamais réécrit
par un import suivant**, y compris si `libelle` change côté PGI. Implémentation : le backend
n'inclut jamais `libelle_service` dans la charge de l'upsert (`OperationInvestissementUpsert`,
`investissement.repository.ts`) — un trigger `BEFORE INSERT` (migration
`20260904120000_operation_investissement_libelle_service.sql`) calcule sa valeur à la création ;
absent de la charge à la mise à jour, il n'est jamais touché par la clause
`ON CONFLICT ... DO UPDATE SET` générée par PostgREST.

**Correction du 04/09/2026** : le champ s'appelle en réalité `libelle_service` (pas `lib_service`
comme initialement nommé le même jour) et sa règle de calcul par défaut est plus précise qu'un
simple report de `libelle` — voir §11 : si `libelle` commence par `numero_operation`, ce préfixe et
les séparateurs qui suivent sont retirés avant d'alimenter `libelle_service` (ex. « IN025393 -
REAMENAGEMENT DU POSTE RORO 93-94 » → « REAMENAGEMENT DU POSTE RORO 93-94 »), sinon `libelle` est
repris tel quel. La migration `lib_service` conçue initialement (`20260904090000_...`) n'a jamais
été exécutée en base et a été abandonnée au profit de `20260904120000_operation_investissement_
libelle_service.sql`.

**Ajout du 04/09/2026 (suite)** : retour sur la décision du 03/09/2026 de ne pas stocker
`MTTRAVAUX`/`MTFESI` (§11) — `mt_travaux` est désormais alimenté par `Montant travaux` (OP, col.
18, §2.1) comme `mt_initial` l'est par `Montant FC` ; `mt_fesi` (`mt_initial - mt_travaux`) est une
**colonne générée Postgres** (`generated always as ... stored`, même mécanique que
`finances.marche.utilisable`), jamais écrite par l'import — une colonne générée refuse toute
valeur explicite, à l'insertion comme à la mise à jour. Implémentation : `mt_fesi` exclu de
`OperationInvestissementUpsert` au même titre que `libelle_service` (`investissement.repository.ts`),
migration `20260904100000_operation_investissement_mt_travaux_fesi.sql`.

**Ajout du 04/09/2026 (suite) — `UTILISABLE`** : colonne ajoutée directement en base par
l'utilisateur (`boolean not null default true`), documentée a posteriori par la migration
`20260904110000_operation_investissement_utilisable.sql`. Même mécanique que `libelle_service` : champ
manuel, exclu de `OperationInvestissementUpsert`, jamais alimenté ni réécrit par l'import. Affiché
sur la carte par un second point à côté du point Actif, éditable via l'icône « Modifier ».

**Correction du 04/09/2026 — `ACTIF` devient manuel** : revient sur la conception initiale du
03/09/2026 (§6), où l'import pilotait entièrement `ACTIF` (`true` sur les opérations éligibles,
`false` sur celles qui en sortaient via `deactivateExcept`). Depuis que `ACTIF` est devenu
éditable dans la modale « Modifier » (aux côtés de `LIBELLE_SERVICE`/`UTILISABLE`), le maintenir
piloté par l'import aurait rendu toute modification manuelle transitoire (écrasée au prochain
import pour toute opération encore éligible) — décision utilisateur : `ACTIF` rejoint
`LIBELLE_SERVICE`/`UTILISABLE` comme champ purement manuel, prend le défaut de colonne (`true`) à la
création, n'est plus jamais inclus dans la charge de l'upsert. Conséquence : le mécanisme
d'inactivation automatique disparaît entièrement (`investissementRepository.
findActiveNumerosByService`/`deactivateExcept` supprimés, `ImportReport.nbInactivees` retiré du
compte-rendu) — une opération qui sort du lot éligible reste désormais inchangée en base tant
qu'un humain ne la modifie pas explicitement.

# 15. Point de vigilance CDC

`ForClaude/CDC/mcd-phases-1-2.md` (§ Cœur métier) documente déjà l'association
`DEMANDE_ACHAT (0,1) — imputée sur — (0,1) OPERATION_INVESTISSEMENT` : une FAD en INVESTISSEMENT
référence un `NUMERO_OPERATION`. Cet import alimente exactement le référentiel que cette FK est
censée cibler — aucune incohérence de modèle, mais **le CDC n'anticipait pas** que la table gagne
`id_service`/`code_cug`/`actif` ni que ses 4 colonnes de montants soient remplacées par 8 : à
répercuter dans le MCD/MLD si cette migration est validée (comme cela a été fait le 30/08/2026 pour
`ETATMARCHE` → `ACTIF`/`UTILISABLE`, cf. historique de `mct-phases-1-2.md`).

# 16. Points restants à confirmer avant implémentation

1. **`LIBOPSERVICE`** (§11) : colonne source réelle dans la feuille OP ? Non repris tant que non
   clarifié.
2. **`date_creation`** (§11) : colonne existante sur la table, absente du mapping des consignes —
   confirmé qu'elle reste hors périmètre de cet import (jamais écrite) ?

Tranchés le 03/09/2026 : garde de fraîcheur du fichier → bandeau informatif seul, pas de blocage
(§1/§7.1) ; lignes AP/CP orphelines → exclusion silencieuse, pas d'anomalie (§4/§8).

Tranché le 04/09/2026 : `UTILISABLE` finalement repris dans le schéma (§11) — champ manuel sans
second critère de calcul, sur le même principe que `LIBELLE_SERVICE`.
