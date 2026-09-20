// Delta §13/§29 : recherche par date dans Messages — importe directement le code de
// production (src/dateSearch.js et src/messageSearch.js), pas une reproduction séparée.
import { parseDateQuery, messageMatchesDateQuery } from '../src/dateSearch.js';
import { computeVisibleMessages } from '../src/messageSearch.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

const TODAY = '2026-09-12'; // référence fixe, indépendante de la date système réelle

// --- parseDateQuery : les formats explicitement demandés par le brief ---
check('1. "24 mai" -> jour/mois, année non précisée', parseDateQuery('24 mai', TODAY), { day: 24, month: 5, year: null });
check('2. "24/05" -> jour/mois, année non précisée', parseDateQuery('24/05', TODAY), { day: 24, month: 5, year: null });
check('3. "24/05/2026" -> jour/mois/année exacts', parseDateQuery('24/05/2026', TODAY), { day: 24, month: 5, year: 2026 });
check('4. "24-05-2026" (tirets) -> équivalent au format slash', parseDateQuery('24-05-2026', TODAY), { day: 24, month: 5, year: 2026 });
check('5. "24 sept" (abréviation) -> mois 9', parseDateQuery('24 sept', TODAY), { day: 24, month: 9, year: null });
check('6. "24 septembre" (en toutes lettres)', parseDateQuery('24 septembre', TODAY), { day: 24, month: 9, year: null });
check('7. "aujourd\'hui" -> date de référence', parseDateQuery("aujourd'hui", TODAY), { day: 12, month: 9, year: 2026 });
check('8. "hier" -> veille de la date de référence', parseDateQuery('hier', TODAY), { day: 11, month: 9, year: 2026 });
check('9. Insensible à la casse et aux accents ("24 MAI", "24 SEPT")', parseDateQuery('24 MAI', TODAY), { day: 24, month: 5, year: null });

// --- Garde-fou explicite du brief : un nombre nu ne doit JAMAIS être traité comme une date ---
check('10. "24" seul -> pas une date (évite les faux positifs sur les recherches courtes)', parseDateQuery('24', TODAY), null);
check('11. "" (vide) -> pas une date', parseDateQuery('', TODAY), null);
check('12. "bonjour" -> pas une date', parseDateQuery('bonjour', TODAY), null);

// --- messageMatchesDateQuery : jour+mois suffisent si l'année n'est pas précisée, mais
//     l'année compte dès qu'elle est donnée explicitement ---
check('13. "24 mai" retrouve un message du 24 mai, quelle que soit l\'année', messageMatchesDateQuery('2025-05-24', '24 mai', TODAY), true);
check('14. "24 mai" retrouve aussi une AUTRE année (2027-05-24)', messageMatchesDateQuery('2027-05-24', '24 mai', TODAY), true);
check('15. "24/05/2026" refuse une autre année (2025-05-24)', messageMatchesDateQuery('2025-05-24', '24/05/2026', TODAY), false);
check('16. "24/05/2026" accepte l\'année exacte', messageMatchesDateQuery('2026-05-24', '24/05/2026', TODAY), true);
check('17. "hier" retrouve exactement la veille de la référence', messageMatchesDateQuery('2026-09-11', 'hier', TODAY), true);
check('18. "hier" ne retrouve pas un autre jour', messageMatchesDateQuery('2026-09-10', 'hier', TODAY), false);

// --- Intégration : computeVisibleMessages combine texte/auteur/pièce jointe/événement lié
//     ET date, sans que l'utilisateur ait à choisir un mode de recherche (brief §13) ---
const events = [{ id: 'evt-piscine', title: 'Sortie piscine — 24 mai' }];
const thread = [
  { id: 'm1', author: 'Sophie', text: 'Rappel sortie piscine samedi.', date: '2026-05-24', linkedEventId: 'evt-piscine' },
  { id: 'm2', author: 'Thomas', text: 'Merci Sophie !', date: '2026-05-24', linkedEventId: 'evt-piscine' },
  { id: 'm3', author: 'Marie', text: 'Qui a le compte-rendu ?', date: '2026-09-12', linkedEventId: null },
];
const byDateMai = computeVisibleMessages(thread, null, '24 mai', events, TODAY).map((m) => m.id);
check('19. computeVisibleMessages("24 mai") retrouve m1 et m2 (date réelle), pas m3', byDateMai.sort(), ['m1', 'm2']);

const byDateSlash = computeVisibleMessages(thread, null, '24/05', events, TODAY).map((m) => m.id);
check('20. computeVisibleMessages("24/05") — même résultat que "24 mai"', byDateSlash.sort(), ['m1', 'm2']);

const byToday = computeVisibleMessages(thread, null, "aujourd'hui", events, TODAY).map((m) => m.id);
check('21. computeVisibleMessages("aujourd\'hui") retrouve m3 (daté de la référence)', byToday, ['m3']);

// Delta §12 : le TITRE de l'événement lié doit matcher même s'il n'apparaît nulle part dans
// le texte du message — "piscine" seul y suffisait déjà par coïncidence, "Sortie piscine —
// 24 mai" (titre exact, tiret cadratin compris) ne doit plus dépendre de cette coïncidence.
const threadNoCoincidence = [
  { id: 'm4', author: 'Julie', text: 'Voici le document.', date: '2026-05-20', linkedEventId: 'evt-piscine', file: { name: 'doc.pdf' } },
];
const byExactTitle = computeVisibleMessages(threadNoCoincidence, null, 'Sortie piscine — 24 mai', events, TODAY).map((m) => m.id);
check('22. Le titre exact de l\'événement lié retrouve le message même sans coïncidence textuelle', byExactTitle, ['m4']);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
