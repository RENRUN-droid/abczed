// Point 2 (recette réelle sur PC) : tests dédiés aux fonctions pures de src/attendeeNames.js —
// importent le vrai code de production, comme les autres modules de logique du projet.
import { resizeNames, cleanNames, buildAttendeeNames, attendeeNamesLine } from '../src/attendeeNames.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// resizeNames : tronque, complète par des chaînes vides — jamais un nom inventé.
check('1. resizeNames agrandit avec des chaînes vides', resizeNames(['Léa'], 3), ['Léa', '', '']);
check('2. resizeNames tronque l\'excédent', resizeNames(['Léa', 'Tom', 'Ana'], 1), ['Léa']);
check('3. resizeNames vers 0 -> tableau vide', resizeNames(['Léa'], 0), []);
check('4. resizeNames identique -> inchangé', resizeNames(['Léa', 'Tom'], 2), ['Léa', 'Tom']);

// cleanNames : trim + retire les entrées vides.
check('5. cleanNames trim et retire les vides', cleanNames([' Léa ', '', '  ', 'Tom']), ['Léa', 'Tom']);
check('6. cleanNames sur tableau entièrement vide', cleanNames(['', '  ']), []);

// buildAttendeeNames : null si rien saisi, sinon {adults, children} nettoyés.
check('7. buildAttendeeNames -> null si rien saisi (adultes et enfants vides)', buildAttendeeNames(['', ''], []), null);
check('8. buildAttendeeNames -> objet avec adultes seuls', buildAttendeeNames(['Léa', ''], []), { adults: ['Léa'], children: [] });
check('9. buildAttendeeNames -> objet avec adultes et enfants', buildAttendeeNames(['Léa', 'Tom'], ['Ana']), { adults: ['Léa', 'Tom'], children: ['Ana'] });
check('10. buildAttendeeNames -> objet même si seuls des enfants sont nommés', buildAttendeeNames([], ['Ana']), { adults: [], children: ['Ana'] });

// attendeeNamesLine : chaîne vide si null, sinon adultes puis enfants, joints par ", ".
check('11. attendeeNamesLine(null) -> chaîne vide', attendeeNamesLine(null), '');
check('12. attendeeNamesLine -> adultes puis enfants, joints', attendeeNamesLine({ adults: ['Léa', 'Tom'], children: ['Ana'] }), 'Léa, Tom, Ana');
check('13. attendeeNamesLine -> adultes seuls', attendeeNamesLine({ adults: ['Léa'], children: [] }), 'Léa');

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
