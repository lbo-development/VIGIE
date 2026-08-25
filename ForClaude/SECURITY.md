# Consignes de sécurité — Claude Code

## Contexte du projet

- **Frontend** : React (JS), HTML/CSS
- **Backend** : Node.js / Express
- **Base de données & Auth** : Supabase (PostgreSQL + Supabase Auth)
- **Déploiement** : Railway
- **Versioning** : GitHub

Application à usage métier (interne/professionnel). Pas de données utilisateurs à caractère très sensible (santé, paiement, biométrie), mais des données personnelles standard (comptes, emails, données métier) qui restent soumises au RGPD.

**Projet Supabase partagé entre plusieurs applications GPMM (décision confirmée le 24/08/2026).** Un seul projet Supabase héberge plusieurs applications métier du port, isolées par schéma PostgreSQL — VIGIE dans le schéma `finances`, au moins une autre application dans `escales`. Conséquences directes pour toute écriture SQL sur ce projet :

- Toutes les tables métier de VIGIE (les 22 tables du MLD) vivent dans le schéma `finances`, jamais `public` — toute référence non qualifiée (`role_attribution`, `demande_achat`, ...) dans une migration, une fonction ou une policy est un bug potentiel : qualifier systématiquement (`finances.role_attribution`).
- `profiles` (lien `auth.users` ↔ identité métier) reste dans `public`, **partagée entre toutes les applications** du projet — ce n'est pas une table propre à VIGIE. `profiles.matricule` référence l'identifiant de personnel GPMM (cohérent avec un identifiant valable dans plusieurs applications), pas une clé étrangère physique vers `finances.acteur` (un lien FK cross-schema depuis une table partagée vers le schéma d'une seule application créerait un couplage indésirable — la cohérence entre `profiles.matricule` et `finances.acteur.matricule` est assurée applicativement, pas par contrainte FK).
- Avant que l'API puisse requêter `finances.*`, le schéma doit être ajouté aux *Exposed schemas* de l'API Supabase (Dashboard → Settings → API) — tant que ce n'est pas fait, les tables existent en base mais sont invisibles pour PostgREST/`supabase-js`, RLS activé ou non.
- Ne jamais écrire, modifier ou même interroger à titre exploratoire un objet du schéma `escales` (ou de tout autre schéma appartenant à une autre application) depuis du code ou une migration VIGIE.

**Objectif** : tout code écrit ou modifié doit viser un niveau de sécurité ≥ 9/10. En cas de doute entre simplicité et sécurité, la sécurité prime. Si une consigne ci-dessous ne peut pas être respectée pour une raison technique, il faut le signaler explicitement dans la réponse plutôt que de l'ignorer silencieusement.

---

## 1. Authentification (Supabase Auth)

- Toujours utiliser Supabase Auth pour l'authentification — ne jamais réimplémenter un système de hash de mot de passe, de génération de token ou de gestion de session maison.
- Ne jamais faire confiance à un `user_id` envoyé depuis le frontend (body, query param, header custom). L'identité de l'utilisateur doit toujours être déduite du token JWT vérifié par Supabase (`supabase.auth.getUser()` côté serveur), jamais d'un champ arbitraire du payload.
- Côté Express, valider systématiquement le JWT Supabase reçu (header `Authorization: Bearer <token>`) sur chaque route protégée, via le SDK Supabase server-side ou une vérification JWKS — jamais de décodage sans vérification de signature.
- Utiliser le client Supabase **service_role** uniquement côté serveur (Express), jamais côté frontend. La clé `service_role` ne doit jamais apparaître dans le code React ni être exposée dans le bundle JS.
- Le frontend utilise uniquement la clé `anon` (publique) de Supabase.
- Implémenter une expiration/refresh de session correcte (laisser Supabase gérer le refresh token, ne pas stocker de tokens dans le `localStorage` si un stockage plus sûr est possible — préférer les cookies `httpOnly`, `Secure`, `SameSite=Strict` quand l'architecture le permet).
- Pour toute route sensible (changement de mot de passe, suppression de compte, actions destructrices), prévoir une re-vérification (ré-authentification ou confirmation) plutôt que de se fier uniquement à la session active.

### 1.1 Postes partagés & inactivité

Ces applications peuvent être utilisées sur des postes partagés — la déconnexion automatique par inactivité est une exigence de sécurité, pas juste une amélioration UX.

- Implémenter une détection d'inactivité côté client (minuteur réinitialisé sur les événements d'activité utilisateur : `mousemove`, `keydown`, `click`, `scroll`, `touchstart`), avec un délai explicite et documenté (ex. 15 minutes, à ajuster selon le contexte de l'application).
- La déconnexion déclenchée par inactivité doit toujours appeler `supabase.auth.signOut()` pour révoquer réellement le refresh token côté serveur — ne jamais se contenter de masquer l'UI, vider le state local ou rediriger vers `/login` sans appel `signOut()` réel : un token laissé valide reste exploitable par la personne suivante sur le poste.
- Après `signOut()`, forcer un rechargement complet de la page (ex. `window.location.replace('/login')`) plutôt qu'une navigation SPA classique, pour purger tout état résiduel en mémoire (state React, caches, données encore affichées à l'écran).
- Si l'application peut être ouverte dans plusieurs onglets sur le même poste, synchroniser la détection d'inactivité et la déconnexion entre onglets (`BroadcastChannel` ou évènement `storage`) — un minuteur isolé par onglet ne suffit pas et laisse une session active dans un onglet oublié.
- Ce mécanisme est un complément au RLS, jamais un substitut : pendant la fenêtre où la session reste active, le RLS (section 2) demeure la seule barrière empêchant un accès aux données d'un autre utilisateur. Réduire la fenêtre de risque côté configuration Supabase Auth (durée de vie du JWT) peut aussi être envisagé sur les projets où le contexte poste partagé est fréquent.

## 2. Autorisation & Row Level Security (RLS)

- **Row Level Security doit être activée sur toutes les tables Supabase sans exception**, y compris les tables qui semblent "internes" ou "non sensibles". Une table sans RLS explicite est considérée comme une faille.
- Chaque politique RLS doit être écrite explicitement (pas de `USING (true)` par défaut sauf justification claire et commentée dans la migration SQL).
- Ne jamais s'appuyer uniquement sur la logique du frontend React pour restreindre l'accès aux données (masquer un bouton n'est pas un contrôle d'accès). Toute restriction visible côté UI doit être **également** appliquée côté base de données (RLS) et/ou côté API Express.
- Pour les opérations complexes nécessitant le contournement du RLS (via `service_role` côté Express), appliquer la vérification des droits manuellement dans le code Express avant d'exécuter la requête.
- Documenter (en commentaire dans la migration SQL) l'intention de chaque politique RLS : qui peut lire/écrire/supprimer quoi et pourquoi.

### 2.1 Modèle utilisateurs — source de vérité unique

**Décision (23/08/2026, voir mémoire projet) : la table `ROLE` du MCD/MLD remplace `profiles.role` comme source unique de vérité pour l'autorisation.** Un `profiles.role` à valeur unique par utilisateur est structurellement incompatible avec le modèle métier : un `ACTEUR` peut cumuler plusieurs rôles actifs simultanément sur des périmètres différents (ex. RC d'une cellule *et* CDS d'un service), les rôles sont historisés (`DATE_DEBUT`/`DATE_FIN`/`ACTIF`), et les 6 `TYPE_ROLE` (RC, CDS, DS, CB, ADMIN_SERVICE, ADMIN_APP) sont scopés à des niveaux de périmètre différents (cellule/service/direction/transverse).

- **Nom de table physique (24/08/2026) : `ROLE` (entité conceptuelle du MCD) s'implémente en base sous le nom `role_attribution`, jamais `role`.** Une table nommée `role` entre en collision avec la notion native de rôle Postgres/Supabase (rôles `anon`/`authenticated`/`service_role`, fonction `auth.role()`, catalogue `pg_roles`) — deux concepts homonymes mais totalement différents, source classique d'erreur au moment d'écrire ou de relire une policy. `role_attribution` est aussi plus fidèle à ce que la table représente (« instance d'attribution d'un rôle à un `ACTEUR` sur un périmètre », cf. MCD) qu'un simple `role`. Voir MLD §2.3 pour la déclaration physique complète.
- `profiles` (`id uuid references auth.users(id) primary key`) reste la table de liaison identité ↔ métier, mais ne porte **pas** de colonne `role`. Elle porte une colonne `matricule` (référence `ACTEUR.MATRICULE`), renseignée après coup : le compte Supabase Auth est créé indépendamment, puis lié à un `ACTEUR` existant via cette colonne (voir mémoire projet "ACTEUR ↔ Auth link"). Tant que `matricule` est `null`, l'utilisateur est authentifié mais n'a aucune autorisation métier.
- Toute vérification d'autorisation dans une policy RLS doit passer par des fonctions `security definer` (jamais de sous-requête directe sur `profiles`/`role_attribution`/`suppleance` dans une policy, pour éviter la récursion RLS) :

  Cette fonction touche uniquement `public.profiles` (identité, partagée entre applications
  du projet) : elle reste dans le schéma `public`, réutilisable par d'autres applications
  du même projet Supabase qui s'appuient aussi sur `profiles.matricule`.

  ```sql
  create or replace function public.current_user_matricule()
  returns text
  language sql
  security definer
  stable
  set search_path = ''
  as $$
    select matricule from public.profiles where id = auth.uid()
  $$;
  ```

  Cette seconde fonction porte la logique d'autorisation propre à VIGIE (`TYPE_ROLE`
  RC/CDS/DS/CB/ADMIN_SERVICE/ADMIN_APP, table `role_attribution`) : elle vit dans le schéma
  `finances`, pas `public` — ce n'est pas une fonction d'infrastructure partagée.

  ```sql
  -- p_perimeter_id : id_cellule / id_service / id_direction selon le TYPE_ROLE
  -- (null uniquement pour ADMIN_APP, qui est transverse). Couvre aussi la
  -- suppléance : un suppléant actif hérite des droits du rôle titulaire
  -- pendant sa période.
  --
  -- p_perimeter_id est en `integer`, pas `uuid` (24/08/2026) : les clés des
  -- tables métier finances.* (id_direction, id_service, id_cellule, id_role...)
  -- sont des entiers, contrairement à profiles.id/auth.uid() qui restent en
  -- uuid — ces deux mondes ne se comparent jamais directement, seul le
  -- matricule (texte) fait le pont entre les deux (cf. §2.1).
  --
  -- ⚠️ Le bypass "pas de périmètre" est lié explicitement à p_type_role =
  -- 'ADMIN_APP', jamais à la seule présence de NULL dans p_perimeter_id.
  -- Piège évité : p_perimeter_id a une valeur par défaut NULL — un appel qui
  -- oublierait de la renseigner pour un rôle non transverse (RC/CDS/DS/CB/
  -- ADMIN_SERVICE) ne doit jamais se retrouver à ignorer le périmètre par
  -- accident (fail open) ; il doit échouer fermé (aucune ligne ne matche).
  create or replace function finances.current_user_has_role(p_type_role text, p_perimeter_id integer default null)
  returns boolean
  language sql
  security definer
  stable
  set search_path = ''
  as $$
    select exists (
      select 1 from finances.role_attribution r
      where r.type_role = p_type_role
        and r.actif = true
        and (
          (p_type_role = 'ADMIN_APP' and p_perimeter_id is null)
          or r.id_cellule = p_perimeter_id
          or r.id_service = p_perimeter_id
          or r.id_direction = p_perimeter_id
        )
        and (
          r.matricule = public.current_user_matricule()
          or exists (
            select 1 from finances.suppleance s
            where s.id_role = r.id_role
              and s.matricule_suppleant = public.current_user_matricule()
              and now() between s.date_debut and s.date_fin
          )
        )
    )
  $$;
  ```

