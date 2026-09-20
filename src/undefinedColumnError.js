// Point 3 (2e contre-vérification, ZIP V7.2) : extrait de src/agendaApi.js dans son propre
// module pur (aucun import Supabase) pour pouvoir être testé directement en Node, à l'identique
// de src/attendeeNames.js et src/agendaSearch.js — agendaApi.js dépend de supabaseClient.js
// (variables d'environnement Vite), ce qui rendait ce test impossible en important le fichier
// tel quel.
//
// La détection précédente — tout message d'erreur contenant simplement la sous-chaîne
// "attendee_names" — était trop large. Une violation de la contrainte de forme ajoutée par
// sql/05_participant_names.sql (ex. `{"adults": "Léa"}`, un objet malformé envoyé par un bug
// côté client) produit elle aussi un message Postgres qui contient "attendee_names" : le nom de
// la colonne apparaît dans le nom de la contrainte elle-même
// (`new row for relation "event_participants" violates check constraint
// "event_participants_attendee_names_shape"`). Avec l'ancienne regex, cette violation aurait été
// prise à tort pour "la migration 05 n'est pas appliquée", puis silencieusement réessayée SANS
// les prénoms : la participation aurait été enregistrée en faisant disparaître l'erreur réelle
// (donnée malformée) au lieu de la remonter à l'appelant.
//
// Seules deux formes précises signalent réellement une colonne absente :
//   1. SQLSTATE Postgres standard "undefined_column" = 42703 — renvoyé tel quel dans
//      `error.code` quand une requête atteint effectivement Postgres avec une colonne inconnue
//      (ex. un `select` explicite sur une colonne absente, cas où PostgREST relaie l'erreur
//      Postgres brute plutôt que de la détecter lui-même via son cache de schéma).
//   2. Le code PostgREST "PGRST204", avec le message exact
//      "Could not find the '<colonne>' column of '<table>' in the schema cache" — c'est la
//      forme que prend concrètement une insertion Supabase visant une colonne inexistante :
//      PostgREST rejette la requête AVANT d'atteindre Postgres, sur la base de son propre cache
//      de schéma, donc 42703 n'est alors jamais émis dans ce cas précis.
//      Vérifié directement contre la référence des codes d'erreur PostgREST
//      (docs.postgrest.org/en/v12/references/errors.html : PGRST204, HTTP 400, "colonne non
//      trouvée dans le cache de schéma") et un corps d'erreur réel rapporté par un utilisateur
//      Supabase (github.com/supabase/supabase/issues/42183 :
//      {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the
//      'batch_number' column of 'planting_plans' in the schema cache"}) — pas une supposition
//      sur le format du message.
// Le message est vérifié avec la colonne ET la table nommées explicitement (pas seulement
// "attendee_names" isolé) pour rester spécifique à CETTE colonne sur CETTE table — un PGRST204
// concernant une autre colonne ou une autre table ne doit jamais être avalé silencieusement ici.
//
// Correctif (contre-vérification V7.3, réserve 1) : `error.code === '42703'` seul acceptait
// N'IMPORTE QUELLE colonne inexistante (`column "x" does not exist`), pas seulement
// `attendee_names` — une tout autre anomalie SQL (faute de frappe ailleurs, régression sur une
// autre colonne) aurait pu déclencher à tort le repli "sans prénoms" au lieu de remonter
// l'erreur réelle. Le message est désormais exigé lui aussi pour 42703, exactement comme pour
// PGRST204. Format exact vérifié en exécutant réellement les deux requêtes concernées contre un
// Postgres local (pas une supposition) :
//   - `insert into event_participants (..., attendee_names) values (...)` (insertParticipation)
//     → `column "attendee_names" of relation "event_participants" does not exist`
//   - `select attendee_names from event_participants` (variante sans "of relation", observée sur
//     un select nu) → `column "attendee_names" does not exist`
// Les deux formes partagent le motif `column "attendee_names"` : c'est ce sous-motif précis,
// colonne nommée explicitement entre guillemets doubles (syntaxe native Postgres, à ne pas
// confondre avec les guillemets simples du message PGRST204 ci-dessus), qui est exigé ici.
// P5 (exercice de correction V7.5) : défaut réel constaté sur le vrai projet Supabase, AVANT
// application de la migration sql/05 — l'agenda affichait "Impossible de charger l'agenda" (une
// vraie erreur générique) au lieu du repli "sans attendee_names" pourtant déjà en place dans
// fetchEventsRaw, contredisant le comportement défensif annoncé comme fonctionnel en V7.4.
//
// Cause réelle, reproduite ici (pas supposée) : `fetchEventsRaw` (agendaApi.js) lit
// `event_participants` en select IMBRIQUÉ (`events -> event_participants(...)`), jamais en
// select direct — or, pour un select IMBRIQUÉ portant sur une colonne absente, PostgREST NE
// PASSE PAS par son cache de schéma (qui produirait PGRST204, déjà géré) : il laisse la requête
// SQL générée atteindre Postgres, qui lève alors un 42703 "undefined_column" natif, mais avec un
// message QUALIFIÉ PAR UN ALIAS ET SANS GUILLEMETS — forme jamais couverte par la détection
// précédente (qui n'acceptait que `column "attendee_names"`, guillemets obligatoires, la forme
// d'un select/insert NON qualifié).
//
// Vérifié en reproduisant réellement la requête équivalente contre un PostgREST 12.2.3 + un
// Postgres locaux, jetables (jamais le Supabase réel de l'utilisateur), avec une table
// `event_participants` sans `attendee_names` (état "avant migration 05") :
//   - select imbriqué (`events?select=*,event_participants(...,attendee_names)`, exactement la
//     forme utilisée par fetchEventsRaw) ->
//     {"code":"42703","message":"column event_participants_1.attendee_names does not exist"}
//     (PostgREST suffixe l'alias d'un numéro, ex. `_1`, pour lever toute ambiguïté de jointure)
//   - select direct (`event_participants?select=attendee_names`) ->
//     {"code":"42703","message":"column event_participants.attendee_names does not exist"}
//   - pour comparaison, une AUTRE colonne absente dans le même select imbriqué ->
//     {"code":"42703","message":"column event_participants_1.some_other_missing_col does not
//     exist"} — confirme que le motif reste bien spécifique à `attendee_names`, jamais un repli
//     générique sur "une colonne quelconque est absente".
//   - l'INSERT (insertParticipation), lui, confirme bien produire PGRST204 tel que déjà documenté
//     ci-dessous (revérifié ici aussi) : {"code":"PGRST204","message":"Could not find the
//     'attendee_names' column of 'event_participants' in the schema cache"}.
export function isUndefinedColumnError(error) {
  if (error?.code === '42703') {
    const msg = error?.message || '';
    // Deux formes réelles acceptées : la forme non qualifiée/entre guillemets (select ou insert
    // SQL brut, non médiatisé par PostgREST — comportement déjà vérifié avant cette passe) et la
    // forme qualifiée par une table ou un alias, sans guillemets (select PostgREST, direct ou
    // imbriqué — voir ci-dessus). `[\w]+\.attendee_names` exige un nom de colonne EXACTEMENT
    // "attendee_names" juste après le point (jamais un simple préfixe, ex.
    // "ancien_attendee_names_x" ne matche pas) — même rigueur que la forme historique.
    return /column\s+"attendee_names"|column\s+[\w]+\.attendee_names\s+does not exist/i.test(msg);
  }
  if (error?.code !== 'PGRST204') return false;
  return /could not find the 'attendee_names' column of 'event_participants' in the schema cache/i.test(
    error?.message || '',
  );
}
