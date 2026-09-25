-- ABCZed — V7.34 (correctif) : colonne members.avatar_url manquante en production.
--
-- Contexte : sql/01_schema_and_helpers.sql décrit `avatar_url` dans la définition de la table
-- `members` depuis la construction initiale de la sécurité (bucket de stockage `avatars` +
-- colonne prévus dès l'origine, jamais utilisés par l'interface avant V7.34). Mais cette
-- définition de fichier n'avait, en réalité, jamais été appliquée contre la vraie base Supabase
-- de l'utilisatrice — divergence entre le fichier source et l'état réel de la base, découverte
-- seulement après le déploiement du code V7.34 (fonctionnalité "avatar/photo de profil").
--
-- Conséquence concrète : juste après la mise en ligne du code V7.34, la moindre tentative de
-- connexion (AuthProvider.jsx → loadMemberships, dont le select réclame désormais avatar_url)
-- déclenchait une erreur PostgREST 400 (code 42703 "column members.avatar_url does not exist"),
-- transformée par le code existant en statut "authenticated-but-no-access" → écran "Accès
-- indisponible" pour TOUT LE MONDE, y compris l'administratrice elle-même. Incident bloquant,
-- résolu en quelques minutes une fois la vraie cause identifiée via l'onglet Network du
-- navigateur (réponse JSON de l'erreur PostgREST).
--
-- Correctif exécuté par l'utilisatrice elle-même dans le SQL Editor Supabase le 24/09 (déjà
-- appliqué contre la vraie base — ce fichier ne fait que consigner rétroactivement ce qui a été
-- joué, pour que le dépôt GitHub reste un historique complet et fidèle) :
--
-- NE PAS RE-EXÉCUTER : deja appliqué en production. Conservé ici uniquement pour mémoire —
-- `if not exists` le rend de toute façon inoffensif si quelqu'un le rejouait par erreur.

alter table members add column if not exists avatar_url text;

notify pgrst, 'reload schema';

-- Leçon retenue (consignée aussi dans MATRICE_LIVRAISON.md, §14) : ne plus jamais présumer
-- qu'une colonne ou une table mentionnée dans sql/*.sql reflète forcément l'état réel de la
-- base de production sans signal de confirmation explicite (test réel ou vérification directe
-- dans Supabase) avant de livrer du code applicatif qui en dépend.
