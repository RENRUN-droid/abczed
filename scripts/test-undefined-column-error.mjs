// Tests dédiés à src/undefinedColumnError.js — importent le vrai code de production, comme les
// autres modules de logique du projet.
//
// Deux cas discriminants centraux :
// - 5/6/14 (2e contre-vérification, ZIP V7.2) : une violation de la contrainte de forme
//   `event_participants_attendee_names_shape` (donnée malformée, ex. un bug côté client qui
//   envoie `{"adults": "Léa"}`) produit un message Postgres qui contient la sous-chaîne
//   "attendee_names" (le nom de la colonne apparaît dans le nom de la contrainte violée) —
//   l'ancienne détection (simple `/attendee_names/i.test(message)`) aurait classé cette
//   violation à tort comme "migration absente" et réessayé silencieusement sans les prénoms,
//   faisant disparaître l'erreur réelle. La détection doit la laisser passer (`false`).
// - 2/15 (3e contre-vérification, ZIP V7.3, réserve 1) : `error.code === '42703'` seul, sans
//   vérifier le message, acceptait N'IMPORTE QUELLE colonne inexistante (`column "x" does not
//   exist`) — une tout autre anomalie SQL aurait pu déclencher à tort le même repli. Le message
//   est désormais exigé aussi pour 42703, avec le motif `column "attendee_names"` — formats
//   vérifiés en exécutant réellement les requêtes concernées contre un Postgres local (pas une
//   supposition, voir MATRICE_LIVRAISON.md).
import { isUndefinedColumnError } from '../src/undefinedColumnError.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${expected}, obtenu ${actual}`); fail++; }
}

// --- Cas qui DOIVENT être reconnus comme "colonne absente" (retry sans prénoms légitime) ---

check(
  '1. SQLSTATE 42703, message INSERT réel (vérifié contre Postgres local : "column \\"attendee_names\\" of relation \\"event_participants\\" does not exist") -> true',
  isUndefinedColumnError({ code: '42703', message: 'column "attendee_names" of relation "event_participants" does not exist' }),
  true,
);
check(
  '2. SQLSTATE 42703, message SELECT nu réel (vérifié contre Postgres local : "column \\"attendee_names\\" does not exist", sans "of relation") -> true',
  isUndefinedColumnError({ code: '42703', message: 'column "attendee_names" does not exist' }),
  true,
);
check(
  '3. PGRST204 avec le message exact documenté par PostgREST, pour cette colonne et cette table -> true',
  isUndefinedColumnError({ code: 'PGRST204', message: "Could not find the 'attendee_names' column of 'event_participants' in the schema cache" }),
  true,
);
check(
  '4. PGRST204 insensible à la casse sur le message -> true',
  isUndefinedColumnError({ code: 'PGRST204', message: "COULD NOT FIND THE 'attendee_names' COLUMN OF 'event_participants' IN THE SCHEMA CACHE" }),
  true,
);

// --- P5 (exercice de correction V7.5) : forme qualifiée/sans guillemets, réellement produite
// par un select PostgREST (direct ou imbriqué) sur une colonne absente — messages capturés en
// reproduisant pour de vrai la requête équivalente à fetchEventsRaw contre un PostgREST 12.2.3 +
// Postgres locaux jetables (table event_participants sans attendee_names, état "avant migration
// 05"), jamais contre le Supabase réel de l'utilisateur. C'est cette forme précise, absente de
// la détection avant cette passe, qui causait le défaut réel : "Impossible de charger l'agenda"
// au lieu du repli sans prénoms.
check(
  '17. [P5, défaut réel corrigé] 42703, select IMBRIQUÉ (message réel capturé : "column event_participants_1.attendee_names does not exist") -> true',
  isUndefinedColumnError({ code: '42703', message: 'column event_participants_1.attendee_names does not exist' }),
  true,
);
check(
  '18. 42703, select DIRECT via l\'API PostgREST (message réel capturé : "column event_participants.attendee_names does not exist", sans alias numéroté) -> true',
  isUndefinedColumnError({ code: '42703', message: 'column event_participants.attendee_names does not exist' }),
  true,
);
check(
  '19. même forme qualifiée mais pour une AUTRE colonne du même select imbriqué (message réel capturé) -> false, ne doit pas devenir un repli générique "colonne absente, peu importe laquelle"',
  isUndefinedColumnError({ code: '42703', message: 'column event_participants_1.some_other_missing_col does not exist' }),
  false,
);
check(
  '20. forme qualifiée mais le nom de colonne n\'est qu\'un préfixe de "attendee_names" (jamais un match par sous-chaîne) -> false',
  isUndefinedColumnError({ code: '42703', message: 'column event_participants_1.old_attendee_names_archive does not exist' }),
  false,
);

// --- Cas qui NE DOIVENT PAS être reconnus (l'erreur réelle doit être remontée telle quelle) ---

check(
  '5. [cas central signalé, ZIP V7.2] violation de la contrainte de forme (donnée malformée) -> false, PAS "migration absente"',
  isUndefinedColumnError({
    code: '23514',
    message: 'new row for relation "event_participants" violates check constraint "event_participants_attendee_names_shape"',
  }),
  false,
);
check(
  '6. autre violation de contrainte mentionnant "attendee_names" dans le détail -> false',
  isUndefinedColumnError({
    code: '23514',
    message: 'new row for relation "event_participants" violates check constraint "event_participants_counts_valid"',
    details: 'Failing row contains (..., attendee_names, ...).',
  }),
  false,
);
check(
  '7. PGRST204 mais pour une AUTRE colonne (pas attendee_names) -> false, ne doit rien avaler ici',
  isUndefinedColumnError({ code: 'PGRST204', message: "Could not find the 'other_col' column of 'event_participants' in the schema cache" }),
  false,
);
check(
  '8. PGRST204 pour attendee_names mais sur une AUTRE table -> false, reste spécifique à event_participants',
  isUndefinedColumnError({ code: 'PGRST204', message: "Could not find the 'attendee_names' column of 'other_table' in the schema cache" }),
  false,
);
check(
  '9. erreur réseau générique sans code -> false',
  isUndefinedColumnError({ message: 'Failed to fetch' }),
  false,
);
check(
  '10. erreur de permission (RLS) mentionnant la table mais pas de colonne absente -> false',
  isUndefinedColumnError({ code: '42501', message: 'new row violates row-level security policy for table "event_participants"' }),
  false,
);
check(
  '11. error undefined/null -> false, ne plante pas',
  isUndefinedColumnError(undefined),
  false,
);
check(
  '12. objet erreur vide -> false',
  isUndefinedColumnError({}),
  false,
);
check(
  '13. code PGRST204 mais message vide/absent -> false (jamais un true "par défaut" sur le seul code)',
  isUndefinedColumnError({ code: 'PGRST204' }),
  false,
);
check(
  '14. [régression exacte du signalement, ZIP V7.2] le message contient "attendee_names" mais code=23514, forme la plus proche du faux positif d\'origine -> false',
  isUndefinedColumnError({ code: '23514', message: 'attendee_names shape check failed' }),
  false,
);
check(
  '15. [réserve V7.3] SQLSTATE 42703 mais pour une AUTRE colonne (ex. faute de frappe ailleurs dans le code) -> false, ne doit plus être avalé par le seul code',
  isUndefinedColumnError({ code: '42703', message: 'column "adults_count" of relation "event_participants" does not exist' }),
  false,
);
check(
  '16. code 42703 mais message vide/absent -> false (jamais un true "par défaut" sur le seul code, même règle que PGRST204)',
  isUndefinedColumnError({ code: '42703' }),
  false,
);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
