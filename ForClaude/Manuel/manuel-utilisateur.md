# VIGIE — Manuel utilisateur

*Application de gestion des achats du Grand Port Maritime de Marseille (GPMM) — demandes d'achat, marchés, commandes et investissements PGI, fournisseurs.*

*État au 23/09/2026.*

___

# Partie 1 — Fonctionnalités principales

## 1.1 Les rôles applicatifs

VIGIE distingue plusieurs rôles, chacun avec son propre périmètre d'action. Un même agent peut cumuler plusieurs rôles (par exemple RC et CDS) : dans ce cas, chaque écran de suivi qui lui est propre affiche uniquement les demandes relevant de ce rôle précis.

| Rôle | Nom complet | Périmètre | Rôle dans le circuit DA/FAD |
|---|---|---|---|
| **Demandeur** | (aucun rôle dédié requis) | Ses propres demandes | Crée et finalise la demande d'achat (DA) |
| **RC** | Responsable de Cellule (N+1) | Sa cellule | Statue sur l'opportunité de l'achat, finalise et transmet la FAD |
| **CDS** | Chef de Service (N+2) | Son service | Statue sur la FAD, transmet à la CB |
| **CB** | Contrôle Budgétaire | Son service (rôle collectif) | Contrôle financier et budgétaire, place la commande |
| **DS** | Directeur de Service (N+3) | Sa direction | Statue sur la FAD au-dessus d'un certain montant, donne l'ordre de commande |
| ADMIN_SERVICE | Administrateur de service | Son service | Gère les référentiels et le paramétrage de son service |
| ADMIN_APP | Administrateur applicatif | Transverse | Gère les référentiels transverses et les comptes utilisateurs |

Tout agent authentifié peut être Demandeur, sans avoir besoin d'un rôle dédié — il lui suffit d'être rattaché à un service. Les rôles RC/CDS/CB/DS/ADMIN_SERVICE/ADMIN_APP sont attribués par un administrateur.

**Suppléance.** Les rôles RC, CDS et DS peuvent être suppléés en cas d'absence — n'importe quel agent actif du même périmètre (service pour RC/CDS, direction pour DS) peut être désigné suppléant, sans avoir besoin de détenir déjà ce rôle. C'est le titulaire lui-même qui déclare et retire sa suppléance, depuis le bouton « Suppléance » en haut de son écran de suivi. Pendant la période, le titulaire suppléé reste en **lecture seule** sur son périmètre : il peut consulter mais plus modifier, transmettre, rejeter ni annuler une demande — seul le suppléant agit. Le rôle CB, collectif par service, n'est jamais suppléé individuellement.

## 1.2 Le cycle de vie d'une demande d'achat (DA/FAD)

Une demande d'achat naît **brouillon** (« En préparation ») dès sa création — vous pouvez la compléter en plusieurs fois avant de la transmettre. Une fois transmise, elle traverse un circuit de validation à plusieurs paliers ; le terme **FAD** (Fiche d'Achat) désigne la demande à partir du moment où elle est transmise au N+2.

Circuit nominal, du demandeur à la commande :

```
Demandeur → RC (N+1) → CDS (N+2) → CB (Contrôle Budgétaire) → [DS (N+3), si au-dessus du seuil] → CB (commande)
```

**Le seuil de validation DS.** Chaque service peut avoir un seuil de validation (deux montants : fonctionnement et investissement), au-delà duquel une FAD doit être examinée par le DS. En dessous du seuil, elle est automatiquement validée et transmise directement en attente de commande, sans jamais passer devant le DS — ce cas reste néanmoins visible en lecture par le DS, marqué d'un badge « Seuil DS », dans son propre écran de suivi. Un service sans seuil paramétré est considéré à seuil 0 : toute FAD y passe systématiquement devant le DS.

**À chaque palier**, l'acteur qui vient de valider une demande n'est **jamais** obligé de la transmettre dans le même geste : une fois validée, elle reste dans sa propre file de travail jusqu'à ce qu'il déclenche lui-même la transmission au palier suivant. Cela laisse la possibilité de revenir sur sa décision (« Dévalider », pour le RC uniquement) avant de transmettre.

