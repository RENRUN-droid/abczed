// Point 3 (recette réelle sur PC) : extrait d'App.jsx pour que Messages.jsx (bandeau de
// confidentialité) puisse lire BUSINESS_DATA_FROM_SUPABASE sans créer un import circulaire
// avec App.jsx (qui importe lui-même Messages.jsx comme composant de page). Mêmes valeurs,
// mêmes commentaires qu'avant ce déplacement — aucun changement de comportement, uniquement
// de l'emplacement de la déclaration. Brief : "Préserve les flags de source de données" —
// ce fichier est désormais la source unique des deux drapeaux, plus simple à vérifier d'un
// coup d'œil qu'avant (auparavant enfouis au milieu d'App.jsx).

// Drapeau historique — pilotait autrefois Agenda/Messages/Partages/La Bande ensemble, via
// l'ancien api.js (member_name/author_name en texte libre, incompatibles avec le schéma
// sécurisé réel). Chacun des quatre modules a depuis reçu son propre drapeau dédié ci-dessous
// (AGENDA_FROM_SUPABASE, MESSAGES_FROM_SUPABASE, MEMBERS_FROM_SUPABASE, SHARES_FROM_SUPABASE),
// le dernier (Partages) ajouté le 23 septembre — plus aucun code de src/ ne lit ce drapeau-ci
// ni n'importe l'ancien api.js. Conservé ici, désactivé, uniquement pour la trace historique —
// même principe que api.js lui-même, laissé intact sur disque plutôt que supprimé.
export const BUSINESS_DATA_FROM_SUPABASE = false;

// Seul Agenda passe au réel via ce drapeau, via src/agendaApi.js.
export const AGENDA_FROM_SUPABASE = true;

// V7.7 : pilote Messages (lecture, envoi, liaison à un événement réel, réactions, Realtime),
// via le module dédié src/messagesApi.js (jamais l'ancien api.js, toujours incompatible avec le
// schéma sécurisé — voir le commentaire en tête de ce fichier).
export const MESSAGES_FROM_SUPABASE = true;

// V7.18 : pilote La Bande (annuaire des membres réels de la communauté, via
// src/membersApi.js/src/memberDirectory.js), et donc aussi le résultat "La Bande" de la
// recherche Accueil et la fiche membre (MemberDetail.jsx), qui partagent la même liste. Ce que
// ce lot NE couvre PAS : les coordonnées de contact (téléphone/e-mail/partage par canal,
// MemberDetail.jsx) et l'édition du profil "Vous" (MyProfileSheet.jsx) restent locales à la
// session — `members` n'a aucune colonne pour ça aujourd'hui ; les enfants/groupes réels
// (`children`/`member_children`, sql/02_rls.sql) sont en revanche déjà lus tels quels, dès
// qu'ils existent.
export const MEMBERS_FROM_SUPABASE = true;

// Backlog point 4 (session du 23 septembre) : cinquième et dernier drapeau de cette série —
// pilote désormais Partages (lecture, création/modification/suppression, upload réel de
// fichiers vers le bucket privé Storage `community-files`, Realtime), via le module dédié
// src/sharesApi.js. La table `shares`, ses 4 policies RLS et le bucket `community-files`
// existaient déjà intégralement (sql/02_rls.sql, sql/03_storage.sql, posés lors d'un chantier
// antérieur) mais n'étaient jamais lus/écrits par l'application — seule la colonne
// `shares.file_path` (sql/08_shares_storage.sql) restait à ajouter, additif pur, aucune policy
// supplémentaire nécessaire. Dernier des cinq modules métier (Agenda/Messages/La Bande/Partages,
// plus l'authentification elle-même) à quitter les données de démonstration locales.
export const SHARES_FROM_SUPABASE = true;

// V7.28 (25 sept.) — pilote "Le p'tit billet" (encart d'accueil), via le module dédié
// src/billetApi.js et la table `billet` (sql/10_billet.sql). Avant ce lot, ce texte était codé
// en dur dans Accueil.jsx depuis l'origine du projet (texte de démonstration, jamais relié à
// aucune donnée réelle) — demande explicite de l'utilisatrice : un billet qu'elle peut
// remettre à jour elle-même depuis l'application, sans jamais repasser par une livraison de
// code. Une seule ligne par communauté (`community_id` est la clé primaire de `billet`) :
// chaque mise à jour REMPLACE le billet courant, pas d'historique — "quelque chose qui passe
// et laisse sa place", formulation exacte de l'utilisatrice.
export const BILLET_FROM_SUPABASE = true;
