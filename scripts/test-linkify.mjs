// V7.77 (19 nov.) — détection des liens dans un texte libre (src/linkify.js).
import { linkifySegments } from '../src/linkify.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}\n   attendu ${e}\n   obtenu  ${a}`); fail++; }
}
const links = (t) => linkifySegments(t).filter((s) => s.type === 'link').map((s) => s.href);
const rebuilt = (t) => linkifySegments(t).map((s) => s.value).join('');

check('1. Texte sans lien -> 1 segment texte', linkifySegments('Sortie piscine mardi'), [{ type: 'text', value: 'Sortie piscine mardi' }]);
check('2. Lien https au milieu', links('Infos ici https://ecole-grandfond.re/sortie puis retour'), ['https://ecole-grandfond.re/sortie']);
check('3. Point final exclu', links('Voir https://ecole.fr.'), ['https://ecole.fr']);
check('4. Virgule / point-virgule exclus', links('a https://a.fr, b https://b.fr;'), ['https://a.fr', 'https://b.fr']);
check('5. Parenthèse fermante hors lien exclue', links('(voir https://exemple.fr/page)'), ['https://exemple.fr/page']);
check('6. Parenthèses internes conservées', links('https://fr.wikipedia.org/wiki/Saint-Paul_(La_Réunion)'), ['https://fr.wikipedia.org/wiki/Saint-Paul_(La_Réunion)']);
check('7. www. -> https:// ajouté', links('Billetterie www.reunion.fr/agenda !'), ['https://www.reunion.fr/agenda']);
check('8. javascript: jamais cliquable', links('javascript:alert(1)'), []);
check('9. "www." seul -> texte', links('tapez www. puis le site'), []);
check('10. Plusieurs lignes, 2 liens', links('Ligne 1 https://a.fr\nLigne 2 http://b.fr/x?y=1&z=2'), ['https://a.fr', 'http://b.fr/x?y=1&z=2']);
check('11. Texte reconstruit à l\'identique', rebuilt('Voir (https://a.fr/x). Merci » www.b.fr…'), 'Voir (https://a.fr/x). Merci » www.b.fr…');
check('12. Guillemet français fermant exclu', links('« https://a.fr/doc »'), ['https://a.fr/doc']);
check('13. null/undefined -> aucun segment', [linkifySegments(null), linkifySegments(undefined)], [[], []]);
check('14. Lien YouTube avec paramètres', links('Vidéo : https://www.youtube.com/watch?v=abc123&t=42s'), ['https://www.youtube.com/watch?v=abc123&t=42s']);

console.log(`\n${pass} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
