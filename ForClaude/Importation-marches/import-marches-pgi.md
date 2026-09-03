# Spécification fonctionnelle — Import du référentiel MARCHE depuis le PGI (fichier Excel)

> **Statut** : construit (30/08/2026) — upload drag & drop, validation, aperçu bloquant,
> confirmation et intégration réelle sont implémentés et testés (backend 21 tests,
> frontend 8 tests). Une nouvelle migration reste à exécuter par l'utilisateur avant mise en
> production : `supabase/migrations/20260830120000_marche_import_prerequisites.sql`
> (`DTELASTIMPORT`, catalogue `last.import.marche.pgi`, `FOURNISSEUR.SIREN` nullable pour
> `TYPE_CREATION='PGI'`) — en plus des deux déjà confirmées exécutées
> (`20260829180000_marche_planpreventionactif_to_text.sql`,
> `20260830090000_marche_actif_completude_utilisable.sql`). Répercussions encore en attente :
> MOT (tâche dédiée à formaliser), MCT/MCD (`UTILISABLE`, renommage `ETATMARCHE → ACTIF`,
> divergence OP3.1 sur la confirmation — voir §5).
> Rédigé à partir de `ForClaude/Importation-marches/import.txt` (description utilisateur) et
> de l'inspection technique du fichier réel `Modele importation marchés PGI.xlsx` (structure
> XML, voir §2 — les coordonnées de cellules citées ici sont vérifiées, pas supposées).

# 1. Objectif

Importer dans `finances.marche` le contenu d'un export PGI au format Excel (modèle :
`ForClaude/Importation-marches/Modele importation marchés PGI.xlsx`), en réutilisant
**telle quelle** la logique déjà validée pour les imports de référentiels PGI (**OP3.1** du
MCT, `ForClaude/CDC/mct-phases-1-2.md` l.120-130) — décision actée le 29/08/2026 (§5).

# 2. Structure réelle du fichier (vérifiée)

Le fichier ne contient qu'**une seule feuille**. Coordonnées de cellules vérifiées par
inspection du XML interne (`xl/worksheets/sheet1.xml`, `xl/sharedStrings.xml`) :

| Cellule | Contenu (fichier modèle) |
|---|---|
| A1 | `Grand Port Maritime de Marseille` |
| D1 | `Edité le : 10-08-2026` (préfixe fixe + date `JJ-MM-AAAA`) |
| A3 | `Récapitulatif d'un marché` |
| A4 | `Récapitulatif des paramètres` (titre de section) |
| A5 | `Exercice : ` *(valeur vide dans le modèle)* |
| A6 | `Numéro de Marché : ` *(valeur vide)* |
| A7 | `Activité : SV` *(label + valeur dans la **même cellule**)* |
| A8 | `CUG : ` *(valeur vide)* |
| A9 | `Nom de Fournisseur : ` *(valeur vide)* |
| A10 | `Détail des Commandes : Non` |
| A11 | *(vide, ligne séparatrice)* |
| **A12:M12** | **ligne d'en-têtes des colonnes**, voir tableau §3 |
| A13+ | lignes de données (une par marché) |

**`Activité : SV` (A7) n'est pas utilisée par l'import** — décision du 29/08/2026 : le
service cible vient exclusivement du rôle de l'acteur qui importe (ADMIN_SERVICE, §4), sans
croisement avec cette cellule (le garde-fou envisagé un temps a été explicitement écarté,
plus simple à ne pas construire).

# 3. Colonnes du fichier (ligne d'en-têtes A12:M12, vérifiées et actées)

| Col. | En-tête (fichier) | Exemple (ligne 13) | Champ `finances.marche` |
|---|---|---|---|
| A | Numéro de marché | `M0909311` | `NUMMARCHE` (clé) |
| B | Libellé de marché | `NETTOYAGE DES INSTALLATIONS...` | `LIBPGI` |
| C | Nom du Fournisseur | `NAID` | `TITULAIRE` |
| D | Numéro du fournisseur | `301791` | `NUM_TITULAIRE` (cf. OP3.1, « variante import marchés ») |
| E | CUG responsable | `268` | `CODE_CUG` (FK vers `CUG`) — **par ligne**, voir §7 |
| F | Description du CUG Responsable | `DSER - SV - EXPLOITATION` | **ignorée à l'import** (doublon lisible de `CUG.LIBELLE_CUG`, aucun contrôle de cohérence) |
| G | Date de début | *(date Excel)* | `DTEDEBUT` |
| H | Date de fin | *(date Excel)* | `DTEFINMAX` |
| I | Date de notification | *(date Excel)* | `DTENOTIF` |
| J | Date de validation | *(date Excel)* | `DTEVALID` |
| K | Montant validé du marché | `144479.13` | `MTMAXI` |
| L | Cumul des engagements | `0` | `LASTMTENGAGE` |
| M | Réalisé | `57704.18` | `LASTMTREALISE` |

## Champs de `finances.marche` absents du fichier — valorisation actée (29/08/2026)

