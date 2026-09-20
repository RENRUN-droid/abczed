// Correction post-livraison (contre-vérification indépendante) : la persistance locale des
// réglages "Mon profil" (§19/§21) — importe directement la fonction pure de production
// (src/shareFlags.js), la même que App.jsx utilise dans toggleMeShareFlag.
import { toggleShareFlag } from '../src/shareFlags.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

const initial = { share_whatsapp: true, share_phone: false, share_sms: false, share_email: true };

check('1. Inverser un flag à false -> true ne touche que lui', toggleShareFlag(initial, 'share_phone'), {
  share_whatsapp: true, share_phone: true, share_sms: false, share_email: true,
});
check('2. Inverser un flag à true -> false ne touche que lui', toggleShareFlag(initial, 'share_whatsapp'), {
  share_whatsapp: false, share_phone: false, share_sms: false, share_email: true,
});

// Immuabilité : App.jsx s'appuie sur une nouvelle référence pour redéclencher un rendu, et sur
// l'objet d'origine pour rester intact si le composant est réaffiché avant que setState ait
// pris effet (React peut appeler ce genre de fonction plusieurs fois en mode strict).
toggleShareFlag(initial, 'share_sms');
check('3. Ne mute pas l\'objet reçu en entrée', initial, {
  share_whatsapp: true, share_phone: false, share_sms: false, share_email: true,
});

// Scénario reproduisant le bug corrigé : fermer puis rouvrir la modale ne doit PAS revenir à
// l'état initial si l'état est porté par App.jsx (qui ne démonte jamais) plutôt que par un
// useState local à MyProfileSheet (qui, lui, était perdu au démontage). Ce test ne peut pas
// exercer React lui-même (aucune dépendance de test de composants dans ce projet), mais il
// prouve que la fonction de mise à jour est bien pure et composable — condition nécessaire
// pour qu'un état levé dans un parent non démonté fonctionne comme attendu.
let flags = { ...initial };
flags = toggleShareFlag(flags, 'share_email'); // "fermeture" simulée : re-render du parent
flags = toggleShareFlag(flags, 'share_email'); // "réouverture" : la valeur doit être restaurée par le second appel, pas réinitialisée à l'état d'origine du module
check('4. Deux inversions successives (fermer/rouvrir simulé) reviennent bien à la valeur précédente, pas à une valeur figée', flags, initial);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