**Rejeté ≠ Annulé.** Le rejet sanctionne un achat jugé non pertinent (ou non conforme, côté CB) ; l'annulation clôt un besoin devenu caduc. Les deux sont **définitifs** — aucune resoumission automatique, un nouveau besoin repart d'une demande créée manuellement. La CB, qui ne juge jamais l'opportunité de l'achat (seulement la conformité budgétaire), ne dispose que du rejet, jamais de l'annulation.

**Demande de complément ou de modification.** À chaque palier, l'acteur qui statue peut aussi renvoyer la demande en amont pour complément d'information, plutôt que de la rejeter :

- Le RC peut demander un complément au Demandeur (retour en file Demandeur).
- Le CDS peut demander un complément au RC (retour en file RC).
- La CB peut demander une modification au RC — la FAD revient directement à la CB une fois corrigée, **sans repasser par le CDS**.
- Le DS peut demander un complément, mais **directement à la CB** (et non au RC ni au CDS) — c'est la seule boucle de reprise qui ne remonte pas jusqu'au RC.

Dans chacun de ces cas, la personne qui reprend la demande voit le motif d'origine affiché en lecture seule, et peut y répondre par un texte libre facultatif avant de retransmettre — cette réponse apparaît comme une nouvelle entrée dans la chronologie des statuts, juste après le motif auquel elle répond (voir §1.4).

**La commande.** Une fois la FAD validée (avec ou sans passage devant le DS), elle atterrit dans la file de la CB avec l'indicateur « À commander » : la CB saisit la commande dans le PGI (hors application), puis constate le montant réel de la commande dans VIGIE. La demande passe alors au statut final « Commandée ».

## 1.3 Marchés, Commandes PGI et Investissements

Ces trois modules sont des **référentiels de consultation**, alimentés par import depuis le PGI (progiciel de gestion intégré du GPMM) — vous n'y créez ni ne modifiez de fiche manuellement, sauf exception signalée ci-dessous. Ils servent notamment à sélectionner un marché ou une opération d'investissement lors de la création d'une demande d'achat.

**États des marchés** (onglet Marchés) liste les marchés en cours, avec pour chacun deux indicateurs visuels : actif/archivé, et fiche complète/incomplète (un marché incomplet n'est pas sélectionnable dans une demande d'achat). Deux barres de progression signalent les marchés proches de leur échéance ou de leur plafond, avec des seuils d'alerte réglables. Un bandeau en haut d'écran indique la date du dernier import et vous alerte s'il date de plus de 15 jours. Un filtre dédié permet de croiser tous ces critères (actif, complet, alertes, agent gestionnaire), en plus d'une recherche libre. Tout agent authentifié consulte les marchés de son propre service ; la modification d'une fiche (sept champs seulement — décomposition du prix, nature de prestation, libellé, agent gestionnaire, seuils d'alerte, plan de prévention) et l'ajout d'une pièce sont réservés aux administrateurs (ADMIN_APP/ADMIN_SERVICE) et à la CB.

**Marchés d'un service tiers** est un registre distinct, pour des marchés gérés par un autre service du port et ressaisis manuellement (jamais importés) — consultation ouverte à tous pour leur service, création/modification/suppression réservées aux administrateurs et à la CB.

**Tableau de bord** (sous Marchés) synthétise ces indicateurs sous forme chiffrée, même périmètre de lecture.

**Commandes PGI** liste, en lecture seule, les commandes déjà passées (montant total, engagé, liquidé, reste à liquider), triable par colonne, filtrable par direction et service. Même bandeau de fraîcheur d'import.

**Investissements** présente les opérations d'investissement sous forme de cartes (statut PGI, indicateurs actif/utilisable, montants par tranche budgétaire — Autorisation de Programme et Crédit de Paiement, aux indices 1 et 8), avec un détail budget/engagé/liquidé/disponible par tranche sur demande. La modification reste limitée à trois champs (libellé propre au service, actif, utilisable), réservée aux administrateurs et à la CB, en complément de l'import.

