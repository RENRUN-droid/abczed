// Point 3 (recette réelle sur PC) : extrait d'App.jsx pour que Messages.jsx (bandeau de
// confidentialité) puisse lire BUSINESS_DATA_FROM_SUPABASE sans créer un import circulaire
// avec App.jsx (qui importe lui-même Messages.jsx comme composant de page). Mêmes valeurs,
// mêmes commentaires qu'avant ce déplacement — aucun changement de comportement, uniquement
// de l'emplacement de la déclaration. Brief : "Préserve les flags de source de données" —
// ce fichier est désormais la source unique des deux drapeaux, plus simple à vérifier d'un
// coup d'œil qu'avant (auparavant enfouis au milieu d'App.jsx).

// Volontairement figé à false ici, indépendamment de la config Supabase : Agenda/Messages/
// Partages/La Bande restent sur des données locales tant qu'api.js n'a pas été migré vers le
// schéma sécurisé (il référence encore member_name/author_name en texte libre, incompatibles
// avec author_id/user_id en uuid — voir commentaire en tête de api.js). À repasser à true (et
// à relier à activeCommunity.community_id) uniquement une fois api.js migré.
export const BUSINESS_DATA_FROM_SUPABASE = false;

// Drapeau DISTINCT de BUSINESS_DATA_FROM_SUPABASE, volontairement — on ne transforme pas ce
// dernier en interrupteur global qui réactiverait Messages/Partages via l'ancien api.js. Seul
// Agenda passe au réel via ce drapeau, via src/agendaApi.js.
export const AGENDA_FROM_SUPABASE = true;

// V7.7 : troisième drapeau, distinct des deux précédents — lui seul pilote Messages (lecture,
// envoi, liaison à un événement réel, réactions, Realtime), via le nouveau module dédié
// src/messagesApi.js (jamais l'ancien api.js, toujours incompatible avec le schéma sécurisé —
// voir le commentaire en tête de ce fichier). BUSINESS_DATA_FROM_SUPABASE reste figé à false et
// continue de gouverner UNIQUEMENT Partages, qui reste sur des données locales dans ce lot.
export const MESSAGES_FROM_SUPABASE = true;

// V7.18 : quatrième drapeau, distinct des trois précédents — lui seul pilote La Bande (annuaire
// des membres réels de la communauté, via src/membersApi.js/src/memberDirectory.js), et donc
// aussi le résultat "La Bande" de la recherche Accueil et la fiche membre (MemberDetail.jsx),
// qui partagent la même liste. BUSINESS_DATA_FROM_SUPABASE reste figé à false et continue de
// gouverner UNIQUEMENT Partages — La Bande n'a jamais dépendu de ce drapeau historique, elle a
// désormais le sien, sur le même principe que Messages/Agenda avant elle. Ce que ce lot NE
// couvre PAS : les coordonnées de contact (téléphone/e-mail/partage par canal, MemberDetail.jsx)
// et l'édition du profil "Vous" (MyProfileSheet.jsx) restent locales à la session — `members`
// n'a aucune colonne pour ça aujourd'hui ; les enfants/groupes réels (`children`/
// `member_children`, sql/02_rls.sql) sont en revanche déjà lus tels quels, dès qu'ils existent.
export const MEMBERS_FROM_SUPABASE = true;