- Les écritures sur `role_attribution` et `SUPPLEANCE` (déclarer/clôturer un rôle) sont réservées à `ADMIN_SERVICE` (sur les rôles de son service) et `ADMIN_APP` — jamais en self-service par l'`ACTEUR` concerné. Prévoir des policies `INSERT`/`UPDATE` explicites en ce sens plutôt qu'une policy générique.
- Ne jamais créer ou réutiliser une table `users`/`utilisateurs` parallèle à `profiles`/`ACTEUR` — c'est une source de bugs de RLS garantie (double source de vérité). Si une telle table existe encore dans le projet, la fusionner plutôt que la faire évoluer.
- **`matricule` peut rester `null` indéfiniment** (compte authentifié, pas encore rattaché à un `ACTEUR`) — ce n'est pas un état transitoire garanti court. Deux conséquences à traiter explicitement, pas seulement pour `current_user_has_role()` :
  - Toute policy RLS, y compris celles qui n'utilisent pas `current_user_has_role()`/`current_user_matricule()`, doit être relue en se demandant explicitement « que se passe-t-il si `matricule` est `null` pour cet utilisateur ? » — la réponse attendue est toujours un refus, jamais un octroi implicite (attention en particulier aux `NOT IN`, `COALESCE(..., true)` ou toute réécriture qui transformerait un `NULL` en autorisation par défaut).
  - Toute route Express qui contourne le RLS via `service_role` doit vérifier explicitement `matricule IS NOT NULL` pour l'utilisateur courant avant d'exécuter la moindre opération métier — ce n'est pas couvert automatiquement par le fait d'utiliser `service_role`, c'est une vérification applicative à écrire soi-même (voir §6, « appliquer la vérification des droits manuellement dans le code Express »).

