// Test qui EXÉCUTE le code de production, pas une reproduction : import direct de
// src/reactions.js, le même module que src/pages/Messages.jsx et src/App.jsx utilisent
// réellement (delta pts 26-28, arbitrage D3).
import { reactionSummary, toggleReaction, REACTION_EMOJIS } from '../src/reactions.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

const base = [
  { userId: 'mem-marie', displayName: 'Marie', emoji: '❤️' },
  { userId: 'mem-thomas', displayName: 'Thomas', emoji: '❤️' },
  { userId: 'mem-sophie', displayName: 'Sophie', emoji: '👍' },
];

// 1. Résumé : compte, "mine", personnes — dérivés, jamais stockés.
const summary = reactionSummary(base, 'mem-marie');
check('1. reactionSummary regroupe par émoji (2 groupes)', summary.length, 2);
const heart = summary.find((r) => r.emoji === '❤️');
check('2. Compte ❤️ = 2', heart.count, 2);
check('3. mine=true pour mem-marie sur ❤️', heart.mine, true);
check('4. people liste bien Marie et Thomas', heart.people.sort(), ['Marie', 'Thomas'].sort());
const thumb = summary.find((r) => r.emoji === '👍');
check('5. mine=false pour mem-marie sur 👍 (n\'a pas réagi ainsi)', thumb.mine, false);

// 2. reactionSummary sur une liste vide/absente -> tableau vide, jamais d'exception.
check('6. reactionSummary([]) = []', reactionSummary([], 'mem-vous'), []);
check('7. reactionSummary(undefined) = []', reactionSummary(undefined, 'mem-vous'), []);

// 3. toggleReaction : ajout d'une personne qui n'a pas encore réagi.
const afterAdd = toggleReaction(base, { userId: 'mem-vous', displayName: 'Vous', emoji: '😮' });
check('8. Ajout : une entrée de plus', afterAdd.length, base.length + 1);
check('9. Ajout : mem-vous présent avec 😮', afterAdd.some((r) => r.userId === 'mem-vous' && r.emoji === '😮'), true);
check('10. Ajout : ne mute PAS le tableau reçu (pureté)', base.length, 3);

// 4. toggleReaction : re-taper sa propre réaction identique -> la retire.
const afterRemove = toggleReaction(base, { userId: 'mem-marie', displayName: 'Marie', emoji: '❤️' });
check('11. Retrait : une entrée de moins', afterRemove.length, base.length - 1);
check('12. Retrait : mem-marie n\'a plus de réaction', afterRemove.some((r) => r.userId === 'mem-marie'), false);
check('13. Retrait : Thomas garde la sienne (pas de sur-suppression)', afterRemove.some((r) => r.userId === 'mem-thomas'), true);

// 5. toggleReaction : changer d'émoji -> une seule réaction active par personne (jamais deux).
const afterChange = toggleReaction(base, { userId: 'mem-marie', displayName: 'Marie', emoji: '😢' });
check('14. Changement : toujours 3 entrées (remplacement, pas ajout)', afterChange.length, 3);
check('15. Changement : mem-marie a exactement une réaction', afterChange.filter((r) => r.userId === 'mem-marie').length, 1);
check('16. Changement : la nouvelle est 😢', afterChange.find((r) => r.userId === 'mem-marie').emoji, '😢');

check('17. 5 émojis proposés dans le sélecteur', REACTION_EMOJIS.length, 5);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
