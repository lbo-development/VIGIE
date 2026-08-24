# VIGIE

Projet full stack généré automatiquement, architecture en couches.

- **Frontend** : React + TypeScript + Vite (`frontend/`) — components/pages/services/hooks/context/utils
- **Backend** : Node.js + Express + TypeScript (`backend/`) — config/controllers/routes/services/repositories/middlewares
- **Base de données** : Supabase, migrations via Supabase CLI (`database/`)
- **Déploiement** : Railway (+ Docker Compose pour le développement local)
- **Versionning** : GitHub
- **Documentation** : `docs/ARCHITECTURE.md`

## Démarrage rapide

```bash
# à la racine, une seule fois
npm install

# copier les variables d'environnement
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
# puis renseigner tes clés Supabase dans ces deux fichiers

# lancer frontend + backend en parallèle
npm run dev
```

- Frontend disponible sur http://localhost:5173
- Backend (API) disponible sur http://localhost:3001

### Avec Docker

```bash
docker compose up
```

(nécessite que `frontend/.env.local` et `backend/.env` existent déjà — voir ci-dessus)

## Structure

```
VIGIE/
├── frontend/    React + TypeScript (Vite) — components, pages, services, hooks, context, utils
├── backend/     Node + Express + TypeScript — config, controllers, routes, services, repositories, middlewares
├── database/    migrations/ (Supabase CLI) + seeds/
├── docs/        ARCHITECTURE.md
├── docker-compose.yml
├── CLAUDE.md    Contexte du projet pour Claude Code
└── package.json Workspaces npm (frontend + backend)
```

Voir `docs/ARCHITECTURE.md` pour le détail des couches et les conventions d'ajout de
fonctionnalité.

## Tests

```bash
npm run test              # frontend + backend
npm run test -w frontend  # Vitest + React Testing Library
npm run test -w backend   # Vitest + Supertest
```

## Base de données Supabase

1. Créer un projet sur https://supabase.com
2. Récupérer l'URL du projet et les clés `anon` (frontend) et `service_role` (backend, jamais exposée côté client)
3. Renseigner ces valeurs dans `frontend/.env.local` et `backend/.env`
4. Gérer le schéma via les migrations Supabase CLI — voir `database/migrations/README.md`
5. Peupler des données de test : `npm run seed` (voir `database/seeds/README.md`)

## Déploiement Railway

1. `railway login`
2. `railway init` à la racine (ou dans chaque dossier frontend/backend pour deux services séparés)
3. Configurer les variables d'environnement Supabase dans le dashboard Railway pour chaque service
4. `railway up`
