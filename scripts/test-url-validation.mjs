// V7.14 (phase 3, item 11) — validation du champ "Lien" d'AddShareSheet.jsx.
import { isValidAbsoluteUrl } from '../src/urlValidation.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${expected}, obtenu ${actual}`); fail++; }
}

check('1. URL https valide', isValidAbsoluteUrl('https://exemple.fr/page'), true);
check('2. URL http valide', isValidAbsoluteUrl('http://exemple.fr'), true);
check('3. Vide -> invalide', isValidAbsoluteUrl(''), false);
check('4. Espaces seuls -> invalide', isValidAbsoluteUrl('   '), false);
check('5. Texte non-URL -> invalide', isValidAbsoluteUrl('pas une url'), false);
check('6. URL relative (sans protocole) -> invalide', isValidAbsoluteUrl('exemple.fr/page'), false);
check('7. www sans protocole -> invalide', isValidAbsoluteUrl('www.exemple.fr'), false);
check('8. javascript: refusé (sécurité)', isValidAbsoluteUrl('javascript:alert(1)'), false);
check('9. data: refusé', isValidAbsoluteUrl('data:text/html,<script>1</script>'), false);
check('10. file: refusé', isValidAbsoluteUrl('file:///etc/passwd'), false);
check('11. Espaces en trop autour d\'une URL valide -> acceptée (trim)', isValidAbsoluteUrl('  https://exemple.fr  '), true);
check('12. mailto: refusé (pas http/https)', isValidAbsoluteUrl('mailto:a@b.fr'), false);
check('13. URL avec port explicite', isValidAbsoluteUrl('https://exemple.fr:8080/chemin'), true);
check('14. null -> invalide, sans exception', isValidAbsoluteUrl(null), false);
check('15. undefined -> invalide, sans exception', isValidAbsoluteUrl(undefined), false);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
