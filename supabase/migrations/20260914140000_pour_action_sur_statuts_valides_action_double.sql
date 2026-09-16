-- Point 2/analyse "pour_action" : les statuts XX_VALIDEE_XX (DA_VALIDEE_RC,
-- FAD_VALIDEE_CDS, FAD_VALIDEE_CB, FAD_VALIDEE_DS) informent le N-1 que sa
-- demande est validée, puis posent explicitement la question à l'utilisateur
-- (le même acteur qui vient de valider) : transmettre tout de suite au N+1, ou
-- plus tard ? La transmission n'est donc PAS garantie atomique avec la
-- validation — si l'utilisateur répond non, il doit pouvoir retrouver ce
-- dossier dans sa file de travail pour lancer la transmission ultérieurement.
--
-- pour_action doit donc être renseigné sur ces 4 statuts, avec le même acteur
-- que l'émetteur (indicateur de tâche « même acteur », pas un transfert —
-- exactement le même principe que FAD_A_COMMANDER pour la CB).
--
-- Sans ce correctif, `pour_action is not null` (la règle déjà établie pour la
-- file "à traiter" de chaque rôle) ne remonte jamais ces 4 statuts : un
-- RC/CDS/CB/DS ayant répondu "non" à la question de transmission perdrait son
-- dossier de vue, sans aucun indicateur pour y revenir.

update finances.statut
set pour_action = emmeteur
where code_statut in ('DA_VALIDEE_RC', 'FAD_VALIDEE_CDS', 'FAD_VALIDEE_CB', 'FAD_VALIDEE_DS');