## 1.4 Fournisseurs

L'onglet **Fournisseurs** est le référentiel des entreprises consultées et titulaires de marché, avec leurs contacts. La consultation est scopée à votre propre service (un administrateur applicatif peut choisir n'importe quel service). Contrairement aux trois modules précédents, **la création d'un fournisseur est ouverte à tout Demandeur**, pour son propre service — seule la modification et le passage en inactif restent réservés aux administrateurs. Le SIREN (identifiant entreprise à 9 chiffres) est obligatoire et vérifié par sa clé de contrôle. Un fournisseur ne se supprime jamais physiquement (seul un passage en « Inactif » est possible, et refusé si un marché, une demande d'achat ou un devis le référence encore) ; ses contacts, en revanche, se suppriment sans restriction. Un contact exige un nom, un prénom, sa fonction (dans une liste fermée) et au moins un numéro de téléphone valide.

## 1.5 Référentiels administrés

Plusieurs listes de paramétrage, gérées exclusivement par les administrateurs, alimentent indirectement vos formulaires (sélection dans une liste déroulante) sans que vous ayez vous-même à les gérer :

- **CUG** (Compte Unitaire de Gestion) — imputation analytique, obligatoire sur toute demande d'achat. Réservé en lecture et en écriture aux administrateurs.
- **Gisements géographique et technique** (Sites/Secteurs) — localisation d'une demande d'achat. Consultation ouverte à tous, gestion réservée aux administrateurs de votre service.
- **Seuils de validation DS** — voir §1.2. Gestion réservée aux administrateurs de votre service.
- **Référentiel libellé** — listes fixes utilisées ailleurs dans l'application (types de pièces jointes, notamment), réservé à l'administrateur applicatif (ADMIN_APP) seul.

___

# Partie 2 — Guide par rôle

## 2.1 Demandeur

**Ce que vous pouvez faire.** Créer une demande d'achat, la compléter au fil de la saisie, la transmettre à votre RC, et suivre son avancement jusqu'à la commande.

**Comment.** Depuis l'onglet « Mes demandes », le bouton **Nouvelle demande** crée immédiatement un brouillon vide que vous complétez ensuite : objet, description, montant, choix entre marché existant ou consultation hors marché. En procédure hors marché, vous consultez de 1 à 5 entreprises (dépôt du devis de chacune, classement du meilleur au moins bon par glisser-déposer — le premier devient le fournisseur retenu). En procédure marché, vous sélectionnez directement le marché concerné. Tant que la demande reste dans l'onglet « À finaliser », vous pouvez la modifier ou la supprimer ; une fois un fournisseur identifié, la **Gestion documentaire** vous permet de déposer les pièces complémentaires (plans, documentation technique...). Le bouton **Transmettre au RC** envoie la demande dans le circuit — elle passe alors en lecture seule de votre point de vue, jusqu'à un éventuel renvoi pour complément (elle réapparaît alors dans votre onglet « À finaliser », modifiable comme avant).

**Chronologie des statuts.** Sur chaque demande, l'icône « Historique des statuts » ouvre le fil chronologique complet de la demande — toutes les transitions de statut, plus récent en premier, avec la date, l'acteur (et son éventuel suppléant), et le commentaire s'il y en a un, affiché directement sous l'entrée concernée.

## 2.2 RC (Responsable de Cellule, N+1)

**Ce que vous pouvez faire.** Statuer sur l'opportunité de chaque demande de votre cellule, la finaliser (localisation, imputation, type d'achat) et la transmettre au CDS. Vous êtes aussi le point de reprise pour deux boucles de complément : celle du CDS (retour direct) et celle de la CB (modification, transmise ensuite directement à la CB sans repasser par le CDS).

