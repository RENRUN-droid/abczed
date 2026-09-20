// Test qui EXÉCUTE le code de production, pas une reproduction : import direct de
// src/messageSearch.js, le même module que src/pages/Messages.jsx utilise réellement
// (delta pts 31-32/61 : tri chronologique défensif, jamais une confiance aveugle dans l'ordre
// d'arrivée du tableau `thread`).
import { computeVisibleMessages, sortMessagesChronologically } from '../src/messageSearch.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// Volontairement dans le DÉSORDRE (pas l'ordre chronologique d'arrivée) — c'est précisément le
// scénario qu'une source de données réelle (réseau, pagination, retries concurrents) peut
// produire, contrairement aux données de démonstration statiques toujours déjà triées.
const shuffled = [
  { id: 'm3', date: '2026-09-10', time: '14:40' },
  { id: 'm1', date: '2026-09-09', time: '09:15' },
  { id: 'm5', date: '2026-09-10', time: '09:21' },
  { id: 'm2', date: '2026-09-09', time: '18:42' },
  { id: 'm4', date: '2026-09-10', time: '10:12' },
];

const ids = (list) => list.map((m) => m.id);
check('1. Tri chronologique correct malgré un tableau mélangé', ids(sortMessagesChronologically(shuffled)), ['m1', 'm2', 'm5', 'm4', 'm3']);

// Stabilité : deux messages au même horodatage exact gardent leur ordre d'origine, jamais
// réordonnés arbitrairement entre eux.
const simultaneous = [
  { id: 'a', date: '2026-09-10', time: '10:00' },
  { id: 'b', date: '2026-09-10', time: '10:00' },
  { id: 'c', date: '2026-09-10', time: '10:00' },
];
check('2. Tri stable : horodatages identiques -> ordre d\'origine conservé', ids(sortMessagesChronologically(simultaneous)), ['a', 'b', 'c']);

// Robustesse : une entrée sans date/heure valide ne fait pas planter le tri, et n'entraîne pas
// la perte des autres messages.
const withBadEntry = [
  { id: 'ok2', date: '2026-09-10', time: '10:00' },
  { id: 'bad', date: null, time: null },
  { id: 'ok1', date: '2026-09-09', time: '10:00' },
];
const sortedBad = sortMessagesChronologically(withBadEntry);
check('3. Entrée sans date : ne plante pas, garde les 3 messages', sortedBad.length, 3);
check('4. Entrée sans date : placée en premier (visible, pas perdue)', sortedBad[0].id, 'bad');

// computeVisibleMessages applique le tri AVANT le filtre par événement lié — les deux vues
// (fil complet et fil filtré) doivent être correctement ordonnées, pas seulement l'une des deux.
const threadWithEvent = [
  { id: 'x2', date: '2026-09-10', time: '10:00', linkedEventId: 'evt-1', text: 'deux' },
  { id: 'x1', date: '2026-09-09', time: '10:00', linkedEventId: 'evt-1', text: 'un' },
];
const filteredView = computeVisibleMessages(threadWithEvent, { id: 'evt-1' }, '', [], '2026-09-11');
check('5. Vue filtrée par événement : chronologique elle aussi', ids(filteredView), ['x1', 'x2']);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
