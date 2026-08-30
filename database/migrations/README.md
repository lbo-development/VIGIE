# Migrations base de données (Supabase CLI)

Ce projet utilise la **Supabase CLI** pour gérer les migrations SQL de façon versionnée,
sans nécessiter de stack Docker locale complète (le projet reste connecté à ton instance
Supabase cloud).

## Mise en place (une seule fois)

```bash
npm install -g supabase          # ou: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <ton-project-ref>   # trouvable dans le dashboard Supabase
```

Cette commande crée un dossier `supabase/` à la racine du projet (config CLI +
`supabase/migrations/`), séparé de ce dossier `database/`.

## Créer une nouvelle migration

```bash
supabase migration new nom_de_la_migration
```

Ça génère un fichier `supabase/migrations/<timestamp>_nom_de_la_migration.sql` vide :
tu y écris le SQL du changement (CREATE TABLE, ALTER TABLE, policies RLS, etc.).

## Appliquer les migrations sur Supabase (cloud)

```bash
supabase db push
```

## Exemple de migration de départ

Pour une nouvelle ressource (ex. `orders`, voir `docs/ARCHITECTURE.md` "Ajouter une nouvelle
ressource"), une première migration ressemble à ceci :

```sql
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

-- Accès réservé au service_role (le backend Express) — la clause `to service_role`
-- est indispensable : sans elle, une policy Postgres s'applique à PUBLIC (donc
-- `anon` et `authenticated` inclus), pas seulement au rôle nommé dans son libellé.
create policy "Allow service role full access" on orders
  for all
  to service_role
  using (true)
  with check (true);
```

## Pourquoi ce dossier `database/migrations/` existe alors ?

Il sert de zone de référence/documentation (ce README) et convient si tu préfères ne pas
utiliser la Supabase CLI et gérer tes migrations SQL manuellement (numérotées à la main,
appliquées via l'éditeur SQL du dashboard Supabase). Dans ce cas, place tes fichiers
`.sql` numérotés directement ici (`001_create_orders.sql`, `002_...sql`, etc.).
