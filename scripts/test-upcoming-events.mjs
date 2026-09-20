// V7.14 — correctif UAT point 15 : "À venir" (Agenda.jsx) et "Prochain événement" (Accueil.jsx)
// ne filtraient auparavant AUCUN événement daté déjà passé — un jeu de données entièrement au
// passé affichait quand même "le plus ancien du lot" comme "prochain événement". Test qui
// EXÉCUTE le code de production, comme scripts/test-agenda-search.mjs : import direct de
// `isUpcomingEvent` depuis src/agendaSearch.js, la même fonction que les deux écrans utilisent
// réellement (jamais une reproduction séparée de la logique).
//
// Référence imposée par le brief de cette passe : "aujourd'hui" = 2026-09-19, avec trois
// événements passés (10, 14, 15 septembre 2026) et au moins un événement futur — aucun des trois
// passés ne doit jamais apparaître dans le résultat "à venir", le futur doit y apparaître.
import { isUpcomingEvent } from '../src/agendaSearch.js';

let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`); fail++; }
}

// Référence : 19 septembre 2026, midi (heure locale de la machine qui exécute ce test — la
// fonction testée compare toujours en heure LOCALE, jamais en UTC, voir son commentaire).
const REFERENCE = new Date(2026, 8, 19, 12, 0, 0);

// --- Scénario imposé par le brief : trois événements passés + un futur -----------------------
const pastEvents = [
  { id: 'past-10', date: '2026-09-10' },
  { id: 'past-14', date: '2026-09-14', startTime: '09:00' },
  { id: 'past-15', date: '2026-09-15' },
];
const futureEvent = { id: 'future-25', date: '2026-09-25' };

for (const e of pastEvents) {
  check(`${e.id} (2026-09-19 de référence) n'est PAS "à venir"`, isUpcomingEvent(e, REFERENCE) === false);
}
check('future-25 (2026-09-25) EST "à venir"', isUpcomingEvent(futureEvent, REFERENCE) === true);

// --- Reproduction du bug exact décrit (Accueil.jsx / Agenda.jsx) : simuler le filtre + tri -----
const allEvents = [...pastEvents, futureEvent];
const computedUpcoming = allEvents
  .filter((e) => isUpcomingEvent(e, REFERENCE))
  .sort((a, b) => new Date(a.date) - new Date(b.date));
check(
  'La liste "à venir" calculée ne contient QUE future-25 (aucun des 3 événements passés)',
  computedUpcoming.length === 1 && computedUpcoming[0].id === 'future-25',
  JSON.stringify(computedUpcoming.map((e) => e.id)),
);

// --- Règle explicite du brief : un événement daté SANS heure reste "à venir" jusqu'à la fin de
// son propre jour calendaire — jamais exclu à l'instant même où "aujourd'hui" a commencé. -----
check(
  '19/09 sans heure, référence 19/09 12h -> encore "à venir" (même jour, pas d\'heure)',
  isUpcomingEvent({ id: 'today-no-time', date: '2026-09-19' }, REFERENCE) === true,
);
check(
  '19/09 sans heure, référence 19/09 23h59 -> encore "à venir" jusqu\'à la fin du jour',
  isUpcomingEvent({ id: 'today-no-time-late', date: '2026-09-19' }, new Date(2026, 8, 19, 23, 59, 0)) === true,
);

// --- Un événement avec une heure précise compare date ET heure, pas seulement la date --------
check(
  '19/09 08h00, référence 19/09 12h00 -> déjà passé (l\'horaire est dépassé)',
  isUpcomingEvent({ id: 'today-am', date: '2026-09-19', startTime: '08:00' }, REFERENCE) === false,
);
check(
  '19/09 18h00, référence 19/09 12h00 -> encore à venir (l\'horaire n\'est pas encore là)',
  isUpcomingEvent({ id: 'today-pm', date: '2026-09-19', startTime: '18:00' }, REFERENCE) === true,
);
check(
  '19/09 12h00 pile, référence 19/09 12h00 pile -> encore à venir (limite inclusive)',
  isUpcomingEvent({ id: 'today-exact', date: '2026-09-19', startTime: '12:00' }, REFERENCE) === true,
);

// --- Un événement sans `date` du tout (cas inattendu, jamais un anniversaire — voir le
// commentaire de la fonction) ne doit jamais être masqué silencieusement. -----------------------
check(
  'Événement sans `date` -> considéré "à venir" par défaut (jamais masqué silencieusement)',
  isUpcomingEvent({ id: 'no-date' }, REFERENCE) === true,
);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
