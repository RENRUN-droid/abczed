// Delta §2.2/§26/§29 : mémoire de navigation (scroll + focus déclencheur par page) —
// importe directement les fonctions pures de production (src/navMemory.js), les mêmes que
// App.jsx utilise comme mutateurs d'état (setNavMemory(captureNavState(...))).
import { captureNavState, clearNavState } from '../src/navMemory.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// --- Capture ---
const afterFirstCapture = captureNavState({}, 'partages', 420, 'share-linkbtn-sh-photos-zoo');
check('1. Capture initiale : nouvelle entrée pour la page', afterFirstCapture, {
  partages: { scrollY: 420, focusId: 'share-linkbtn-sh-photos-zoo' },
});

const withTwoPages = captureNavState(afterFirstCapture, 'messages', 900, 'msg-event-btn-m1');
check('2. Capture sur une autre page : les deux entrées coexistent', withTwoPages, {
  partages: { scrollY: 420, focusId: 'share-linkbtn-sh-photos-zoo' },
  messages: { scrollY: 900, focusId: 'msg-event-btn-m1' },
});

check('3. Capture sans focusId (ex. Accueil, §26 : scroll seul) -> focusId null', captureNavState({}, 'accueil', 150), {
  accueil: { scrollY: 150, focusId: null },
});

// Une nouvelle capture sur une page déjà présente REMPLACE l'ancienne (dernier départ fait foi).
const recaptured = captureNavState(withTwoPages, 'partages', 800, 'share-linkbtn-sh-autorisation');
check('4. Recapturer une page existante remplace son entrée (pas un empilement)', recaptured.partages, { scrollY: 800, focusId: 'share-linkbtn-sh-autorisation' });
check('5. ...sans toucher les autres pages déjà mémorisées', recaptured.messages, { scrollY: 900, focusId: 'msg-event-btn-m1' });

// --- Consommation (retour) ---
const afterConsume = clearNavState(withTwoPages, 'messages');
check('6. clearNavState retire uniquement la page consommée', afterConsume, {
  partages: { scrollY: 420, focusId: 'share-linkbtn-sh-photos-zoo' },
});
check('7. Consommer une page absente ne lève pas d\'erreur et ne change rien', clearNavState(afterConsume, 'labande'), afterConsume);

// Immuabilité : les fonctions ne doivent jamais muter l'objet reçu (React s'appuie sur des
// références nouvelles pour redéclencher un rendu) — le test échouerait silencieusement à la
// prochaine capture si une mutation en place avait lieu.
const original = { agenda: { scrollY: 10, focusId: 'agenda-row-e1' } };
captureNavState(original, 'agenda', 999, 'agenda-row-e2');
check('8. captureNavState ne mute pas l\'objet passé en entrée', original, { agenda: { scrollY: 10, focusId: 'agenda-row-e1' } });
clearNavState(original, 'agenda');
check('9. clearNavState ne mute pas non plus l\'objet passé en entrée', original, { agenda: { scrollY: 10, focusId: 'agenda-row-e1' } });

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
