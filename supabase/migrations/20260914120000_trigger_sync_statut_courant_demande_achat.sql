-- Point 2 de la conception "gestion des statuts et de leur évolution" : garantir
-- au niveau base (pas seulement par convention applicative) que
-- demande_achat.code_statut reflète toujours le statut le plus récent de
-- historique_statut (règles 1 et 3 : un seul statut courant à l'instant t,
-- toujours égal au dernier enregistré).
--
-- Choix : trigger AFTER INSERT sur historique_statut plutôt qu'un calcul à la
-- volée (vue / sous-requête MAX(date_heure)) — le repository backend lit déjà
-- demande_achat.code_statut comme une colonne directe (filtres, select), et la
-- FK demande_achat_code_statut_fkey en dépend. Remettre en cause cette
-- dénormalisation aurait un coût largement disproportionné par rapport au
-- bénéfice : le trigger suffit à transformer la promesse "maintenu par
-- déclencheur applicatif" du MCD (§2.5) en garantie réelle de la base.
--
-- Vérifié avant d'écrire cette migration : aucun code backend ne fait
-- aujourd'hui d'UPDATE direct sur demande_achat.code_statut (seule
-- finances.creer_demande_achat_brouillon l'insère, à la création) — ce trigger
-- n'entre donc en conflit avec aucun chemin de code existant.
--
-- security definer + search_path fixé : la fonction doit pouvoir mettre à jour
-- demande_achat quel que soit l'appelant de l'INSERT sur historique_statut
-- (y compris si RLS venait à restreindre historique_statut à un rôle qui n'a
-- pas lui-même le droit d'UPDATE sur demande_achat) ; elle appartient au
-- propriétaire des tables (postgres), qui n'est pas soumis à RLS.

create or replace function finances.sync_statut_courant_demande_achat()
returns trigger
language plpgsql
security definer
set search_path = finances, pg_catalog
as $$
begin
  update finances.demande_achat
    set code_statut = new.code_statut
    where id_demande_achat = new.id_demande_achat;
  return new;
end;
$$;

create trigger trg_sync_statut_courant
after insert on finances.historique_statut
for each row
execute function finances.sync_statut_courant_demande_achat();
