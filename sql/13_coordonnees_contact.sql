-- ABCZed — V7.37 : vraies coordonnées de contact (téléphone/e-mail) + partage.
--
-- Jusqu'ici, "Mon profil" affichait 4 cases à cocher (WhatsApp/Téléphone/SMS/E-mail) qui ne
-- vivaient que dans l'état React de l'appli le temps de la session — aucune colonne pour un
-- numéro ou une adresse, aucune persistance, comme le disait honnêtement le texte affiché
-- ("préférences enregistrées uniquement pour cette session"). Ce fichier ajoute les 6 colonnes
-- réellement nécessaires : un numéro et un e-mail uniques par personne (jamais un par canal —
-- WhatsApp/SMS/téléphone partagent le même numéro), plus un flag de partage indépendant par
-- canal (on peut partager son numéro pour un appel sans accepter les SMS, par ex.).
--
-- Écriture déjà couverte SANS aucune nouvelle policy ni aucun nouveau grant :
--   - `grant select, update on members to authenticated` (sql/02_rls.sql, ligne 216) est un
--     grant de TABLE, pas par colonne — couvre déjà ces 6 nouvelles colonnes.
--   - La policy "update_own_display_fields_or_admin" (sql/02_rls.sql) autorise déjà un membre
--     à modifier SA PROPRE ligne (`user_id = auth.uid() and status = 'active'`).
--   - Le trigger protect_sensitive_member_columns (sql/01_schema_and_helpers.sql) ne bloque que
--     community_id/user_id/role/status — jamais ces colonnes.
-- Leçon de l'incident §14 (avatar_url) appliquée : les colonnes ci-dessous n'existent nulle
-- part ailleurs dans le dépôt avant ce fichier — pas de divergence possible entre "documenté"
-- et "appliqué", contrairement à avatar_url qui existait déjà (à tort) dans sql/01.
--
-- NON EXÉCUTÉ PAR MOI CONTRE LE PROJET SUPABASE RÉEL DE L'UTILISATEUR. Application manuelle :
-- coller ce fichier dans le SQL Editor Supabase, une fois. Idempotent (`if not exists`).

alter table members add column if not exists phone_number text;
alter table members add column if not exists email text;
alter table members add column if not exists share_whatsapp boolean not null default false;
alter table members add column if not exists share_phone boolean not null default false;
alter table members add column if not exists share_sms boolean not null default false;
alter table members add column if not exists share_email boolean not null default false;

notify pgrst, 'reload schema';
