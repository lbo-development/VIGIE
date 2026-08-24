# Template GPMM — Guide d'implémentation pour Claude Code

Ce document explique comment utiliser le template GPMM pour construire une nouvelle
application métier. Il doit être fourni à Claude Code au début de tout nouveau projet
d'application GPMM, avant toute écriture de code.

## Objectif

Toutes les applications métier GPMM (ERP-Voyageurs et les suivantes) doivent partager
**exactement** le même design : mêmes composants, mêmes couleurs, même comportement,
même structure de navigation. Ce template est la source unique de vérité. Il ne doit
**jamais** être copié puis modifié à la marge par une application individuelle — voir
la section « Règles strictes » ci-dessous.

## Contenu du template

```
gpmm-template/
├── gpmm.css                    Feuille de style UNIQUE — shell + tous les composants
├── icons.svg                   Sprite de 35 icônes SVG standardisées (#i-xxx)
├── app.js                      Socle JS commun — shell + comportement de tous les composants
├── starter-vierge.html         Point de départ pour une nouvelle application
├── exemple-erp-voyageurs.html  Exemple d'application complète, tous composants en situation
├── logo-gpmm.png                Logo — référencé à la racine (src="logo-gpmm.png")
└── GUIDELINES.md                Ce document
```

**Logo :** les deux fichiers HTML référencent `logo-gpmm.png` à la racine du projet
(`src="logo-gpmm.png"`), pas dans un sous-dossier `assets/`. Si le projet cible préfère
un dossier `assets/`, adapter le chemin dans le HTML — mais garder un chemin **relatif
simple**, à un seul niveau, pour que l'image reste visible même si le fichier HTML est
prévisualisé isolément (sans le reste de l'arborescence à côté).

Un document séparé, `gpmm-style-guide.html`, sert de **catalogue visuel** de tous les
composants disponibles (avec démonstration interactive) — à consulter pour voir à quoi
ressemble un composant avant de l'utiliser, mais **jamais à copier son CSS/JS** : c'est
`gpmm.css` et `app.js` qui font foi en production.

## Démarrage d'une nouvelle application

1. Copier `gpmm.css`, `icons.svg` (ou le sprite inline), `app.js`, `logo-gpmm.png` /
   `assets/logo-gpmm.png` tels quels dans le nouveau projet — **sans aucune modification**.
2. Dupliquer `starter-vierge.html` comme point de départ du fichier principal de la
   nouvelle application.
3. Remplacer les textes entre crochets (`[Nom de l'application]`), adapter les onglets
   de navigation (`data-main-tab`) et le menu latéral (`.sidebar-item`, `.menu-group`)
   à l'organisation propre de la nouvelle application.
4. Construire les pages avec les composants documentés dans `gpmm-style-guide.html` en
   utilisant exclusivement les classes `gp-*` existantes.
5. Toute logique métier (données, appels API, règles spécifiques à l'application) va
   dans un fichier JS séparé (ex. `app-metier.js`), chargé **après** `app.js`. Ne jamais
   écrire de logique métier dans `app.js` lui-même.

## Règles strictes

**Ne jamais modifier `gpmm.css` ou `app.js` au niveau d'une application individuelle.**
Si un composant manque ou ne convient pas à un besoin, c'est le template lui-même qui
doit évoluer (nouvelle version distribuée à toutes les applications), jamais une copie
locale divergente. Une divergence locale, même petite, est exactement le problème que
ce template existe pour éliminer.

**Ne jamais réinventer un composant qui existe déjà.** Avant d'écrire du HTML/CSS pour
un bouton, un champ, un tableau, une modale, etc., vérifier dans `gpmm-style-guide.html`
si un composant `gp-*` existant répond au besoin. Consulter la liste de la section
suivante.

**Ne jamais introduire de nouvelle couleur, police, ombre ou rayon de bordure en dur.**
Toutes les valeurs visuelles passent par les variables CSS définies dans `:root` de
`gpmm.css` (`--gp-primary`, `--gp-radius`, `--gp-shadow-float`, etc.). Si une teinte
semble manquante, c'est un signal pour faire évoluer le template plutôt que d'écrire
une couleur en dur dans une page.

**Toujours utiliser le sprite d'icônes fusionné (`#i-xxx`).** Ne pas ajouter d'icônes
depuis une autre bibliothèque (Font Awesome, Material Icons, etc.). Si une icône
manque, l'ajouter au sprite partagé `icons.svg` (avec le même style de tracé : `viewBox
0 0 24 24`, `stroke-width:2`, coins arrondis) plutôt que d'improviser localement.

**La structure du shell (header / sidebar / statusbar) ne se modifie pas.** Le grid
3-lignes (`.app-shell`), le comportement de la sidebar rétractable, la position de la
languette de bascule (`.sidebar-rail-toggle`) et la logique de responsive sont fixes.
Seuls le contenu de `.content-area`, les onglets de `.header-tabs` et les entrées du
menu `.sidebar-nav` changent d'une application à l'autre.

## Composants disponibles (référence rapide)

Tous documentés avec exemples HTML dans `gpmm-style-guide.html`. Liste non exhaustive :

| Composant | Classes principales | Comportement JS |
|---|---|---|
| Boutons | `.gp-btn` + `--primary/--secondary/--ghost/--danger/--neutral`, `--sm/--lg`, `--icon` | — |
| Interrupteur | `.gp-switch` | natif (checkbox) |
| Case à cocher / radio | `.gp-check` / `.gp-radio` | — |
| Case maître indéterminée | `[data-master="groupe"]` + `[data-group="groupe"]` sur les cases filles | `initMasterCheckboxes` |
| Champ texte | `.gp-field` / `.gp-label` / `.gp-input` / `.gp-help` / `.gp-errmsg` | — |
| Groupe de saisie (icône, suffixe) | `.gp-inputgroup` | — |
| Spin button (nombre) | `.gp-spin[data-spin]` ou `.gp-spin--touch[data-spin]` | `initSpinButtons` |
| Calendrier / date picker | `.gp-dp[data-dp]` | `initDatepicker` |
| Listbox (sélection simple) | `.gp-listbox[data-single-listbox]` | `initSingleListbox` |
| Combobox | `.gp-combobox` avec `[data-cb-trigger]`/`[data-cb-value]`/`[data-cb-opt]` | `initCombobox` |
| Chips (filtres) | `.gp-chipset` / `.gp-chip` | `initChipsAndTiles` |
| Tuiles avec compteur | `.gp-tile[data-tile]` | `initChipsAndTiles` |
| Slicer liste à cocher | `.gp-slicer[data-slicer]` avec `[data-count]`/`[data-clear]` | `initCheckSlicers` |
| Slicer dropdown | `[data-dd]` avec `[data-dd-trigger]` | `initDropdownSlicers` |
| Slicer de plage | `.gp-range[data-range]` | `initRangeSliders` |
| Toasts | voir section dédiée ci-dessous | `initToasts` |
| Modale | voir section dédiée ci-dessous | `initModals` |
| Onglets en page | `.gp-tabs` / `.gp-tab[data-tab]` + `.gp-tabpanel[data-panel]` | `initPageTabs` |
| Panneaux liés aux onglets principaux (header) | `[data-main-panel="xxx"]` associé à `[data-main-tab="xxx"]` | `initShell` |
| Sélecteur segmenté | `.gp-seg` / `.gp-seg__item` | `initPageTabs` |
| Badge | `.gp-badge` + `--info/--success/--warning/--danger` | — |
| Tableau (tri, redim., réordo., sélection) | voir section dédiée ci-dessous | `initTables` |
| Tooltip | `.gp-tip[data-tip="texte"]` | CSS uniquement |
| Popover | `.gp-popover` | à câbler au cas par cas |
| Empilement vertical espacé | `.stack` (`gap:14px` par défaut) | — |
| Rangée horizontale avec retour à la ligne | `.row` (`gap:16px`) | — |
| Grille auto-adaptative | `.grid` (colonnes `minmax(230px,1fr)`) | — |
| Séparateur horizontal | `.divider` | — |

### Utiliser une modale

```html
<button class="gp-btn gp-btn--primary" data-open-modal="monId">Ouvrir</button>

<div class="gp-overlay" id="monId">
  <div class="gp-modal" role="dialog" aria-modal="true" aria-labelledby="monIdTitre">
    <div class="gp-modal__hd">
      <h3 class="gp-modal__title" id="monIdTitre">Titre</h3>
      <button class="gp-modal__close" data-close aria-label="Fermer"><svg class="ti"><use href="#i-x"></use></svg></button>
    </div>
    <div class="gp-modal__bd gp-scroll">...</div>
    <div class="gp-modal__ft">
      <button class="gp-btn gp-btn--secondary" data-close>Annuler</button>
      <button class="gp-btn gp-btn--primary" data-close>Enregistrer</button>
    </div>
  </div>
</div>
```
S'ouvre/se ferme aussi via `window.gpmmOpenModal(id)` / `window.gpmmCloseModal(id)` en JS.

### Déclencher un toast

```js
gpmmToast({ type: 'success', title: 'Modifications enregistrées', text: 'La fiche a été mise à jour.' });
// type: 'info' | 'success' | 'warning' | 'danger'
// info/success disparaissent seuls après 5s ; warning/danger restent jusqu'à fermeture manuelle
```

### Afficher un contenu différent par onglet principal (header)

Chaque bouton `[data-main-tab="xxx"]` du header peut avoir un panneau de contenu
associé, affiché automatiquement au clic (les autres sont masqués) :

```html
<div data-main-panel="escales" hidden>...contenu de l'onglet Escales...</div>
```

Le panneau correspondant à l'onglet actif au chargement (`aria-selected="true"`) ne
doit pas porter `hidden`. Un onglet sans panneau défini affiche simplement une zone
vide — utile pour des modules pas encore développés. Voir `exemple-erp-voyageurs.html`
pour un exemple avec 5 panneaux actifs sur 8 onglets.

### Saisir une date

**Ne jamais utiliser `<input type="date">` natif du navigateur** — son datepicker n'est
pas stylé par GPMM et casse la cohérence visuelle. Utiliser le composant du style
guide : un champ texte au format JJ/MM/AAAA dans un `.gp-inputgroup` avec l'icône
`#i-calendar` :

```html
<div class="gp-field">
  <label class="gp-label">Date</label>
  <div class="gp-inputgroup"><input placeholder="JJ/MM/AAAA"><svg class="ti" style="font-size:15px;"><use href="#i-calendar"></use></svg></div>
</div>
```

Le template ne fournit pas de calendrier déroulant interactif — c'est un champ texte
avec icône décorative. Si un vrai calendrier déroulant devient nécessaire pour une
application, c'est un nouveau composant à ajouter au template (voir dernière section),
pas une raison de revenir au datepicker natif.

### Saisir une date

Deux composants existent selon le besoin, ne jamais utiliser `<input type="date">`
natif du navigateur (datepicker non stylé, casse la cohérence visuelle) :

**Date unique — calendrier `.gp-dp` :** dropdown sous le champ, grille avec mois/année
cliquables, bascule automatique en saisie directe JJ/MM/AAAA dès que l'utilisateur
tape, colonnes samedi/dimanche en bande continue, aujourd'hui marqué d'un point.

```html
<div class="gp-dp" data-dp>
  <div class="gp-dp__input" data-dp-trigger>
    <span class="gp-dp__ico"><svg class="ti"><use href="#i-calendar"></use></svg></span>
    <input type="text" placeholder="JJ/MM/AAAA" maxlength="10" data-dp-input aria-label="Date" autocomplete="off">
  </div>
  <div class="gp-dp__panel" data-dp-panel>
    <div class="gp-dp__direct" data-dp-direct>
      <div class="gp-dp__dpart" data-dp-dd>--</div><span class="gp-dp__dsep">/</span>
      <div class="gp-dp__dpart" data-dp-mm>--</div><span class="gp-dp__dsep">/</span>
      <div class="gp-dp__dpart" style="flex:2;" data-dp-yy>----</div>
    </div>
    <p class="gp-dp__hint" data-dp-hint hidden>Saisie en cours — JJ/MM/AAAA</p>
    <div class="gp-dp__nav">
      <button class="gp-dp__nav-btn" data-dp-prev aria-label="Mois précédent"><svg class="ti"><use href="#i-chevron-left"></use></svg></button>
      <div class="gp-dp__nav-sels"><button class="gp-dp__nav-sel" data-dp-msel></button><button class="gp-dp__nav-sel" data-dp-ysel></button></div>
      <button class="gp-dp__nav-btn" data-dp-next aria-label="Mois suivant"><svg class="ti"><use href="#i-chevron-right"></use></svg></button>
    </div>
    <div class="gp-dp__body"><div class="gp-dp__grid" data-dp-grid></div></div>
    <div class="gp-dp__foot">
      <button class="gp-btn gp-btn--ghost gp-btn--sm" data-dp-today>Aujourd'hui</button>
      <button class="gp-btn gp-btn--primary gp-btn--sm" data-dp-ok>OK</button>
    </div>
  </div>
</div>
```

Comportement fourni automatiquement par `app.js` (`initDatepicker`) : aucun JS
supplémentaire à écrire. **Point d'attention connu :** le panel s'ouvre en
`position:absolute` ; s'il est placé à l'intérieur d'un conteneur à `overflow`
contraint (ex. `.gp-modal__bd`), il peut être tronqué visuellement selon la position
du champ. Vérifier visuellement dans ce cas, et déplacer le champ ou ajuster le
conteneur si besoin.

**Plage de dates — filtre :** préréglages (`7 jours`, `30 jours`, `Ce mois`,
`Personnalisé`) + deux champs texte JJ/MM/AAAA dans des `.gp-inputgroup` avec icône
`#i-calendar` (pas de calendrier déroulant sur ce composant — voir la section
« Slicer de plage » du style guide et `exemple-erp-voyageurs.html`, onglet Escales).

### Rendre un tableau triable / redimensionnable / sélectionnable

Ajouter `data-table` sur `.gp-table-wrap`, `data-col data-type="text|date"` +
`data-sort` + `data-rz` (redimensionnement) sur chaque `<th>` triable, et `data-rowcheck`
sur chaque case de ligne + `data-selall` sur la case d'en-tête. La poignée de
réordonnancement doit être un `<span class="gp-th__grip" draggable="true">` contenant
l'icône (pas `draggable="true"` posé directement sur le `<svg>` : peu fiable selon les
navigateurs) :

```html
<span class="gp-th__grip" draggable="true" aria-label="Déplacer la colonne" role="button">
  <svg class="ti"><use href="#i-grip-vertical"></use></svg>
</span>
```

Voir la section « Tableau » de `gpmm-style-guide.html` pour le balisage complet, ou
l'exemple fonctionnel dans `exemple-erp-voyageurs.html`.

**Colonne Actions par ligne :** `.gp-rowacts` regroupe des boutons icône dans une
cellule dédiée, en fin de tableau. Ce `<th>` ne porte ni `data-col` ni `data-sort` —
il reste fixe, non triable et non déplaçable :

```html
<div class="gp-rowacts">
  <button aria-label="Visualiser"><svg class="ti"><use href="#i-eye"></use></svg></button>
  <button aria-label="Modifier"><svg class="ti"><use href="#i-pencil"></use></svg></button>
  <button aria-label="Télécharger"><svg class="ti"><use href="#i-download"></use></svg></button>
  <button class="del" aria-label="Supprimer"><svg class="ti"><use href="#i-trash"></use></svg></button>
</div>
```
La classe `.del` colore l'icône en rouge (danger) — à réserver à l'action destructive.

## Nomenclature des icônes

Le sprite fusionné utilise exclusivement le préfixe `#i-`. Les 35 icônes disponibles :

`i-menu`, `i-chevron-left`, `i-chevron-right`, `i-chevron-down`, `i-home`, `i-ship`,
`i-tools`, `i-building`, `i-users`, `i-shield`, `i-folder`, `i-fire`, `i-settings`,
`i-moon`, `i-sun`, `i-search`, `i-plus`, `i-download`, `i-bell`, `i-check`, `i-x`,
`i-minus`, `i-arrow-up`, `i-arrow-down`, `i-selector`, `i-calendar`, `i-lock`,
`i-alert-circle`, `i-info-circle`, `i-circle-check`, `i-alert-triangle`, `i-eye`,
`i-pencil`, `i-trash`, `i-grip-vertical`, `i-cloud`.

Utilisation : `<svg class="ti"><use href="#i-nom"></use></svg>`

## Thème clair / sombre

Géré automatiquement par `app.js` (mémorisation via `localStorage`, repli sur la
préférence système). Aucune application ne doit implémenter sa propre bascule de
thème : le bouton `#themeToggle` du starter kit suffit et fonctionne partout où il
est présent dans le HTML.

## Ce qu'il faut faire si un besoin ne rentre dans aucun composant existant

Ne pas improviser une solution locale. Signaler le manque : le template doit être
étendu (nouveau composant ajouté à `gpmm.css`/`app.js`/`gpmm-style-guide.html` et
redistribué à toutes les applications), pas contourné application par application.
C'est la condition pour que la cohérence visuelle tienne dans la durée.
