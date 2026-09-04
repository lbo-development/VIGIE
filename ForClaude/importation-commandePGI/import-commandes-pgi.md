# Spécification fonctionnelle — Import des commandes depuis le PGI (fichier Excel)

> **Statut** : construit (03/09/2026) — upload drag & drop, validation, aperçu bloquant,
> confirmation, intégration réelle et page de consultation sont implémentés et testés (backend
> 28 tests, frontend 17 tests). Fonctionnalité non prévue au CDC initial (ajout demandé par
> l'utilisateur). Deux migrations restent à exécuter par l'utilisateur avant mise en production,
> dans l'ordre :
> `supabase/migrations/20260903090000_create_commande_pgi.sql` (table `finances.commande_pgi`,
> catalogue du paramètre `last.import.commande.pgi`) puis
> `supabase/migrations/20260903100000_commande_pgi_marche_hors_marche.sql` (colonne `marche`
> rendue `NOT NULL`, défaut `'HM'` — voir §3).
> Rédigé à partir de l'inspection technique directe des fichiers réels de ce répertoire
> (`Modele importation marchés PGI.xlsx` — nommage trompeur, il s'agit bien du modèle
> **commandes** — et `consignes importation commandes PGI.xlsx`) et des décisions actées avec
> l'utilisateur le 03/09/2026.

# 1. Objectif

Importer dans `finances.commande_pgi` le contenu d'un export PGI au format Excel (modèle :
`Modele importation marchés PGI.xlsx`, consignes : `consignes importation commandes PGI.xlsx`),
pour disposer, par commande, des montants engagés/liquidés utiles au suivi budgétaire — en
réutilisant la logique déjà validée pour l'import des marchés
(`ForClaude/Importation-marches/import-marches-pgi.md`) : structure de fichier vérifiée
cellule par cellule, flux preview/confirm en deux temps, paramètre applicatif de verrouillage
par service.

**Point de vigilance CDC** (signalé le 03/09/2026) : `ForClaude/CDC/mot-phases-1-2.md` (OP1.6)
décrit déjà une notion de « commande » — `DEMANDE_ACHAT.MONTANT_COMMANDE` et le statut
`FAD_COMMANDEE`, saisis manuellement par la CB une fois la commande passée dans le PGI. C'est un
concept **distinct** de celui-ci : `finances.commande_pgi` est un import en masse du référentiel
des commandes PGI pour le suivi budgétaire, pas la saisie individuelle liée au cycle de vie d'une
FAD. Aucun conflit de schéma ; un rapprochement futur (relier une FAD à sa ligne `commande_pgi`
via NUMCMD) est envisageable mais n'a pas été demandé ni construit.

# 2. Structure réelle du fichier (vérifiée)

Une seule feuille. Coordonnées vérifiées par inspection directe (`exceljs`) du fichier modèle :