### 2.2 Pièges RLS à connaître et prévenir systématiquement

- **GRANT ≠ POLICY** : une policy RLS n'est évaluée que si le rôle Postgres (`anon`/`authenticated`) a déjà le GRANT SQL de base sur la table. `permission denied for table ...` signale un GRANT manquant, pas un problème de policy — vérifier `GRANT SELECT, INSERT, UPDATE, DELETE ON finances.<table> TO authenticated;` avant de toucher aux policies.
- **Schéma non-`public` (`finances`) : un `GRANT` sur la table ne suffit pas, il faut aussi le `USAGE` sur le schéma.** Piège spécifique à un schéma dédié comme `finances` (n'existe pas avec `public`, accessible par défaut) : `GRANT USAGE ON SCHEMA finances TO authenticated, anon;` est un préalable oublié en cause fréquente d'un `permission denied for schema finances` qui ressemble à un problème de policy mais n'en est pas un. De même, le schéma doit figurer dans les *Exposed schemas* de l'API Supabase (Dashboard → Settings → API) pour que `supabase-js`/PostgREST puisse seulement l'atteindre.
- **Un SELECT sans policy matchante ne lève pas d'erreur, il renvoie silencieusement `[]`.** Ne jamais interpréter un résultat vide comme "il n'y a pas de données" sans avoir vérifié qu'une policy SELECT couvre bien le rôle courant.
- **Un UPDATE dont le `USING` ne matche aucune ligne réussit avec 0 ligne modifiée, sans erreur.** Toujours utiliser `.update(...).select()` côté `supabase-js` et vérifier la longueur du tableau retourné plutôt que l'absence d'exception.
- **Les policies permissives se combinent en OR, pas en AND.** Ne jamais laisser une policy `USING (true)` de test à côté d'une policy stricte : elle rend l'ensemble aussi permissif que la moins restrictive. Auditer `select * from pg_policies where schemaname = 'finances' and tablename = '<table>'` avant de considérer une table comme sécurisée.
- Chaque nouvelle table avec RLS doit définir explicitement une policy par opération (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) alignée sur les `TYPE_ROLE` pertinents (RC, CDS, DS, CB, ADMIN_SERVICE, ADMIN_APP — via `finances.current_user_has_role()`, §2.1) — ne jamais partir du principe qu'une policy `SELECT` couvre implicitement les autres opérations.

## 3. Validation et sanitization des données

- Toute donnée entrante (body, query params, headers, params d'URL) côté Express doit être validée avec un schéma explicite (ex. `zod` ou `yup`) avant traitement — jamais utilisée brute.
- Rejeter par défaut (`fail closed`) : si une donnée ne correspond pas au schéma attendu, retourner une erreur 400, ne pas essayer de "corriger" silencieusement l'entrée.
- Côté React, valider aussi les formulaires côté client pour l'UX, mais ne **jamais** considérer cette validation comme une mesure de sécurité — elle est toujours redondante avec la validation serveur, jamais un substitut.
- Limiter strictement les types, longueurs et formats acceptés (emails, UUID, enums) plutôt que d'accepter des chaînes libres partout.

## 4. Protection contre les injections

- Utiliser exclusivement le client Supabase (`supabase-js`) ou des requêtes paramétrées pour toute interaction avec la base — ne jamais concaténer des chaînes de caractères pour construire une requête SQL.
- Si une fonction RPC Postgres ou du SQL brut est nécessaire, utiliser des paramètres liés (`$1`, `$2`, ...) et jamais d'interpolation de variables utilisateur dans le texte de la requête.
- Attention aux injections dans les filtres dynamiques Supabase (`.eq()`, `.or()`, etc.) : ne jamais construire dynamiquement une chaîne de filtre à partir d'une entrée utilisateur non échappée.
- Pour toute commande shell exécutée côté serveur (si applicable), ne jamais passer d'entrée utilisateur non échappée à `exec`/`spawn` avec `shell: true`.

## 5. Protection XSS / CSRF côté React

- Ne jamais utiliser `dangerouslySetInnerHTML` avec du contenu provenant d'une source utilisateur sans passer par une librairie de sanitization (ex. `DOMPurify`).
- Ne jamais injecter de données utilisateur dans des attributs `href`, `src` ou des templates de script sans validation (risque d'`javascript:` URI ou d'injection).
- Toute donnée affichée provenant de l'API doit être traitée comme non fiable, même si elle provient de "notre propre" base de données (elle peut avoir été insérée par un autre utilisateur).
- Pour les actions qui modifient un état côté serveur (POST/PUT/DELETE), s'assurer que l'API Express vérifie l'origine des requêtes (CORS strict, voir section 6) plutôt que de se reposer sur un token CSRF si l'authentification se fait par Bearer token (moins vulnérable au CSRF classique que les cookies de session).
- Si des cookies de session sont utilisés, prévoir une protection CSRF explicite (token synchronizer ou `SameSite=Strict`/`Lax`).

## 6. Sécurité des API Express

- Configurer `helmet` sur l'application Express pour les headers de sécurité HTTP par défaut (CSP, `X-Content-Type-Options`, `X-Frame-Options`, etc.).
- Configurer CORS de manière stricte : liste blanche explicite des origines autorisées (le domaine du frontend en prod, éventuellement `localhost` en dev), jamais `origin: '*'` sur une route authentifiée.
- Mettre en place un rate limiting (ex. `express-rate-limit`) sur toutes les routes sensibles (login, reset password, endpoints publics coûteux) pour limiter le brute-force et l'abus.
- Ne jamais faire confiance aux headers HTTP envoyés par le client pour des décisions de sécurité (ex. `X-Forwarded-For` sans validation du proxy, headers custom d'identité).
- Toute route doit vérifier explicitement l'autorisation (pas seulement l'authentification) : un utilisateur connecté n'a pas automatiquement le droit d'accéder à n'importe quelle ressource.
- Limiter la taille des payloads acceptés (`express.json({ limit: ... })`) pour éviter les abus de type déni de service applicatif.

## 7. Gestion des secrets

- Aucun secret (clé Supabase `service_role`, clé API tierce, secret JWT, identifiants de base de données) ne doit jamais être écrit en dur dans le code source, y compris temporairement pour "tester".
- Tous les secrets doivent être lus via `process.env` côté Express, jamais hardcodés ni committés.
- Le fichier `.env` (et toute variante `.env.local`, `.env.production`, etc.) doit systématiquement figurer dans `.gitignore`. Vérifier cela avant tout commit qui touche à la configuration.
- Ne jamais logguer un secret, un token JWT complet ou un mot de passe, même en `console.log` de debug — y compris temporairement.
- Si un secret a été accidentellement committé dans l'historique Git, le signaler explicitement plutôt que de simplement le supprimer du fichier (il reste dans l'historique et doit être révoqué/régénéré).

## 8. Gestion des erreurs et des logs

- Les messages d'erreur renvoyés au client ne doivent jamais exposer de détails d'implémentation (stack trace, requête SQL, chemin de fichier serveur, version de librairie). Renvoyer des messages génériques côté client et logguer le détail côté serveur uniquement.
- Ne jamais renvoyer directement l'objet d'erreur brut d'une librairie (Supabase, Postgres, etc.) au client — le mapper vers un message contrôlé.
- Les logs serveur ne doivent contenir aucune donnée personnelle sensible en clair au-delà de ce qui est nécessaire au débogage (éviter de logguer des mots de passe, tokens, emails complets si évitable).

## 9. Dépendances

- Avant d'ajouter une nouvelle dépendance npm, préférer une librairie activement maintenue plutôt qu'un package peu utilisé ou non maintenu depuis longtemps.
- Éviter d'introduire des dépendances avec des permissions excessives (accès filesystem, réseau) pour des besoins simples.
- Garder les dépendances liées à la sécurité (`helmet`, `express-rate-limit`, SDK Supabase, librairies de validation) à jour lors de toute modification du `package.json`.

## 10. Upload de fichiers (si applicable au projet)

- Valider le type MIME réel du fichier (pas seulement l'extension) et sa taille avant tout traitement ou stockage (Supabase Storage).
- Ne jamais utiliser un nom de fichier fourni par l'utilisateur tel quel pour le stockage — générer un identifiant/nom neutre côté serveur.
- Appliquer des règles RLS/policies sur les buckets Supabase Storage, au même titre que sur les tables.

## 11. Checklist rapide avant de livrer du code

Avant de considérer une fonctionnalité comme terminée, vérifier que :

1. Toute nouvelle table Supabase a du RLS activé avec des politiques explicites.
2. Toute route Express nouvelle valide son authentification ET son autorisation — et, si elle utilise `service_role`, vérifie explicitement que `matricule` n'est pas `null` pour l'utilisateur courant avant d'agir (voir §2.1).
3. Toute entrée utilisateur est validée par un schéma avant traitement.
4. Aucun secret n'a été écrit en dur ou loggué.
5. Aucune donnée sensible n'est exposée dans une réponse d'erreur.
6. Le code React n'utilise pas de contenu utilisateur non sanitizé dans le DOM.
7. Les nouvelles dépendances ajoutées sont justifiées et maintenues.

Si un de ces points ne peut pas être respecté, le signaler explicitement dans la réponse au lieu de livrer silencieusement une exception.
