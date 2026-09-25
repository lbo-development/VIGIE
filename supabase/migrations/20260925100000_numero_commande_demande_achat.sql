-- Décision du 25/09/2026 : numéro de commande PGI, saisi par la CB à OP1.6 (« Commander »),
-- absent du schéma jusqu'ici (seul MONTANT_COMMANDE était constaté côté VIGIE, le bon de commande
-- restant une tâche manuelle dans le PGI). Texte libre, sans contrainte de format — obligatoire au
-- moment de la saisie (validé côté application, jamais en NOT NULL ici : les FAD déjà commandées
-- avant cette migration n'en ont pas).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'finances'
      and table_name = 'demande_achat'
      and column_name = 'numero_commande'
  ) then
    alter table finances.demande_achat add column numero_commande text null;
  end if;
end $$;
