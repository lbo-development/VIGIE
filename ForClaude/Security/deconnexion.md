# Déconnexion automatique par inactivité

> Complète `ForClaude/SECURITY.md` §1.1 (« Postes partagés & inactivité ») : ce document décrit le
> mécanisme tel qu'implémenté côté frontend, pour relecture avant intégration définitive.
> Statut : implémenté, non revu par l'utilisateur.

## 1. Contexte et objectif

`ForClaude/SECURITY.md` §1.1 exige, pour toute application métier GPMM utilisée sur poste potentiellement
partagé, une déconnexion automatique après un délai d'inactivité — avec révocation réelle du token côté
Supabase (pas un simple masquage d'UI), synchronisée entre les onglets ouverts.

Ce document décrit une implémentation de référence de ce mécanisme, à reprendre telle quelle (ou adaptée
à la marge) dans toute application du portefeuille GPMM partageant la même base technique (frontend
React/TypeScript, authentification Supabase, design system GPMM). Elle suppose un point de départ
classique : un `AuthContext` qui expose déjà l'état de session Supabase mais aucun mécanisme
d'inactivité, et aucune page `/login` encore branchée à un vrai écran de connexion.

## 2. Paramètres retenus

| Paramètre | Valeur | Origine |
|---|---|---|
| Délai d'inactivité avant déconnexion | **30 minutes** | Choix utilisateur (arbitrage entre les 15 min d'exemple de SECURITY.md et le contexte réel des postes GPMM concernés) |
| Durée de l'avertissement avant expiration | 1 minute | Choix par défaut, non discuté en détail — à ajuster si besoin |
| Avertissement avant déconnexion | Oui, avec action « Rester connecté » | Choix utilisateur (plutôt qu'une déconnexion silencieuse) |
| Page de destination après déconnexion | `/login` (nouvelle page créée) | Choix utilisateur — aucune page de connexion n'existait avant ce chantier |

## 3. Mécanisme

### 3.1 Détection d'activité

`frontend/src/hooks/useInactivityLogout.ts` écoute les événements `mousemove`, `keydown`, `click`,
`scroll`, `touchstart` sur `window` (liste exacte de SECURITY.md §1.1), avec un throttle d'1 seconde pour
éviter les resets excessifs. Chaque activité réinitialise deux minuteurs :

- un minuteur d'avertissement, déclenché à *délai total − durée d'avertissement* (29 min) ;
- un minuteur de déconnexion, déclenché au délai total (30 min).

Le hook n'installe écouteurs et minuteurs **que si une session existe** (`enabled: Boolean(session)`) — sans
session, aucune surveillance d'inactivité n'est active.

### 3.2 Avertissement

À 29 minutes d'inactivité, `InactivityWarning.tsx` affiche un toast `gp-toast--warning` (composant du
design system GPMM, aucune classe inventée) avec un compte à rebours `mm:ss` et une action « Rester
connecté ». Cette action — comme n'importe quelle activité détectée, y compris involontaire — réinitialise
les minuteurs et referme l'avertissement.

### 3.3 Synchronisation multi-onglets

