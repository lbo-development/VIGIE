---
MLD (Modèle Logique de Données) - CONSOLIDÉ Phases 1 & 2
Dérivé de mcd-phase1.md (validé) et mcd-phase2.md (validé le 23/08), par application des règles de passage Merise MCD → MLD. Intègre les 4 arbitrages client du 22/08 et les 9 décisions Phase 2 du 23/08.
Statut : Phase 1 complète et arbitrée ; Phase 2 validée (MCD Phase 2 arbitré, cf. mcd-phase2.md).
Remplace mld-phase1.md (qui devient obsolète).
Cible d'implémentation : Web App + base dédiée type Supabase/PostgreSQL — index uniques partiels et contraintes CHECK ci-dessous y sont implémentables.
Schéma physique (24/08/2026) : projet Supabase partagé entre plusieurs applications GPMM ; toutes les tables ci-dessous s'implémentent dans le schéma `finances`, pas `public` (sauf `profiles`, hors périmètre de ce MLD, qui reste dans `public` — voir ForClaude/SECURITY.md).
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
- **DIRECTION** (**ID_DIRECTION**, CODE_DIRECTION *(UNIQUE)*, LIBELLE_DIRECTION, ACTIF)
- **SERVICE** (**ID_SERVICE**, CODE_SERVICE *(UNIQUE)*, LIBELLE_SERVICE, #ID_DIRECTION → DIRECTION, ACTIF)
- **CELLULE** (**ID_CELLULE**, CODE_CELLULE *(UNIQUE)*, LIBELLE_CELLULE, #ID_SERVICE → SERVICE, ACTIF)
- **ACTEUR** (**MATRICULE**, NOM, PRENOM, FONCTION, #ID_CELLULE → CELLULE)

> **Clé technique pour DIRECTION / SERVICE / CELLULE.** PK = ID de substitution immuable ; le code métier (CODE_*) devient un attribut NOT NULL + UNIQUE, mutable en cas de réorganisation sans impact sur les FK. ACTEUR.MATRICULE et les référentiels PGI (CUG.CODE_CUG, MARCHE.NUMMARCHE, NUMERO_OPERATION) conservent leur clé naturelle (identifiant stable / clé de rapprochement à l'import).

## 2.2 Référentiels métier
- **SITE** (**CODE_SITE**, LIB_SITE, ORDRE_SITE, ACTIF, #(N)ID_SERVICE → SERVICE)
- **SOUS_SITE** (**#CODE_SITE → SITE**, **CODE_SOUS_SITE**, LIB_SOUS_SITE, ORDRE_SOUS_SITE, ACTIF) — PK composite (CODE_SITE, CODE_SOUS_SITE)
- **SECTEUR** (**CODE_SECTEUR**, LIB_SECTEUR, ORDRE_SECTEUR, ACTIF, #(N)ID_SERVICE → SERVICE)
- **SOUS_SECTEUR** (**#CODE_SECTEUR → SECTEUR**, **CODE_SOUS_SECTEUR**, LIB_SOUS_SECTEUR, ORDRE_SOUS_SECTEUR, ACTIF) — PK composite (CODE_SECTEUR, CODE_SOUS_SECTEUR)

> **Normalisation SITE / SECTEUR (26/08/2026).** Chaque gisement géographique (SITE) et technique (SECTEUR) est décomposé en deux niveaux : la table parent porte le libellé, l'ordre d'affichage et l'attachement au service ; la table enfant porte le code de sous-niveau, son ordre et son flag ACTIF. `ID_SERVICE` nullable en base à ce stade : il sera valorisé une fois le référentiel organisationnel (SERVICE) chargé. La FK de DEMANDE_ACHAT cible la table enfant (SOUS_SITE / SOUS_SECTEUR) via une clé composite — voir §2.4 pour le caractère désormais optionnel de ce sous-niveau (28/08/2026).
>
> **LIB_SOUS_SITE / LIB_SOUS_SECTEUR (28/08/2026).** Ajout d'un libellé propre sur la table enfant, distinct du code — l'IHM affiche désormais ce libellé plutôt que le code technique (`CODE_SOUS_SITE`/`CODE_SOUS_SECTEUR` restent la clé, non éditable après création). Rétro-remplis à la migration avec la valeur du code existant, à corriger ensuite au cas par cas.

- **CUG** (**CODE_CUG**, LIBELLE_CUG, #ID_SERVICE → SERVICE, **ACTIF** *(booléen, défaut true — ajout 29/08/2026, archivage par flag comme SITE/SECTEUR/FOURNISSEUR)*)
- **OPERATION_INVESTISSEMENT** (**NUMERO_OPERATION**, LIBELLE, MT_AP1, MT_AP8, MT_CP1, MT_CP8, DATE_CREATION, MT_INITIAL)
- **FOURNISSEUR** (**ID_FOURNISSEUR**, #ID_SERVICE → SERVICE, **ETATFOURNISSEUR** *(Actif | Inactif — ajout arbitrage 4)*, RAISON_SOCIALE_PGI, RAISON_SOCIALE_SERVICE, SIREN, NUMPGI, ADR1, ADR2, CP, VILLE, CEDEX, TYPE_CREATION) — colonne renommée SIRET → SIREN le 29/08/2026 (voir note ci-dessous)
- **CONTACT** (**ID_CONTACT**, #ID_FOURNISSEUR → FOURNISSEUR, NOM, PRENOM, MAIL, TELFIXE, TELMOBILE, FONCTION, NATUREFONCTION)
- **MARCHE** (**NUMMARCHE**, **ACTIF** *(booléen, remplace ETATMARCHE — renommage 30/08/2026, voir note)*, TYPE_CREATION, TYPEPROC, TYPEDECOMPOPRIX, NATUREPRESTA, LIBPGI, LIBELLE_SERVICE, TITULAIRE, NUM_TITULAIRE, TITULAIRE_SERVICE, AGENTGESTION, #CODE_CUG → CUG *(CUGGestion)*, DTENOTIF, DTEVALID, DTEDEBUT, DTEFINMAX, MTMINI, MTMAXI, ALERTEMT, ALERTEDATE, LASTMTREALISE, LASTMTENGAGE, DTELASTSOLDE, **DTELASTIMPORT** *(ajout 29/08/2026, voir note ci-dessous)*, PLANPREVENTIONACTIF, **COMPLETUDE** *(booléen, ajout 30/08/2026)*, **UTILISABLE** *(booléen calculé = ACTIF ET COMPLETUDE, ajout 30/08/2026)*, #(N)ID_FOURNISSEUR → FOURNISSEUR)

> `MARCHE.MT_SOLDE` non stocké : vue/colonne générée `MTMAXI − (LASTMTREALISE + LASTMTENGAGE)`.
> `MARCHE.#ID_FOURNISSEUR` **nullable en base** (arbitrage 2), résolu à l'import via (service, NUM_TITULAIRE = FOURNISSEUR.NUMPGI), rendu obligatoire par règle applicative une fois l'import consolidé.
>
> **Import PGI des marchés (29/08/2026)** — voir la spécification complète
> `ForClaude/Importation-marches/import-marches-pgi.md`. Points structurants pour ce MLD :
> `ALERTEMT`/`ALERTEDATE` sont des **seuils en pourcentage** (respectivement du montant de
> référence type `MTMAXI`, et de la durée écoulée entre `DTEDEBUT`/`DTEFINMAX`) déclenchant
> une alerte — **pas** un montant brut en € ni une date calendaire, malgré ce que suggèrent
> leurs noms. `PLANPREVENTIONACTIF` change de type : **texte** (plus booléen), défaut `NULL`
> — ce n'est plus un simple indicateur oui/non mais une valeur à renseigner manuellement
> après l'import (migration `20260829180000_marche_planpreventionactif_to_text.sql`).
> `DTELASTIMPORT` (nouveau champ) trace, **par marché**, la date du dernier
> fichier PGI l'ayant importé/modifié — distinct du paramètre applicatif
> `last.import.marche.pgi` (`finances.parametre_application`, portée **par service**) qui
> conditionne la possibilité du prochain import pour un service. À la modification d'un
> marché déjà existant (import ré-exécuté), **seuls les champs correspondant directement à
> une colonne du fichier PGI sont réécrits** ; tous les autres (`TYPEDECOMPOPRIX`,
> `NATUREPRESTA`, `AGENTGESTION`, `TITULAIRE_SERVICE`, `PLANPREVENTIONACTIF`, `MTMINI`,
> `ALERTEMT`, `ALERTEDATE`) ne sont valorisés qu'à la création et ne sont plus jamais
> réécrits ensuite, même modifiés manuellement entre-temps — `DTELASTIMPORT` est la seule
> exception (réécrit à chaque import, pour toute ligne présente dans le fichier).
>
> **ACTIF / COMPLETUDE / UTILISABLE (30/08/2026).** `ETATMARCHE` (texte) est remplacé par
> `ACTIF` (booléen, `TRUE` par défaut), aligné sur le reste du référentiel organisationnel
> (`DIRECTION`/`SERVICE`/`CELLULE`/`SITE`/`SECTEUR`/`CUG` — seul `FOURNISSEUR.ETATFOURNISSEUR`
> reste en texte, décision propre à cette table, non remise en cause). **⚠️ Ce renommage doit
> être répercuté dans le MCT** (OP3.1 et le contrôle croisé MCD qui citent `ETATMARCHE` par
> son ancien nom), non fait à ce stade. Un marché absent du fichier importé n'est désactivé
> (`ACTIF = FALSE`) que s'il est `TYPE_CREATION = PGI` — **une création manuelle de marché est
> prévue** (écran pas encore construit), auquel cas `TYPE_CREATION` prendra une seconde
> valeur non encore nommée (par analogie avec `FOURNISSEUR.TYPE_CREATION = 'SERVICE'`) ;
> un marché ainsi créé n'est jamais désactivé par un import qui ne le contient pas.
> `COMPLETUDE` (booléen, `FALSE` par défaut) est recalculée automatiquement par l'application
> (pas par l'import) dès que `TYPEDECOMPOPRIX`, `NATUREPRESTA`, `AGENTGESTION`,
> `TITULAIRE_SERVICE`, `PLANPREVENTIONACTIF`, `ALERTEMT` et `ALERTEDATE` sont tous renseignés
> (`MTMINI` volontairement exclu : son défaut `0` ne permet pas de distinguer une valeur
> laissée à 0 d'une valeur jamais renseignée — recommandation à confirmer avant
> implémentation). `UTILISABLE` est une **colonne générée Postgres**
> (`GENERATED ALWAYS AS (actif AND completude) STORED`), jamais écrite directement. **Seuls
> les marchés `UTILISABLE = TRUE` sont proposés à la création d'une demande d'achat (OP1.1)**
> — règle qui touche aussi le MCT (OP1.1) et le MCD (association DEMANDE_ACHAT — s'appuie
> sur — MARCHE), **à répercuter séparément, non fait à ce stade**. Migration proposée :
> `supabase/migrations/20260830090000_marche_actif_completude_utilisable.sql`.
> **FOURNISSEUR/CONTACT — CRUD manuel et droits d'écriture (29/08/2026, corrigé le 29/08/2026 après transmission du schéma physique réel).** `finances.fournisseur`/`finances.contact` **existaient déjà** physiquement avant ce chantier — pas de création de table, seulement sécurisation (GRANT/RLS/policies, absents jusqu'ici) via `supabase/migrations/20260829130000_create_fournisseur_contact.sql` (une première version du fichier contenait par erreur un `CREATE TABLE`, corrigée). Un fournisseur créé manuellement (écran, pas import PGI) a `TYPE_CREATION = SERVICE`, avec `RAISON_SOCIALE_PGI`/`NUMPGI` laissés `NULL` (renseignés uniquement par l'import PGI, non implémenté à ce stade — voir MCT OP3.1). `SIREN` (colonne renommée depuis `SIRET` le 29/08/2026 — confusion de terminologie corrigée : SIRET identifie un établissement sur 14 chiffres, SIREN l'entreprise sur 9, c'est bien ce second identifiant qui était visé ici ; migration `20260829150000_rename_fournisseur_siret_to_siren.sql`, simple renommage, aucune donnée modifiée, type toujours `text` sans contrainte de longueur) est **NOT NULL** sur la table réelle (obligatoire à la création, contrairement à une première implémentation qui le rendait optionnel). FOURNISSEUR (`ETATFOURNISSEUR`, référencé par DEMANDE_ACHAT/DEVIS_CONSULTE/MARCHE — ces trois tables existent elles aussi déjà physiquement) supporte, depuis le 29/08/2026, une **suppression physique conditionnelle** — exception au principe général d'archivage de ce champ : autorisée pour ADMIN_APP/ADMIN_SERVICE (`assertManagesFournisseur`, pas la règle plus large de la création) uniquement si aucun MARCHE (`id_fournisseur`), DEMANDE_ACHAT (`id_fournisseur_retenu`) ni DEVIS_CONSULTE (`id_fournisseur`, même une ligne non retenue) ne le référence encore (`fournisseur.service.ts#deleteFournisseur`) — sinon 409, message invitant à passer en Inactif à la place. Supprime aussi tous les CONTACT du fournisseur (jamais l'inverse : CONTACT seul reste également supprimable indépendamment, pas de champ d'état, aucune autre table ne le référence). Filet de sécurité : les FK marche/demande_achat/devis_consulte → fournisseur n'ont pas d'`ON DELETE CASCADE` (RESTRICT par défaut), Postgres refuserait de toute façon la suppression en cas de bug dans la vérification applicative — voir migration `20260829140000_fournisseur_delete_policy.sql`. Modification (mise à jour, ACTIF) ouverte à ADMIN_APP (transverse) ou ADMIN_SERVICE scopé à son service (même règle que SITE/SECTEUR/SEUIL_VALIDATION_DS, voir `assertManagesService`). **Création** plus ouverte : un Demandeur (sans rôle dédié) peut aussi créer un FOURNISSEUR pour son propre service (`assertManagesServiceOrIsOwnActor`, distinct d'`assertManagesService`) — la modale de création n'affiche alors ni Direction ni Service, le fournisseur hérite directement du service de l'acteur connecté (résolu via `ACTEUR.ID_CELLULE → SERVICE`, ou via l'attribution ADMIN_SERVICE le cas échéant, exposé par `/api/me#idService`). Lecture scopée au service de l'acteur pour tout le monde sauf ADMIN_APP, y compris ce même Demandeur (voir `ForClaude/CDC/mot-phases-1-2.md` l.68 et `ForClaude/SECURITY.md` §2.5). `NATUREFONCTION` (CONTACT) : liste fermée — **valeurs de la contrainte CHECK réelle, déjà en place sur la table préexistante** : DIRIGEANT, JURIDIQUE, COMMERCIAL, RESPONSABLE D'AFFAIRE, RESPONSABLE TECHNIQUE, TECHNICIEN, RESPONSABLE FINANCIER/COMPTABILITE (pas la liste "Dirigeant/Commercial/Juridique/Administratif/Chargé d'affaire/Technicien" un temps documentée ici par erreur, avant transmission du schéma réel) ; conservée distincte de `FONCTION` (texte libre), tranchant le point résiduel noté au MCD §7. **Champs obligatoires CONTACT (décision du 29/08/2026)** : NOM, PRENOM et NATUREFONCTION obligatoires ; au moins un des deux numéros de téléphone (TELFIXE ou TELMOBILE) doit être renseigné — règle appliquée identiquement à la création et à la modification (`contact.service.ts`, schéma Zod partagé avec `.refine()`), pour ne pas laisser un contact redevenir incomplet après une modification. MAIL et FONCTION restent optionnels.

## 2.3 Rôles et suppléance (arbitrage 3)
- **ROLE_ATTRIBUTION** (**ID_ROLE**, #MATRICULE → ACTEUR, TYPE_ROLE *(RC | CDS | DS | CB | ADMIN_SERVICE | ADMIN_APP)*, #(N)ID_CELLULE → CELLULE, #(N)ID_SERVICE → SERVICE, #(N)ID_DIRECTION → DIRECTION, **DATE_DEBUT**, **DATE_FIN** *(N)*, **ACTIF** *(booléen)*)
- **SUPPLEANCE** (**ID_SUPPLEANCE**, #ID_ROLE → ROLE_ATTRIBUTION, #MATRICULE_SUPPLEANT → ACTEUR, DATE_DEBUT, DATE_FIN)

> **Nom de table physique (24/08/2026) :** l'entité conceptuelle `ROLE` du MCD s'implémente ici sous le nom `ROLE_ATTRIBUTION` — une table nommée `ROLE` entrerait en collision avec la notion native de rôle Postgres/Supabase (rôles `anon`/`authenticated`/`service_role`, fonction `auth.role()`), source classique de confusion à l'écriture des policies RLS (voir `ForClaude/SECURITY.md` §2.1). Décision de niveau MLD/physique uniquement : le MCD reste inchangé (l'entité s'appelle toujours ROLE au niveau conceptuel), seule sa traduction en table SQL change de nom. La colonne `ID_ROLE` (y compris en FK, ex. `SUPPLEANCE.ID_ROLE`) garde son nom : seul le nom de la table cible change.
>
> DATE_DEBUT/DATE_FIN/ACTIF ajoutés pour porter l'unicité « un seul actif par périmètre » (RC/CDS/DS) et **conserver l'historique des titulaires** : un changement de titulaire clôt la ligne courante (DATE_FIN renseignée, ACTIF=false) et en crée une nouvelle. **Périmètres : RC→cellule ; CDS, CB, ADMIN_SERVICE→service ; DS→direction ; ADMIN_APP→sans périmètre (transverse)**. CB collective par service ; ADMIN_SERVICE et ADMIN_APP sans unicité (plusieurs possibles).

## 2.4 Cœur métier — la demande (FAD)
- **DEMANDE_ACHAT** (**NUMERO**, OBJET, DESCRIPTION, MONTANT_DEMANDE, IMPUTATION_COMPTABLE, PROCEDURE_ACHAT, TYPE_ACHAT, TYPE_FAD, MOTIF_CHOIX, LIBELLE_MOTIF_CHOIX, MONTANT_RETENU, MONTANT_COMMANDE, DATE_CREATION, #MATRICULE_DEMANDEUR → ACTEUR, **#(CODE_SITE, (N)CODE_SOUS_SITE) → SOUS_SITE** *(FK composite — CODE_SITE obligatoire, CODE_SOUS_SITE optionnel, cf. note ci-dessous)*, **#(CODE_SECTEUR, (N)CODE_SOUS_SECTEUR) → SOUS_SECTEUR** *(idem)*, **#CODE_CUG → CUG** *(NOT NULL — arbitrage 1)*, #(N)NUMERO_OPERATION → OPERATION_INVESTISSEMENT, #(N)NUMMARCHE → MARCHE, #(N)ID_FOURNISSEUR_RETENU → FOURNISSEUR, #CODE_STATUT → STATUT *(statut courant)*)
- **DEVIS_CONSULTE** (**ID_DEVIS**, #NUMERO → DEMANDE_ACHAT, #ID_FOURNISSEUR → FOURNISSEUR, MONTANT_DEVIS, FICHIER_PDF, RETENU)
- **PIECE_JOINTE** (**ID_PIECE**, #(N)NUMERO → DEMANDE_ACHAT, **#(N)NUMERO_CSF → CERTIFICAT_SERVICE_FAIT** *(Phase 2)*, TYPE_PIECE, **ORIGINE** *(UTILISATEUR | SYSTEME)*, FICHIER, NOM_FICHIER)

> **Sous-niveau optionnel (28/08/2026, confirmé sur relecture du schéma physique).** `CODE_SITE` et `CODE_SECTEUR` restent **obligatoires** : toute FAD est positionnée sur un site et un secteur. `CODE_SOUS_SITE`/`CODE_SOUS_SECTEUR` sont **nullables** : une FAD peut ne pas préciser de sous-niveau. Point d'attention technique : une FK composite Postgres est **MATCH SIMPLE** par défaut — dès que `CODE_SOUS_SITE` est NULL, la contrainte ne vérifie *plus du tout* `CODE_SITE` contre `SOUS_SITE` (elle est entièrement ignorée pour cette ligne, pas seulement pour la partie NULL). Dans ce cas, la validité de `CODE_SITE` (qu'il existe bien dans `SITE`) doit être garantie par une règle applicative, pas par cette contrainte — idem pour `CODE_SECTEUR`/`SECTEUR`. À vérifier/renforcer côté implémentation si ce n'est pas déjà fait (ex. contrainte simple additionnelle `CODE_SITE → SITE`, ou validation service avant écriture).
> `CODE_CUG` désormais **obligatoire** (imputation analytique systématique) ; `NUMERO_OPERATION` renseigné en sus lorsque INVESTISSEMENT (cf. CHECK §4).
> `ID_FOURNISSEUR_RETENU` **nullable en base** (arbitrage 2), obligatoire par règle applicative au stade FAD.
> **PIECE_JOINTE polymorphe** : rattachée à une DA **ou** à un CSF (exactement une des deux FK — CHECK §4). `ORIGINE` distingue les pièces déposées (UTILISATEUR) des pièces générées par l'application (SYSTEME). La **fiche récapitulative de la FAD** (PDF généré à l'autorisation de commande) est une pièce `ORIGINE=SYSTEME`, `TYPE_PIECE=FICHE_FAD`, rattachée à la DA, non supprimable par l'utilisateur.

## 2.5 Statuts et traçabilité (FAD)
- **STATUT** (**CODE_STATUT**, LIBELLE, COMMENTAIRE) — valeurs : DA_ENREGISTREE, DA_REJETEE, FAD_TRANSMISE_CDS, FAD_REJETEE_CDS, FAD_TRANSMISE_BUDGET, FAD_REJETEE_BUDGET, FAD_TRANSMISE_DS, FAD_REJETEE_DS, FAD_VALIDEE_DS, FAD_COMMANDEE, FAD_CLOTUREE
- **HISTORIQUE_STATUT** (**ID_HISTO**, #NUMERO → DEMANDE_ACHAT, #CODE_STATUT → STATUT, #MATRICULE_ACTEUR → ACTEUR, #(N)ID_SUPPLEANCE → SUPPLEANCE, DATE_HEURE, COMMENTAIRE_MOTIF)

## 2.6 Paramétrage
- **SEUIL_VALIDATION_DS** (**#ID_SERVICE → SERVICE**, SEUIL_FONCTIONNEMENT, SEUIL_INVESTISSEMENT) — PK = ID_SERVICE (au plus une ligne par service, **plus d'historisation** — décision du 28/08/2026, remplace la version précédente ci-dessous). Un service sans ligne est traité comme SEUIL_FONCTIONNEMENT = SEUIL_INVESTISSEMENT = 0 (jamais une valeur NULL à interpréter : soit la ligne existe et porte deux montants, soit elle n'existe pas et vaut 0 par convention).

> Rattachement : SERVICE (1,1) — définit — (0,1) SEUIL_VALIDATION_DS (au plus une ligne, plus 1:N).
>
> **Simplification du 28/08/2026 (annule l'historisation).** L'ancien modèle (une ligne par changement de seuil, datée, avec TYPE_IMPUTATION en valeur de ligne) était jugé trop complexe à l'usage. Remplacé par une ligne unique par service portant les deux seuils en colonnes — plus de DATE_APPLICATION, plus de calcul "date la plus récente ≤ date d'évaluation" : le seuil courant est simplement la valeur en base (ou 0 si aucune ligne). Conséquence assumée : on perd la capacité à reconstituer un seuil historique différent du seuil courant pour une FAD ancienne — ce compromis a été jugé acceptable au vu de la complexité que l'historisation représentait côté écran d'administration.
>
> **Droit d'écriture — décision du 29/08/2026, remplace l'écart noté le 28/08.** Le paragraphe précédent de ce document indiquait que le paramétrage des seuils restait de la responsabilité du **DS** (par direction) ; l'implémentation du 28/08/2026 l'avait restreint à **ADMIN_APP uniquement**, en écart assumé. Décision définitive du 29/08/2026 : l'écriture est ouverte à **ADMIN_APP** (transverse) **ou ADMIN_SERVICE scopé à son propre service** — même règle que SITE/SOUS_SITE et SECTEUR/SOUS_SECTEUR (voir `assertManagesService`, `backend/src/services/seuilValidationDs.service.ts`, et `ForClaude/SECURITY.md` §2.4). Ce n'est plus le rôle DS (par direction) qui porte ce droit, mais ADMIN_SERVICE (par service), pour rester cohérent avec le modèle d'administration des autres référentiels.

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
- `FOURNISSEUR` : **écart constaté le 29/08/2026** — ce document affirmait `UNIQUE (ID_SERVICE, SIREN)` (alors documenté SIRET) et `UNIQUE (ID_SERVICE, NUMPGI) WHERE NUMPGI IS NOT NULL`, mais le schéma physique réel transmis par l'utilisateur ne montre **aucune contrainte UNIQUE** sur `finances.fournisseur` au-delà de la clé primaire — seulement `fournisseur_pkey` et la FK vers `service`. (SERVICE, SIREN) reste la clé métier conceptuelle (MCD), non enforcée physiquement à ce jour ; ne pas supposer son unicité côté application sans revalider.
- `ROLE_ATTRIBUTION` (unicité du titulaire **actif** par périmètre — arbitrage 3) :
  - `UNIQUE (ID_CELLULE) WHERE TYPE_ROLE='RC' AND ACTIF = true`
  - `UNIQUE (ID_SERVICE) WHERE TYPE_ROLE='CDS' AND ACTIF = true`
  - `UNIQUE (ID_DIRECTION) WHERE TYPE_ROLE='DS' AND ACTIF = true`
  - Pas d'unicité pour CB (collectif).
- `DEVIS_CONSULTE` : `UNIQUE (NUMERO) WHERE RETENU = true` (un seul devis retenu par demande).

**Exclusivité / cohérence conditionnelle (CHECK)**
- `DEMANDE_ACHAT` — imputation (arbitrage 1) :
  `CHECK (CODE_CUG IS NOT NULL)` *(CUG toujours obligatoire)* et
  `CHECK ( (IMPUTATION_COMPTABLE='INVESTISSEMENT' AND NUMERO_OPERATION IS NOT NULL) OR (IMPUTATION_COMPTABLE='FONCTIONNEMENT' AND NUMERO_OPERATION IS NULL) )`
- `ROLE_ATTRIBUTION` — cohérence périmètre / type :
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

**Intégrité référentielle** : toutes les FK des §2/§3 en FOREIGN KEY ; `ON DELETE RESTRICT` sur référentiels ; pas de suppression physique sur MARCHE (ETATMARCHE), ni sur DIRECTION/SERVICE/CELLULE (ACTIF, ajout 28/08/2026 — même principe). **FOURNISSEUR** (ETATFOURNISSEUR) fait exception depuis le 29/08/2026 : suppression physique autorisée, mais uniquement si aucun MARCHE, DEMANDE_ACHAT (fournisseur retenu) ni DEVIS_CONSULTE (même non retenu) ne le référence encore — voir §2.2. Cas particulier : la FK composite DEMANDE_ACHAT → SOUS_SITE / SOUS_SECTEUR n'est **pas** vérifiée par Postgres quand le sous-niveau est NULL (MATCH SIMPLE) — voir note §2.4.

**Colonnes calculées / dénormalisées** : `MARCHE.MT_SOLDE` (vue) ; `DEMANDE_ACHAT.CODE_STATUT` et `CERTIFICAT_SERVICE_FAIT.CODE_STATUT_CSF` = pointeurs de statut courant, cohérents avec le dernier HISTORIQUE_* par déclencheur applicatif.

---

# 5. Inventaire des tables

**Phase 1 (21)** : DIRECTION, SERVICE, CELLULE, ACTEUR, SITE, SOUS_SITE, SECTEUR, SOUS_SECTEUR, CUG, OPERATION_INVESTISSEMENT, FOURNISSEUR, CONTACT, MARCHE, ROLE_ATTRIBUTION, SUPPLEANCE, DEMANDE_ACHAT, DEVIS_CONSULTE, PIECE_JOINTE, STATUT, HISTORIQUE_STATUT, SEUIL_VALIDATION_DS.

**Phase 2 (3)** : CERTIFICAT_SERVICE_FAIT, STATUT_CSF, HISTORIQUE_STATUT_CSF.
*(PIECE_JOINTE est étendue, pas dupliquée.)*

**Total : 24 tables**, toujours sans aucune table de jointure (aucune association N:M sur l'ensemble des deux phases).

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
- 24/08/2026 (renommage technique) : table `ROLE` renommée `ROLE_ATTRIBUTION` au niveau physique (collision avec la notion native de rôle Postgres/Supabase, détectée à la préparation des policies RLS — voir `ForClaude/SECURITY.md` §2.1). Décision de niveau MLD uniquement : l'entité conceptuelle ROLE du MCD est inchangée ; seules les occurrences de la table dans ce document (déclaration, FK de SUPPLEANCE, contraintes d'unicité et de cohérence, inventaire) sont mises à jour. Les entrées d'historique antérieures à cette date, écrites avant le renommage, conservent le nom `ROLE` tel qu'en vigueur à l'époque.
- 26/08/2026 (normalisation SITE / SECTEUR) : SITE et SECTEUR éclatés chacun en une table parent + une table enfant. **SITE** (**CODE_SITE**, LIB_SITE, ORDRE_SITE, #(N)ID_SERVICE) et **SOUS_SITE** (PK composite CODE_SITE + CODE_SOUS_SITE, ORDRE_SOUS_SITE, ACTIF) ; **SECTEUR** (**CODE_SECTEUR**, LIB_SECTEUR, ORDRE_SECTEUR, #(N)ID_SERVICE) et **SOUS_SECTEUR** (PK composite CODE_SECTEUR + CODE_SOUS_SECTEUR, ORDRE_SOUS_SECTEUR, ACTIF). La FK dans DEMANDE_ACHAT devient composite : (CODE_SITE, CODE_SOUS_SITE) → SOUS_SITE et (CODE_SECTEUR, CODE_SOUS_SECTEUR) → SOUS_SECTEUR. Rattachement à SERVICE nullable (ID_SERVICE NOT NULL à valoriser une fois le référentiel organisationnel chargé). Total Phase 1 : 19 → 21 tables ; total général : 22 → 24 tables.
- 28/08/2026 (relecture schéma physique) : trois changements constatés en confrontant ce MLD au schéma physique Supabase réel (`finances.*`), et intégrés ici : (1) **ACTIF** ajouté sur DIRECTION, SERVICE, CELLULE (§2.1) — désactivation, jamais de suppression physique (même principe que SITE/SECTEUR ; tranche partiellement le point ouvert du MCD §7, ACTEUR non concerné) ; (2) **LIB_SOUS_SITE** / **LIB_SOUS_SECTEUR** ajoutés sur SOUS_SITE / SOUS_SECTEUR (§2.2) — libellé propre au sous-niveau, distinct du code, affiché par l'IHM ; (3) la FK composite de DEMANDE_ACHAT vers SOUS_SITE/SOUS_SECTEUR (§2.4) est en réalité **partiellement nullable** : CODE_SITE/CODE_SECTEUR restent obligatoires, mais CODE_SOUS_SITE/CODE_SOUS_SECTEUR sont nullables en base (une FAD peut ne pas préciser de sous-niveau) — avec la mise en garde MATCH SIMPLE associée (§2.4, §4). Répercuté dans le MCD (§1, §2, §7).
- 28/08/2026 (simplification SEUIL_VALIDATION_DS) : abandon de l'historisation (§2.6). **SEUIL_VALIDATION_DS** passe de (ID_SEUIL, #ID_SERVICE, TYPE_IMPUTATION, MONTANT_SEUIL, DATE_APPLICATION) — plusieurs lignes par service, une par changement daté — à (**#ID_SERVICE**, SEUIL_FONCTIONNEMENT, SEUIL_INVESTISSEMENT) — une ligne au plus par service, ID_SERVICE devenant la PK. Plus de DATE_APPLICATION ni de calcul de seuil "en vigueur" par date : absence de ligne = seuils à 0. Cardinalité SERVICE — définit — SEUIL_VALIDATION_DS revue de (1,1)-(0,N) à (1,1)-(0,1). Écart avec la décision du 22/08 sur le droit d'écriture DS consigné dans la note du §2.6 (écriture restreinte à ADMIN_APP dans l'implémentation actuelle). Migration physique : `supabase/migrations/20260828112927_simplify_seuil_validation_ds.sql` (DROP/CREATE, aucune donnée réelle à migrer). Répercuté dans le MCD (§1, §2) et le MCT (OP1.4).
- 29/08/2026 (droit d'écriture SEUIL_VALIDATION_DS) : décision définitive remplaçant l'écart noté le 28/08 — écriture ouverte à ADMIN_APP (transverse) ou **ADMIN_SERVICE scopé à son propre service** (§2.6), alignée sur SITE/SOUS_SITE et SECTEUR/SOUS_SECTEUR plutôt que sur le droit DS/direction envisagé le 22/08. Policies RLS `finances.seuil_validation_ds` mises à jour en conséquence (voir `ForClaude/SECURITY.md` §2.4) ; pas de changement de structure de table. Répercuté dans le MCD et le MOT.
- 29/08/2026 (CRUD FOURNISSEUR/CONTACT + habilitation) : sécurisation de `finances.fournisseur`/`finances.contact` (§2.2) — GRANT/RLS/policies, absents jusqu'ici — via `supabase/migrations/20260829130000_create_fournisseur_contact.sql` (voir correction ci-dessous : ces tables existaient déjà, ce n'était pas une création). Droit d'écriture ouvert à ADMIN_APP (transverse) en plus d'ADMIN_SERVICE (son service, déjà documenté MOT) — même modèle que SITE/SECTEUR/SEUIL_VALIDATION_DS, policies RLS voir `ForClaude/SECURITY.md` §2.5. Lecture scopée au service de l'acteur pour tout le monde sauf ADMIN_APP (y compris Demandeur, sans rôle dédié) — nuance propre à FOURNISSEUR/CONTACT, absente de SITE/SECTEUR (lecture ouverte à tous sur ces derniers). Résolution du point résiduel « redondance FONCTION/NATUREFONCTION » (MCD §7) : les deux champs sont conservés. Répercuté dans le MCD (§1, §7, §8) et le MOT.
- 29/08/2026 (correction — schéma FOURNISSEUR/CONTACT préexistant) : l'utilisateur a transmis le schéma physique réel de `finances.*`, révélant que `fournisseur`/`contact` (ainsi que `marche`, `demande_achat`, `devis_consulte`, `cug`, `operation_investissement`, `acteur`, `role_attribution`, etc.) existaient déjà avant le chantier du jour — la migration ci-dessus ne devait pas contenir de `CREATE TABLE` (corrigée : GRANT/RLS/policies seulement). Deux écarts corrigés dans le code applicatif : `NATUREFONCTION` suit la contrainte CHECK réelle — DIRIGEANT, JURIDIQUE, COMMERCIAL, RESPONSABLE D'AFFAIRE, RESPONSABLE TECHNIQUE, TECHNICIEN, RESPONSABLE FINANCIER/COMPTABILITE (pas la liste inventée plus haut) — et `FOURNISSEUR.SIRET` est **NOT NULL**, rendu obligatoire à la création côté Zod/formulaire (il était traité comme optionnel). Aucun changement de structure de table : uniquement le code applicatif (backend, frontend) et cette documentation qui s'alignent sur l'existant. Répercuté dans le MCD (§8) et SECURITY.md (§2.5).
- 29/08/2026 (création FOURNISSEUR ouverte au Demandeur) : au-delà d'ADMIN_APP/ADMIN_SERVICE, un Demandeur (sans rôle dédié) peut désormais créer un FOURNISSEUR pour son propre service — seule la création est concernée, la modification reste ADMIN_APP/ADMIN_SERVICE. Nouvelle vérification `assertManagesServiceOrIsOwnActor` (distincte d'`assertManagesService`, réservée à ce cas). `/api/me` expose désormais `idService` (rattachement ACTEUR.ID_CELLULE → SERVICE, indépendant des rôles) pour que le Demandeur connaisse son propre service côté écran. Écart RLS assumé : la policy INSERT de `finances.fournisseur` ne couvre que ADMIN_APP/ADMIN_SERVICE (voir `ForClaude/SECURITY.md` §2.5) — le backend (`service_role`) reste seul juge en pratique. Répercuté dans le MOT et SECURITY.md.
- 29/08/2026 (suppression conditionnelle FOURNISSEUR) : exception au principe général « pas de suppression physique » (§4, Intégrité référentielle) — ADMIN_APP/ADMIN_SERVICE peuvent supprimer physiquement un FOURNISSEUR (et ses CONTACT) si aucun MARCHE/DEMANDE_ACHAT (fournisseur retenu)/DEVIS_CONSULTE (même non retenu) ne le référence, sinon 409. Nouveaux repositories minimaux `marche.repository.ts`/`demandeAchat.repository.ts`/`devisConsulte.repository.ts` (une seule fonction de vérification d'existence chacun — ces entités n'ont pas de CRUD dans ce backend, phase pas commencée). Nouvelle policy RLS `fournisseur_delete_admin` (migration `20260829140000_fournisseur_delete_policy.sql`) ; les FK des trois tables citées n'ont pas d'`ON DELETE CASCADE`, Postgres refuse de toute façon la suppression en filet de sécurité. Suppression des CONTACT puis du FOURNISSEUR en deux appels distincts (pas de transaction multi-instructions exposée par `supabase-js`). Répercuté dans le MOT et SECURITY.md (§2.5).
- 29/08/2026 (champs obligatoires CONTACT) : NOM, PRENOM et NATUREFONCTION deviennent obligatoires (auparavant tous deux optionnels/nullables), et au moins un des deux numéros de téléphone (TELFIXE ou TELMOBILE) doit être renseigné — validation Zod avec `.refine()`, identique en création et en modification. Aucun changement de structure de table (les colonnes restaient déjà nullables en base ; la contrainte est uniquement applicative, comme pour tout ce backend).
- 29/08/2026 (NOM en majuscules + structure des numéros de téléphone) : NOM est désormais normalisé en MAJUSCULES (transform Zod, appliqué en création et modification ; mis en forme dès la frappe côté écran). TELFIXE/TELMOBILE, quand renseignés, doivent respecter une structure valide — format local français (`0` + 9 chiffres, ex. `06 83 09 58 81`) ou international (`+` suivi de 8 à 15 chiffres, limite E.164, ex. `+33 6 83 09 58 81`, `+254 6 83 09 58 81`) ; les espaces/points/tirets de saisie sont tolérés puis retirés — le numéro est **stocké normalisé, sans séparateur** (ex. `0683095881`, `+33683095881`). Validation par regex (`PHONE_REGEX`), redondante côté écran pour un retour immédiat, le backend restant seul à faire foi.
- 29/08/2026 (renommage FOURNISSEUR.SIRET → SIREN) : confusion de terminologie corrigée — SIRET identifie un établissement (14 chiffres), SIREN l'entreprise (9 chiffres) ; c'est bien SIREN qui était visé pour ce champ. Simple renommage de colonne (`alter table ... rename column`), aucune donnée modifiée, type toujours `text`, migration `20260829150000_rename_fournisseur_siret_to_siren.sql`. À cette occasion, constat que ce document affirmait à tort une contrainte `UNIQUE (ID_SERVICE, SIREN)` inexistante sur le schéma physique réel (§4) — corrigé. Répercuté dans le MCD et SECURITY.md (§2.5).
- 29/08/2026 (validation clé de contrôle SIREN) : le SIREN doit désormais être renseigné **et** valide — clé de Luhn sur 9 chiffres (INSEE), vérifiée à la création et en modification (`isValidSiren`, backend et frontend, backend seul faisant foi). Espaces de saisie tolérés, retirés avant stockage. Exception connue et non couverte : quelques SIREN historiques (ex. La Poste, 356000000) échappent à cette règle mais restent valides administrativement.
- 29/08/2026 (gestion manuelle CUG + ajout ACTIF) : **ACTIF** ajouté sur CUG (§2.2, booléen, défaut true) — désactivation par flag, jamais de suppression physique, même principe que SITE/SECTEUR/FOURNISSEUR (migration `20260829160000_add_actif_cug_and_secure.sql`, qui sécurise aussi la table jusqu'ici sans GRANT/RLS/policies). Nouvelle tâche de gestion manuelle (créer/modifier libellé et état) en complément de l'import PGI existant (OP3.1) — droit d'écriture ADMIN_APP (transverse) ou ADMIN_SERVICE scopé à son propre service, **sans** périmètre Demandeur (contrairement à FOURNISSEUR : la lecture elle-même est réservée à ces deux rôles, rejet 403 sinon). CODE_CUG reste la clé naturelle, non modifiable après création (comme SITE/SECTEUR, à la différence de CODE_CELLULE). Répercuté dans le MOT et SECURITY.md (§2.6).
- 29/08/2026 (spécification import PGI des marchés) : ajout de **DTELASTIMPORT** sur MARCHE
  (§2.2, date de dernière importation **par marché** — nécessite une migration, pas encore
  écrite). Clarification (pas un changement de structure) : `ALERTEMT`/`ALERTEDATE`, dont ce
  document ne précisait jusqu'ici ni le type ni l'unité, sont des **seuils en pourcentage**
  (montant réalisé/engagé vs référence, durée écoulée du marché) — pas un montant brut en €
  ni une date calendaire. Acteur de l'import PGI marchés confirmé : `ADMIN_SERVICE` sur son
  propre service (même tâche déjà documentée au MOT « Lancer les imports PGI », aucun
  changement MOT/MCT nécessaire) ; aucune étape de confirmation intermédiaire (reprend OP3.1
  telle quelle). Règle de réécriture à la modification (marché déjà existant) : seuls les
  champs correspondant à une colonne du fichier PGI sont réécrits, tous les autres champs
  absents du fichier ne sont valorisés qu'à la création, sauf `DTELASTIMPORT` (toujours
  réécrit). Nouveau paramètre applicatif `last.import.marche.pgi`
  (`finances.parametre_application`, portée par service, création manuelle préalable
  obligatoire par service avant son premier import — sinon rejet). Spécification complète :
  `ForClaude/Importation-marches/import-marches-pgi.md`. Répercuté dans le MOT et
  SECURITY.md (à faire).
- 29/08/2026 (correction type PLANPREVENTIONACTIF) : passe de **booléen** à **texte**, défaut
  `NULL` — ce champ n'est plus un simple indicateur oui/non mais une valeur à renseigner
  manuellement après l'import PGI des marchés (décision utilisateur). Migration proposée :
  `supabase/migrations/20260829180000_marche_planpreventionactif_to_text.sql` (change le type
  de colonne, réinitialise les valeurs existantes à `NULL` — la table n'a pas de données
  réelles connues à ce stade).
- 30/08/2026 (ACTIF/COMPLETUDE/UTILISABLE) : `ETATMARCHE` (texte) remplacé par **ACTIF**
  (booléen), aligné sur DIRECTION/SERVICE/CELLULE/SITE/SECTEUR/CUG — décision utilisateur.
  Règle d'archivage raffinée : un marché absent du fichier n'est désactivé que s'il est
  `TYPE_CREATION = PGI` (une création manuelle de marché est prévue, `TYPE_CREATION`
  prendra alors une seconde valeur non encore nommée — jamais désactivée par un import qui
  ne la contient pas). Nouveaux champs **COMPLETUDE** (booléen, `FALSE` à la création,
  recalculé automatiquement par l'application dès que TYPEDECOMPOPRIX/NATUREPRESTA/
  AGENTGESTION/TITULAIRE_SERVICE/PLANPREVENTIONACTIF/ALERTEMT/ALERTEDATE sont tous
  renseignés — MTMINI exclu du calcul, à confirmer) et **UTILISABLE** (colonne générée
  Postgres, `ACTIF ET COMPLETUDE`). Seuls les marchés `UTILISABLE` seront proposés à la
  création d'une DA (OP1.1) — à répercuter dans le MCT et le MCD (non fait à ce stade), de
  même que le renommage `ETATMARCHE → ACTIF` dans OP3.1/contrôle croisé du MCT. Migration
  proposée : `supabase/migrations/20260830090000_marche_actif_completude_utilisable.sql`.
  Détail complet : `ForClaude/Importation-marches/import-marches-pgi.md`.
