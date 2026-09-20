// Lot consolidé UX/navigation (points 1/9/10) — importe directement les fonctions pures de
// production (src/sectionOrigin.js), les mêmes que App.jsx utilise dans enterSection()/goTo().
import { setSectionOrigin, clearSectionOrigin } from '../src/sectionOrigin.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// --- Pose d'une origine (CTA "Voir tous les X" ou lien profond depuis Accueil) ---
check('1. Poser une origine pour "messages"', setSectionOrigin({}, 'messages', 'accueil'), { messages: 'accueil' });

const both = setSectionOrigin(setSectionOrigin({}, 'messages', 'accueil'), 'partages', 'accueil');
check('2. Deux pages peuvent avoir chacune leur origine, indépendamment', both, { messages: 'accueil', partages: 'accueil' });

// --- Effacement (navigation franche : barre du bas, brief point 1 "aucune flèche artificielle") ---
check('3. clearSectionOrigin efface uniquement la page ciblée', clearSectionOrigin(both, 'messages'), { messages: null, partages: 'accueil' });
check('4. Effacer une page déjà à null/absente est un no-op (même référence de contenu)', clearSectionOrigin({}, 'labande'), {});
check('5. Effacer une page dont l\'origine est déjà null ne recrée pas d\'entrée', clearSectionOrigin({ messages: null }, 'messages'), { messages: null });

// --- Immuabilité (React s'appuie sur une nouvelle référence pour redéclencher un rendu) ---
const original = { messages: 'accueil' };
setSectionOrigin(original, 'partages', 'accueil');
check('6. setSectionOrigin ne mute pas l\'objet reçu en entrée', original, { messages: 'accueil' });
clearSectionOrigin(original, 'messages');
check('7. clearSectionOrigin ne mute pas non plus l\'objet reçu en entrée', original, { messages: 'accueil' });

// --- Scénario reproduisant le bug corrigé : le CTA "Voir tous les messages" doit poser la
// même origine qu'un lien profond vers un message précis (avant ce lot, seul le second le
// faisait — le CTA passait par goTo(), qui n'a jamais connu cette notion). ---
const afterViewAllMessages = setSectionOrigin({}, 'messages', 'accueil');
check('8. "Voir tous les messages" pose bien origin=accueil pour messages (bug corrigé)', afterViewAllMessages.messages === 'accueil', true);

// --- Symétrie avec la navigation franche : goTo('messages') doit annuler cette origine, pour
// qu'aucune flèche artificielle n'apparaisse en arrivant par la barre du bas ensuite. ---
check('9. goTo (clearSectionOrigin) annule bien l\'origine posée par un CTA', clearSectionOrigin(afterViewAllMessages, 'messages').messages, null);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
