# Initialisation de dépôt Git/GitHub et déploiement Railway

> Compétences génériques, indépendantes du projet : procédure et pièges rencontrés en
> pratique lors de l'initialisation d'un dépôt et d'un déploiement sur Railway (stack
> Node/TypeScript, monorepo npm workspaces avec un frontend et un backend — mais la
> logique reste valable pour d'autres stacks). À relire au démarrage de tout nouveau
> projet avant d'initialiser un dépôt ou de configurer Railway.

## 1. Initialiser le dépôt Git et le pousser sur GitHub

Avant le tout premier commit :

1. `git status` complet (jamais `-uall` sur un gros repo) : relire la liste entière,
   repérer tout fichier volumineux ou non expliqué à la racine (archive, dump, export).
2. Vérifier qu'aucun fichier `.env` réel n'est présent parmi les fichiers suivis — seuls
   les `.env.example` doivent l'être. `find . -iname ".env*" -not -iname "*.example" -not -path "*/node_modules/*"`
   doit renvoyer une liste vide.
3. Vérifier que `.gitignore` (racine + chaque sous-projet) couvre au minimum :
   `node_modules`, `dist`/`build`, `.env`, `.env.local`, `*.log`.
4. Avant `git push` vers un remote existant : `git ls-remote <url>` pour confirmer que le
   dépôt distant est vide (aucune sortie, exit code 0). S'il contient déjà des refs, ne
   pas pousser sans en discuter avec l'utilisateur — risque d'écraser du contenu existant.

Ensuite : `git add -A` (justifié uniquement pour un commit initial complet et déjà vérifié
sain — pas une habitude à reproduire sur des commits ultérieurs, où un ajout ciblé reste
préférable), commit avec un message décrivant le contenu du scaffold, `git remote add
origin <url>`, `git push -u origin main`.

## 2. Utiliser la CLI Railway sans installation globale

`npx --yes @railway/cli <commande>` — pas besoin d'installer le paquet, chaque appel le
télécharge/utilise à la volée.

**Authentification en environnement non interactif** (pas de navigateur disponible côté
agent) : `railway login --browserless`. La commande affiche une URL et un code à 8
caractères ; transmettre ce lien à l'utilisateur pour qu'il le valide **dans son propre
navigateur**, là où il est déjà connecté. Ne jamais demander d'identifiants directement.
Vérifier ensuite avec `railway whoami`.

**Lier un projet existant** : `railway list` pour voir les projets accessibles, puis
`railway link -p <NomOuID>` — accepte le nom ou l'ID, résout généralement sans prompt
interactif supplémentaire si le nom est unique.

**Avant toute commande destructrice ou de configuration**, vérifier sa syntaxe exacte via
`<commande> --help` plutôt que de deviner des noms de flags : les CLI évoluent, et un flag
mal deviné peut échouer silencieusement ou faire autre chose que prévu.

### ⚠️ `railway variables` affiche les secrets en clair

Contrairement au dashboard web (valeurs masquées par défaut), `railway variables` en CLI
imprime **toutes les valeurs en texte clair**, y compris les clés privilégiées. Cette
sortie atterrit dans les logs/l'historique de l'outil qui l'a exécutée. Réflexes :

- Ne lancer cette commande que si c'est réellement nécessaire (pas par réflexe
  d'inspection).
- Si une valeur sensible apparaît ainsi (clé service-role, secret API, etc.), le signaler
  **immédiatement et explicitement** à l'utilisateur, et recommander sa régénération côté
  fournisseur (elle doit être considérée comme potentiellement compromise dès qu'elle a
  transité par un canal qui n'est pas fait pour ça).
- Distinguer les clés publiques par nature (clé "anon"/"publishable" d'un client, destinée
  à être exposée côté navigateur) — pas de rotation nécessaire si affichées — des clés
  privilégiées qui contournent des contrôles d'accès (service-role, clé d'admin, secret de
  signature) — celles-là doivent être tournées.

