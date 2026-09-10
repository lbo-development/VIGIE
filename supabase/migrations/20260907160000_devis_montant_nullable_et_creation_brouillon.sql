-- Décision du 07/09/2026 (deux changements liés à l'adoption du modèle de
-- création progressive de la DA, en remplacement de l'idée d'une écriture
-- unique et atomique en fin de parcours).

-- 1) DEVIS_CONSULTE.MONTANT_DEVIS devient nullable. Pour MARCHE, le devis
-- BPU facultatif n'a pas besoin d'un montant significatif (MONTANT_DEMANDE
-- fait foi) — NULL marque explicitement « non pertinent », préférable à un
-- 0 qui affirmerait à tort que le devis ne vaut rien.
alter table finances.devis_consulte
  alter column montant_devis drop not null;

alter table finances.devis_consulte
  drop constraint if exists devis_consulte_montant_devis_check;
alter table finances.devis_consulte
  add constraint chk_devis_montant_devis check (montant_devis is null or montant_devis >= 0);

comment on column finances.devis_consulte.montant_devis is
  'Montant du devis — obligatoire par règle applicative si HORS_MARCHE, non significatif si MARCHE (peut rester NULL, MONTANT_DEMANDE fait foi).';

-- 2) Modèle de création progressive (décision du 07/09/2026, remplace
-- l'idée d'une fonction Postgres unique écrivant toute la DA d'un coup) :
-- dès l'ouverture de CreationDA (clic « Nouvelle demande »), une ligne
-- DEMANDE_ACHAT est créée immédiatement à l'état DA_EN_PREPARATION — le
-- reste des écrans (MarcheDA, FournisseurDA, PiecesDevisDA,
-- PiecesComplementairesDA) opère ensuite sur cette ligne déjà existante,
-- chaque « Enregistrer » de sous-écran écrivant sa propre donnée
-- immédiatement (UPDATE/INSERT ordinaires côté service, pas de transaction
-- géante). Nécessite d'allouer NUMERO au bon moment sans collision entre
-- deux créations simultanées pour le même service — objet de cette
-- fonction, volontairement minimale (pas de validation métier, la
-- validation Zod reste faite côté TypeScript avant tout appel).
--
-- PROCEDURE_ACHAT n'étant choisi par l'utilisateur qu'à l'intérieur de
-- CreationDA (pas avant), la ligne est créée avec la valeur par défaut
-- 'MARCHE' (correspond au bouton radio pré-sélectionné dans le wireframe),
-- modifiable ensuite comme n'importe quel autre champ du brouillon.
create or replace function finances.creer_demande_achat_brouillon(
  p_id_service bigint,
  p_matricule_demandeur text
)
returns finances.demande_achat
language plpgsql
security definer
set search_path = finances, pg_temp
as $$
declare
  v_prefix text := to_char(current_date, 'YYYY-MM-DD');
  v_next int;
  v_numero text;
  v_row finances.demande_achat;
begin
  -- Verrou applicatif scopé (service, jour) : sérialise l'allocation du
  -- numéro entre créations concurrentes pour le même service le même jour,
  -- relâché automatiquement à la fin de la transaction appelante.
  perform pg_advisory_xact_lock(hashtextextended(p_id_service::text || '|' || v_prefix, 0));

  select coalesce(max(substring(numero from '-(\d{3})$')::int), 0) + 1
    into v_next
  from finances.demande_achat
  where id_service = p_id_service
    and numero like v_prefix || '-%';

  v_numero := v_prefix || '-' || lpad(v_next::text, 3, '0');

  insert into finances.demande_achat (
    numero, id_service, matricule_demandeur, procedure_achat,
    objet, montant_demande, date_creation, code_statut
  ) values (
    v_numero, p_id_service, p_matricule_demandeur, 'MARCHE',
    '', 0, current_date, 'DA_EN_PREPARATION'
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function finances.creer_demande_achat_brouillon(bigint, text) is
  'Alloue un NUMERO sans collision (service, jour) et crée le brouillon DA_EN_PREPARATION minimal. Ne contient aucune règle métier — appelée par demandeAchat.service.ts après validation applicative de ID_SERVICE/MATRICULE_DEMANDEUR (ex. demandeur cible choisi par un RC/ADMIN_SERVICE créant pour un tiers).';
