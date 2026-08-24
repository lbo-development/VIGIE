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
- Ne jamais utiliser `<input type="date">` natif du navigateur : utiliser le
  composant `.gp-dp` (calendrier) documenté dans `GUIDELINES.md`.
- La structure du shell applicatif (header, sidebar rétractable, barre de statut)
  ne se modifie pas. Seuls le contenu de page, les onglets et le menu latéral
  changent d'une application à l'autre.
- Toute logique métier (données, appels API, règles propres à cette application)
  va dans un fichier JS séparé, chargé après `app.js`. Ne jamais écrire de
  logique métier dans les fichiers du template.

## Démarrage d'une nouvelle application

Dupliquer `ForClaude/Template UX/starter-vierge.html` comme point de départ du fichier
principal de cette application (adapter les chemins vers `gpmm.css`, `app.js`,
`icons.svg` et `logo-gpmm.png` selon l'emplacement réel du fichier de destination),
puis suivre `ForClaude/Template UX/GUIDELINES.md`.