**Précision du 29/08/2026, décisive pour la modification (marché déjà existant, même
`NUMMARCHE`) : seuls les champs ayant une correspondance directe avec une colonne du fichier
(le tableau ci-dessus, A à M) sont réécrits. Tous les champs de la table ci-dessous (à
l'exception de `DTELASTIMPORT` et `ACTIF`, voir leurs notes) ne reçoivent leur valeur qu'à la
CRÉATION — une réimportation ultérieure ne les touche plus jamais**, même si l'utilisateur
les a modifiés manuellement entre-temps (sinon un import récurrent écraserait silencieusement
une saisie manuelle, ex. `MTMINI` renseigné à la main reviendrait à `0` au prochain import :
inacceptable). `ACTIF` fait exception au sens strict (il est bien réécrit à chaque import,
cf. OP3.1) mais ne provient pas non plus d'une colonne du fichier — sa réécriture est pilotée
par la présence/absence du `NUMMARCHE` dans le fichier, pas par une valeur qu'il contiendrait.
`COMPLETUDE` fait aussi exception, mais dans l'autre sens : ce n'est pas l'import qui la
réécrit, c'est un recalcul applicatif continu (voir sa note) — non lié aux imports.

**Décision du 30/08/2026 : `ETATMARCHE` (texte) est remplacé par `ACTIF` (booléen)**, aligné
sur le reste du référentiel organisationnel (`DIRECTION`/`SERVICE`/`CELLULE`/`SITE`/
`SECTEUR`/`CUG` sont déjà des booléens `ACTIF` — seul `FOURNISSEUR.ETATFOURNISSEUR` reste en
texte `'Actif'|'Inactif'`, décision historique propre à cette table, non remise en cause ici).
**⚠️ `ETATMARCHE` est également mentionné dans OP3.1 et le contrôle croisé MCD du MCT
(`ForClaude/CDC/mct-phases-1-2.md`) — ce renommage doit y être répercuté, pas fait à ce
stade (hors périmètre de cette mise à jour).**

| Champ | Valeur à la création | Comportement à la modification | Note |
|---|---|---|---|
| `ACTIF` *(remplace `ETATMARCHE`, 30/08/2026)* | `TRUE` | **Réécrit, sous condition** : `FALSE` si le marché est `TYPE_CREATION = PGI` **et** absent du fichier pour ce service (archivage) ; **inchangé** sinon — en particulier, un marché créé manuellement (`TYPE_CREATION` ≠ `PGI`, voir note ci-dessous) n'est **jamais** désactivé par un import qui ne le contient pas | Précision du 30/08/2026, raffine la règle générale d'archivage d'OP3.1 |
| `COMPLETUDE` *(nouveau champ, 30/08/2026)* | `FALSE` | **Recalculée automatiquement par l'application** (pas par l'import) : passe à `TRUE` dès que `TYPEDECOMPOPRIX`, `NATUREPRESTA`, `AGENTGESTION`, `TITULAIRE_SERVICE`, `PLANPREVENTIONACTIF`, `ALERTEMT` et `ALERTEDATE` sont tous non `NULL` | **`MTMINI` volontairement exclu de ce calcul** — son défaut est `0`, pas `NULL` (§3), donc impossible de distinguer « laissé à 0 intentionnellement » de « jamais renseigné » ; recommandation de rédaction, à confirmer avant implémentation |
| `UTILISABLE` *(nouveau champ calculé, 30/08/2026)* | *(calculé)* | **Colonne générée Postgres** (`GENERATED ALWAYS AS (actif AND completude) STORED`) — jamais écrite directement, ni par l'import ni par l'application, toujours synchronisée avec `ACTIF`/`COMPLETUDE` | **Seuls les marchés `UTILISABLE = TRUE` seront proposés à la création d'une demande d'achat** (OP1.1) — règle qui touche aussi le MCT (OP1.1) et le MCD (association DEMANDE_ACHAT — s'appuie sur — MARCHE), **à répercuter séparément, hors périmètre de cette mise à jour** |
| `TYPE_CREATION` | `PGI` | **Jamais réécrit** | Marque l'origine de la fiche, figée après création. **Une création manuelle de marché est prévue** (30/08/2026, écran pas encore construit) — utilisera l'une des deux autres valeurs déjà autorisées par la contrainte réelle. **Correction du 30/08/2026** : la contrainte `CHECK marche_type_creation_check`, préexistante sur la table physique, n'autorisait que `'SERVICE'`/`'AUTRE'` — jamais `'PGI'` — ce qui faisait échouer toute création (violation de contrainte). Étendue par migration pour ajouter `'PGI'` (voir note technique ci-dessous) |
| `TYPEPROC` | Dérivé de `NUMMARCHE` : préfixe `P` → `MAPA`, préfixe `M` ou `S` → `MARCHE` | **Recalculé, sans effet pratique** (`NUMMARCHE` ne change jamais pour un marché donné, donc le résultat est identique) | Règle calculée, pas une constante ; le fichier modèle ne contient que des numéros préfixés `P`/`M`/`S` (voir ligne 631, `S2109325`) — tout autre préfixe est une anomalie (ligne exclue de l'intégration, pas un blocage global) |
| `LIBELLE_SERVICE` *(oubli du 29/08/2026, corrigé le 30/08/2026)* | `LIBPGI` de la ligne (colonne B, « Libellé de marché ») | **Jamais réécrit** | Même logique que `FOURNISSEUR.RAISON_SOCIALE_SERVICE` vs `RAISON_SOCIALE_PGI` : `LIBELLE_SERVICE` est le libellé propre au service, initialisé depuis le PGI à la création puis librement modifiable sans être jamais écrasé par une réimportation |
| `TYPEDECOMPOPRIX` | `NULL` | **Jamais réécrit** | à renseigner manuellement ultérieurement |
| `NATUREPRESTA` | `NULL` | **Jamais réécrit** | idem |
| `AGENTGESTION` | `NULL` | **Jamais réécrit** | idem |
| `TITULAIRE_SERVICE` *(oubli du 29/08/2026, corrigé le 30/08/2026)* | `TITULAIRE` de la ligne (colonne C, « Nom du Fournisseur ») | **Jamais réécrit** | Même logique que `LIBELLE_SERVICE`/`LIBPGI` et `FOURNISSEUR.RAISON_SOCIALE_SERVICE`/`RAISON_SOCIALE_PGI` : libellé propre au service, initialisé depuis le PGI à la création puis librement modifiable |
| `PLANPREVENTIONACTIF` | `NULL` | **Jamais réécrit** | **Type changé de booléen à texte le 29/08/2026** (n'est plus un simple oui/non — à renseigner manuellement ultérieurement) ; défaut `NULL`. Migration : `supabase/migrations/20260829180000_marche_planpreventionactif_to_text.sql` |
| `MTMINI` | `0` | **Jamais réécrit** | à renseigner manuellement ultérieurement |
| `ALERTEMT` | `0.8` | **Jamais réécrit** | **Colonne `numeric` en base** — seuil en ratio (ex. `0.8`) d'un montant de référence (ex. `MTMAXI`) déclenchant une alerte budgétaire — pas un montant brut en €, malgré ce que le nom du champ suggère |
| `ALERTEDATE` | `120` | **Jamais réécrit** | **Colonne `integer` en base** — seuil en **nombre de jours** déclenchant une alerte liée à la date — pas une date calendaire, malgré ce que le nom du champ suggère. **Correction du 30/08/2026** : le mapping `ALERTEMT`/`ALERTEDATE` était inversé dans le code (`120`/`0.8` au lieu de `0.8`/`120`) — `alertedate` étant `integer` en base, insérer `0.8` y faisait échouer toute création de marché (`invalid input syntax for type integer`), vérifié sur le schéma réel via l'OpenAPI PostgREST (lecture seule) |
| `DTELASTSOLDE` | *(non concerné)* | *(non concerné)* | Champ financier distinct (date du dernier solde, lié à `MT_SOLDE = MTMAXI − (LASTMTREALISE + LASTMTENGAGE)`), hors périmètre de cet import |
| `DTELASTIMPORT` *(nouveau champ)* | Date du fichier importé (D1, §2) | **Toujours réécrit** (à la création ET à chaque modification) — seul champ « absent du fichier » à ne pas suivre la règle « jamais réécrit » ci-dessus, puisqu'il sert justement à tracer la dernière importation | **N'existe pas encore dans `finances.marche` — nécessite une migration** (`ALTER TABLE ... ADD COLUMN`) et une mise à jour du MLD §2.2. Par **marché** (audit ligne à ligne), distinct du paramètre applicatif `last.import.marche.pgi` (§7) qui lui est par **service** |

# 4. Acteur et service cible — décidé

**Décision du 29/08/2026 : ADMIN_SERVICE, sur son propre service** (attribution active dans
`role_attribution`) — même acteur et même mécanisme que la tâche déjà documentée au MOT,
« Lancer les imports PGI (marchés, CUG, opérations) | admin_service | TI | TR »
(`ForClaude/CDC/mot-phases-1-2.md` l.71). Aucun croisement avec la cellule `Activité` du
fichier (§2).

**Élargissement du 30/08/2026 : ADMIN_APP (transverse) et CB (Contrôle Budgétaire, scopé à
son propre service comme ADMIN_SERVICE — voir MOT, poste « CB | service (collectif) | CB »)
peuvent aussi lancer cet import**, spécifiquement pour les marchés — décision propre à
`ForClaude/Importation-marches/import-marches-pgi.md`, **ne modifie pas** la tâche générale
« Lancer les imports PGI (marchés, CUG, opérations) » du MOT (CUG/opérations restent
`admin_service` seul, sauf décision contraire future). À date, purement une règle d'affichage
frontend (`filterMarchesSidebarItems`, `config/navigation.ts` — masque "Importation marchés
PGI" sans l'un des trois) : aucun backend d'import n'existe encore pour l'appliquer
réellement côté serveur.

Vérification d'autorisation côté backend, à construire avec le reste de l'import : même
patron que les autres écritures scopées par service (`assertManagesService`,
`backend/src/services/authorization.service.ts`), à étendre pour reconnaître aussi le rôle
CB (pas seulement ADMIN_APP/ADMIN_SERVICE comme le fait `assertManagesService` aujourd'hui).

# 5. Étape d'intégration — revirement du 30/08/2026 : vraie pause de confirmation

**Décision du 30/08/2026, remplace celle du 29/08/2026 (revirement explicite, demandé par
l'utilisateur).** La décision du 29/08 écartait toute étape de confirmation intermédiaire, en
alignement avec OP3.1 (MCT) qui documente les imports PGI comme une routine automatique sans
confirmation. **Ce n'est plus le cas pour l'import des marchés** : l'utilisateur voit
désormais réellement la liste des conséquences (créés/archivés) **avant** que l'écriture en
base n'ait lieu, et doit cliquer sur « Confirmer l'import » pour que l'étape 4 s'exécute.

**⚠️ Divergence assumée avec OP3.1 (MCT) — à signaler, pas à corriger silencieusement.** OP3.1
reste documenté comme automatique sans confirmation pour les *autres* imports PGI (CUG,
opérations, fournisseurs, pas encore construits) — cette exception est propre à MARCHE, actée
par l'utilisateur le 30/08/2026, et ne change pas OP3.1 lui-même dans le MCT (à répercuter là
si un jour les autres imports adoptent le même modèle).

**Implémentation (30/08/2026)** : deux appels HTTP successifs, sans état serveur entre les
deux (`backend/src/services/marcheImport.service.ts`) — le fichier est ré-envoyé tel quel à la
confirmation, qui **revalide tout depuis zéro** (étapes 1 et 2) avant d'écrire réellement :
protège contre un changement d'état survenu pendant que l'utilisateur regardait l'aperçu (ex.
un autre agent qui aurait importé entre-temps).
- `POST /api/marches/import/preview` — étapes 1+2+3, aucune écriture en base.
- `POST /api/marches/import/confirm` — revalide, puis étape 4 réelle + compte-rendu final.

Séquence complète (Étapes 1 et 2 ci-dessous, §6/7, précèdent cette étape) :
1. **Validation** : rejet des lignes sans `NUMMARCHE`, listées en anomalie.
2. **Consolidation** : doublons de `NUMMARCHE` dans le fichier traités « dernier gagne »,
   signalés en anomalie.
3. **Aperçu (bloquant)** : présente la liste des marchés à créer et à archiver (§3 ci-dessous
   du MCT — comparaison par `NUMMARCHE` uniquement) — l'utilisateur doit cliquer sur
   « Confirmer l'import » pour poursuivre.
4. **Intégration** (seulement après confirmation) : ajout (nouveau `NUMMARCHE`, tous les
   champs valorisés selon §3 — `ACTIF = TRUE`, `COMPLETUDE = FALSE`), ou **modification**
   (`NUMMARCHE` déjà existant) — dans ce cas, **précision du 29/08/2026 : seuls les champs
   ayant une correspondance directe avec une colonne du fichier (§3, tableau A-M) sont
   réécrits ; tous les autres champs de la ligne existante restent strictement inchangés**,
   y compris s'ils ont été modifiés manuellement depuis leur dernière valeur d'import (voir
   détail champ par champ, §3). Ou archivage (`NUMMARCHE` absent du fichier mais présent en
   base pour ce service, **et `TYPE_CREATION = PGI`**, précision du 30/08/2026 →
   `ACTIF = FALSE`, jamais de suppression physique — un marché créé manuellement n'est jamais
   désactivé de cette façon. L'archivage ne touche que `ACTIF`, pas `DTELASTIMPORT` : un
   marché absent du fichier n'a par définition pas été « importé » cette fois-ci. Pour toute
   ligne présente dans le fichier (ajout ou modification), `DTELASTIMPORT` = date du fichier
   (D1, §2/§3) est réécrit ; `COMPLETUDE` n'est en revanche jamais recalculée par l'import
   lui-même (§3).
5. **Variante marchés** (déjà prévue par OP3.1) : si `NUM_TITULAIRE` (col. D) est inconnu du
   service, auto-création d'une fiche `FOURNISSEUR` (`TYPE_CREATION = PGI`, `SIREN = NULL` —
   voir note ci-dessous), listée dans « fournisseurs ajoutés ». `RAISON_SOCIALE_PGI` **et**
   `RAISON_SOCIALE_SERVICE` sont tous deux initialisés avec `TITULAIRE` de la ligne (colonne C,
   « Nom du Fournisseur »), confirmé le 30/08/2026 — repli sur `NUM_TITULAIRE` uniquement si
   `TITULAIRE` est vide dans le fichier, `RAISON_SOCIALE_SERVICE` étant `NOT NULL` en base
   (contrairement à `RAISON_SOCIALE_PGI`, nullable).
6. **Mise à jour de `last.import.marche.pgi`** (§7) avec la date de génération du fichier
   (cellule D1, §2) pour ce service — condition de possibilité du **prochain** import.
7. **Compte-rendu final** : marchés ajoutés, archivés, fournisseurs ajoutés, anomalies — **à
   l'écran et en document téléchargeable** (décision du 29/08/2026, §8 ; téléchargement généré
   côté client, pas un nouvel endpoint).

**Correctif du 30/08/2026 — `FOURNISSEUR.SIREN` devient nullable pour `TYPE_CREATION='PGI'`.**
Le fichier d'import des marchés ne fournit aucun SIREN (colonnes disponibles : nom et numéro
du fournisseur uniquement, §3 colonnes C/D) — or `SIREN` était `NOT NULL` sans exception
(décision du 29/08/2026). Migration
`supabase/migrations/20260830120000_marche_import_prerequisites.sql` : retire le `NOT NULL`
global, ajoute une contrainte `CHECK (siren is not null or type_creation = 'PGI')` — reste
obligatoire pour une création manuelle (`TYPE_CREATION='SERVICE'`), imposé applicativement par
`fournisseur.service.ts` (inchangé). Répercuté dans le MLD §2.2.

# 6. Étape 1 — Vérification structurelle du fichier

Contrôles bloquants (arrêt du processus + compte-rendu d'anomalie si l'un échoue) :

1. **A1** = `Grand Port Maritime de Marseille` (sans espace superflu).
2. **A3** = `Récapitulatif d'un marché` (sans espace superflu).
3. **D1** commence par `Edité le :` — le reste de la cellule (sans espace en tête/fin) doit
   être une date au format `JJ-MM-AAAA`. Cette date = date de génération du fichier PGI.
4. **A12:M12** strictement identique (13 cellules, valeur exacte) au fichier de référence
   `Modele importation marchés PGI.xlsx` — voir tableau §3 pour les valeurs de référence.

# 7. Étape 2 — Vérification de l'éligibilité à l'import

1. **Paramètre applicatif `last.import.marche.pgi`** (`finances.parametre_application`,
   voir `docs/ARCHITECTURE.md` "Paramétrage applicatif") :
   - Portée **par service** (pas globale) — une ligne par service ayant déjà importé.
   - **Décision du 29/08/2026 : la ligne doit déjà exister pour ce service avant son tout
     premier import** — création manuelle préalable par `ADMIN_APP` (écran Réglages, comme
     pour tout paramètre scopé par service), sinon **erreur bloquante**. Ceci revient à faire
     de la présence de cette ligne un **interrupteur d'activation** de l'import PGI marchés
     pour un service donné.
   - La date de génération du fichier (D1, étape 1.3) doit être **≥** à la valeur du
     paramètre pour ce service. Si la valeur est vide (représentée en base comme le JSON
     `null`, distinct du `NOT NULL` de la colonne — voir note technique ci-dessous),
     l'import est valide (aucune borne).
   - **Nécessite l'ajout de la clé `last.import.marche.pgi`** au registre backend
     (`PARAMETRE_SCHEMAS`, `backend/src/services/parametres.service.ts` — schéma de
     validation date) et une ligne `finances.parametre_definition` correspondante
     (migration), sur le modèle de ce qui a été fait pour `auth.inactivite_delai_minutes`
     (voir `docs/ARCHITECTURE.md`, décision du 29/08/2026 sur le catalogue des paramètres).
2. **CUG responsable — vérification PAR LIGNE** (§2/§3 : la colonne E n'est pas une valeur
   unique de fichier mais une donnée par marché) : pour **chaque ligne** du fichier, le CUG
   responsable (colonne E) doit être un CUG (`finances.cug`) **affecté au service cible** de
   l'import, sinon anomalie.
3. **Date de fin — vérification PAR LIGNE, exclusion silencieuse (décision du 30/08/2026)** :
   pour **chaque ligne**, `DTEFINMAX` (colonne H, « Date de fin ») doit être **postérieure ou
   égale** à la date de génération du fichier (D1, étape 1.3) — un marché déjà terminé avant la
   date du fichier (ou dont la date de fin est absente) n'est pas importé. **Contrairement à la
   vérification 2, cette exclusion n'apparaît pas dans la liste des anomalies du compte-rendu**
   — décision explicite de l'utilisateur, un export réel contenant en pratique un grand nombre
   de marchés historiques déjà terminés (230 lignes sur 275 dans le fichier de test), dont le
   signalement systématique en anomalie n'apportait rien à l'utilisateur.

Les vérifications 2 et 3 sont **par ligne, non bloquantes** : une ligne en échec est exclue de
l'intégration sans empêcher les autres lignes valides du même fichier d'être importées (seule la
vérification 2 est en plus listée dans le compte-rendu d'anomalies, voir note ci-dessus pour la
3). La vérification 1 (paramètre) reste **bloquante pour le fichier entier** — si elle échoue,
le processus s'arrête et un compte-rendu d'anomalie est proposé à l'utilisateur.

**Note technique — représentation de « valeur vide ».** `parametre_application.valeur` est
`jsonb NOT NULL` (contrainte de colonne) : une absence de borne ne peut donc pas être une
vraie valeur SQL `NULL`, mais doit être stockée comme la valeur JSON `null` elle-même
(`'null'::jsonb`, valide et non-NULL du point de vue de la colonne) — à valider à
l'implémentation.

# 8. Points restés ouverts — tous tranchés le 29/08/2026

Pour traçabilité, les questions posées et leur réponse :
- Acteur/service cible → §4 (ADMIN_SERVICE sur son propre service, pas de croisement `Activité`).
- Étape de confirmation avant import → §5 (aucune, reprend OP3.1 tel quel).
- Existence préalable de `last.import.marche.pgi` → §7 (création manuelle obligatoire par service).
- Reprise d'OP3.1 pour l'intégration → §5 (oui, telle quelle).
- Mapping des colonnes B/C/G-M → §3 (confirmé tel que proposé).
- Usage de la colonne F (Description du CUG Responsable) → §3 (ignorée, aucun contrôle).
- Forme du compte-rendu → §5 point 6 (écran + document téléchargeable).
- Valorisation des champs absents du fichier → §3 (table détaillée, dont la découverte du
  nouveau champ `DTELASTIMPORT` et de la nature réelle de `ALERTEMT`/`ALERTEDATE`, en % et non
  en montant/date).

**Aucun point ouvert restant.** Reste à faire avant implémentation : migration ajoutant
`DTELASTIMPORT` à `finances.marche` (§3) et clarification du MLD §2.2 sur la nature de
`ALERTEMT`/`ALERTEDATE` (§3).

# 10. États des marchés — liste (30/08/2026)

Page `/marches` (`Marches.tsx`), ouverte à tout utilisateur authentifié — pas de restriction de
rôle sur la consultation (contrairement à l'import, §4), scopée à son propre service (transitif
via `ACTEUR.ID_CELLULE → CELLULE.ID_SERVICE`, indépendant de ses rôles) sauf ADMIN_APP qui
choisit librement. Backend : `GET /api/marches?idService=X` (`marche.service.ts#listMarches`),
même principe de double-scope que `fournisseur.service.ts#resolveReadScope` — l'`idService`
transmis par un non-ADMIN_APP est ignoré au profit de son propre service.

**Carte par marché** (maquette utilisateur, `ListeMarche.pdf`) :
- Deux pastilles : `ACTIF` (vert/rouge) et `COMPLETUDE` (vert/rouge) — toujours affichées et
  calculées, y compris quand `COMPLETUDE = FALSE` (`ALERTEMT`/`ALERTEDATE` ont toujours une
  valeur par défaut dès la création, indépendamment des autres champs qui déterminent
  `COMPLETUDE` — décision utilisateur).
- Barre « Durée » : remplissage = `(aujourd'hui − DTEDEBUT) / (DTEFINMAX − DTEDEBUT)`. **Rouge
  si jours restants < `ALERTEDATE`** (nombre de jours), vert sinon — correction d'une coquille
  du PDF source, qui indiquait « Vert » dans les deux sens.
- Barre « Montant » : remplissage = `(MTMAXI − MT_SOLDE) / MTMAXI`. **Rouge si `MT_SOLDE <=
  (1 − ALERTEMT) × MTMAXI`** (solde au ratio ou en dessous du seuil), vert sinon — décision
  utilisateur du 30/08/2026 : le PDF source inversait littéralement cette règle (vert quand le
  solde est faible) ; le sens retenu est celui, cohérent, de la barre durée (rouge = on
  approche de la limite).
- Une carte sans `DTEDEBUT`/`DTEFINMAX` (ou sans `MTMAXI`/`MT_SOLDE`) n'affiche simplement pas
  la barre correspondante, plutôt qu'une valeur incohérente.

**Filtres** : Direction → Service (même mécanisme que Fournisseurs.tsx/ImportMarches.tsx —
comboboxes toujours actives, réduites au service propre pour un acteur non ADMIN_APP), Statut
(Actifs/Inactifs/Tous, **défaut Actifs** — masque les marchés archivés par défaut, contrairement
à Fournisseurs/CUG qui défaultent sur "Tous"), recherche texte libre (`NUMMARCHE`, `LIBPGI`,
`TITULAIRE`) — ces deux derniers filtres sont appliqués côté client sur la liste déjà chargée
pour le service, comme Fournisseurs.tsx. Tri alphabétique par `NUMMARCHE`. Pas d'action au clic
sur une carte à ce stade (lecture seule).

Fichiers : `backend/src/services/marche.service.ts`, `controllers/marche.controller.ts`,
`routes/marche.routes.ts` (monté sur `/marches`, avant `/marches/import` dans
`routes/index.ts`) ; `marche.repository.ts` étendu (`mt_solde`, `utilisable` ajoutés à
`SELECT_COLUMNS` et à l'interface `Marche`, exclus des types d'entrée `create`/`update` —
colonnes générées Postgres, jamais écrites). Frontend : `hooks/useMarches.ts`, `Marches.tsx`
réécrite (filtre + liste de cartes), styles dans `styles/marche.css` (`.marche-*`).

# 11. Création manuelle d'un marché, hors import PGI (30/08/2026)

Modale ouverte depuis `Marches.tsx` (bouton page « Nouveau marché », plus l'icône « Ajouter »
déjà présente sur chaque carte — les deux ouvrent la même modale) — réservée
`assertManagesServiceOrHasRoleCb` (ADMIN_APP/ADMIN_SERVICE/CB), maquette utilisateur
`ListeMarche.pdf`, confrontée au schéma physique réel (`SchemaBase.txt`, transmis le
30/08/2026) plusieurs champs du croquis manquaient ou étaient ambigus par rapport au schéma —
décisions ci-dessous.

**Découverte corrigée en amont de ce chantier** : `MARCHE.MT_SOLDE`/`UTILISABLE` étaient de
simples colonnes `DEFAULT` (appliqué à l'INSERT seulement, jamais à l'UPDATE — donc figées dès
la première modification de `MTMAXI`/`LASTMTREALISE`/`LASTMTENGAGE`/`ACTIF`/`COMPLETUDE`), pas
de vraies colonnes générées comme le code le supposait depuis le début de la session. Migration
exécutée par l'utilisateur : `DROP COLUMN` + `ADD COLUMN ... GENERATED ALWAYS AS (...) STORED`
pour les deux — vérifié via `information_schema.columns.is_generated = 'ALWAYS'`. Aucun code
applicatif à changer (le repository excluait déjà ces deux champs de tout payload d'écriture).

**Champs du croquis, mapping retenu** :
- Numéro de marché (Champ 1) → `NUMMARCHE`, regex `^[PMS]\d{7}[A-Za-z0-9]*$` (préfixe P/M/S +
  7 chiffres + suffixe alphanumérique optionnel — confirmé contre les vrais numéros déjà vus :
  `M0909311`, `P2205926`, `M1602619TC2`, `M2407225P2`, `S2109325`). Rejet 409 si déjà existant.
- Titulaire (Liste 4, fournisseurs actifs du service) → `ID_FOURNISSEUR`, et
  `TITULAIRE`/`TITULAIRE_SERVICE` reçoivent **tous deux**
  `FOURNISSEUR.RAISON_SOCIALE_SERVICE` (même valeur dupliquée) — `RAISON_SOCIALE_PGI` n'étant
  pas fiable pour un fournisseur créé manuellement, même logique que l'import PGI.
- Libellé (Champ 2) → `LIBPGI` **et** `LIBELLE_SERVICE` reçoivent tous deux la même saisie,
  conformément à l'annotation du croquis lui-même.
- Type de procédure/Décomposition du prix/Nature de la prestation (Listes 1/2/3) →
  `TYPEPROC`/`TYPEDECOMPOPRIX`/`NATUREPRESTA`, valeurs stockées en MAJUSCULES (cohérent avec
  `demande_achat.type_achat` et l'import PGI), choisies via dropdown — **pas dérivées du
  préfixe du numéro** comme le fait l'import (le croquis montre un choix explicite pour
  `TYPEPROC`, contrairement à `deriveTypeProc` côté import).
- Agent gestionnaire (Liste 5) — **découverte** : `AGENTGESTION` est un simple champ `text` en
  base, **pas une FK vers `ACTEUR`** — la liste (acteurs du service, via `CELLULE.ID_SERVICE`)
  sert uniquement à préremplir le texte libre `"NOM Prénom"`, aucune intégrité référentielle
  imposée par la base sur ce choix.
- CUG : **revirement du 01/09/2026** — le dropdown CUG (ajouté le 30/08/2026, cf. ci-dessous)
  est supprimé de cette modale sur demande explicite. `CODE_CUG` était `NOT NULL` en base ;
  migration `20260901120000_marche_code_cug_nullable.sql` pour le rendre nullable, un marché
  créé ici n'a donc plus jamais de CUG. Conséquence découverte en le retirant : `listMarches`
  (voir marche.service.ts) ne résolvait jusque-là le service d'un marché que via
  `CODE_CUG → CUG.ID_SERVICE` — un marché sans CUG y serait resté invisible pour toujours, quel
  que soit le service filtré. Corrigé en ajoutant un second chemin de résolution via
  `ID_FOURNISSEUR → FOURNISSEUR.ID_SERVICE` (toujours renseigné dans ce flux), les deux
  ensembles étant fusionnés et dédupliqués par `NUMMARCHE`.
- Montant maximum, MTMAXI (absent du croquis) : ajouté — sans lui `MT_SOLDE` reste `NULL` et
  la barre « Montant » de `Marches.tsx` ne s'affiche jamais pour ces marchés. Placé sous Nature
  de la prestation (revirement du 01/09/2026). Saisi en simple champ texte filtré aux chiffres
  (`sanitizeInteger`, même principe que `SeuilsValidationDs.tsx`) — **pas** le composant
  `SpinButton` : un montant en euros ne s'incrémente pas au chevron, exception documentée dans
  `ForClaude/INSTRUCTIONS_UX.md`.
- Alerte sur date/montant : `ALERTEDATE` saisi en jours bruts (défaut 120, comme l'import) ;
  `ALERTEMT` saisi en **%** (défaut 80), converti en ratio (`/100`) côté frontend juste avant
  l'envoi — le backend et la base attendent un ratio partout ailleurs dans l'application.
  Alerte sur date/Alerte sur montant utilisent le composant `SpinButton`
  (`components/SpinButton.tsx`, nouveau, ajouté le 30/08/2026 — réimplémentation React de
  `.gp-spin`, voir `ForClaude/INSTRUCTIONS_UX.md`), pas un `<input type="number">` nu. Placées
  (avec Agent gestionnaire) dans une 3ᵉ colonne « Gestion du marché », à côté de « Dates
  significatives » (revirement du 01/09/2026, remplace l'ancienne section pleine largeur
  séparée par un `divider`).
- 4 dates (Validation/Notification/Début/Fin max) : composant `DatePicker`
  (`components/DatePicker.tsx`, nouveau, ajouté le 30/08/2026) — réimplémentation React du
  calendrier `.gp-dp` du template (voir `ForClaude/INSTRUCTIONS_UX.md`, section
  « Spécificité VIGIE », et `Combobox.tsx` pour le même principe) plutôt que de simples champs
  texte `JJ/MM/AAAA`, décision initiale revue le jour même sur demande explicite de
  l'utilisateur. Valeur `null`/ISO exposée directement au parent (`Marches.tsx`), plus de
  conversion/validation de format à la soumission du formulaire — une saisie invalide dans le
  champ n'est simplement jamais propagée à l'état React (reste sans effet, pas d'erreur
  bloquante).

**`TYPE_CREATION = 'SERVICE'`** (par analogie avec `FOURNISSEUR.TYPE_CREATION`).

**`COMPLETUDE` calculée à l'enregistrement** (pas de moteur de recalcul continu — décision
explicite de l'utilisateur) : `true` si `TYPEDECOMPOPRIX`, `NATUREPRESTA` et `AGENTGESTION`
sont tous renseignés. `PLANPREVENTIONACTIF` — normalement l'un des champs déterminants de
`COMPLETUDE` (voir §3) — est **volontairement exclu de ce calcul pour cette modale**, absent du
croquis et du formulaire (décision explicite : sans cette exclusion, `COMPLETUDE` ne pourrait
jamais devenir `true` pour un marché créé ici). `TITULAIRE_SERVICE`/`ALERTEMT`/`ALERTEDATE`
sont toujours renseignés dans ce flux (fournisseur obligatoire, valeurs par défaut), donc
jamais bloquants.

**Découverte d'accès pendant l'implémentation** : `cug.service.ts#listCug` (utilisé par
l'écran Réglages/CUG) est réservé à ADMIN_APP/ADMIN_SERVICE — CB explicitement exclu (décision
du 29/08/2026). Plutôt que d'élargir cet endpoint partagé (aurait donné à CB un accès à la
gestion des CUG, hors périmètre), nouvel endpoint dédié `GET /api/marches/creation-options`
(CUG actifs + acteurs du service, autorisation `assertManagesServiceOrHasRoleCb`) — même
principe que la création de `assertManagesServiceOrHasRoleCb` elle-même : une variante étroite
plutôt qu'un élargissement d'une règle partagée.

Fichiers : `backend/src/repositories/acteur.repository.ts` (`findAllByService`, nouveau) ;
`marche.repository.ts` (`create` accepte désormais `completude` en entrée au lieu de le figer
à `false` — l'import PGI le passe explicitement, cf. `marcheImport.service.ts`) ;
`marche.service.ts` (`listCreationOptions`, `createMarche`) ; `marche.controller.ts`/
`marche.routes.ts` étendus (`GET /creation-options`, `POST /`). Frontend :
`hooks/useMarcheCreationOptions.ts` (nouveau), `Marches.tsx` (`CreateMarcheModal`, bouton page
+ icône carte). Tests : 13 nouveaux côté backend (`marche.service.test.ts`), 5 côté frontend
(`Marches.test.tsx`).

# 12. Marchés d'un service tiers (01/09/2026)

Registre séparé, **jamais mélangé** avec « États des marchés du service » (§10, `MarchesPGI.tsx`)
ni avec `finances.marche` : un marché tiers appartient réellement à un *autre* service du port
(qui n'utilise pas forcément VIGIE), que le service courant est autorisé à utiliser et doit donc
ressaisir manuellement pour pouvoir le citer plus tard dans une demande d'achat (fonctionnalité
pas encore implémentée dans ce backend — `demandeAchat.repository.ts` ne contient qu'un
garde-fou de suppression de fournisseur).

L'utilisateur a d'abord proposé de dupliquer `MarchesPGI.tsx` pour distinguer import PGI et
création manuelle par le service — écarté en creusant le besoin réel : ni le tableau de bord
(barres de progression durée/montant, complétude, compteur enregistrés/sélectionnés, libellé de
dernier import PGI) ni le modèle de données de `finances.marche` (CODE_CUG, DTELASTIMPORT,
ALERTEMT, consommation LASTMTREALISE/LASTMTENGAGE) n'ont de sens pour un marché qu'on ne gère
pas soi-même. Renommage au passage : l'entrée de sidebar "Marchés externes" (ajoutée le
01/09/2026 comme coquille vide) devient "Marchés d'un service tiers" et porte cette
fonctionnalité (`/marches/tiers`).

**Caractéristiques** (décidées avec l'utilisateur) : `nummarche`, `libelle_service` (libellé du
marché, même sémantique que `finances.marche.libelle_service`), `id_fournisseur` (FK,
appartenant au service courant), `mtmaxi`, `dtedebut`, `dtefinmax`, `typeproc` (**déduit
automatiquement** du préfixe de `nummarche` — `P`→`MAPA`, `M`/`S`→`MARCHE`, jamais un choix
utilisateur, contrairement à `CreateMarcheModal` — réutilise `deriveTypeProc`, exporté de
`marcheImport.service.ts`), `typedecompoprix`, `agentgestion`, `alertedate`. Volontairement
absents : `code_cug`, `dtevalid`/`dtenotif`, `naturepresta`, `mtmini`, `alertemt` et toute
consommation (`lastmtrealise`/`lastmtengage`/`mt_solde`/`dtelastsolde`) — on ne suit pas la
consommation d'un marché qu'on ne gère pas, seule une alerte de date a du sens.

**Accès** : lecture ouverte à tout utilisateur authentifié pour son propre service (ADMIN_APP
libre du service consulté) — décision explicite, ces marchés servent à tout agent créant une
demande d'achat, pas seulement aux admins (même règle que `listMarches`, §10 — pas le modèle
fermé de `cug.service.ts`). Création et modification réservées ADMIN_APP/ADMIN_SERVICE/CB
(`assertManagesServiceOrHasRoleCb`, réutilisée telle quelle). Champ `ACTIF` (défaut `true`),
archivage jamais suppression physique — cohérent avec CUG/Fournisseur/Site/Secteur.

**Modèle de données** : nouvelle table `finances.marche_tiers` — vraie création (pas de schéma
PGI préexistant à respecter, contrairement à `cug`/`fournisseur`/`marche`), PK technique
`id_marche_tiers` (pas de clé naturelle : deux services différents peuvent légitimement
enregistrer indépendamment le même `nummarche` tiers), unicité `(id_service, nummarche)`
seulement. Migration `20260901130000_create_marche_tiers.sql` — première policy RLS du projet à
combiner ADMIN_APP/ADMIN_SERVICE/CB (les policies CUG/SITE/SECTEUR existantes n'en connaissent
que deux).

Fichiers backend : `repositories/marcheTiers.repository.ts`, `services/marcheTiers.service.ts`
(sur le modèle de `cug.service.ts` pour la forme, de `marche.service.ts#resolveReadScope` pour
l'accès ouvert), `controllers/marcheTiers.controller.ts`, `routes/marcheTiers.routes.ts` (montée
`/marches/tiers`, troisième mount sous `/marches` aux côtés de `marche.routes.ts` et
`marcheImport.routes.ts`, sans conflit de routage). `marcheImport.service.ts#deriveTypeProc`
exporté pour être réutilisé (même principe que `findLastImportRow`/`PARAMETRE_NON_INITIALISE`,
§10). Frontend : `hooks/useMarcheTiers.ts` (nouveau), `pages/MarchesTiers.tsx` (remplace
`MarchesExternes.tsx`, supprimé) — tableau façon `Cug.tsx` (pas de cartes/barres de progression),
filtre Direction → Service façon `MarchesPGI.tsx`, modale de création/édition réutilisant les
composants `Combobox`/`DatePicker`/`SpinButton` et les hooks `useFournisseurs`/
`useMarcheCreationOptions` déjà existants pour Titulaire/Agent gestionnaire. Numéro de marché
non modifiable après création (clé de l'unicité `(id_service, nummarche)`, même principe que
`CODE_CUG` sur `Cug.tsx`) ; type de procédure jamais saisi, affiché en lecture seule une fois
dérivé côté serveur.

# 13. finances.marche — plus de création manuelle, « Modifier » remplace « Ajouter » (01/09/2026)

Revirement sur la décision du 30/08/2026 (§11) : la création manuelle d'un marché (icône
« Ajouter », `CreateMarcheModal`, `POST /marches`) est **entièrement retirée**. Décision actée
avec l'utilisateur :

- **Aucune création manuelle** d'un marché dans `finances.marche` — seul l'import PGI en crée
  (`marcheImport.service.ts`, `type_creation = 'PGI'`).
- **Aucune suppression ni désactivation manuelle** — `ACTIF` n'est réécrit que par l'archivage
  de l'import (`marche.repository.ts#archiveMany`, restreint `TYPE_CREATION = 'PGI'`, inchangé).
- **Seuls huit champs restent modifiables**, réservé ADMIN_APP/ADMIN_SERVICE/CB
  (`assertManagesServiceOrHasRoleCb`) : `TYPEPROC`, `TYPEDECOMPOPRIX`, `NATUREPRESTA`,
  `LIBELLE_SERVICE`, `AGENTGESTION`, `ALERTEDATE`, `ALERTEMT`, `PLANPREVENTIONACTIF` — jamais
  `NUMMARCHE`/le titulaire/le CUG ni les dates/montants (réécrits uniquement par l'import,
  colonnes A-M du §3).

  **Revirement le même jour, quelques heures plus tard (voir §14) : `TYPEPROC` retiré de cette
  liste.** Ne restent donc que sept champs modifiables — le paragraphe ci-dessus reste tel quel
  pour l'historique, mais n'est plus exact : voir §14 pour l'état actuel.

`TYPE_CREATION` reste donc utile (contrairement à une première intuition de l'utilisateur,
vérifiée puis infirmée avant ce chantier) : il protège encore les marchés déjà créés
manuellement avant ce revirement (existants en base, jamais migrés) contre l'archivage
automatique de l'import — cette protection ne perd son utilité que si, un jour, plus aucun
marché `TYPE_CREATION != 'PGI'` ne subsiste en base.

**`COMPLETUDE` recalculée à chaque modification** (remplace le calcul figé à la création
manuelle, désormais sans objet) — décision explicite de l'utilisateur, `true` si `TYPEPROC`,
`TYPEDECOMPOPRIX`, `NATUREPRESTA`, `LIBELLE_SERVICE`, `AGENTGESTION`, `ALERTEDATE` et `ALERTEMT`
sont tous renseignés (`PLANPREVENTIONACTIF` volontairement exclu, contrairement à l'intention
initiale du 30/08/2026 pour un recalcul continu — voir §10). C'est la première fois que
`COMPLETUDE` peut réellement changer après la création d'un marché : jusqu'ici, un marché
importé restait `COMPLETUDE = FALSE` (et donc `UTILISABLE = FALSE`) pour toujours, faute de
mécanisme pour la faire évoluer.

**Bug corrigé au passage** : les icônes d'action (Visualiser/Modifier/Ajouter) étaient nichées
dans le bloc d'affichage de la barre « Montant » (`MarcheCard`, `MarchesPGI.tsx`) — un marché
sans `MTMAXI`/`MT_SOLDE` n'affichait donc aucune icône, y compris pour un ADMIN_APP/
ADMIN_SERVICE/CB, le rendant impossible à modifier. Les actions (désormais Visualiser/Modifier
seulement) sont sorties de ce bloc, toujours affichées.

Fichiers backend : `marche.repository.ts` (nouveau type `MarcheManagedFieldsInput`, nouvelle
fonction `updateManagedFields` — `create`/`createMarcheSchema` retirés de `marche.service.ts`) ;
`marche.service.ts` (`listCreationOptions` → `listMarcheOptions`, ne renvoie plus les CUG ;
nouvelle `updateMarcheManagedFields`, avec `resolveMarcheIdService` — même double voie
CUG/fournisseur que `listMarches`, nécessaire pour autoriser la modification faute de colonne
`id_service` directe sur `finances.marche`) ; `marche.controller.ts`/`marche.routes.ts`
(`postMarche` → `putMarche`, `GET /creation-options` → `GET /options`, nouvelle
`PUT /marches/:nummarche`). Frontend : `useMarcheCreationOptions.ts` renommé
`useMarcheOptions.ts` (ne renvoie plus les CUG) ; `MarchesPGI.tsx` — `CreateMarcheModal`
remplacée par `EditMarcheModal` (pré-remplit les huit champs depuis le marché cliqué ; Agent
gestionnaire reste en texte libre en base, la combobox ne présélectionne que si le texte
correspond exactement à un acteur du service, sinon « Non renseigné » plutôt qu'une
correspondance forcée).

# 14. finances.marche — TYPEPROC retiré des champs modifiables (01/09/2026)

Revirement sur §13, le même jour, quelques heures après l'ajout de `TYPEPROC` à la liste des
huit champs modifiables via « Modifier ». Décision explicite de l'utilisateur : `TYPEPROC` est
renseigné une seule fois, à l'import (dérivé du préfixe de `NUMMARCHE`, §3), et ne doit **jamais**
être modifiable ensuite — contrairement à `TYPEDECOMPOPRIX`/`NATUREPRESTA`, qui restent des choix
métier révisables.

- **Sept champs modifiables désormais** (au lieu de huit) : `TYPEDECOMPOPRIX`, `NATUREPRESTA`,
  `LIBELLE_SERVICE`, `AGENTGESTION`, `ALERTEDATE`, `ALERTEMT`, `PLANPREVENTIONACTIF`.
- La combobox « Type de procédure » est retirée de `EditMarcheModal`
  (`frontend/src/pages/MarchesPGI.tsx`) — plus aucune saisie, plus aucun affichage dans cette
  modale (le champ reste visible ailleurs, ex. liste des marchés, en lecture seule).
- **`COMPLETUDE`** continue de dépendre de `TYPEPROC`, mais sa valeur est désormais lue sur la
  ligne existante en base (`existing.typeproc`, résolue via `marcheRepository.findByNummarche`),
  plus jamais sur l'entrée du formulaire puisque ce champ n'en fait plus partie. En pratique
  `TYPEPROC` est `NOT NULL` en base et toujours renseigné (dérivé à l'import), donc cette
  condition reste toujours vraie — gardée pour la clarté de la règle métier plutôt que par
  nécessité stricte.
- Fichiers modifiés : `marche.service.ts` (schéma Zod `updateMarcheManagedFieldsSchema` — retrait
  du champ et de `TYPEPROC_VALUES` ; `completude` lit `existing.typeproc`) ;
  `marche.repository.ts` (`MarcheManagedFieldsInput` — retrait de `'typeproc'` du `Pick`) ;
  `MarchesPGI.tsx` (retrait de l'état `typeproc`, de la combobox, de la validation associée, du
  champ dans le payload `PUT /marches/:nummarche` — message de validation simplifié en « Le
  libellé est obligatoire. »). Tests backend et frontend mis à jour en conséquence.

# 15. Liste des marchés — en-tête, compteur et modale de filtre (02/09/2026)

Trois ajustements de mise en page/comportement de `MarchesPGI.tsx`, tous décidés par
l'utilisateur le même jour :

- **En-tête** : le message "Pensez à importer les marchés récents" (import obsolète, voir
  `IMPORT_STALE_JOURS`) est désormais affiché sur la même ligne que "État des marchés au
  [date]", plutôt qu'en-dessous.
- **Compteur** ("X marchés sélectionnés sur Y marchés enregistrés") : le bouton "Filtrer"
  (ouvre `FilterModal`) est déplacé de la ligne Direction/Service/Recherche vers cette ligne,
  juste après le texte du compteur. Un nouveau bouton "Supprimer les filtres" est ajouté juste
  à côté — contrairement à celui qui existait jusqu'ici *dans* la modale (qui ne vidait que le
  brouillon, sans effet tant que "Filtrer" n'était pas recliqué), celui-ci vide **directement**
  le filtre déjà appliqué (statut, alerte, recherche) — voir `handleResetFilters`.
- **Modale de filtre (`FilterModal`), refonte complète sur maquette utilisateur** : chaque
  critère (Actif, Complet, Alerte date, Alerte montant) passe d'une case à cocher à deux états
  (cochée/décochée) à un choix à trois états **Oui / Non / Tous** (type `TriEtat`,
  `matchesTriEtat`) — `'tous'` remplace l'ancien "décochée" (aucune contrainte), `'oui'`
  remplace l'ancien "cochée", et `'non'` est une **nouvelle capacité** : filtrer explicitement
  sur les marchés qui NE vérifient PAS le critère (ex. voir uniquement les marchés archivés, ou
  uniquement les fiches incomplètes — impossible avec les cases à cocher). Le bouton "Supprimer
  les filtres" de la modale (qui ne vidait que le brouillon) est retiré, ce geste vivant
  désormais sur la page principale (voir ci-dessus). Regroupement visuel "Statut"/"Alerte"
  (deux colonnes) abandonné au profit d'une liste verticale, chaque ligne portant directement
  son propre libellé ("Alerte date"/"Alerte montant" remplacent "Sur date"/"Sur montant" sous
  l'en-tête "Alerte"). Chaque bouton radio porte un `aria-label` combinant critère et option
  (ex. "Actif : Oui") pour rester distinguable malgré la répétition visuelle "Oui"/"Non"/"Tous"
  sur quatre lignes — utilise les classes `.gp-radio`/`.gp-choice` déjà présentes dans
  `gpmm.css` mais jamais utilisées jusqu'ici dans l'application.

Fichiers modifiés : `MarchesPGI.tsx` (`TriEtat`, `matchesTriEtat`, `handleResetFilters`,
`FilterTriEtatRow`, `FilterModal`, `FilterModalValues`) ; `MarchesPGI.test.tsx` (tests de la
modale de filtre réécrits pour les rôles `radio` avec `aria-label`, nouveaux tests pour le
critère "Non" et pour le bouton "Supprimer les filtres" de la page principale).

# 16. Modale « Visualiser » le marché (02/09/2026)

L'icône « Visualiser » des cartes (`MarcheCard`) existait visuellement depuis le 30/08/2026
mais n'était câblée à aucune action (voir §10). Câblée pour la première fois ce jour-là, sur
croquis utilisateur : `ViewMarcheModal`, lecture seule, ouverte à tout le monde (même règle
d'accès que l'icône elle-même — contrairement à « Modifier », réservée `canManage`).

- **Quatre groupes de champs**, fidèles au croquis : « Identification » (Numéro du marché,
  Titulaire, Libellé) ; « Caractéristiques » (Type de procédure, Décomposition du prix, Nature
  de la prestation) ; « Dates significatives » (Validation, Notification, Début, Fin max) ;
  « Gestion du marché » (Agent gestionnaire, CUG, Solde restant, Temps restant) ; puis Alerte
  sur date/Alerte sur montant en bas. Disposition en grille à trois colonnes (classe `.grid`
  déjà présente dans `gpmm.css`, réutilisée telle quelle) plutôt qu'une nouvelle classe dédiée.
- **Chaque champ est un `<input readOnly>`** (`ViewField`, `id`/`htmlFor` généré depuis le
  libellé pour rester accessible) plutôt qu'un simple texte — rend le croquis (champs
  "encadrés") fidèlement, permet la sélection/copie de la valeur. Un seul bouton « Retour »
  (pas d'« Enregistrer », lecture seule).
- **`CUG`/`Validation`/`Notification` n'existaient pas encore dans le type frontend `Marche`**
  (`useMarches.ts`) — présents côté backend (`code_cug`, `dtevalid`, `dtenotif`, déjà renvoyés
  par `GET /marches`) mais jamais déclarés côté client faute d'un écran les affichant jusqu'ici.
  Ajoutés au type, aucun changement backend nécessaire.
- **Temps restant** réutilise `computeDuree(...).joursRestants` (déjà utilisé pour la barre de
  progression « Durée » de la carte) plutôt qu'un nouveau calcul.
- Valeurs `null` affichées `—` (`formatDateOrDash`, dictionnaires `TYPEDECOMPOPRIX_LABELS`/
  `NATUREPRESTA_LABELS` pour les libellés lisibles des énumérations, même valeurs que les
  options de `EditMarcheModal`).

# 17. Marchés d'un service tiers — liste en cards, modale Visualiser (02/09/2026)

Revirement sur §12 : la liste de `MarchesTiers.tsx` était volontairement un tableau (« pas de
barres de progression, pas de complétude, pas de suivi de consommation — on ne gère pas ce
marché »). Sur croquis utilisateur (card avec titre, sous-titre, une seule barre de
progression "Durée" et une seule pastille de statut), le tableau est remplacé par une liste de
cards réutilisant le même patron visuel que `MarcheCard` de MarchesPGI.tsx.

- **Toujours pas de complétude ni de suivi de consommation** (pas de barre "Montant", pas de
  MT_SOLDE) — seule la barre "Durée" (DTEDEBUT→DTEFINMAX, alerte sous ALERTEDATE jours
  restants) a un sens pour cette entité, et une seule pastille (ACTIF — pas de seconde pastille
  COMPLETUDE, qui n'existe pas ici). `computeDuree`/`DureeInfo`/`daysBetween` dupliqués
  localement dans `MarchesTiers.tsx`, même calcul que MarchesPGI.tsx.
- **Icône Visualiser câblée** (`ViewMarcheTiersModal`, lecture seule, ouverte à tout le monde —
  même principe que `ViewMarcheModal` de MarchesPGI.tsx, §16) : Numéro, Titulaire, Libellé,
  Type de procédure, Décomposition du prix, Début, Fin max, Montant maximum, Alerte sur date,
  Agent gestionnaire, Statut, Commentaire. Pas de Validation/Notification/CUG/Solde
  restant/Nature de la prestation (n'existent pas pour `finances.marche_tiers`).
- **Icône Modifier renommée** `"Modifier le marché tiers"` → `"Modifier"` (aria-label/tooltip),
  pour rester cohérente avec le patron `MarcheCard` de MarchesPGI.tsx (le contexte de la card
  suffit à lever l'ambiguïté).
- **Pas de suppression physique pour l'instant**, décision explicite de l'utilisateur après
  vérification du schéma : `admin_app`/`admin_service` devraient pouvoir supprimer
  physiquement un marché tiers non impliqué dans une FAD, mais `finances.demande_achat.nummarche`
  est aujourd'hui une FK vers `finances.marche` (import PGI) uniquement — **aucun lien en base**
  n'existe encore entre une demande d'achat/FAD et `finances.marche_tiers`, donc le contrôle
  "pas impliqué dans une FAD" ne peut pas être vérifié. Reporté jusqu'à ce que le module FAD
  référence les marchés tiers. Seul le statut ACTIF reste modifiable (switch existant de la
  modale « Modifier »).
- Fichiers modifiés : `MarchesTiers.tsx` (`computeDuree`, `DureeInfo`, `daysBetween`,
  `formatDateOrDash`, `ViewField`, `MarcheTiersCard`, `ViewMarcheTiersModal`, retrait du
  `<table>`) ; `MarchesTiers.test.tsx` (tests réécrits pour la card, nouveaux tests pour la
  modale Visualiser).

# 18. Demande d'achat ↔ marché tiers, suppression physique d'un marché tiers (02/09/2026)

Deux chantiers liés, décidés le même jour :

**a) `finances.demande_achat` peut désormais référencer un marché tiers.** Lors de la création
d'une future demande d'achat, le demandeur choisira soit un marché service (`finances.marche`),
soit un marché tiers (`finances.marche_tiers`) — il faut pouvoir distinguer lequel a été
retenu. Stratégie retenue (proposée à l'utilisateur, deux options comparées) : **deux colonnes
FK nullables plutôt qu'une référence polymorphe** — `NUMMARCHE` (déjà existant, texte, unique
globalement) et `ID_MARCHE_TIERS` (nouveau, bigint, clé technique de `finances.marche_tiers`,
PAS unique globalement) sont de types et de garanties d'unicité différents ; les fusionner en
une seule colonne texte + discriminant aurait fait perdre une vraie contrainte FK d'un côté.
Contrainte `demande_achat_marche_exclusif_check` : jamais les deux renseignés en même temps
(les deux peuvent rester NULL, même principe que `MONTANT_RETENU`/`ID_FOURNISSEUR_RETENU` sur
cette table — nullable en base, obligatoire par règle applicative à un stade donné, pas de CRUD
`demande_achat` dans ce backend pour l'instant). Pas de colonne discriminante stockée : le type
se déduit de la colonne renseignée. Migration
`20260902090000_demande_achat_add_marche_tiers_ref.sql`.

**b) Suppression physique d'un marché tiers (icône corbeille, `MarchesTiers.tsx`)** — réservée
ADMIN_APP/ADMIN_SERVICE/CB (`assertManagesServiceOrHasRoleCb`, même triplet que création/
modification), autorisée seulement si aucune demande d'achat ne référence encore ce marché
tiers. **Devenue possible seulement grâce au point (a)** : au tour précédent (§17), la
suppression avait été explicitement reportée faute de lien en base pour vérifier "pas impliqué
dans une FAD" (`demande_achat.nummarche` ne référençait alors que `finances.marche`). Migration
`20260902091000_marche_tiers_delete_policy.sql` (grant + policy DELETE, sur le modèle
insert/update de `20260901130000_create_marche_tiers.sql`).

- Backend : `demandeAchat.repository.ts#existsForMarcheTiers` (même patron que
  `existsForFournisseurRetenu`) ; `marcheTiers.repository.ts#remove` ;
  `marcheTiers.service.ts#deleteMarcheTiers` (404 si introuvable, 403 sans droit, 409 si
  référencé par une DA — même structure que `fournisseur.service.ts#deleteFournisseur`) ;
  `DELETE /marches/tiers/:id` (controller + route).
- Frontend : icône corbeille dans `MarcheTiersCard` (gated `canManage`, même rôle exact que la
  policy DELETE) ; `DeleteMarcheTiersModal` — même patron que
  `Fournisseurs.tsx#DeleteFournisseurModal` (confirmation, message 409 de l'API affiché tel
  quel, oriente vers l'état Inactif).
- Tests : `marcheTiers.service.test.ts` (5 nouveaux cas `deleteMarcheTiers`) ;
  `MarchesTiers.test.tsx` (3 nouveaux cas : suppression réussie, "Annuler", 409).

# 19. Champs obligatoires du marché tiers, ACTIF auto-calculé (02/09/2026)

À la création comme à la modification d'un marché tiers, décision utilisateur : titulaire,
libellé (au moins 15 caractères), décomposition du prix, agent gestionnaire, montant maximum et
date de fin maximum deviennent obligatoires. Nouvelle règle associée : si la date de fin
maximum est déjà dépassée, `ACTIF` est forcé à `false`, quel que soit ce qui est soumis.

**Clarification actée avec l'utilisateur avant implémentation** : l'énoncé initial disait "si
fin max >= à la date du jour, passer inactif", ce qui est l'inverse de toute logique métier (un
marché dont la fin n'est pas encore atteinte serait alors marqué inactif). Confirmé qu'il
s'agissait d'une inversion : la règle implémentée est "si `DTEFINMAX < aujourd'hui`, `ACTIF` =
`false`" — cohérent avec la définition déjà en place ailleurs dans VIGIE (`MarchesPGI.tsx`,
« enregistré » = `DTEFINMAX >= aujourd'hui`).

- **Base** — migration `20260902100000_marche_tiers_champs_obligatoires.sql` :
  `MTMAXI`/`DTEFINMAX`/`TYPEDECOMPOPRIX`/`AGENTGESTION` passent `NOT NULL` (`ID_FOURNISSEUR`
  l'était déjà depuis la création de la table) ; nouvelle contrainte CHECK
  `marche_tiers_libelle_service_min_length` (`char_length(libelle_service) >= 15`). **Décision
  explicite : pas de contrainte CHECK basée sur `CURRENT_DATE`** pour la règle ACTIF/DTEFINMAX —
  un CHECK Postgres n'est évalué qu'à l'écriture, jamais en continu ; une ligne valide à sa
  création deviendrait silencieusement non conforme le lendemain sans qu'aucune écriture ne le
  déclenche. Cette règle reste donc purement applicative, recalculée à chaque
  création/modification (`marcheTiers.service.ts#isMarcheTiersExpire`), jamais une contrainte
  DB.
- **Backend** (`marcheTiers.service.ts`) : `createMarcheTiersSchema`/`updateMarcheTiersSchema`
  — tous les champs listés ci-dessus retirés de `.nullable().optional()`, `libelleService`
  passe `.min(1, …)` à `.min(LIBELLE_MIN_LENGTH, …)`. `ACTIF` calculé (jamais transmis tel quel
  par le client) : `!isMarcheTiersExpire(dtefinmax)` à la création ; à la modification,
  `isMarcheTiersExpire(dtefinmax) ? false : (data.actif ?? existing.actif)` — l'interrupteur
  "Actif" de la modale reste donc effectif tant que la date de fin n'est pas dépassée, mais n'a
  plus le dernier mot une fois dépassée. Type `MarcheTiers` (repository et hook frontend) mis à
  jour en conséquence (`mtmaxi`/`dtefinmax`/`typedecompoprix`/`agentgestion` non nullables —
  `dtedebut` l'est devenu aussi le même jour, voir §20 ci-dessous).
- **Frontend** (`MarchesTiers.tsx`) : `MarcheTiersFormModal` — message de validation étendu à
  tous les nouveaux champs obligatoires (texte différent création/modification, "Numéro de
  marché" n'apparaissant qu'en création) ; contrôle séparé pour la longueur du libellé (message
  dédié) ; libellé du champ Libellé complété "(15 caractères minimum)" ; interrupteur "Actif"
  désactivé et forcé décoché si `DTEFINMAX` est dépassée, avec un texte d'aide expliquant
  pourquoi (reflet de la règle serveur, pas la source de vérité — le backend recalcule de toute
  façon). **Bug corrigé au passage** : `agentMatricule` n'était jamais pré-rempli à l'ouverture
  de la modale de modification (`useEffect` manquant, présent dans l'équivalent
  `EditMarcheModal` de MarchesPGI.tsx mais oublié ici à la création du formulaire le 01/09/2026)
  — resté inoffensif tant qu'AGENTGESTION était optionnel, devenu bloquant maintenant qu'il est
  obligatoire (un "Enregistrer" sans y retoucher aurait renvoyé `agentgestion: null` et échoué en
  400 même si la fiche avait déjà un agent valide).

# 20. DTEDEBUT rejoint la liste des champs obligatoires, incident de migration (02/09/2026)

Quelques heures après §19, extension de la même liste de champs obligatoires du marché tiers à
`DTEDEBUT` (date de début) — même traitement que les autres : Zod (`createMarcheTiersSchema`/
`updateMarcheTiersSchema`, `.min(1, 'La date de début est obligatoire.')`), type `MarcheTiers`
(repository backend + hook frontend, `dtedebut: string` au lieu de `string | null`), message de
validation frontend étendu, `fillRequiredFields()` des tests mis à jour. Migration séparée
(`20260902110000_marche_tiers_dtedebut_obligatoire.sql`, plutôt qu'une modification de
`20260902100000...sql` déjà exécutée) : `alter column dtedebut set not null`.

**Incident traité en cours de route** : la première tentative d'exécution de
`20260902100000_marche_tiers_champs_obligatoires.sql` par l'utilisateur a échoué
(`23502: column "mtmaxi" of relation "marche_tiers" contains null values`) — une ligne de test
résiduelle (`id_marche_tiers=2`, `nummarche=P2605112`, `libelle_service="TEST"`) créée pendant
le développement de la fonctionnalité avait `mtmaxi`/`agentgestion` non renseignés (et un
libellé de 4 caractères, qui aurait de toute façon échoué à la contrainte de longueur).
Vérification en lecture seule du contenu réel de la table (jamais d'écriture directe, règle du
projet) pour confirmer qu'il s'agissait bien de données de test avant de proposer une solution.
Après clarification avec l'utilisateur (question initiale mal formulée, reformulée plus
simplement), la ligne a été supprimée par l'utilisateur lui-même (`delete from
finances.marche_tiers where id_marche_tiers = 2;`), puis la migration relancée avec succès —
confirmé par une nouvelle lecture du schéma (colonnes bien passées `NOT NULL`). Avant d'écrire
la migration DTEDEBUT, même vérification en lecture seule : la ligne restante en base avait déjà
`dtedebut` renseigné, aucun nouveau blocage attendu.

# 21. Tableau de bord des marchés (02/09/2026)

Nouvelle page `/marches/tdb`, entrée "Tableau de bord" dans la sidebar de la section Marchés —
indicateurs chiffrés agrégés, style PowerBI (cartes avec un gros chiffre).

- **Aucun nouvel endpoint backend** : la page réutilise directement `useMarches`/
  `useMarcheTiers` (déjà utilisés par MarchesPGI.tsx/MarchesTiers.tsx) — le périmètre
  (service propre / libre pour ADMIN_APP) est donc déjà appliqué côté serveur par ces deux
  hooks, sans code supplémentaire. Filtre Direction → Service : copie exacte du mécanisme déjà
  en place sur les deux autres pages Marchés.
- **Composant visuel réutilisé, pas réinventé** : avant d'écrire la moindre ligne de CSS
  (`ForClaude/INSTRUCTIONS_UX.md` l'impose), recherche dans `gpmm-style-guide.html`/
  `GUIDELINES.md` d'un équivalent "carte indicateur" — trouvé dans
  `exemple-erp-voyageurs.html` (`.metrics-grid`/`.metric-card`/`.metric-label`/
  `.metric-value`/`.metric-meta`), et confirmé **déjà présent tel quel dans
  `gpmm.css`** (donc déjà disponible dans tout `frontend/`, aucun import supplémentaire
  nécessaire). Les sections sont regroupées avec `.gp-panel`/`.panel-header`/`.eyebrow`,
  également déjà dans `gpmm.css`. Aucun composant ad hoc inventé.
- **Nouveau fichier `frontend/src/styles/tableauDeBord.css`** (demande explicite de
  l'utilisateur, en prévision d'autres tableaux de bord futurs) — volontairement réduit à ce
  qui manque réellement au gabarit : deux modificateurs `.metric-value.warning`/
  `.metric-value.danger` pour teinter le gros chiffre d'une carte (gpmm.css ne teinte que
  `.metric-meta`, jamais `.metric-value`), sur le même principe que les modificateurs déjà
  présents dans gpmm.css (`.metric-meta.success`/`.metric-meta.warning`).
- **Indicateurs** — « États des marchés du service » (finances.marche) : Marchés, Actifs,
  Complets, Utilisables, MAPA, Marché, En alerte (union alerte date/montant), Alerte sur date,
  Alerte sur montant. « Marchés d'un service tiers » (finances.marche_tiers) : Marchés tiers,
  Actifs, Alerte sur date (pas d'alerte montant : aucun suivi de consommation pour cette
  entité, cohérent avec §17). `isAlerteDuree`/`isAlerteMontant` dupliqués localement dans
  `MarchesTdb.tsx`, réduits au seul booléon `isAlerte` des fonctions `computeDuree`/
  `computeMontant` de MarchesPGI.tsx/MarchesTiers.tsx (même formule, la barre de progression
  n'a pas de sens pour un compteur).

**Révision visuelle le même jour, en deux passes** (`tableauDeBord.css` complété à chaque fois,
toujours sans toucher gpmm.css, toujours sur ses seuls tokens/composants) :

*Passe 1* (retour utilisateur : « essaie un UX un peu plus sexy ») — pastille ronde colorée à
gauche de chaque carte (`.metric-card--icon`/`.metric-card__icon`, icône du sprite partagé),
teinte par variante (`.info`/`.success`/`.warning`/`.danger`, paires `--gp-*-bg`/`--gp-*` de
gpmm.css) et légère élévation au survol. Hiérarchie sur les alertes : « En alerte » (le total)
en `danger` (rouge), ses deux composantes « Alerte sur date »/« Alerte sur montant » en
`warning` (orange). Neuf cartes de la section « États des marchés du service » réparties en
trois sous-groupes (`.tdb-subgroup`, chacun un `.eyebrow` + une grille) plutôt qu'une seule
grille de neuf : Vue d'ensemble (Marchés/Actifs/Complets/Utilisables, `.metrics-grid` 4
colonnes) ; Type de procédure (MAPA/Marché) ; Alertes (En alerte/Alerte sur date/Alerte sur
montant) — ces deux derniers sur `.grid` (auto-adaptatif, gpmm.css) plutôt que `.metrics-grid`
(4 colonnes fixes) pour éviter les colonnes vides d'une grille à 4 colonnes sous-remplie par 2
ou 3 cartes.

*Passe 2* (retour utilisateur, même jour : « retire les icônes... ils ne sont pas adaptés » +
demande de présentation en deux colonnes + bandeau de dernier import) —
`.metric-card--icon`/`.metric-card__icon` entièrement retirés (icône jugée pas adaptée à une
simple étiquette chiffrée) : ne reste que l'élévation au survol, désormais posée directement
sur `.metric-card`. **Présentation en deux colonnes** via `.demo-grid` (gpmm.css — déjà utilisé
dans `exemple-erp-voyageurs.html` pour panneau principal + panneau latéral, collapse à une
colonne sous 1100px), colonne de gauche plus large (`1.6fr`) pour « États des marchés du
service » (trois sous-groupes) et colonne de droite plus étroite (`.7fr`) pour « Marchés d'un
service tiers » (une seule grille) — repris tel quel, aucune nouvelle règle de grille écrite.
**Bandeau « État des marchés au [date] »** ajouté sous le titre de la colonne de gauche : copie
exacte du bandeau de `MarchesPGI.tsx` (`useMarcheLastImport`, mêmes constantes
`IMPORT_STALE_JOURS`/`PARAMETRE_NON_INITIALISE` dupliquées ici comme partout ailleurs dans ce
module de pages) — mêmes trois cas (paramètre non initialisé, aucun import effectué, import
obsolète depuis plus de 15 jours).

# 22. Pièces documentaires d'un marché (CCAP/CCTP/AE/AVENANT/BPU/AUTRE) (02/09/2026)

Table neuve `finances.marche_piece` (migration `20260902120000_create_marche_piece.sql`),
**indépendante de `finances.piece_jointe`** — celle-ci reste exclusivement polymorphe
DEMANDE_ACHAT/CERTIFICAT_SERVICE_FAIT (`ForClaude/CDC/mld-phases-1-2.md` §2.4/§4), un
rattachement MARCHE y romprait son CHECK déjà figé au CDC. Décision explicite de
l'utilisateur : une seule table pour les deux familles de marché plutôt que deux, un marché
service (`finances.marche`) et un marché tiers (`finances.marche_tiers`) pouvant chacun
recevoir des pièces.

**Modèle** — `TYPE_MARCHE` (`SERVICE`/`TIERS`) discrimine laquelle de `NUMMARCHE`
(clé naturelle du marché service) ou `ID_MARCHE_TIERS` (clé technique du marché tiers) est
renseignée, exactement une des deux (`CHECK` en base). Une pièce porte aussi :
- `TYPE_PIECE` : `CCAP`/`CCTP`/`AE`/`AVENANT`/`BPU`/`AUTRE`.
- `NUMERO_AVENANT` (entier ≥ 0) — saisi manuellement au dépôt, modifiable ensuite
  indépendamment du fichier. Pas de contrainte d'unicité sur le couple
  (`TYPE_PIECE`, `NUMERO_AVENANT`) : plusieurs pièces peuvent légitimement le partager (ex.
  un AE corrigé après coup, conservé à côté du premier).
- `NOM_FICHIER_ORIGINAL` (affichage/téléchargement uniquement) et `STORAGE_PATH` — chemin
  neutre généré côté serveur (`service/<nummarche>/<uuid>.pdf` ou
  `tiers/<id_marche_tiers>/<uuid>.pdf`), jamais le nom d'origine (`SECURITY.md` §10).
- `TAILLE_OCTETS` (≤ 10 Mo) et `MATRICULE_DEPOT`.

**Stockage** : bucket Supabase Storage dédié `marche-pieces`, privé, `application/pdf`
uniquement, 10 Mo max côté bucket **et** revalidé côté Express (`marchePiece.service.ts`,
signature `%PDF` vérifiée sur le buffer réel — pas seulement le `Content-Type` déclaré par le
navigateur). Ordre du dépôt : upload du fichier d'abord (chemin neutre), puis insertion de la
ligne de métadonnées ; si l'insertion échoue, nettoyage immédiat du fichier orphelin plutôt que
de laisser une ligne pointer vers un fichier absent — l'inverse (pièce visible mais
impossible à télécharger) aurait été pire. Suppression physique, sans trace résiduelle
(contrairement au marché tiers, où `ACTIF` sert d'archivage — une pièce supprimée n'a pas de
sens à conserver) : ligne d'abord (aucune pièce visible ne doit pouvoir survivre à son propre
fichier), fichier ensuite en best-effort (un échec de suppression du fichier laisse au pire un
objet orphelin dans le bucket, journalisé, sans impact utilisateur).

**Droits** : lecture ouverte à tout utilisateur authentifié pour le marché de son propre
service (même périmètre que la lecture du marché visé lui-même) — RLS `USING
(current_user_matricule() IS NOT NULL)`, scoping fin par service appliqué côté Express
(`marchePiece.service.ts#resolveReadScope`/`assertReadAccess`), pas en base, comme partout
ailleurs dans ce backend. Dépôt/modification métadonnées/suppression réservés
`assertManagesServiceOrHasRoleCb` (ADMIN_APP/ADMIN_SERVICE/CB) — même triplet que
`finances.marche_tiers`, traduit aussi en policies RLS sur la table et sur `storage.objects`
(filet de sécurité pour un appel direct à l'API Storage avec le JWT d'un utilisateur ; le
backend utilise `service_role` et les contourne de toute façon, le vrai périmètre est imposé
côté Express).

**Backend** : `marchePiece.repository.ts` (CRUD table + `uploadFile`/`downloadFile`/
`removeFile` sur le bucket, aucune logique métier), `marchePiece.service.ts` (résolution du
service propriétaire du marché visé — même double voie que
`marche.service.ts#resolveMarcheIdService`, dupliquée plutôt que partagée pour garder chaque
ressource autonome —, validation Zod, contrôle MIME réel), `marchePiece.controller.ts`,
routes `GET/POST /marches/pieces`, `PUT/DELETE /marches/pieces/:id`,
`GET /marches/pieces/:id/download` (`marchePiece.routes.ts`, `requireAuth` en tête, upload via
`multer` en `memoryStorage` — le fichier ne touche jamais le disque avant l'envoi au bucket).

**Frontend** : deux modales, ouvertes depuis l'icône « Visualiser les pièces » (`#i-folder`,
ouverte à tout le monde) et l'icône « Ajouter une pièce » (`#i-cloud`, réservée `canManage`)
de chaque carte marché — présentes à l'identique sur `MarchesPGI.tsx` (marché service) et
`MarchesTiers.tsx` (marché tiers), seule la `marcheRef` transmise change.
- `PiecesMarcheModal.tsx` — liste des pièces (triées par numéro d'avenant puis type côté
  backend), téléchargement toujours possible, édition du couple type/numéro d'avenant et
  suppression (avec confirmation) réservées `canManage`.
- `AddPieceMarcheModal.tsx` — type de pièce et numéro d'avenant demandés avant l'intégration
  du fichier (décision utilisateur), modifiables ensuite indépendamment via
  `PiecesMarcheModal`.
- `FileDropzone.tsx` — nouveau composant dédié (glisser-déposer + clic, validation type/taille
  côté client), aucun équivalent dans `gpmm-style-guide.html` : motif nouveau plutôt
  qu'improvisé, toutes les valeurs visuelles passent par les variables `--gp-*`
  (`styles/marche.css`, classes `.marche-dropzone*`), contrairement au précédent ad hoc
  d'`ImportMarches.tsx` qui codait des couleurs de repli en dur.
- Hook `usePiecesMarche.ts` — partie liste sur le modèle de `useMarches.ts`
  (`{ pieces, loading, error, refetch }`), partie mutation (dépôt/métadonnées/suppression/
  téléchargement) en state-machine sur le modèle de `useMarcheImport.ts`. Téléchargement via
  `api.getBlob` + lien `<a download>` généré en mémoire (`URL.createObjectURL`), jamais de
  navigation directe vers l'URL du fichier (bucket privé, nécessite le JWT applicatif).

**Test d'intégration bout-en-bout ajouté le 02/09/2026** (`marchePiece.routes.test.ts`) :
routes → `requireAuth` → vrai parsing multipart par `multer` → controller → service →
repository (seule la frontière Supabase est mockée) — complète les tests unitaires
existants (`marchePiece.service.test.ts` côté backend, `AddPieceMarcheModal.test.tsx`/
`PiecesMarcheModal.test.tsx`/`FileDropzone.test.tsx` côté frontend). Découverte à cette
occasion, non corrigée (hors périmètre) : un fichier dépassant la limite `multer` (10 Mo)
produit une 500 générique plutôt qu'une 400 propre — l'erreur `MulterError` n'est jamais
traduite en `AppError`. Aucune vérification manuelle en navigateur possible dans cet
environnement. Aucun lien avec une demande d'achat à ce stade (contrairement à
`finances.demande_achat` qui référence déjà `finances.marche`/`finances.marche_tiers`, voir
§18) — la table `marche_piece` ne porte aucune colonne de rattachement à une DA, malgré le
commentaire de migration l'évoquant comme usage futur ("utile plus tard à la création d'une
demande d'achat").

**RLS resserrée le 02/09/2026** (migration `20260902130000_marche_piece_add_id_service.sql`,
suite à un audit de sécurité) : la policy `SELECT` initiale n'exigeait que
`current_user_matricule() IS NOT NULL`, sans scoping par service — un agent authentifié
pouvait lire, via l'API REST Supabase directe (en contournant Express), les pièces de tous
les services. Colonne `ID_SERVICE` ajoutée (stampée une fois à l'insertion par
`marchePiece.service.ts#uploadPiece`, jamais réécrite — sans risque de dérive, le service
d'un marché/marché tiers étant immuable après création), nouvelle fonction
`finances.current_user_id_service()` (résout le service de l'utilisateur courant via
`ACTEUR.ID_CELLULE → CELLULE.ID_SERVICE`), policy `marche_piece_select_scoped` remplaçant
`marche_piece_select_authenticated`. `uploadPiece` refuse désormais explicitement (404) un
dépôt dont le service serait irrésolvable, plutôt que de laisser échouer l'insertion sur la
contrainte `NOT NULL`. `finances.marche_tiers` a reçu le même traitement le jour même
(migration `20260902140000_marche_tiers_select_scoped.sql`) : contrairement à
`marche_piece`, aucune colonne à ajouter (`ID_SERVICE` existe depuis sa création), simple
remplacement de `marche_tiers_select_authenticated` par `marche_tiers_select_scoped` (même
fonction `finances.current_user_id_service()`, aucun changement de code applicatif
nécessaire côté Express). Les deux tables sont désormais scopées par service au niveau RLS.
Voir `docs/ARCHITECTURE.md` ("Module Marchés") pour le détail technique.

# 9. Historique

- 29/08/2026 : premier jet, à partir de `import.txt` (description utilisateur) et de
  l'inspection technique du fichier réel `Modele importation marchés PGI.xlsx`.
- 29/08/2026 (décisions d'architecture) : acteur/service cible tranché (ADMIN_SERVICE sur son
  propre service, aucun changement MOT/MCT nécessaire) ; pas d'étape de confirmation
  intermédiaire (l'« aperçu » décrit initialement correspond en réalité au compte-rendu final
  déjà prévu par OP3.1, produit après import) ; étape d'intégration = reprise directe d'OP3.1 ;
  paramètre `last.import.marche.pgi` à créer manuellement par service avant le premier import
  de ce service.
- 29/08/2026 (décisions de détail) : mapping des colonnes B/C/G-M confirmé ; colonne F
  ignorée à l'import ; compte-rendu à l'écran et téléchargeable ; valorisation de tous les
  champs `finances.marche` absents du fichier actée, révélant au passage (a) un nouveau champ
  requis `DTELASTIMPORT` (date de dernière importation par marché, absent du MLD actuel) et
  (b) que `ALERTEMT`/`ALERTEDATE` sont en réalité des seuils en pourcentage (montant réalisé
  vs référence, durée écoulée du marché) et non un montant brut/une date calendaire comme
  leur nom le suggérait — à corriger dans le MLD §2.2. Garde-fou optionnel sur la cellule
  `Activité` du fichier explicitement écarté.
- 29/08/2026 (précision création/modification) : à la modification d'un marché déjà existant
  (même `NUMMARCHE`), seuls les champs ayant une correspondance directe avec une colonne du
  fichier (§3, colonnes A-M) sont réécrits — tous les autres champs (§3, tableau des champs
  absents du fichier) ne reçoivent leur valeur qu'à la création et ne sont plus jamais
  réécrits ensuite, même si modifiés manuellement entre-temps. Exception : `DTELASTIMPORT`
  est réécrit à chaque import pour toute ligne présente dans le fichier (création ou
  modification), mais pas pour une ligne archivée (absente du fichier). Répercuté dans le
  MLD §2.2 (voir entrée correspondante).
- 29/08/2026 (correction type PLANPREVENTIONACTIF) : le champ n'est plus un booléen mais du
  texte, défaut `NULL` — décision de l'utilisateur, ce champ n'étant plus un simple oui/non
  mais une valeur à renseigner manuellement ultérieurement. Migration proposée :
  `supabase/migrations/20260829180000_marche_planpreventionactif_to_text.sql`. Répercuté
  dans le MLD §2.2.
- 30/08/2026 (ACTIF/COMPLETUDE/UTILISABLE) : `ETATMARCHE` (texte) remplacé par `ACTIF`
  (booléen), aligné sur le reste du référentiel organisationnel — décision utilisateur.
  Règle d'archivage raffinée : `ACTIF = FALSE` uniquement si le marché absent du fichier est
  `TYPE_CREATION = PGI` (une création manuelle de marché est prévue, jamais désactivée
  automatiquement par un import qui ne la contient pas — `TYPE_CREATION` aura donc une
  seconde valeur, non encore nommée). Nouveaux champs `COMPLETUDE` (booléen, `FALSE` à la
  création, recalculé automatiquement dès que `TYPEDECOMPOPRIX`/`NATUREPRESTA`/
  `AGENTGESTION`/`TITULAIRE_SERVICE`/`PLANPREVENTIONACTIF`/`ALERTEMT`/`ALERTEDATE` sont tous
  renseignés — `MTMINI` exclu du calcul, son défaut `0` ne permettant pas de distinguer
  « laissé à 0 » de « jamais renseigné », à confirmer) et `UTILISABLE` (colonne générée
  Postgres `ACTIF AND COMPLETUDE`, jamais écrite directement). **Seuls les marchés
  `UTILISABLE` seront proposés à la création d'une demande d'achat (OP1.1)** — règle à
  répercuter dans le MCT et le MCD, hors périmètre de cette mise à jour. Le renommage
  `ETATMARCHE → ACTIF` doit aussi être répercuté dans le MCT (OP3.1, contrôle croisé), non
  fait à ce stade. Migration proposée :
  `supabase/migrations/20260830090000_marche_actif_completude_utilisable.sql`. Répercuté
  dans le MLD §2.2.
- 30/08/2026 (élargissement acteur — CB) : l'import marchés est désormais aussi ouvert à
  **ADMIN_APP** (transverse) et **CB** (Contrôle Budgétaire, scopé à son propre service),
  en plus d'ADMIN_SERVICE — décision propre à cet import, ne change pas la tâche générale
  MOT « Lancer les imports PGI (marchés, CUG, opérations) » (toujours `admin_service` seul
  pour CUG/opérations). Appliqué pour l'instant uniquement côté frontend
  (`filterMarchesSidebarItems`, masque "Importation marchés PGI" dans la sidebar sans l'un
  des trois rôles, `ImportMarches.tsx` affiche un message de droits insuffisants en repli) —
  aucun backend d'import n'existe encore pour l'appliquer réellement ;
  `assertManagesService` devra être étendu pour reconnaître CB le moment venu.
- 30/08/2026 (construction complète) : revirement sur la décision du 29/08 — vraie pause de
  confirmation avant l'intégration réelle (§5), divergence assumée avec OP3.1 (MCT), signalée
  mais MCT non modifié à ce stade. Backend construit de bout en bout :
  `assertManagesServiceOrHasRoleCb` (nouvelle fonction dédiée dans `authorization.service.ts`,
  ne modifie pas `assertManagesService` — CB ne doit pas hériter de droits sur
  SITE/SECTEUR/CUG/FOURNISSEUR/SEUIL_VALIDATION_DS) ; `last.import.marche.pgi` ajouté à
  `PARAMETRE_SCHEMAS` ; `marche.repository.ts` étendu (`findByNummarche`, `findByCugCodes` —
  le service d'un marché se résout via son CUG, `finances.marche` n'a pas de colonne
  `id_service` propre —, `create`, `update`, `archiveMany`) ; nouveau
  `marcheImport.service.ts` (parsing `exceljs`, validation étapes 1/2, diff étape 3,
  intégration étape 4/5/6). Dépendances ajoutées : `multer` (upload, `memoryStorage`,
  jamais de persistance disque) et `exceljs` (parsing, préféré à `xlsx`/SheetJS pour son
  historique de maintenance) — `uuid` (dépendance transitive d'`exceljs`) forcé à `^11.1.1`
  via `overrides` dans le `package.json` racine pour corriger une vulnérabilité modérée
  (GHSA-w5hq-g745-h8pq), sans changement de comportement observé. Frontend : nouveau hook
  `useMarcheImport.ts` (état `idle→previewing→ready→confirming→done`, fichier ré-envoyé tel
  quel à la confirmation) et réécriture complète d'`ImportMarches.tsx` (zone de glisser-déposer,
  filtre Direction→Service pour ADMIN_APP calqué sur `Cellules.tsx`, service propre en lecture
  seule pour ADMIN_SERVICE/CB, compte-rendu téléchargeable généré côté client). `api.ts` a
  gagné `postForm` (upload multipart, ne fixe pas `Content-Type` pour laisser le navigateur
  générer la boundary). Découverte associée, corrigée dans la même migration : `SIREN` devient
  nullable pour `TYPE_CREATION='PGI'` (voir plus haut). Tests : 21 (backend,
  `marcheImport.service.test.ts`) + 8 (frontend, `ImportMarches.test.tsx`) ; suites complètes
  au vert des deux côtés. Pas de vérification manuelle en navigateur possible dans cet
  environnement.
- 30/08/2026 (préfixe `S`) : `deriveTypeProc` reconnaît désormais aussi le préfixe `S` (en plus
  de `M`) pour dériver `TYPEPROC = MARCHE` — décision utilisateur (§3, tableau ci-dessus mis à
  jour). Le fichier modèle contient déjà un exemple (`S2109325`, ligne 631).
- 30/08/2026 (`LIBELLE_SERVICE`) : oubli corrigé — à la création, `LIBELLE_SERVICE` est
  initialisé avec la valeur `LIBPGI` du fichier (colonne B, « Libellé de marché ») plutôt que
  `NULL`, sur le même principe que `FOURNISSEUR.RAISON_SOCIALE_SERVICE`/`RAISON_SOCIALE_PGI` —
  décision utilisateur. Toujours **jamais réécrit** à la modification (tableau ci-dessus).
- 30/08/2026 (date de fin, règle d'éligibilité — allers-retours) : un 3e contrôle à l'étape 2
  (§7) a été ajouté — `DTEFINMAX` (colonne H) doit être postérieure ou égale à la date de
  génération du fichier (D1) pour que la ligne soit importée — puis entièrement retiré sur un
  premier retour utilisateur (sur un export réel, il excluait 230 lignes sur 275, marchés
  historiques déjà terminés), avant d'être rétabli une seconde fois avec une nuance : la ligne
  reste bien exclue de l'intégration si la condition échoue, mais **sans plus apparaître dans la
  liste des anomalies** du compte-rendu (contrairement au contrôle CUG, qui lui reste
  signalé) — c'est ce comportement final qui est actif. Voir §7 pour le détail.
- 30/08/2026 (bug `TYPE_CREATION` — contrainte CHECK préexistante non compatible) : la
  confirmation échouait systématiquement dès la première création (`violates check constraint
  "marche_type_creation_check"`, code Postgres `23514`). Cause obtenue par lecture directe de
  la contrainte (`pg_get_constraintdef`, fournie par l'utilisateur — non lisible via l'API
  Supabase/PostgREST) : `marche_type_creation_check` n'autorisait que `'SERVICE'`/`'AUTRE'`,
  jamais `'PGI'` — contrainte posée avant ce chantier, jamais mise à jour pour l'import.
  Migration `20260830130000_marche_type_creation_add_pgi.sql` (étend la contrainte, ajoute
  `'PGI'` aux valeurs autorisées, conserve `'SERVICE'`/`'AUTRE'`) — à exécuter avant de pouvoir
  confirmer un import. Tableau ci-dessus (`TYPE_CREATION`) mis à jour.
- 30/08/2026 (`RAISON_SOCIALE_SERVICE` du fournisseur auto-créé, confirmation) : initialisé avec
  `TITULAIRE` de la ligne (colonne C, « Nom du Fournisseur »), identique à `RAISON_SOCIALE_PGI`
  — comportement déjà en place, confirmé par l'utilisateur. Le repli sur `NUM_TITULAIRE` (déjà
  présent) ne joue que dans le cas marginal où `TITULAIRE` est vide dans le fichier, pour
  respecter la contrainte `NOT NULL` de la colonne en base — §5 point 5 précisé.
- 30/08/2026 (barre de progression à la confirmation) : le design system GPMM ne contenait
  aucun composant de ce type — plutôt que d'improviser localement (interdit par
  `ForClaude/Template UX/GUIDELINES.md`), un nouveau composant `.gp-progress` (variantes
  déterminée/indéterminée) a été ajouté **au template partagé** (`gpmm.css`,
  `gpmm-style-guide.html`, `GUIDELINES.md`) — décision utilisateur, impacte toutes les
  applications GPMM, pas seulement VIGIE. `frontend/src/styles/gpmm.css` resynchronisé à
  l'identique. Utilisé dans `ImportMarches.tsx` (variante indéterminée) pendant l'étape
  `confirming` — aucune progression chiffrée disponible côté backend (un seul appel HTTP,
  pas de streaming).
- 30/08/2026 (`TITULAIRE_SERVICE`) : même oubli que `LIBELLE_SERVICE` (29/08/2026) — à la
  création, `TITULAIRE_SERVICE` est désormais initialisé avec `TITULAIRE` du fichier (colonne
  C, « Nom du Fournisseur ») plutôt que `NULL` — constaté par l'utilisateur sur des marchés
  fraîchement importés (`titulaire_service` toujours `NULL` malgré `titulaire` renseigné).
  Toujours **jamais réécrit** à la modification (tableau ci-dessus). Un script de backfill
  ponctuel (`update finances.marche set titulaire_service = titulaire where titulaire_service
  is null`) avait déjà été fourni séparément pour les lignes déjà en base au moment de ce
  correctif.
- 30/08/2026 (affichage du dernier import à côté du service) : nouveau `GET
  /api/marches/import/last-import?idService=X` (même autorisation que preview/confirm —
  `assertManagesServiceOrHasRoleCb`), lit `last.import.marche.pgi` pour le service donné en
  distinguant absence de ligne (`exists: false`) de valeur vide (`exists: true, valeur: null`).
  Affiché sous le sélecteur Service (ADMIN_APP) ou sous le rappel Direction/Service en lecture
  seule (ADMIN_SERVICE/CB) via `useLastImportMarchePgi.ts`, dans `ImportMarches.tsx`.
- 30/08/2026 (bug `ALERTEMT`/`ALERTEDATE` inversés) : la confirmation échouait systématiquement
  (« Erreur interne du serveur ») dès la première ligne créée, sans qu'aucun marché n'apparaisse
  en base (le fournisseur auto-créé pour cette ligne, lui, était bien persisté — écriture non
  transactionnelle, effet de bord constaté). Diagnostiqué en lisant le schéma réel de
  `finances.marche` via l'OpenAPI exposé par PostgREST (lecture seule, aucune requête
  d'écriture) : `ALERTEMT` est `numeric` (ratio, défaut `0.8`), `ALERTEDATE` est **`integer`**
  (nombre de jours, défaut `120`) — l'inverse de ce que le code envoyait depuis la construction
  initiale (`ALERTEMT_DEFAUT = 120`, `ALERTEDATE_DEFAUT = 0.8`), provoquant une erreur Postgres
  à l'insertion (`0.8` dans une colonne `integer`). Constantes corrigées dans
  `marcheImport.service.ts` ; tableau ci-dessus mis à jour en conséquence.
- 01/09/2026 (« État des marchés au [date] » sur MarchesPGI.tsx — voir §11) : premier essai
  fautif, corrigé le jour même. La première version réutilisait le mécanisme générique
  `GET /parametres/:cle` (`parametre_effectif`, portée service **avec héritage**
  direction/global), étendu d'un `idService` optionnel honoré pour ADMIN_APP — repéré comme
  incorrect en préparant le renommage de `Marches.tsx` en `MarchesPGI.tsx` : la lecture aurait
  pu remonter une valeur définie au niveau direction et l'afficher comme si c'était la date
  d'import propre au service consulté, alors que `findLastImportRow` (ci-dessus, 30/08/2026)
  existe déjà précisément pour éviter ce cas, en lisant la ligne exacte du service. Cet essai a
  été entièrement retiré (`parametres.service.ts#getParametreEffectif` et son controller
  redevenus tels qu'avant, `hooks/useParametre.ts` sans le paramètre `idService`).
  Correctif définitif : nouveau `GET /api/marches/last-import?idService=X` (`marche.routes.ts`,
  `marche.controller.ts#getMarcheLastImport`, `marche.service.ts#getLastImportStatus`) —
  réutilise `findLastImportRow`, désormais exporté de `marcheImport.service.ts`, mais avec
  l'autorisation de lecture de `listMarches` (ouverte à tout acteur pour son propre service,
  ADMIN_APP libre du service consulté) plutôt que `assertManagesServiceOrHasRoleCb` : la page
  "États des marchés du service" reste ouverte à tous, contrairement à `ImportMarches.tsx`.
  Nouveau hook frontend `useMarcheLastImport.ts` (même forme que `useLastImportMarchePgi.ts`,
  endpoint différent). Décision utilisateur du même jour sur le texte affiché : si le paramètre
  n'a **aucune ligne pour ce service** (`exists: false`), afficher l'alerte
  `Paramètre "last.import.marche.pgi" non initialisé.` à la place du libellé de date — exactement
  le même texte que celui qui bloque désormais l'import lui-même (`checkLastImportParametre`,
  §2 point 1, constante partagée `PARAMETRE_NON_INITIALISE` exportée de
  `marcheImport.service.ts`, remplace l'ancien message plus long "n'existe pas pour ce
  service — un ADMIN_APP doit le créer…", le blocage de l'import à 400 étant inchangé).

**Note de nommage (01/09/2026)** : `frontend/src/pages/Marches.tsx` renommé en
`MarchesPGI.tsx` (composant `Marches` → `MarchesPGI`, route `/marches` inchangée) — les
mentions de `Marches.tsx` dans les sections §10/§11 ci-dessus (rédigées le 30/08/2026, avant le
renommage) restent donc historiquement exactes mais désignent le même fichier.
- 01/09/2026 (Marchés d'un service tiers — voir §12) : nouveau registre séparé de
  `finances.marche`, pour les marchés appartenant à un autre service du port ressaisis
  manuellement en vue d'une future demande d'achat. Duplication de `MarchesPGI.tsx` envisagée
  puis écartée (tableau de bord et modèle de données de `finances.marche` sans objet pour un
  marché non géré par le service). Nouvelle table `finances.marche_tiers`, premier module
  complet CRUD de ce backend avec lecture ouverte à tous mais écriture réservée
  ADMIN_APP/ADMIN_SERVICE/CB (policy RLS combinant les trois rôles, une première dans ce
  projet). Renomme au passage l'entrée de sidebar "Marchés externes" (coquille vide du
  01/09/2026, sans définition métier) en "Marchés d'un service tiers".
- 01/09/2026 (finances.marche — voir §13) : revirement sur la création manuelle actée le
  30/08/2026 — retirée entièrement (icône « Ajouter », `CreateMarcheModal`, `POST /marches`),
  seul l'import PGI crée désormais des marchés ; aucune suppression ni désactivation manuelle
  (déjà le cas). Icône « Modifier » câblée pour la première fois (jusqu'ici visuelle
  seulement, et de toute façon invisible pour tout marché sans MTMAXI/MT_SOLDE — bug corrigé au
  passage), réservée ADMIN_APP/ADMIN_SERVICE/CB, huit champs modifiables seulement. `COMPLETUDE`
  recalculée à chaque modification (première fois qu'elle peut changer après la création d'un
  marché importé). `TYPE_CREATION` confirmé toujours utile (protection des marchés
  historiquement créés manuellement contre l'archivage automatique de l'import), contrairement
  à une intuition initiale de l'utilisateur.
- 01/09/2026 (finances.marche — voir §14) : revirement sur §13, quelques heures plus tard —
  `TYPEPROC` retiré des champs modifiables via « Modifier » (renseigné à l'import, jamais
  modifiable ensuite, décision explicite de l'utilisateur). Sept champs modifiables au lieu de
  huit ; combobox « Type de procédure » retirée d'`EditMarcheModal` ; `COMPLETUDE` lit désormais
  `TYPEPROC` sur la ligne existante plutôt que sur l'entrée du formulaire.
- 02/09/2026 (liste des marchés — voir §15) : alerte "import obsolète" alignée sur la ligne
  "État des marchés au [date]" ; bouton "Filtrer" déplacé à côté du compteur, nouveau bouton
  "Supprimer les filtres" à côté (vide directement le filtre appliqué, contrairement à celui
  qui existait dans la modale). Modale de filtre refaite sur maquette utilisateur : les quatre
  critères passent de cases à cocher à deux états à un choix à trois états Oui/Non/Tous
  (`TriEtat`) — "Non" est une capacité nouvelle (voir uniquement les marchés qui NE vérifient
  PAS le critère, ex. seulement les archivés). Bouton "Supprimer les filtres" retiré de la
  modale (déplacé sur la page principale, voir ci-dessus).
- 02/09/2026 (modale « Visualiser » — voir §16) : icône « Visualiser » des cartes câblée pour la
  première fois (purement visuelle depuis le 30/08/2026). `ViewMarcheModal`, lecture seule,
  ouverte à tout le monde, sur croquis utilisateur — quatre groupes de champs (Identification,
  Caractéristiques, Dates significatives, Gestion du marché) plus Alerte sur date/montant.
  `code_cug`/`dtevalid`/`dtenotif` ajoutés au type frontend `Marche` (déjà renvoyés par le
  backend, jamais déclarés côté client faute d'écran les affichant).
- 02/09/2026 (marchés d'un service tiers — voir §17) : revirement sur §12, le tableau de
  `MarchesTiers.tsx` remplacé par une liste de cards (même patron que MarcheCard de
  MarchesPGI.tsx) — une seule barre "Durée" (pas de "Montant", aucun suivi de consommation pour
  cette entité), une seule pastille ACTIF (pas de COMPLETUDE). Icône Visualiser câblée
  (`ViewMarcheTiersModal`). Suppression physique demandée par l'utilisateur (ADMIN_APP/
  ADMIN_SERVICE, si non impliqué dans une FAD) mais **reportée** : vérification du schéma faite
  avant d'écrire du code — `finances.demande_achat.nummarche` ne référence que `finances.marche`
  (import PGI), aucun lien avec `finances.marche_tiers` n'existe encore pour permettre ce
  contrôle.
- 02/09/2026 (demande d'achat ↔ marché tiers, suppression marché tiers — voir §18) :
  `finances.demande_achat` gagne `ID_MARCHE_TIERS` (bigint, FK vers `finances.marche_tiers`),
  exclusif avec `NUMMARCHE` (contrainte `demande_achat_marche_exclusif_check`) — stratégie deux
  colonnes FK plutôt qu'une référence polymorphe, proposée puis validée avec l'utilisateur.
  Débloque la suppression physique d'un marché tiers (icône corbeille, ADMIN_APP/ADMIN_SERVICE/
  CB, 409 si référencé par une DA) reportée au tour précédent (§17) faute de ce lien.
- 02/09/2026 (champs obligatoires marché tiers, ACTIF auto-calculé — voir §19) : titulaire,
  libellé (≥ 15 caractères), décomposition du prix, agent gestionnaire, montant maximum, date de
  fin maximum obligatoires à la création comme à la modification (Zod + contraintes DB, migration
  `20260902100000_marche_tiers_champs_obligatoires.sql`). `ACTIF` forcé à `false` si `DTEFINMAX`
  est dépassée (règle applicative uniquement, jamais un CHECK basé sur `CURRENT_DATE`) —
  clarification actée avec l'utilisateur avant d'implémenter : l'énoncé initial ("si fin max >=
  aujourd'hui, inactif") était inversé par rapport à la logique métier. Bug corrigé au passage :
  `agentMatricule` jamais pré-rempli en modification (`useEffect` manquant depuis la création du
  formulaire le 01/09/2026), resté inoffensif tant qu'AGENTGESTION était optionnel.
- 02/09/2026 (DTEDEBUT obligatoire, incident de migration — voir §20) : `DTEDEBUT` rejoint la
  liste des champs obligatoires du marché tiers (migration
  `20260902110000_marche_tiers_dtedebut_obligatoire.sql`). Au passage : la première tentative
  d'exécution de la migration §19 avait échoué (`23502`, colonne `mtmaxi` contenant une valeur
  NULL) à cause d'une ligne de test résiduelle — vérifiée en lecture seule, confirmée comme
  donnée de test (`libelle_service="TEST"`), supprimée par l'utilisateur lui-même avant de
  relancer la migration avec succès.
- 02/09/2026 (tableau de bord des marchés — voir §21) : nouvelle page `/marches/tdb`
  ("Tableau de bord" dans la sidebar Marchés) — indicateurs chiffrés (marchés/actifs/complets/
  utilisables/MAPA/MARCHE/alertes pour finances.marche ; marchés tiers/actifs/alerte date pour
  finances.marche_tiers). Aucun nouvel endpoint : réutilise `useMarches`/`useMarcheTiers`
  existants. Composant visuel `.metrics-grid`/`.metric-card` trouvé déjà présent dans
  gpmm.css (visible dans exemple-erp-voyageurs.html) plutôt que réinventé — nouveau fichier
  `styles/tableauDeBord.css` (demandé explicitement, pour les futurs tableaux de bord)
  volontairement réduit à deux modificateurs de couleur absents du gabarit.
- 02/09/2026 (tableau de bord des marchés, révision — voir §21) : deux passes le même jour.
  D'abord pastilles d'icône colorées par carte + élévation au survol (retour « essaie un UX un
  peu plus sexy »), neuf cartes réparties en trois sous-groupes. Puis, sur nouveau retour, les
  icônes sont retirées (« pas adaptés »), la page passe en présentation deux colonnes
  (`.demo-grid` de gpmm.css, déjà utilisé ailleurs, rien de nouveau écrit) et gagne le bandeau
  « État des marchés au [date] »/alerte d'import obsolète sous le titre de gauche, copié tel
  quel de MarchesPGI.tsx (`useMarcheLastImport`).
- 02/09/2026 (pièces documentaires d'un marché — voir §22) : nouvelle table
  `finances.marche_piece`, indépendante de `finances.piece_jointe` (celle-ci reste
  exclusivement polymorphe DEMANDE_ACHAT/CERTIFICAT_SERVICE_FAIT, cf.
  `ForClaude/CDC/mld-phases-1-2.md` §2.4/§4 — un rattachement MARCHE romprait son CHECK déjà
  figé au CDC) — décision utilisateur d'une seule table pour marché service et marché tiers
  plutôt que deux. Bucket Storage privé dédié `marche-pieces` (PDF uniquement, 10 Mo max,
  vérifié aussi côté Express via la signature `%PDF` du buffer). Droits identiques à
  `finances.marche_tiers` (lecture ouverte scopée service, écriture
  ADMIN_APP/ADMIN_SERVICE/CB). Suppression physique sans trace résiduelle (contrairement à
  `marche_tiers` où `ACTIF` archive) — décision utilisateur, une pièce supprimée n'a pas de
  sens à conserver. Deux modales frontend (`PiecesMarcheModal`/`AddPieceMarcheModal`),
  nouveau composant `FileDropzone` (glisser-déposer, aucun équivalent dans le style guide,
  motif nouveau plutôt qu'improvisé), accessibles depuis les icônes « Visualiser les
  pièces »/« Ajouter une pièce » déjà présentes sur les cards de `MarchesPGI.tsx` et
  `MarchesTiers.tsx`. Pas de vérification manuelle en navigateur possible dans cet
  environnement ; aucun lien avec une demande d'achat à ce stade malgré le commentaire de
  migration l'évoquant comme usage futur.
- 02/09/2026 (test d'intégration bout-en-bout des pièces — voir §22) : `marchePiece.routes.test.ts`
  ajouté, exerce routes/`requireAuth`/`multer` réel/controller/service/repository (seule la
  frontière Supabase mockée) — comble le point non traité de l'entrée précédente. Découverte :
  un fichier dépassant la limite `multer` (10 Mo) produit une 500 générique, pas une 400
  propre (`MulterError` jamais traduite en `AppError`) — non corrigé, hors périmètre de cette
  tâche.
- 02/09/2026 (RLS resserrée sur `marche_piece` — voir §22) : audit de sécurité révélant que la
  policy `SELECT` initiale (matricule non nul, sans scoping service) permettait à tout agent
  authentifié de lire, via l'API REST Supabase directe, les pièces de tous les services.
  Colonne `ID_SERVICE` ajoutée (stampée une fois à l'insertion, jamais réécrite — service d'un
  marché/marché tiers immuable après création, vérifié dans `marche.service.ts`/
  `marcheTiers.service.ts` avant de retenir cette solution plutôt qu'une fonction SQL de
  résolution CUG/fournisseur), nouvelle fonction `finances.current_user_id_service()`, policy
  `marche_piece_select_scoped`. `uploadPiece` refuse désormais 404 si le service est
  irrésolvable. `finances.marche_tiers` a la même famille de risque (policy `SELECT` non
  scopée par service), non traitée dans cette migration.
- 02/09/2026 (RLS resserrée sur `marche_tiers` — voir §22) : même correctif que ci-dessus,
  appliqué à `finances.marche_tiers` (migration
  `20260902140000_marche_tiers_select_scoped.sql`) — `marche_tiers_select_authenticated`
  remplacée par `marche_tiers_select_scoped`. Plus simple que pour `marche_piece` : `ID_SERVICE`
  existe sur cette table depuis sa création (`20260901130000_create_marche_tiers.sql`), aucune
  colonne à ajouter, aucun changement de code Express nécessaire. Les deux tables du module
  Marchés sont désormais scopées par service en RLS, pas seulement côté Express.
