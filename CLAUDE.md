# VIGIE — contexte pour Claude Code

Voir aussi `docs/ARCHITECTURE.md` pour le détail complet de l'architecture.

## Stack

- **Frontend** : React 18 + TypeScript, bundler Vite, dans `frontend/`, routing React Router,
  état global via Context API (`frontend/src/context/`)
- **Backend** : Node.js + Express + TypeScript, dans `backend/`, architecture en couches
  (routes → controllers → services → repositories)
- **Base de données / Auth** : Supabase (client dans `frontend/src/lib/supabaseClient.ts` et
  `backend/src/config/supabaseClient.ts`), migrations via Supabase CLI (`database/migrations/`)
- **Déploiement** : Railway (config `backend/railway.json`), Docker Compose pour le dev local
- **Tests** : Vitest partout — React Testing Library côté frontend, Supertest côté backend

## Règle de dépendance backend (stricte)

```
routes → controllers → services → repositories → Supabase
```

Un controller n'appelle jamais un repository directement. Un repository ne contient
jamais de logique métier — uniquement des requêtes Supabase. Toute nouvelle ressource
suit le modèle de `cug` (`backend/src/{repositories,services,controllers,routes}/cug.*`) :
repository (requêtes Supabase), service (schéma Zod par opération d'écriture, règles
métier), controller (traduction requête/réponse), routes (`router.use(requireAuth)` en
tête — **toute nouvelle route doit monter `requireAuth`**, sans exception).

## Conventions frontend

- Une page = un fichier dans `pages/`, déclarée comme route dans `App.tsx`.
- Un composant réutilisable = un fichier dans `components/`, sans appel réseau direct.
- Tout appel HTTP passe par `services/api.ts`, jamais de `fetch()` direct dans un composant.
- La logique de données réutilisable (état + effet) va dans un hook `hooks/useXxx.ts`.

## Conventions générales

- Le frontend consomme l'API backend via `VITE_API_URL` (voir `frontend/.env.example`).
- La clé Supabase `service_role` ne doit **jamais** être utilisée côté frontend — uniquement dans `backend/`.
- Les variables d'environnement ne sont jamais commitées (`.env`, `.env.local` sont dans `.gitignore`) ; seuls les `.env.example` sont versionnés.
- Toute nouvelle variable d'environnement doit être ajoutée à la fois dans le fichier réel (non commité) et dans le `.env.example` correspondant, avec une valeur d'exemple neutre.
- Tout changement de schéma de base de données passe par une migration Supabase CLI (voir `database/migrations/README.md`), jamais par une modification manuelle non versionnée.
- **Claude Code ne modifie jamais directement la base Supabase (schéma ou données) — ni via le SDK, ni via l'API REST, ni via une commande shell.** La lecture (vérification, introspection) reste autorisée, jamais l'écriture (INSERT/UPDATE/DELETE/DDL/GRANT...). Si une modification est nécessaire, toujours proposer le script SQL correspondant et laisser l'utilisateur l'exécuter lui-même dans l'éditeur SQL du dashboard Supabase.

## Commandes utiles

```bash
npm run dev                 # frontend + backend en parallèle (racine)
npm run dev -w frontend     # lance uniquement le frontend
npm run dev -w backend      # lance uniquement le backend
npm run build                # build frontend + backend
npm run test                  # tests frontend + backend
npm run lint                   # lint frontend + backend
npm run seed                    # peuple la base avec des données de test
docker compose up                # frontend + backend via Docker (dev)
```

## Spécifications fonctionnelles de l'application (interface utilisateur)

Avant tout travail touchant aux spécification fonctionnelles tu dois lire intégralement les consignes enregistrées dans le répertoire `ForClaude/CDC` tu dois, avant toutes modificationss, me signaler si mes demandes sont cohérentes avec les documents.

## Design system GPMM (interface utilisateur)

Avant tout travail touchant à l'interface de cette application (HTML, CSS,
composants visuels, comportement d'écran), lire intégralement
`ForClaude/INSTRUCTIONS_UX.md`.

Ces règles priment sur toute décision de style ou de comportement d'interface
prise par ailleurs dans ce document : ne jamais improviser un composant, une
couleur, une police ou une icône qui s'écarte de ce que `ForClaude/INSTRUCTIONS_UX.md`
et `ForClaude/Template UX/GUIDELINES.md` décrivent.

## Sécurité applicative

Ce projet vise un niveau de sécurité ≥ 9/10. Toutes les consignes détaillées (authentification, RLS, validation des données, protections XSS/injections, gestion des secrets, gestion des erreurs, dépendances, uploads) sont dans `ForClaude/SECURITY.md`.

**Avant d'écrire ou modifier du code touchant à l'authentification, aux données utilisateur, à Supabase (tables, policies RLS, storage) ou à une route Express, lire `ForClaude/SECURITY.md` et respecter ses consignes.**

Si une consigne de `SECURITY.md` ne peut pas être respectée pour une raison technique, le signaler explicitement dans la réponse plutôt que de l'ignorer silencieusement.

## Paramétrage applicatif

Les paramètres de configuration modifiables sans déploiement (ex : longueur max de
l'objet d'une FAD) suivent un modèle clé/valeur avec portée organisationnelle — global,
par direction ou par service, résolution en cascade où le plus spécifique gagne (un
service hérite implicitement de sa direction) — géré exclusivement par le rôle
`ADMIN_APP`. Décision et schéma détaillés dans `docs/ARCHITECTURE.md` (section
« Paramétrage applicatif »), policies RLS dans `ForClaude/SECURITY.md` §2.3. Ne pas
réinventer un autre mécanisme de configuration dynamique sans repartir de cette décision.
