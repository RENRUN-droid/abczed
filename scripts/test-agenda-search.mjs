// Test qui EXÉCUTE le code de production, pas une reproduction : import direct de
// src/agendaSearch.js, le même module que src/pages/Agenda.jsx utilise réellement.
import { computeFilteredEvents, eventsOnDate, upcomingExcludingSelected, normalize } from '../src/agendaSearch.js';

const events = [
  { id: 'e1', category: 'sortie', title: 'Sortie piscine', location: 'Piscine municipale', date: '2026-09-10' },
  { id: 'e2', category: 'ecole', title: 'Réunion École maternelle', location: 'École Jean Moulin', date: '2026-09-14' },
  { id: 'e3', category: 'autre', title: 'Vide-grenier', location: '', date: '2026-09-10' },
  { id: 'e4', category: 'anniversaire', title: "Anniversaire d'Emma", day: 24, month: 5 },
  { id: 'e5', category: 'sortie', title: 'Sortie au zoo', location: 'Zoo de Vincennes', date: '2026-09-20' },
  { id: 'e6', category: 'ecole', title: 'Portes ouvertes à L’École', location: '', date: '2026-09-16' },
];

let pass = 0, fail = 0;
function check(label, actualIds, expectedIds) {
  const a = actualIds.slice().sort().join(',');
  const e = expectedIds.slice().sort().join(',');
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu [${e}], obtenu [${a}]`); fail++; }
}
const ids = (list) => list.map((e) => e.id);

check('1. "ecole" (Tous) trouve les titres avec École', ids(computeFilteredEvents(events, 'tous', 'ecole')), ['e2', 'e6']);
check('2. "l\'ecole" trouve "L’École" (apostrophe typo)', ids(computeFilteredEvents(events, 'tous', "l'ecole")), ['e6']);
check('3a. "anniversaire d’Emma" (typo) trouve "Anniversaire d\'Emma"', ids(computeFilteredEvents(events, 'tous', 'anniversaire d’Emma')), ['e4']);
check('3b. "anniversaire d\'Emma" (droite) trouve la même chose', ids(computeFilteredEvents(events, 'tous', "anniversaire d'Emma")), ['e4']);
check('4. "PISCINE" (majuscules)', ids(computeFilteredEvents(events, 'tous', 'PISCINE')), ['e1']);
check('5. Recherche par titre ("zoo")', ids(computeFilteredEvents(events, 'tous', 'zoo')), ['e5']);
check('6. Recherche par lieu ("vincennes")', ids(computeFilteredEvents(events, 'tous', 'vincennes')), ['e5']);
check('7. Terme inexistant -> zéro résultat', ids(computeFilteredEvents(events, 'tous', 'xyzabc123')), []);
check('8a. Chaîne vide + Tous', ids(computeFilteredEvents(events, 'tous', '')), ['e1','e2','e3','e4','e5','e6']);
check('8b. Chaîne vide + Sorties', ids(computeFilteredEvents(events, 'sortie', '')), ['e1','e5']);
check('9. "sortie" + Tous', ids(computeFilteredEvents(events, 'tous', 'sortie')), ['e1','e5']);
check('10. "zoo" + Sorties', ids(computeFilteredEvents(events, 'sortie', 'zoo')), ['e5']);
check('11. "ecole" + École (catégorie)', ids(computeFilteredEvents(events, 'ecole', 'ecole')), ['e2','e6']);
check('12. "ecole" + Autres (catégorie) -> vide', ids(computeFilteredEvents(events, 'autre', 'ecole')), []);
check('13. "zoo" isole un seul événement', ids(computeFilteredEvents(events, 'tous', 'zoo')), ['e5']);

const filteredTous = computeFilteredEvents(events, 'tous', '');
const day10 = eventsOnDate(filteredTous, new Date(2026, 8, 10));
const subsetOk = day10.every((e) => filteredTous.some((f) => f.id === e.id));
console.log(subsetOk ? '✅ 14. eventsOnDate(10 sept) est un sous-ensemble cohérent de filtered' : '❌ 14. INCOHERENCE');
subsetOk ? pass++ : fail++;

const filteredPiscine = computeFilteredEvents(events, 'tous', 'piscine');
const day10Piscine = eventsOnDate(filteredPiscine, new Date(2026, 8, 10));
check('15. Anti-duplication : panneau du 10 sept avec recherche "piscine"', ids(day10Piscine), ['e1']);
const upcomingAfter = upcomingExcludingSelected(filteredPiscine, day10Piscine);
check('15b. "À venir" exclut bien e1 après sélection du 10 sept', ids(upcomingAfter), []);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