Un `BroadcastChannel` dédié (nom propre à l'application, ex. `'<app>-inactivity'`) diffuse deux types de
messages :

- `{ type: 'activity' }` : émis à chaque activité détectée dans un onglet, reçu par tous les autres
  onglets pour réinitialiser **leur propre** minuteur. Sans cela, un onglet resté inactif pourrait
  déclencher une déconnexion alors que l'utilisateur est actif dans un autre onglet de la même session —
  le risque explicitement signalé par SECURITY.md §1.1.
- `{ type: 'logout' }` : émis par `AuthContext.signOut()` à chaque déconnexion (automatique ou manuelle),
  reçu par tous les autres onglets pour les rediriger immédiatement vers `/login`, sans réappeler
  `supabase.auth.signOut()` (déjà fait par l'onglet à l'origine de la déconnexion).

### 3.4 Déconnexion réelle

`AuthContext.tsx` — `signOut()` :
1. diffuse `{ type: 'logout' }` aux autres onglets ;
2. appelle `supabase.auth.signOut()` (révocation réelle du refresh token côté Supabase, pas un simple
   nettoyage d'état local) ;
3. force un rechargement complet via `window.location.replace('/login')` — jamais une navigation SPA —
   pour purger tout état résiduel en mémoire (state React, caches, données encore affichées à l'écran),
   conformément à SECURITY.md §1.1.

Cette fonction est l'unique point d'entrée de déconnexion de l'application ; le minuteur d'inactivité s'y
branche (`onLocalTimeout`) sans dupliquer la logique.

### 3.5 Page de connexion

`frontend/src/pages/Login.tsx` : écran minimal email/mot de passe via
`supabase.auth.signInWithPassword`, monté hors du shell GPMM (route `/login` indépendante dans
`App.tsx`, pas d'en-tête/sidebar avant authentification), stylé exclusivement avec les classes existantes
du design system (`gp-panel`, `gp-field`, `gp-label`, `gp-input`, `gp-errmsg`, `gp-btn`). Redirige
automatiquement vers `/` si une session est déjà active.

## 4. Fichiers concernés

**Créés**
- `frontend/src/hooks/useInactivityLogout.ts`
- `frontend/src/components/shell/InactivityWarning.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Login.css`

**Modifiés**
- `frontend/src/context/AuthContext.tsx` — `signOut()` réel + diffusion multi-onglets + rechargement complet ; contexte mémoïsé (`useCallback`/`useMemo`) pour la stabilité des minuteurs.
- `frontend/src/components/shell/AppShell.tsx` — branchement du minuteur (actif si session) et affichage de l'avertissement.
- `frontend/src/App.tsx` — route `/login` publique ; sprite d'icônes remonté à la racine (nécessaire aux deux côtés du shell).

## 5. Ce qui n'est pas couvert

- **Aucun bouton de déconnexion manuelle dans l'interface.** Une tentative d'ajout dans le pied de la
  sidebar (`sidebar-footer`) a été annulée : ce conteneur GPMM est dimensionné pour exactement deux
  actions (Paramètres + thème) — un troisième bouton fait déborder et chevaucher les libellés (vérifié à
  l'écran). Conformément à `INSTRUCTIONS_UX.md` (« ne jamais improviser un composant… signaler le manque
  plutôt que contourner »), aucun correctif CSS local n'a été appliqué. Une déconnexion manuelle nécessite
  donc une évolution du template GPMM partagé (variante du footer, ou un futur menu de compte dans le
  header) — hors périmètre d'une application individuelle.
- **Aucun garde de route.** Les pages restent accessibles sans session (pas de redirection forcée vers
  `/login` pour un visiteur non authentifié) : le mécanisme d'inactivité protège une session déjà ouverte,
  il ne rend pas l'application privée à lui seul. À compléter par un garde de route dès que l'application
  concernée expose des ressources qui l'exigent.
- **Durée d'avertissement (1 min) non validée explicitement** avec l'utilisateur, contrairement au délai
  total (30 min) — ajustable sans risque dans `AppShell.tsx` (`INACTIVITY_WARNING_MS`).
- **Non testé en conditions réelles** : aucune instance Supabase n'étant configurée en local, la
  déconnexion effective (révocation du refresh token) n'a pas été vérifiée de bout en bout — seuls le
  rendu de l'écran de connexion et l'absence d'erreurs de compilation/lint/tests ont été vérifiés.

## 6. Vérifications effectuées

- `tsc --noEmit` : sans erreur.
- `eslint` : sans erreur (un avertissement préexistant, sans rapport, sur `AuthContext.tsx`).
- `vitest run` (frontend) : suite existante toujours au vert.
- Vérification visuelle (Playwright headless, écrans clair) : `/login` (rendu correct, sans erreur
  console liée au code applicatif) et `/` (shell, sidebar dépliée/repliée) — a révélé puis fait annuler le
  point 5 ci-dessus.

## 7. Historique

- 24/08/2026 : rédaction initiale de cette spécification, en réponse à l'exigence de SECURITY.md §1.1
  (déconnexion automatique par inactivité sur poste partagé, jusque-là non implémentée).