| Cellule | Contenu (fichier modèle) |
|---|---|
| A3 (mergée A3:AL3) | `Liste des lignes de commandes par ligne budgétaire` |
| Z1 | `Edité le ` |
| AA1 | `: 23/07/2026` — les 10 derniers caractères forment la date de génération du fichier, format `JJ/MM/AAAA` (à la différence de l'import marchés, qui utilise `JJ-MM-AAAA` en D1) |
| A13:AL13 | ligne d'en-têtes des 38 colonnes, voir §3 |
| A14+ | lignes de données, une par ligne de commande PGI — s'arrête à la première ligne sans valeur en colonne G (Commande) |

Contrairement à l'import marchés (A1 = raison sociale de l'organisme), la cellule A1 du fichier
commandes ne porte pas un texte unique mais trois cellules distinctes (A1/B1/C1 = "Grand "/"Port
Maritime de"/"Marseille") — **non utilisée par l'import**, aucun contrôle dessus (même principe
que la cellule "Activité" de l'import marchés, écartée le 29/08/2026).

# 3. Colonnes du fichier (ligne d'en-têtes A13:AL13, vérifiées)

38 colonnes au total. Seules 11 sont mappées vers `finances.commande_pgi` — décision du
03/09/2026 : les 27 autres ne servent qu'à valider/filtrer les lignes à l'import, jamais
stockées.

| Col. | En-tête (fichier) | Champ `finances.commande_pgi` | Usage |
|---|---|---|---|
| E | CUG Emetteur | `code_cug` | stocké + contrôle service (§7) |
| F | Acheteur | `acheteur` | stocké |
| G | Commande | `numcmd` | stocké, **clé unique** (§5) |
| N | Date de commande | `dtecmd` | stocké (ligne représentative, §5) |
| T | Compte Budgétaire | `compte_budgetaire` | stocké (ligne représentative, §5) |
| W | Catégorie Opération | `catop` | stocké (ligne représentative, §5) |
| Y | Fournisseur | `libfournisseur` | stocké (ligne représentative, §5) |
| Z | Marché | `marche` | stocké, **texte libre sans FK** vers `finances.marche` (décision explicite : pas de dépendance d'ordre entre les deux imports) ; vide → `HM` (Hors Marché), voir correction du 03/09/2026 ci-dessous |
| AD | Montant HT actuel | `mtactuel` | stocké, **cumulé** (§5) |
| AG | Engagé commande | `mtengage` | stocké, **cumulé** (§5) |
| AH | Total Liquidé HT | `mtliquide` | stocké, **cumulé** (§5) |

Colonnes utilisées uniquement pour filtrer (jamais stockées) :

| Col. | En-tête (fichier) | Usage |
|---|---|---|
| J | Commande Annulée  ? | doit valoir `N` (exclusion silencieuse sinon, §8) |
| K | Ligne Annulée ? | doit valoir `N` (exclusion silencieuse sinon, §8) |
| L | Libellé | ne doit pas contenir FACTURER/ESTIMATION/REVISION en majuscules (exclusion silencieuse sinon, §8) |

Les 24 colonnes restantes (Exercice Budgétaire, Direction, Département, Activité, Report,
Qualification, Statut d'approbation, Date GL, Demande d'achat, Date DA, CUG Destinataire,
Compte, CPV, Sous-opération, Quantité commandée, Prix Unitaire, Montant HT Initial, Quantité
recue, Quantité facturée, Dont CHAP, Dont CHAP Liquidée, Surfacturation De CHAP, CHAP annulées)
ne sont ni contrôlées ni stockées.

**Normalisation** : le fichier PGI utilise parfois la valeur numérique `0` comme marqueur
« vide » sur les colonnes texte (observé sur Catégorie Opération et Marché) — traité comme
absence de valeur à l'import, jamais comme la chaîne `"0"`.

**Correction du 03/09/2026 — Marché vide → `HM`** : contrairement à Catégorie Opération (vide →
`null`), une colonne Marché vide (ou `0`) est remplacée par la valeur `HM` (Hors Marché) —
décision utilisateur, `finances.commande_pgi.marche` est donc `NOT NULL` (migration
`20260903100000_commande_pgi_marche_hors_marche.sql`, backfill des lignes déjà en base + défaut
`'HM'`). Implémentation : `commandePgiImport.service.ts#MARCHE_HORS_MARCHE`.

# 4. NUMCMD n'est pas une clé unique dans le fichier PGI — agrégation par commande

**Découverte du 03/09/2026, décisive pour la conception** : contrairement à `NUMMARCHE` (clé
naturelle unique dans l'export marchés), le couple (Commande, Ligne de commande) **n'est pas
unique** dans l'export commandes réel — 37 couples sur 938 lignes apparaissent en plusieurs
exemplaires avec des quantités/montants différents (ex. commande `930088` ligne `1` en deux
exemplaires, quantités reçues 3 puis 22), sans qu'aucune autre colonne ne les distingue.
Vérifié par ailleurs sur ce même fichier : Fournisseur, CUG, Marché, Acheteur, Catégorie
Opération et Date de commande ne varient **jamais** entre les lignes d'une même Commande — seul
le Compte Budgétaire diverge, et seulement sur 4 commandes sur 150 multi-lignes (ex. une ligne
« Location trimestrielle » sur le compte 613, une ligne « Forfait maintenance » sur le compte
615, pour la même commande).

**Décision de l'utilisateur (03/09/2026)** : le numéro de commande (`NUMCMD`, colonne G) devient
la clé unique de `finances.commande_pgi`. Pour chaque commande, les lignes valides (après
filtrage, §8, et contrôle CUG, §7) sont agrégées :
- `mtactuel`, `mtengage`, `mtliquide` : **sommés** sur toutes les lignes valides de la commande.
- Les 8 autres champs stockés (§3) : pris sur la ligne dont `Montant HT actuel` (avant somme)
  est le **plus élevé** — règle donnée par l'utilisateur pour le cas vérifié du Compte
  Budgétaire divergent, généralisée ici à l'ensemble des champs non cumulés par cohérence
  (aucun autre champ ne variant en pratique, cf. ci-dessus).

Implémentation : `backend/src/services/commandePgiImport.service.ts#groupByNumcmd`.

# 5. Acteur et service cible

**ADMIN_APP** (transverse), **ADMIN_SERVICE** et **CB** (Contrôle Budgétaire), scopés à leur
propre service — même triplet que l'import marchés
(`assertManagesServiceOrHasRoleCb`, `backend/src/services/authorization.service.ts`, réutilisée
telle quelle, aucune modification). Filtre Direction → Service identique à `ImportMarches.tsx`
(comboboxes toujours affichées, réduites au service propre pour ADMIN_SERVICE/CB).

# 6. Étape d'intégration — « annule et remplace », pas de diff créer/archiver

**Différence majeure avec l'import marchés**, décision de l'utilisateur (03/09/2026) : chaque
confirmation d'import est un remplacement complet des commandes du service cible — pas de
distinction créer/modifier/archiver ligne à ligne (impossible ici : `NUMCMD` n'a de sens que
pour le fichier qui vient d'être importé, cf. §4 — l'absence d'une commande dans un nouveau
fichier ne signifie pas nécessairement qu'elle doit être « archivée », elle peut simplement être
sortie du périmètre budgétaire de l'extraction).

Séquence (`backend/src/services/commandePgiImport.service.ts`) :
1. **Validation** (étapes 1 et 2 ci-dessous, §7/§8) — identique en `preview()` et `confirm()`.
2. **Agrégation** par NUMCMD (§4).
3. **Aperçu (bloquant)** — `POST /api/commandes/import/preview`, aucune écriture en base :
   présente la liste des commandes qui seront intégrées (numéro, fournisseur, engagé, liquidé),
   le nombre de lignes exclues (§8) et les anomalies (§7). L'utilisateur doit cliquer sur
   « Confirmer l'import » pour poursuivre.
4. **Intégration réelle** (seulement après confirmation) — `POST /api/commandes/import/confirm`,
   revalide tout depuis zéro (même fichier ré-envoyé par le frontend, aucun état serveur entre
   les deux appels, protège contre un changement d'état pendant que l'utilisateur regardait
   l'aperçu) puis :
   - `commandePgiRepository.deleteByService(idService)` — supprime toutes les lignes déjà en
     base pour ce service.
   - `commandePgiRepository.insertMany(...)` — réinsère les commandes agrégées du fichier.
   - Met à jour `last.import.commande.pgi` avec la date de génération du fichier (§7) pour ce
     service.
5. **Compte-rendu final** — à l'écran et téléchargeable (généré côté client), même principe que
   l'import marchés.

# 7. Étape 2 — vérification de l'éligibilité

1. **Paramètre applicatif `last.import.commande.pgi`**
   (`finances.parametre_application`, voir `docs/ARCHITECTURE.md` « Paramétrage applicatif »),
   même mécanique que `last.import.marche.pgi` :
   - Portée **par service** — une ligne par service ayant déjà importé.
   - La ligne doit déjà exister pour ce service avant son tout premier import — création
     manuelle préalable par `ADMIN_APP` (écran Réglages), sinon **erreur bloquante**
     (`Paramètre "last.import.commande.pgi" non initialisé.`).
   - La date de génération du fichier (AA1, §2) doit être **≥** à la valeur du paramètre pour ce
     service, sinon **erreur bloquante** — un fichier plus ancien que la dernière importation
     enregistrée ne peut jamais être importé (règle confirmée le 03/09/2026, déjà active et
     testée : `commandePgiImport.service.test.ts`, cas « rejette si le fichier est antérieur à
     la dernière importation »).
   - Valeur vide (`null`) = aucune borne (première importation).
2. **CUG Emetteur — vérification PAR LIGNE** (colonne E) : pour chaque ligne du fichier, le CUG
   doit être affecté au service cible de l'import (`finances.cug`), sinon **anomalie signalée**
   dans le compte-rendu, ligne exclue du regroupement. Contrairement au filtrage du §8, ce
   contrôle n'est pas silencieux.

# 8. Filtrage des lignes — exclusion silencieuse

Décision du 03/09/2026 : une ligne est exclue du regroupement (§4) **sans apparaître dans les
anomalies** du compte-rendu si l'une des conditions suivantes est vraie :
- `Commande Annulée ?` (colonne J) ≠ `N`.
- `Ligne Annulée ?` (colonne K) ≠ `N`.
- `Libellé` (colonne L), comparé en majuscules, contient `FACTURER`, `ESTIMATION` ou `REVISION`.

Seul le **nombre total** de lignes exclues est affiché (`nbExclues`), pas le détail ligne par
ligne — même logique que l'exclusion silencieuse sur la date de fin des marchés (30/08/2026,
export réel contenant en pratique un grand nombre de lignes de ce type, dont le signalement
systématique n'apporterait rien à l'utilisateur).

# 9. Étape 1 — vérification structurelle du fichier

Contrôles bloquants (arrêt du processus + message d'erreur si l'un échoue) :

1. **A3** = `Liste des lignes de commandes par ligne budgétaire` (cellule mergée A3:AL3).
2. **Z1** = `Edité le` (après normalisation des espaces insécables U+00A0, typographie PGI).
3. **AA1** : les 10 derniers caractères doivent former une date au format `JJ/MM/AAAA` — cette
   date est la date de génération du fichier, utilisée par le contrôle d'éligibilité (§7) et
   stampée sur chaque ligne insérée (`dtelastimport`).
4. **A13:AL13** strictement identique (38 cellules, valeur exacte) au fichier de référence — voir
   `REFERENCE_HEADERS` dans `commandePgiImport.service.ts`.

# 10. En-tête de la page d'import — rappel de la dernière importation

Décision du 03/09/2026, alignée sur `MarchesPGI.tsx` (bandeau « État des marchés au [date] ») :
sous le titre de `ImportCommandes.tsx` (comme de `ImportMarches.tsx`), une fois un service
sélectionné :
- Paramètre non initialisé pour ce service → message d'alerte dédié (texte exact du §7).
- Sinon, si une date d'import existe → `Dernière importation le JJ/MM/AAAA` ; sinon →
  `Dernière importation — aucun import effectué`.
- **Alerte de rappel** « Pensez à importer les commandes récentes » si la dernière importation
  date de **15 jours ou plus** (`IMPORT_STALE_JOURS`, même seuil que l'import marchés) ou si
  aucun import n'a encore été effectué.

Ce bandeau est un rappel visuel uniquement — il ne bloque rien (le blocage réel est le contrôle
du §7, appliqué à la validation du fichier déposé).

# 11. Table cible — `finances.commande_pgi`

Voir migrations `supabase/migrations/20260903090000_create_commande_pgi.sql` et
`20260903100000_commande_pgi_marche_hors_marche.sql` pour le détail complet (RLS scopée service,
paramètre applicatif). Colonnes : `numcmd` (PK, texte), `code_cug`, `id_service` (stampé depuis
le service cible de l'import, pas dérivé du CUG — même choix que
`finances.marche_piece`/`marche_tiers`), `acheteur`, `dtecmd`, `compte_budgetaire` (nullable),
`catop` (nullable), `libfournisseur`, `marche` (**`NOT NULL`, défaut `'HM'`** — voir §3),
`mtactuel`/`mtengage`/`mtliquide` (numeric), `dtelastimport`, `created_at`/`updated_at`.

# 12. Page de consultation — `finances.commande_pgi` en lecture seule

Décision du 03/09/2026 : nouvelle page **CommandesPGI.tsx** (montée `/commandes`), « État des
commandes PGI du service » dans la sidebar — sur le modèle de `Fournisseurs.tsx` pour la
structure (filtre Direction → Service en cascade, tous deux obligatoires pour afficher la liste,
recherche texte libre sur commande/fournisseur/marché), mais en **lecture seule** : aucune
création/modification/suppression manuelle, la table n'est alimentée que par l'import (§6).

Lecture ouverte à tout utilisateur authentifié pour son propre service (ADMIN_APP libre du
service consulté) — même périmètre que « États des marchés du service »
(`marche.service.ts#resolveReadScope`), pas le modèle plus restreint de l'import (§5). Backend :
`commandePgi.repository.ts#findAll` (ajouté à `deleteByService`/`insertMany`),
`commandePgi.service.ts#listCommandesPgi`, `commandePgi.controller.ts`, `commandePgi.routes.ts`
(montée `/api/commandes`, avant `/api/commandes/import` dans `routes/index.ts` — même ordre que
`/marches`/`/marches/import`).

# 13. Fichiers

Backend : `repositories/commandePgi.repository.ts` (`findAll` pour la consultation §12 ;
`deleteByService`, `insertMany` pour l'import — pas d'`update`/`archiveMany`, l'« annule et
remplace » ne nécessite aucune lecture de l'existant), `services/commandePgiImport.service.ts`,
`controllers/commandePgiImport.controller.ts`, `routes/commandePgiImport.routes.ts` (montée
`/api/commandes/import`), `services/commandePgi.service.ts`, `controllers/commandePgi.controller.ts`,
`routes/commandePgi.routes.ts` (montée `/api/commandes`), `services/parametres.service.ts`
(`PARAMETRE_SCHEMAS['last.import.commande.pgi']`). Tests : `test/commandePgiImport.service.test.ts`
(25 cas), `test/commandePgi.service.test.ts` (5 cas).

Frontend : `hooks/useCommandePgiImport.ts`, `hooks/useLastImportCommandePgi.ts`,
`hooks/useCommandesPgi.ts`, `pages/ImportCommandes.tsx` (montée `/commandes/import`),
`pages/CommandesPGI.tsx` (montée `/commandes`), section de navigation « Commandes »
(`config/navigation.ts` — `COMMANDES_SIDEBAR_ITEMS` : « État des commandes PGI du service »
toujours visible, « Importation commandes PGI » réservée ADMIN_APP/ADMIN_SERVICE/CB via
`filterCommandesSidebarItems`), câblée dans `AppShell.tsx` et `App.tsx`. Tests :
`pages/ImportCommandes.test.tsx` (14 cas), `pages/CommandesPGI.test.tsx` (6 cas),
`config/navigation.test.ts` étendu.

# 14. Historique

- 03/09/2026 (conception) : analyse du fichier réel (938 lignes), découverte de la non-unicité
  de (Commande, Ligne de commande) — décisions actées avec l'utilisateur : NUMCMD clé unique par
  agrégation (montants sommés, autres champs sur la ligne au montant le plus élevé), seules les
  11 colonnes nommées dans les consignes stockées, import « annule et remplace » par service,
  exclusions silencieuses (annulé/estimation-révision), anomalie CUG signalée, colonne Marché en
  texte libre sans FK, aperçu bloquant, rôles ADMIN_APP/ADMIN_SERVICE/CB. Construction complète
  backend + frontend le même jour (23 + 11 tests).
- 03/09/2026 (en-tête des pages d'import) : ajout du bandeau « Dernière importation le [date] »
  et de l'alerte de rappel à 15 jours sur `ImportMarches.tsx` et `ImportCommandes.tsx` (les deux
  pages n'affichaient jusque-là qu'un simple libellé à côté du sélecteur de service) — mêmes
  conditions d'alerte que le bandeau déjà existant sur `MarchesPGI.tsx`.
- 03/09/2026 (confirmation) : la règle de blocage d'un fichier antérieur à la dernière
  importation enregistrée (§7) était déjà active et testée dès la construction initiale —
  confirmé auprès de l'utilisateur après une question de clarification.
- 03/09/2026 (page de consultation, §12) : nouvelle page `CommandesPGI.tsx` (« État des
  commandes PGI du service »), lecture seule, sur le modèle de `Fournisseurs.tsx` — nouveau
  `commandePgi.service.ts#listCommandesPgi` (lecture ouverte à tout utilisateur pour son propre
  service, ADMIN_APP libre), `commandePgi.repository.ts#findAll`. L'onglet d'en-tête
  « Commandes » pointe désormais vers `/commandes` (comme « Marchés » vers `/marches`), plus
  directement vers `/commandes/import`.
- 03/09/2026 (correction Marché vide → `HM`, §3) : décision utilisateur, une colonne Marché vide
  (ou `0`) est désormais remplacée par `HM` (Hors Marché) au lieu de `null` —
  `commandePgiImport.service.ts#MARCHE_HORS_MARCHE`. Colonne `finances.commande_pgi.marche`
  passée `NOT NULL` avec défaut `'HM'` (migration
  `20260903100000_commande_pgi_marche_hors_marche.sql`, backfill des lignes déjà en base).
  Répercuté côté frontend (`useCommandesPgi.ts`/`CommandesPGI.tsx` : `marche` n'est plus
  nullable, affiché tel quel sans repli `—`).
