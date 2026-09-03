# Instructions UX / Design system GPMM

Cette application fait partie des applications métier du Grand Port Maritime de
Marseille (GPMM). Elle doit respecter strictement le design system commun à toutes
les applications GPMM, fourni dans ce dossier `ForClaude/Template UX`.

Ces règles priment sur toute décision de design ou de comportement d'interface
que tu pourrais prendre par défaut. Elles sont obligatoires, pas des suggestions.

## À faire avant d'écrire une seule ligne de code d'interface

1. Lire intégralement `ForClaude/Template UX/GUIDELINES.md`.
2. Lire `ForClaude/Template UX/gpmm-style-guide.html` pour voir tous les composants
   disponibles et leur usage (ouvrir le fichier ou en lire le code).
3. Regarder `ForClaude/Template UX/exemple-erp-voyageurs.html` comme référence d'une
   application complète déjà construite avec ce template.

## Règles non négociables

- Utiliser `ForClaude/Template UX/gpmm.css`, `ForClaude/Template UX/app.js` et `ForClaude/Template UX/icons.svg`
  tels quels. Ne jamais les copier puis les modifier localement à cette
  application — toute évolution nécessaire se fait au niveau du template
  partagé, pas d'une application individuelle.
- Ne jamais improviser un composant (bouton, champ, tableau, modale, calendrier,
  etc.) qui n'existe pas dans `gpmm-style-guide.html`. Si un besoin n'est couvert
  par aucun composant existant, s'arrêter et le signaler plutôt que de contourner
  avec du CSS/JS ad hoc.
- Ne jamais introduire de couleur, police, ombre, rayon de bordure ou espacement
  en dur. Toutes les valeurs visuelles passent par les variables CSS `--gp-*`
  définies dans `gpmm.css`.
- Ne jamais utiliser d'icône extérieure au sprite `icons.svg` (nomenclature
  `#i-xxx`). Si une icône manque, le signaler.
- Ne jamais utiliser `<input type="date">` natif du navigateur, ni un simple champ
  texte `JJ/MM/AAAA` par confort : **tout champ date doit utiliser le calendrier
  interactif `.gp-dp`** documenté dans `GUIDELINES.md` — voir la spécificité VIGIE
  ci-dessous pour son intégration concrète dans cette application React.
- Ne jamais utiliser un simple `<input type="number">` nu pour une valeur numérique
  courte à ajuster (quantité, seuil, nombre de jours…) : **tout champ de ce type doit
  utiliser le spin button `.gp-spin`** (chevrons haut/bas) documenté dans
  `GUIDELINES.md`/`gpmm-style-guide.html` — voir la spécificité VIGIE ci-dessous.
  Exception assumée : un **montant** (euros, souvent à 5-6 chiffres) n'est pas une
  valeur qu'on ajuste au chevron — il reste un `<input type="text">` filtré aux
  chiffres uniquement (voir `sanitizeInteger` dans `SeuilsValidationDs.tsx` et
  `Marches.tsx`), jamais `type="number"` natif (qui autoriserait `e`, `+`, `-`, et
  affiche des flèches navigateur non stylées).
- La structure du shell applicatif (header, sidebar rétractable, barre de statut)
  ne se modifie pas. Seuls le contenu de page, les onglets et le menu latéral
  changent d'une application à l'autre.
- Toute logique métier (données, appels API, règles propres à cette application)
  va dans un fichier JS séparé, chargé après `app.js`. Ne jamais écrire de
  logique métier dans les fichiers du template.

## Spécificité VIGIE — application React, `app.js` non chargé

VIGIE est une SPA React (Vite), pas une page statique du gabarit. **`ForClaude/Template
UX/app.js` n'est jamais importé dans `frontend/`** (seul `gpmm.css` l'est, via
`src/main.tsx`) — les comportements interactifs que `app.js` pilote normalement dans le
gabarit statique (`initCombobox`, `initDatepicker`, `initSpinButtons`, etc., via des
attributs `data-*` requêtés sur le DOM) n'ont donc **aucun effet** dans cette
application : poser le balisage HTML brut d'un composant du style guide (ex. copier
littéralement le `<div class="gp-dp" data-dp>...` de `GUIDELINES.md`) produit un
élément inerte, pas un vrai calendrier.

**Chaque composant interactif du template utilisé dans VIGIE doit exister comme
composant React dédié**, dans `frontend/src/components/`, qui reproduit fidèlement les
classes CSS et la structure du composant `gpmm.css` d'origine (donc entièrement stylé
par le template partagé, sans aucune valeur en dur) mais dont le comportement
(ouverture/fermeture, navigation, sélection…) est réimplémenté en React — jamais une
dépendance à `app.js`. Deux existent déjà, à réutiliser systématiquement plutôt que d'en
recréer un autre ou de revenir à un champ texte simplifié :