## 3. Choisir l'architecture de déploiement — avec l'utilisateur, pas à sa place

Deux modèles courants pour déployer un frontend + un backend sur Railway. Le choix change
concrètement ce qu'il faut coder ; ne pas le présumer — le confirmer explicitement.

**Indice à chercher avant de demander** : une variable d'environnement déjà configurée
côté Railway du type `VITE_API_URL=/api` (valeur **relative**) trahit une intention de
service unique — une URL relative ne fonctionne que si frontend et API partagent la même
origine.

### a) Service unique (un seul processus sert le frontend ET l'API)

- Le serveur backend sert aussi les fichiers statiques du build frontend, expose l'API
  sous un préfixe dédié (ex. `/api`), et renvoie `index.html` en fallback pour le routage
  côté client (SPA).
- Avantages : un seul domaine, pas de CORS à gérer entre les deux.
- Implémentation type (Express) :
  1. Monter les routes API sous le préfixe (`app.use('/api', routes)`).
  2. Juste après, un handler `app.use('/api', notFound)` qui répond 404 JSON sur toute
     route `/api/*` non matchée — **avant** le fallback SPA, sinon une route API inconnue
     renverrait `index.html` avec un statut 200 au lieu d'un 404.
  3. `express.static(distPath)` puis un catch-all `app.get('*', ...)` qui renvoie
     `index.html` pour tout le reste.
  4. Gater ce bloc par l'existence réelle du build (`fs.existsSync`) : en développement,
     le frontend tourne sur son propre serveur (Vite dev, etc.), le dossier `dist` n'existe
     pas encore, et seule l'API doit répondre — sans changement de comportement local.
- Un seul `railway.json` à la racine du repo (le service déploie depuis la racine, pas un
  sous-dossier) ; script `start` **à la racine du repo** (voir piège ci-dessous).

### b) Deux services séparés dans le même projet Railway

- Chaque service a son propre "Root Directory" (ex. `/backend`, `/frontend`), réglé dans
  ses Settings.
- ⚠️ **Piège documenté par Railway** : le fichier de config (`railway.json`/`.toml`) ne
  suit pas le Root Directory. Il faut soit placer un fichier de config dans chaque
  sous-dossier et régler explicitement le "Config File Path" de chaque service pour qu'il
  pointe dessus, soit s'appuyer entièrement sur la config dashboard.
- Variables croisées entre services d'un même projet : syntaxe
  `${{ nom_du_service.RAILWAY_PUBLIC_DOMAIN }}` — ne renvoie que le domaine, sans schéma
  (préfixer `https://` à la main). Résolues aussi au moment du build, donc utilisables pour
  des variables "gravées" au build (type `VITE_*` de Vite) — mais seulement si le service
  référencé a déjà un domaine public généré au moment du build du service dépendant.
- Le frontend statique a besoin de son propre mécanisme de service (serveur statique dédié
  type `serve -s dist -l $PORT`, ou configuration spécifique du builder).

## 4. Pièges de build rencontrés en pratique, et leur cause

- **"No start command detected"** (échec au stade `prepare`) → il manque un script
  `"start"` dans le `package.json` **à la racine du service déployé**. Sur un monorepo
  npm workspaces déployé depuis la racine, un `"start"` défini seulement dans le
  `package.json` d'un workspace ne suffit pas : il en faut un à la racine qui délègue
  (ex. `"start": "node backend/dist/server.js"`).
- **`npm ci` échoue avec "Missing: X from lock file"** alors que tout fonctionne en
  local → le `package-lock.json` n'a pas été régénéré après l'ajout/la modification d'une
  dépendance dans le `package.json` d'un workspace. `npm install` corrige ce
  désalignement silencieusement en local ; `npm ci` (utilisé par les builds Railway/CI)
  est strict et échoue net. Réflexe : après toute modification de dépendances, lancer
  `npm install` **à la racine du repo** (pas seulement dans le sous-workspace concerné)
  et committer le lockfile mis à jour.
