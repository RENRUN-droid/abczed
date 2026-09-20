// P1 (exercice de correction V7.5) : tests dédiés à src/router.js — importent le vrai code de
// production, comme les autres modules de logique pure du projet.
import { pathForState, stateForPath, URL_SECTIONS } from '../src/router.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// --- pathForState : une destination navigable par section ---
check('1. accueil -> "/"', pathForState('accueil'), '/');
check('2. agenda -> "/agenda"', pathForState('agenda'), '/agenda');
check('3. messages -> "/messages"', pathForState('messages'), '/messages');
check('4. partages -> "/partages"', pathForState('partages'), '/partages');
check('5. labande -> "/labande"', pathForState('labande'), '/labande');
check('6. vue inconnue -> repli "/" (jamais un chemin vide/incohérent)', pathForState('thread'), '/');
check('7. les 5 sections connues sont exactement celles attendues', [...URL_SECTIONS].sort(), ['accueil', 'agenda', 'labande', 'messages', 'partages'].sort());

// --- pathForState : fiche événement, avec origine ---
check('8. event-detail avec origine connue -> id + ?from=origine', pathForState('event-detail', 'evt-42', 'agenda'), '/evenement/evt-42?from=agenda');
check('9. event-detail avec origine "thread" (non représentée dans l\'URL) -> pas de ?from du tout', pathForState('event-detail', 'evt-42', 'thread'), '/evenement/evt-42');
check('10. event-detail sans origine -> pas de ?from', pathForState('event-detail', 'evt-42'), '/evenement/evt-42');
check('11. event-detail sans id -> repli "/" (jamais une URL de fiche vide)', pathForState('event-detail', null, 'agenda'), '/');
check('12. id d\'événement contenant des caractères à encoder -> encodé dans l\'URL', pathForState('event-detail', 'evt/étrange?', 'agenda'), '/evenement/evt%2F%C3%A9trange%3F?from=agenda');

// --- stateForPath : la restauration symétrique (round-trip) ---
check('13. "/" -> accueil', stateForPath('/', ''), { view: 'accueil' });
check('14. "/agenda" -> agenda', stateForPath('/agenda', ''), { view: 'agenda' });
check('15. "/messages" -> messages', stateForPath('/messages', ''), { view: 'messages' });
check('16. "/partages" -> partages', stateForPath('/partages', ''), { view: 'partages' });
check('17. "/labande" -> labande', stateForPath('/labande', ''), { view: 'labande' });
check('18. chemin non reconnu -> repli accueil (jamais une page blanche)', stateForPath('/route/inconnue', ''), { view: 'accueil' });
check('19. "/evenement/evt-42?from=agenda" -> event-detail, origine restaurée', stateForPath('/evenement/evt-42', '?from=agenda'), { view: 'event-detail', eventId: 'evt-42', eventOrigin: 'agenda' });
check('20. "/evenement/evt-42" sans ?from -> origine par défaut "agenda"', stateForPath('/evenement/evt-42', ''), { view: 'event-detail', eventId: 'evt-42', eventOrigin: 'agenda' });
check('21. "?from=" avec une origine non reconnue (ex. injectée à la main) -> repli "agenda", jamais une valeur arbitraire', stateForPath('/evenement/evt-42', '?from=thread'), { view: 'event-detail', eventId: 'evt-42', eventOrigin: 'agenda' });
check('22. round-trip complet : pathForState puis stateForPath redonnent le même événement+origine', stateForPath(new URL('http://x' + pathForState('event-detail', 'evt-99', 'messages')).pathname, new URL('http://x' + pathForState('event-detail', 'evt-99', 'messages')).search), { view: 'event-detail', eventId: 'evt-99', eventOrigin: 'messages' });
check('23. id encodé dans l\'URL est bien décodé à la lecture', stateForPath('/evenement/evt%2F%C3%A9trange%3F', '?from=agenda'), { view: 'event-detail', eventId: 'evt/étrange?', eventOrigin: 'agenda' });

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