- `components/Combobox.tsx` — réimplémentation de `.gp-combobox`.
- `components/DatePicker.tsx` — réimplémentation de `.gp-dp` (calendrier), utilisé par
  tous les champs date de l'application (ex. `CreateMarcheModal` dans `Marches.tsx`).
  Deux simplifications assumées par rapport au gabarit, documentées dans le composant
  lui-même : la saisie directe se fait dans le champ texte principal (pas le triptyque
  `.gp-dp__direct` à 3 segments auto-avançants du gabarit), et le sélecteur rapide
  mois/année (`.gp-dp__nav-sel`) est un simple libellé, sans menu déroulant — navigation
  uniquement via les flèches précédent/suivant.
- `components/SpinButton.tsx` — réimplémentation de `.gp-spin` (variante desktop,
  chevrons haut/bas — pas `.gp-spin--touch`, non nécessaire à ce jour), utilisé par tout
  champ numérique court de l'application (ex. Montant maximum/Alerte sur date/Alerte sur
  montant de `CreateMarcheModal` dans `Marches.tsx`).

Si un composant du template est nécessaire mais n'a pas encore d'équivalent React dans
`components/`, il faut le construire sur ce même principe (reprendre les classes CSS du
gabarit, comportement en React) — jamais improviser un composant visuellement différent,
et jamais copier le balisage `data-*` du gabarit en supposant que `app.js` le fera
fonctionner.

### Panneaux flottants (`.gp-menu`, `.gp-dp__panel`…) dans un conteneur scrollable

`.gp-menu` (Combobox) et `.gp-dp__panel` (DatePicker) sont en `position:absolute` dans
`gpmm.css`, positionnés par rapport à leur propre racine (`.gp-combobox`/`.gp-dp`). Posé
tel quel à l'intérieur d'un conteneur en `overflow` non visible — typiquement
`.gp-modal__bd.gp-scroll` d'une modale un peu longue — le panneau est rogné dès qu'il
dépasse le cadre du conteneur, même si son `z-index` est correct : le `z-index` régit
l'empilement, pas le rognage par `overflow`, qui s'applique indépendamment.

`Combobox.tsx` et `DatePicker.tsx` contournent ce problème en rendant leur panneau via un
portail React (`createPortal`) directement dans `document.body`, positionné en
`position:fixed` avec des coordonnées calculées depuis `getBoundingClientRect()` de
l'ancre (hook partagé `hooks/useFloatingPosition.ts`, qui recalcule la position tant que
le panneau est ouvert — scroll de n'importe quel ancêtre, resize). Tout futur composant à
panneau flottant (menu, popover, etc.) doit suivre le même principe dès qu'il est
susceptible d'apparaître dans une modale ou toute autre zone scrollable — ne jamais se
contenter du `position:absolute` du gabarit dans ce cas, sous peine d'options invisibles
ou inatteignables.

Conséquence pour les tests (Testing Library) : un panneau ainsi portalé n'est plus un
descendant DOM de son composant d'origine ni de la modale — le rechercher avec
`document.querySelector('.gp-menu')` (ou `screen.getByRole(...)`), jamais avec
`within(dialog)` ni `trigger.closest('.gp-combobox')!.querySelector(...)`.

### Modale avec `<form>` : shrink-to-fit et scroll interne

`.gp-modal` est un flex-column avec `max-height` et `overflow:hidden` — le contrat attendu
est que `.gp-modal__hd`/`.gp-modal__ft` gardent leur taille (`flex:none`) et que
`.gp-modal__bd` absorbe l'espace restant et scrolle (`overflow-y:auto`) dès que le contenu
dépasse. Ce contrat casse silencieusement si `.gp-modal__bd` et `.gp-modal__ft` sont
enveloppés dans un `<form>` : le `<form>` (bloc, `overflow:visible` par défaut) devient
alors l'unique enfant flex de `.gp-modal`, et sa taille minimale automatique se cale sur
son contenu — il ne rétrécit jamais, et `.gp-modal` le rogne purement et simplement avec
son `overflow:hidden`, y compris le pied avec les boutons (aucune scrollbar n'apparaît nulle
part, les boutons deviennent inatteignables). C'est le cas de toute modale de ce projet
utilisant `<form onSubmit=...>` autour de `.gp-modal__bd`/`.gp-modal__ft` (le gabarit
statique, lui, ne met jamais de `<form>` à cet endroit — voir
`ForClaude/Template UX/exemple-erp-voyageurs.html`).

Le correctif systématique appliqué à toutes ces modales : donner au `<form>` lui-même
`style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}`,
pour qu'il redevienne un vrai conteneur flex-column capable de rétrécir et de répartir
correctement l'espace entre son corps (scrollable) et son pied (fixe). Reprendre ce même
style sur tout nouveau `<form>` placé de cette manière dans une modale.

## Démarrage d'une nouvelle application

Dupliquer `ForClaude/Template UX/starter-vierge.html` comme point de départ du fichier
principal de cette application (adapter les chemins vers `gpmm.css`, `app.js`,
`icons.svg` et `logo-gpmm.png` selon l'emplacement réel du fichier de destination),
puis suivre `ForClaude/Template UX/GUIDELINES.md`.
