// Brief §3/§33 : la normalisation partagée (Messages, Partages, La Bande) doit être testée
// en important le vrai module de production, pas une copie — src/searchUtils.js est
// exactement ce qu'Accueil.jsx, Messages.jsx, Partages.jsx et LaBande.jsx importent.
import { normalize, textMatches, anyFieldMatches } from '../src/searchUtils.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${expected}, obtenu ${actual}`); fail++; }
}

check('1. normalize retire les accents', normalize('École'), 'ecole');
check('2. normalize unifie les apostrophes typographiques', normalize('l’école'), "l'ecole");
check('3. normalize insensible à la casse', normalize('PISCINE'), 'piscine');

check('4. textMatches trouve malgré accent+casse', textMatches('Réunion École', 'ecole'), true);
check('5. textMatches sur chaîne vide -> toujours vrai (pas de filtre)', textMatches('quoi que ce soit', ''), true);
check('6. textMatches — aucune correspondance', textMatches('Sortie piscine', 'zoo'), false);

// Brief §21 (Messages) : recherche sur contenu / auteur / pièce jointe.
check('7. anyFieldMatches — trouve via l\'auteur', anyFieldMatches(['Qui peut covoiturer samedi ?', 'Sabrina', null], 'sabrina'), true);
check('8. anyFieldMatches — trouve via le nom de fichier joint', anyFieldMatches([null, 'Julie', 'Autorisation parentale.pdf'], 'autorisation'), true);
check('9. anyFieldMatches — ignore les champs null/undefined sans planter', anyFieldMatches([null, undefined, 'Thomas'], 'thomas'), true);
check('10. anyFieldMatches — aucun champ ne correspond', anyFieldMatches(['a', 'b', 'c'], 'zzz'), false);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
