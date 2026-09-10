-- Oubli des migrations 20260907160000/20260907170000 : ce projet révoque
-- tout droit hérité par défaut sur finances.* (durcissement du 30/08/2026,
-- voir 20260830100000_harden_finances_grants.sql) — toute nouvelle fonction
-- doit recevoir explicitement GRANT EXECUTE, comme
-- finances.parametre_effectif/upsert_parametre_application
-- (20260825110000_add_parametre_application_functions.sql). Sans ce GRANT,
-- l'appel via service_role (backend) échoue en "permission denied", remonté
-- comme une erreur 500 générique côté API (cause du bug "Erreur interne du
-- serveur" au clic sur "Nouvelle demande").
grant execute on function finances.creer_demande_achat_brouillon(bigint, text) to service_role;