**Comment.** Votre écran de suivi (« FAD — <cellule> » dans la barre latérale) présente 4 onglets : À traiter, En cours, FAD commandées, Rejetées/Annulées. Sur une demande « À traiter », l'icône dédiée ouvre **Valider les éléments de la commande** — une visualisation des éléments transmis par le demandeur (objet, montant, fournisseur consulté) et quatre décisions possibles : Valider, Demander un complément, Rejeter, Annuler (commentaire obligatoire sauf pour Valider). Une fois validée, la demande reste dans votre file jusqu'à ce que vous ouvriez l'écran **Traiter** pour la finaliser : reformulation de l'objet/description si besoin, saisie du site, du secteur, du CUG, du type d'achat, du type de FAD et de l'imputation comptable, puis **Transmettre au CDS**. Un bouton **Enregistrer** vous permet de sauvegarder votre saisie en plusieurs fois sans transmettre. Sur une reprise après demande de complément (du CDS) ou de modification (de la CB), ce même écran affiche le motif d'origine et vous propose d'y répondre avant de retransmettre.

**Chronologie des statuts.** Même mécanisme que pour le Demandeur — icône « Historique des statuts » sur chaque ligne, fil chronologique complet, plus récent en premier.

## 2.3 CDS (Chef de Service, N+2)

**Ce que vous pouvez faire.** Statuer sur les FAD de votre service et les transmettre à la CB. **Vous ne modifiez jamais aucun champ** — contrairement au RC, votre rôle est purement décisionnel.

**Comment.** Votre écran de suivi (« FAD (N+2) — <service> ») présente les mêmes 4 onglets que le RC, scopés à votre service entier (pas seulement une cellule). Sur une FAD « À traiter », l'unique icône ouvre **Valider les éléments de la commande** — un résumé en lecture seule, avec les quatre mêmes décisions que le RC (Valider/Compléter/Rejeter/Annuler). Une fois validée, la même modale se rouvre pour proposer uniquement **Transmettre à la CB**, sans aucune saisie.

**Chronologie des statuts.** Identique aux autres rôles.

## 2.4 CB (Contrôle Budgétaire)

**Ce que vous pouvez faire.** Contrôler les éléments financiers et budgétaires de chaque FAD de votre service, corriger si besoin certains champs comptables (CUG, type d'achat, imputation), transmettre au DS (ou constater l'exemption automatique de seuil), répondre à une demande de complément du DS, et enfin constater la commande une fois celle-ci passée dans le PGI. Vous êtes un rôle **collectif** (jamais individuellement suppléé).

**Comment.** Votre écran de suivi (« FAD (CB) — <service> ») propose un unique onglet « À traiter », qui regroupe toutes les FAD sur lesquelles une action de votre part est possible — y compris celles à modifier après renvoi par le RC. Trois modales selon le cas : **Valider la commande** (décision + correction éventuelle des champs comptables), **Compléter** (répondre au motif du DS, avec les mêmes trois champs modifiables), **Commander** (saisie du montant réel une fois la commande passée dans le PGI). C'est aussi depuis votre écran que se télécharge la **fiche FAD papier** (PDF récapitulatif, réservé à votre rôle).

**Chronologie des statuts.** Identique aux autres rôles.

## 2.5 DS (Directeur de Service, N+3)

**Ce que vous pouvez faire.** Statuer sur les FAD de votre direction dont le montant dépasse le seuil de validation défini pour leur service, et donner l'ordre de commande à la CB une fois validées. Votre périmètre est une **direction**, potentiellement plusieurs services — contrairement aux autres rôles, scopés à un service ou une cellule unique. **Vous ne modifiez jamais aucun champ**, comme le CDS.

**Comment.** Votre écran de suivi (« FAD (N+3) — <direction> ») fonctionne comme celui du CDS : un onglet « À traiter » avec une décision (Valider/Compléter/Rejeter/Annuler — le complément revient directement à la CB, pas au RC ni au CDS), puis, une fois validée, un bouton unique **Transmettre à la CB**. L'onglet « En cours » reste visible même pour les FAD qui ne passent jamais par vous : celles exemptées de seuil y apparaissent, marquées du badge **« Seuil DS »**, pour votre traçabilité — sans jamais nécessiter d'action de votre part.

**Chronologie des statuts.** Identique aux autres rôles.
