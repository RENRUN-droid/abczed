// V7.7 (P2/P9) : test qui EXÉCUTE le code de production, pas une reproduction — import direct
// de src/avatarColor.js, le même module que src/messagesApi.js utilise réellement pour dériver
// couleur/initiales d'un message réel (author_id uuid + members.display_name), sans nouvelle
// colonne arbitraire en base (brief explicite).
import { avatarColorFor, initialsOf } from '../src/avatarColor.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// 1. Déterminisme : le même id produit TOUJOURS la même couleur (condition nécessaire, rien
// n'est stocké en base pour ça — chaque appareil/session doit retomber sur la même valeur).
const idA = '11111111-1111-1111-1111-111111111111';
const idB = '22222222-2222-2222-2222-222222222222';
check('1. Même id -> même couleur (appel 1)', avatarColorFor(idA), avatarColorFor(idA));
check('2. Même id -> même couleur (appel répété, 10 fois)', Array.from({ length: 10 }, () => avatarColorFor(idA)).every((c) => c === avatarColorFor(idA)), true);

// 2. Deux ids différents ne sont pas garantis distincts (palette finie), mais dans ce cas précis
// ils tombent sur des couleurs différentes — vérifie que le hash ne renvoie pas une constante.
check('3. Deux ids différents ne donnent pas systématiquement la même couleur', avatarColorFor(idA) !== avatarColorFor(idB), true);

// 3. Toujours une couleur de la palette fixe (jamais une valeur hors palette, jamais undefined).
const PALETTE = [
  '#C9A6D4', '#E7A6B0', '#9BB7D4', '#9BD4C0', '#E7C89B',
  '#D4A69B', '#A6C9D4', '#D4C9A6', '#B8A6D4', '#A6D4B8',
];
check('4. avatarColorFor renvoie toujours une couleur de la palette fixe', PALETTE.includes(avatarColorFor(idA)), true);
check('5. avatarColorFor(undefined) ne plante pas et renvoie une couleur de la palette', PALETTE.includes(avatarColorFor(undefined)), true);
check('6. avatarColorFor(null) ne plante pas et renvoie une couleur de la palette', PALETTE.includes(avatarColorFor(null)), true);
check('7. avatarColorFor("") ne plante pas et renvoie une couleur de la palette', PALETTE.includes(avatarColorFor('')), true);

// 4. Initiales : jusqu'à 2 lettres, une par mot, jamais un fragment d'uuid ni une valeur inventée.
check('8. initialsOf("Sabrina Vally") -> "SV" (comme la donnée de démonstration existante)', initialsOf('Sabrina Vally'), 'SV');
check('9. initialsOf("Marie") -> "M" (un seul mot, une seule lettre)', initialsOf('Marie'), 'M');
check('10. initialsOf("  Jean   Paul  ") -> "JP" (espaces multiples/en bord ignorés)', initialsOf('  Jean   Paul  '), 'JP');
check('11. initialsOf(nom à 3 mots) -> 2 lettres seulement (les 2 premiers mots)', initialsOf('Marie Claire Dupont'), 'MC');
check('12. initialsOf("") -> "?" (jamais planter, jamais deviner)', initialsOf(''), '?');
check('13. initialsOf(undefined) -> "?"', initialsOf(undefined), '?');
check('14. initialsOf(null) -> "?"', initialsOf(null), '?');
check('15. initialsOf("membre") (repli neutre "Membre" en minuscule ici pour le test) -> "M"', initialsOf('membre'), 'M');
check('16. initialsOf minuscule -> initiale mise en MAJUSCULE ("marie dupont" -> "MD")', initialsOf('marie dupont'), 'MD');

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail ? 1 : 0);
