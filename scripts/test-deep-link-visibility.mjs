// Correction (contre-vérification indépendante, 2e passe) : un lien profond depuis
// l'Accueil doit garantir que sa cible est effectivement rendue, même si Messages/Partages
// avaient un filtre ou une recherche actifs d'une visite précédente qui la masquerait.
// App.jsx réinitialise désormais filter/query à leur état neutre ("tous"/vide) au moment où
// il ouvre le lien profond (openMessageFromAccueil / openShareFromAccueil) — ce test vérifie
// l'invariant au niveau des vraies fonctions de filtrage de production (pas une copie) :
// avec filtre "tous" et recherche vide, TOUT élément est visible, quel que soit son type ou
// son contenu.
import { computeFilteredShares } from '../src/shareSearch.js';
import { computeVisibleMessages } from '../src/messageSearch.js';
import { SHARE_TYPES } from '../src/data.js';

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}`); fail++; }
}

// --- Scénario exact signalé : Partages resté sur le filtre "Documents", l'Accueil cible un
// partage de type "photo" — avant correction, il n'apparaissait dans aucune liste filtrée.
const shares = [
  { id: 'sh-doc', type: 'document', title: 'Autorisation sortie piscine', description: '', author: 'Sabrina', fileName: 'autorisation.pdf' },
  { id: 'sh-photo', type: 'photo', title: 'Photos sortie zoo', description: '', author: 'Thomas' },
  { id: 'sh-lien', type: 'lien', title: 'Menus de la cantine', description: '', author: 'Julie' },
];

const staleFilter = 'document';
const staleQuery = 'autorisation';
const targetId = 'sh-photo';

const beforeFix = computeFilteredShares(shares, staleFilter, staleQuery);
check(
  '1. Reproduction du bug signalé : avec le filtre/recherche resté actif, la cible "photo" N\'est PAS visible',
  !beforeFix.some((s) => s.id === targetId)
);

const afterFix = computeFilteredShares(shares, 'tous', '');
check(
  '2. Correction : avec filtre "tous" + recherche vide (état neutre appliqué par openShareFromAccueil), la cible EST visible',
  afterFix.some((s) => s.id === targetId)
);

// Invariant général : quel que soit le type déclaré dans SHARE_TYPES, un partage de ce type
// reste visible en filtre "tous" + recherche vide — pas seulement pour le cas "photo" testé
// ci-dessus.
const allTypesVisible = Object.keys(SHARE_TYPES).every((type) => {
  const probe = [{ id: 'probe', type, title: 'x', description: '', author: 'y' }];
  return computeFilteredShares(probe, 'tous', '').length === 1;
});
check('3. Tout type de partage (Infos/Documents/Photos/Liens) reste visible en filtre "tous" + recherche vide', allTypesVisible);

// --- Même invariant côté Messages : une recherche restée active ne doit pas pouvoir
// masquer la cible d'un lien profond une fois réinitialisée à vide.
const thread = [
  { id: 'm1', text: 'Bonjour à tous !', author: 'Sophie', linkedEventId: null },
  { id: 'm2', text: 'Qui peut covoiturer samedi ?', author: 'Sabrina', linkedEventId: null },
];
const staleMessageQuery = 'bonjour';
check(
  '4. Reproduction : avec une ancienne recherche "bonjour", le message de Sabrina N\'est PAS visible',
  !computeVisibleMessages(thread, null, staleMessageQuery).some((m) => m.id === 'm2')
);
check(
  '5. Correction : recherche vide (état neutre appliqué par openMessageFromAccueil) -> le message de Sabrina EST visible',
  computeVisibleMessages(thread, null, '').some((m) => m.id === 'm2')
);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