- **Avertissements `EBADENGINE`** (une dépendance exige une version de Node supérieure à
  celle utilisée par le builder) → ajouter un champ `"engines": { "node": ">=XX" }` dans
  le `package.json` racine pour que le builder sélectionne une version de Node
  compatible.
- **Le builder par défaut peut changer sans prévenir** (Nixpacks vs Railpack observés
  successivement sur un même projet, sans changement de config côté repo) : un
  `railway.json` avec `"builder": "NIXPACKS"` n'est pas garanti d'être honoré si Railway a
  fait évoluer son builder par défaut. Toujours vérifier dans les logs de build quel
  builder a réellement été utilisé plutôt que de le supposer.
- **Dépréciation du "Config as Code"** (`railway.json`/`.toml`) au profit d'un format
  "Infrastructure as Code" (`.railway/railway.ts`, migration via `railway config
  migrate`), annoncée par la CLI elle-même — vérifier l'état de cette dépréciation au
  moment de la mise en œuvre plutôt que de supposer que `railway.json` fonctionnera
  indéfiniment sans y prêter attention.

## 5. Redéployer après un correctif

- `railway redeploy --from-source -y` : relance un déploiement à partir du dernier commit
  de la source déjà configurée (le repo GitHub connecté), sans rien uploader depuis le
  poste local.
- **Éviter `railway up` sur un service déjà connecté à un dépôt GitHub** : cette commande
  peut basculer la source de déploiement vers un upload CLI ad hoc et désolidariser le
  service de son dépôt (perte de l'auto-déploiement sur push). Elle reste appropriée pour
  un service qui n'est pas encore connecté à un dépôt.
- Suivre l'avancement d'un déploiement :
  - `railway deployment list --json` → statut (`BUILDING`, `DEPLOYING`, `SUCCESS`,
    `FAILED`…) et hash du commit associé, pour confirmer qu'un nouveau déploiement a bien
    été déclenché sur le bon commit.
  - `railway logs <deployment-id> --build --lines N` pour les logs de build (diagnostic
    des échecs de `prepare`/`npm ci`/`npm run build`).
  - `railway logs <deployment-id> --lines N` (sans `--build`) pour les logs d'exécution du
    service une fois démarré.

## 6. Gestion des secrets pendant la mise en œuvre

- Éviter de faire transiter une valeur de secret par la conversation quand une
  alternative existe : préférer un fichier local `.env`/`.env.local` (déjà couvert par
  `.gitignore`) que l'agent peut lire directement, plutôt que de la faire coller dans le
  chat.
- Si un secret apparaît malgré tout en clair dans une sortie d'outil (voir §2), le
  signaler explicitement et sans délai, et recommander sa régénération côté fournisseur
  plutôt que de poursuivre sans le mentionner.
- Une fois une valeur de secret récupérée légitimement (ex. depuis les variables déjà
  configurées sur la plateforme de déploiement), elle peut être reportée dans les fichiers
  `.env` locaux du projet pour permettre le développement local — à condition que ces
  fichiers restent bien hors du dépôt Git.

## 7. Checklist rapide

1. `git status` relu intégralement avant tout premier commit — rien d'inattendu.
2. Aucun `.env` réel dans les fichiers suivis ; `.gitignore` complet (racine + sous-projets).
3. `git ls-remote <url>` avant `git push` vers un remote existant.
4. Architecture de déploiement (service unique vs deux services) confirmée avec
   l'utilisateur avant d'écrire la moindre config Railway.
5. `package-lock.json` régénéré à la racine après toute modification de dépendances dans
   un workspace, avant de pousser.
6. `engines.node` défini si des dépendances l'exigent (vérifier les warnings `EBADENGINE`).
7. Build et tests exécutés en local avant de pousser un correctif de déploiement.
8. Aucune valeur de secret laissée en clair dans la conversation sans que ce soit signalé
   et une régénération recommandée.
