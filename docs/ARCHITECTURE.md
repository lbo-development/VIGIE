# Architecture — VIGIE

## Vue d'ensemble

```
VIGIE/
├── frontend/    React + TypeScript (Vite)
├── backend/     Node.js + Express + TypeScript
├── database/    Migrations (Supabase CLI) + seeds
├── docs/        Ce dossier
├── docker-compose.yml
└── package.json (workspaces npm)
```

Le frontend et le backend sont deux applications indépendantes qui communiquent
uniquement via l'API HTTP exposée par le backend (`VITE_API_URL`). Ils ne s'importent
jamais l'un l'autre.

## Frontend — organisation en couches

```
frontend/src/
├── components/   Composants UI réutilisables, sans logique métier
├── pages/        Un fichier par route, compose des components/
├── services/      Appels HTTP vers le backend (api.ts)
├── hooks/          Logique réutilisable avec état (useXxx)
├── context/         État global via Context API (ex: AuthContext)
├── utils/            Fonctions pures sans dépendance React
└── lib/               Clients tiers (supabaseClient.ts)
```

**Flux de données type** : une page (`pages/`) appelle un hook (`hooks/`), qui appelle le
service HTTP (`services/`), qui appelle le backend. Le hook expose un état (loading, data,
error) consommé par la page, qui délègue l'affichage à des `components/`.

**Ajouter une nouvelle page** :
1. Créer `pages/MaPage.tsx`
2. L'importer dans `App.tsx` et déclarer sa `<Route path="/ma-page" element={<MaPage />} />`
3. Si elle a besoin de données : créer le hook correspondant dans `hooks/`, qui utilise `services/api.ts`

## Backend — architecture en couches

```
backend/src/
├── config/         Variables d'environnement, client Supabase
├── routes/          Déclaration des endpoints HTTP (pas de logique)
├── controllers/       Traduction requête <-> réponse HTTP, délègue aux services
├── services/            Logique métier, validation, orchestration
├── repositories/          Seule couche qui parle à Supabase/la base de données
├── middlewares/             Error handling, 404, (auth à ajouter si besoin)
├── app.ts                    Assemble l'app Express (sans écouter de port)
└── server.ts                  Point d'entrée : démarre le serveur HTTP
```

**Règle de dépendance stricte** (chaque couche n'appelle que la couche juste en dessous) :

```
routes → controllers → services → repositories → Supabase
```

Un controller n'appelle jamais un repository directement, un repository ne contient
jamais de logique métier. Cette séparation permet de tester chaque couche isolément et
de remplacer Supabase par autre chose plus tard sans toucher aux services/controllers.

**Ajouter une nouvelle ressource** (ex: "orders"), en suivant le modèle de `items`
(`backend/src/{repositories,services,controllers,routes}/items.*`) :
1. `repositories/orders.repository.ts` — requêtes Supabase pour la table `orders`
2. `services/orders.service.ts` — validation et règles métier, appelle le repository
3. `controllers/orders.controller.ts` — handlers Express, appelle le service, gère les erreurs via `next(err)`
4. `routes/orders.routes.ts` — déclare les endpoints, monté dans `routes/index.ts`
5. Ajouter la migration correspondante (voir `database/migrations/README.md`)

## Erreurs

Les erreurs métier doivent être levées via `AppError` (`middlewares/errorHandler.ts`),
avec un status HTTP explicite (ex: `throw new AppError('Nom requis', 400)`). Le
middleware d'erreur global les transforme en réponse JSON `{ message }` avec le bon code
HTTP. Ne jamais répondre directement une erreur depuis un service ou un repository.

## Tests

- **Frontend** : Vitest + React Testing Library, un fichier `*.test.tsx` à côté du
  composant testé (voir `frontend/src/components/StatusBadge.test.tsx`).
- **Backend** : Vitest + Supertest, contre l'app Express exportée par `app.ts` (sans
  démarrer de vrai serveur) — voir `backend/src/test/health.test.ts`.

## Authentification & sécurité

- Le frontend utilise le client Supabase avec la clé `anon` (exposable publiquement,
  restreinte par les policies RLS de Supabase).
- Le backend utilise la clé `service_role` (jamais exposée, contourne les policies RLS —
  à réserver aux opérations serveur qui en ont explicitement besoin).
- L'état de session (utilisateur connecté) est disponible partout côté frontend via
  `useAuth()` (`frontend/src/context/AuthContext.tsx`).
