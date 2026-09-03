-- Ajoute CREATED_AT/UPDATED_AT à finances.marche_tiers (table créée le jour même dans
-- 20260901130000_create_marche_tiers.sql, décision du 01/09/2026 de tracer ces dates).
-- UPDATED_AT est maintenu par trigger à chaque UPDATE, pas seulement `default now()` à
-- l'insertion — un simple DEFAULT ne se redéclenche jamais après coup (même piège que
-- finances.mt_solde/utilisable avant leur passage en colonnes générées le 30/08/2026, et que
-- finances.seuil_validation_ds.updated_at, qui n'a jamais eu ce trigger).
alter table finances.marche_tiers
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Fonction générique (pas spécifique à marche_tiers) : à réutiliser pour tout futur UPDATED_AT
-- de ce schéma plutôt que d'en écrire une nouvelle par table.
create or replace function finances.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger marche_tiers_set_updated_at
  before update on finances.marche_tiers
  for each row
  execute function finances.set_updated_at();
