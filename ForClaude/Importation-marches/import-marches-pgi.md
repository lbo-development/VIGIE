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
