// Brief §14/§33 : tests dédiés à l'invalidation de selectedDate et à la déduplication des
// pastilles par catégorie — importent le vrai code de production (src/agendaSearch.js),
// pas une reproduction séparée.
import { computeFilteredEvents, isSelectedDateStillValid, distinctCategoriesOf, impliedCategoryOf, peopleCountOf, familiesCountOf } from '../src/agendaSearch.js';

const events = [
  { id: 'e1', category: 'ecole', title: 'Réunion École', date: '2026-09-15' },
  { id: 'e2', category: 'sortie', title: 'Sortie piscine', date: '2026-09-15' },
  { id: 'e3', category: 'sortie', title: 'Sortie parc', date: '2026-09-15' },
  { id: 'e4', category: 'autre', title: 'Vide-grenier', date: '2026-09-20' },
];

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${expected}, obtenu ${actual}`); fail++; }
}
function checkArr(label, actual, expected) {
  const a = actual.slice().sort().join(',');
  const e = expected.slice().sort().join(',');
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu [${e}], obtenu [${a}]`); fail++; }
}

// §14 : selectedDate reste valide tant qu'elle contient un événement dans l'ensemble filtré.
const ecoleOnly = computeFilteredEvents(events, 'ecole', '');
check('1. 15 sept valide sous École (contient e1)', isSelectedDateStillValid(ecoleOnly, '2026-09-15'), true);

// §14 : passer à un filtre où cette date n'a plus d'événement -> devient invalide.
const autreOnly = computeFilteredEvents(events, 'autre', '');
check('2. 15 sept devient invalide sous Autres (aucun événement ce jour dans ce filtre)', isSelectedDateStillValid(autreOnly, '2026-09-15'), false);

// §14 : le 20 sept reste valide sous Autres.
check('3. 20 sept valide sous Autres (contient e4)', isSelectedDateStillValid(autreOnly, '2026-09-20'), true);

// §14 : aucune date sélectionnée -> toujours "valide" (rien à invalider).
check('4. Pas de date sélectionnée -> valide par convention', isSelectedDateStillValid(events, null), true);

// §12 : deux sorties le même jour -> UNE seule catégorie "sortie", pas deux pastilles vertes.
const day15AllCats = computeFilteredEvents(events, 'tous', '');
const day15Events = day15AllCats.filter((e) => e.date === '2026-09-15');
checkArr('5. Pastilles du 15 sept = catégories présentes, dédupliquées', distinctCategoriesOf(day15Events), ['ecole', 'sortie']);

// §12 : aucun événement -> aucune catégorie.
checkArr('6. Aucun événement -> aucune pastille', distinctCategoriesOf([]), []);

// Correctif (recette réelle sur PC, point 1) : impliedCategoryOf — mise en évidence dérivée
// d'une date sélectionnée, sans jamais modifier le filtre réel.
const day20 = events.filter((e) => e.date === '2026-09-20'); // e4 seul, catégorie "autre"
check('7. Filtre "tous" + jour à catégorie unique -> cette catégorie est implicite', impliedCategoryOf('tous', day20), 'autre');
check('8. Filtre "tous" + jour multi-catégories (École + Sorties) -> null, pas de masquage d\'une catégorie au profit d\'une autre', impliedCategoryOf('tous', day15Events), null);
check('9. Filtre déjà sur une catégorie précise -> jamais de catégorie implicite (aucune ambiguïté à résoudre)', impliedCategoryOf('ecole', day20), null);
check('10. Aucun événement ce jour -> null', impliedCategoryOf('tous', []), null);

// Correctif (point 2, recette réelle sur PC) : peopleCountOf/familiesCountOf ne doivent
// jamais renvoyer undefined, quelle que soit la forme des participants (chaîne simple —
// ancien format démo — ou objet réel {adultsCount, childrenCount}).
check('11. peopleCountOf sur participants "chaîne simple" -> 1 chacun', peopleCountOf(['Parent 1', 'Parent 2', 'Parent 3']), 3);
check('12. familiesCountOf sur participants "chaîne simple"', familiesCountOf(['Parent 1', 'Parent 2', 'Parent 3']), 3);
check(
  '13. peopleCountOf sur participants objets -> somme réelle adultes+enfants',
  peopleCountOf([{ adultsCount: 2, childrenCount: 1 }, { adultsCount: 1, childrenCount: 0 }]),
  4,
);
check(
  '14. familiesCountOf sur participants objets -> nombre de foyers, pas de personnes',
  familiesCountOf([{ adultsCount: 2, childrenCount: 1 }, { adultsCount: 1, childrenCount: 0 }]),
  2,
);
check('15. peopleCountOf/familiesCountOf sur aucun participant -> 0', peopleCountOf([]) + familiesCountOf([]), 0);
check('16. peopleCountOf/familiesCountOf sur undefined -> 0 (jamais undefined)', peopleCountOf(undefined) + familiesCountOf(undefined), 0);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
