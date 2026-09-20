// Tests de src/resolveEvent.js — 6e passe.
// Couvre explicitement le cas qui a échappé aux 83 tests précédents : un événement absent des
// événements "live" (agenda réel) mais présent dans les événements de démonstration (le cas
// réel de 'evt-piscine', référencé par des messages/partages mockés alors que l'agenda, lui,
// vient de Supabase depuis AGENDA_FROM_SUPABASE=true).
import { resolveEventById } from '../src/resolveEvent.js';

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}`); fail++; }
}

const live = [
  { id: 'evt-live-1', title: 'Événement réel Supabase' },
  { id: 'evt-live-2', title: 'Autre événement réel' },
];
const mock = [
  { id: 'evt-piscine', title: 'Sortie piscine — 24 mai' },
  { id: 'evt-live-1', title: 'Version démo (ne doit jamais gagner sur le live)' },
];

ok('1. Trouvé directement dans les événements live', resolveEventById(live, mock, 'evt-live-2')?.title === 'Autre événement réel');

ok(
  '2. Reproduction du bug réel : absent du live, présent seulement en mock (evt-piscine) -> résolu via le repli',
  resolveEventById(live, mock, 'evt-piscine')?.title === 'Sortie piscine — 24 mai',
);

ok(
  '3. Présent dans les DEUX sources -> le live gagne toujours (jamais la version mock qui pourrait être périmée)',
  resolveEventById(live, mock, 'evt-live-1')?.title === 'Événement réel Supabase',
);

ok('4. Absent des deux sources -> null (pas d’exception)', resolveEventById(live, mock, 'evt-inconnu') === null);

ok('5. id null -> null sans même chercher', resolveEventById(live, mock, null) === null);

ok('6. id undefined -> null', resolveEventById(live, mock, undefined) === null);

ok('7. Événements live vides (agenda pas encore chargé) -> repli mock fonctionne quand même', resolveEventById([], mock, 'evt-piscine')?.title === 'Sortie piscine — 24 mai');

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
