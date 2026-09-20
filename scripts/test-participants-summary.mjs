// P2 (exercice de correction V7.5) : tests dédiés au résumé participants affiché sur la carte
// Agenda — importent le vrai code de production (agendaSearch.js), pas une reproduction.
import { eventModeOf, participantsSummaryLabel } from '../src/agendaSearch.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// --- eventModeOf (partagé Agenda.jsx / EventDetail.jsx) ---
check('1. catégorie non-"sortie" -> "simple"', eventModeOf({ category: 'anniversaire' }), 'simple');
check('2. "sortie" + subtype "sortie_ecole" -> "accompaniment"', eventModeOf({ category: 'sortie', subtype: 'sortie_ecole' }), 'accompaniment');
check('3. "sortie" sans subtype école -> "family"', eventModeOf({ category: 'sortie', subtype: 'sortie_famille' }), 'family');

// --- participantsSummaryLabel : cas 0 participant -> chaîne vide (aucun résumé affiché) ---
check('4. aucun participant -> chaîne vide', participantsSummaryLabel([]), '');
check('5. participants undefined -> chaîne vide', participantsSummaryLabel(undefined), '');

// --- accords singulier/pluriel ---
check(
  '6. 1 participant, 1 adulte, 0 enfant -> singulier, "enfant" omis entièrement',
  participantsSummaryLabel([{ adultsCount: 1, childrenCount: 0 }]),
  '1 participant · 1 adulte'
);
check(
  '7. exemple du brief : 3 participants, 2 adultes, 1 enfant',
  participantsSummaryLabel([{ adultsCount: 2, childrenCount: 1 }]),
  '3 participants · 2 adultes · 1 enfant'
);
check(
  '8. 2 participants, 2 adultes, 0 enfant -> "enfant" omis, jamais "0 enfant"',
  participantsSummaryLabel([{ adultsCount: 2, childrenCount: 0 }]),
  '2 participants · 2 adultes'
);
check(
  '9. uniquement des enfants (0 adulte) -> "adulte" omis, jamais "0 adulte"',
  participantsSummaryLabel([{ adultsCount: 0, childrenCount: 2 }]),
  '2 participants · 2 enfants'
);
check(
  '10. plusieurs foyers cumulés (2 puis 1 participant) -> totaux additionnés',
  participantsSummaryLabel([{ adultsCount: 2, childrenCount: 1 }, { adultsCount: 1, childrenCount: 0 }]),
  '4 participants · 3 adultes · 1 enfant'
);
check(
  '11. participant "chaîne simple" (ancien format démo) -> compte 1 adulte, 0 enfant (repli déjà utilisé ailleurs)',
  participantsSummaryLabel(['Jean Dupont']),
  '1 participant · 1 adulte'
);
check(
  '12. aucun prénom dans le résumé (le brief l\'exige explicitement)',
  /Jean|Dupont/.test(participantsSummaryLabel([{ adultsCount: 1, childrenCount: 0, names: ['Jean'] }])),
  false
);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
