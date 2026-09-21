// V7.18 : test qui EXÉCUTE le code de production, pas une reproduction — import direct de
// src/memberDirectory.js, le même module que src/membersApi.js utilise réellement pour
// traduire une ligne `members` (+ member_children/children imbriqués) Supabase vers la forme
// attendue par LaBande.jsx/MemberDetail.jsx/Accueil.jsx. Même patron que
// scripts/test-avatar-color.mjs.
import { splitDisplayName, mapMemberRow, mapMemberRows } from '../src/memberDirectory.js';
import { avatarColorFor } from '../src/avatarColor.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// 1. splitDisplayName — même heuristique "premier mot = prénom" que partout ailleurs dans ce
// projet pour un nom saisi librement.
check('1. splitDisplayName("Sabrina Vally") -> prénom/nom séparés', splitDisplayName('Sabrina Vally'), { firstName: 'Sabrina', lastName: 'Vally' });
check('2. splitDisplayName("Marie") (un seul mot) -> nom vide, jamais undefined', splitDisplayName('Marie'), { firstName: 'Marie', lastName: '' });
check('3. splitDisplayName("Marie Claire Dupont") -> tout le reste dans lastName', splitDisplayName('Marie Claire Dupont'), { firstName: 'Marie', lastName: 'Claire Dupont' });
check('4. splitDisplayName("  Jean   Paul  ") -> espaces multiples/en bord ignorés', splitDisplayName('  Jean   Paul  '), { firstName: 'Jean', lastName: 'Paul' });
check('5. splitDisplayName("") -> repli "Membre", jamais une chaîne vide affichée nue', splitDisplayName(''), { firstName: 'Membre', lastName: '' });
check('6. splitDisplayName(null) -> même repli, ne plante pas', splitDisplayName(null), { firstName: 'Membre', lastName: '' });
check('7. splitDisplayName(undefined) -> même repli, ne plante pas', splitDisplayName(undefined), { firstName: 'Membre', lastName: '' });

// 2. mapMemberRow — sentinelle 'mem-vous' : le SEUL endroit qui décide "est-ce moi ?", à partir
// du vrai user_id (jamais deviné ailleurs, jamais sur l'id de la ligne members elle-même).
const rowSelf = { id: 'row-1', user_id: 'uid-me', display_name: 'Renaud Thiaudière', role: 'admin', member_children: [] };
const rowOther = { id: 'row-2', user_id: 'uid-other', display_name: 'Sabrina Vally', role: 'member', member_children: [] };
check('8. mapMemberRow — la ligne dont user_id === currentUserId reçoit id="mem-vous"', mapMemberRow(rowSelf, 'uid-me').id, 'mem-vous');
check('9. mapMemberRow — une autre ligne garde son id réel (jamais "mem-vous" pour un tiers)', mapMemberRow(rowOther, 'uid-me').id, 'row-2');
check('10. mapMemberRow — currentUserId absent/null -> jamais "mem-vous" par erreur', mapMemberRow(rowOther, null).id, 'row-2');
check('11. mapMemberRow — userId exposé tel quel (pas seulement l\'id de la ligne members)', mapMemberRow(rowOther, 'uid-me').userId, 'uid-other');
check('12. mapMemberRow — role transmis tel quel', mapMemberRow(rowOther, 'uid-me').role, 'member');
check('13. mapMemberRow — avatarColor dérivé de l\'id de la ligne members (même fonction que le reste de l\'app)', mapMemberRow(rowOther, 'uid-me').avatarColor, avatarColorFor('row-2'));

// 3. mapMemberRow — relations (member_children -> children, vraie FK), forme attendue par
// data.js#childrenOf() côté consommateur ({childId, label, firstName, groupLabel}).
const rowWithKids = {
  id: 'row-3', user_id: 'uid-3', display_name: 'Karim Haddad', role: 'member',
  member_children: [
    { label: 'Papa', children: { id: 'child-1', first_name: 'Yanis', group_label: 'Petite section' } },
    { label: 'Papa', children: { id: 'child-2', first_name: 'Lina', group_label: 'Grande section' } },
  ],
};
check('14. mapMemberRow — relations traduites avec firstName/groupLabel déjà résolus', mapMemberRow(rowWithKids, 'uid-me').relations, [
  { childId: 'child-1', label: 'Papa', firstName: 'Yanis', groupLabel: 'Petite section' },
  { childId: 'child-2', label: 'Papa', firstName: 'Lina', groupLabel: 'Grande section' },
]);
check('15. mapMemberRow — pas d\'enfant -> relations = tableau vide, jamais undefined/null', mapMemberRow(rowOther, 'uid-me').relations, []);
check('16. mapMemberRow — member_children absent (undefined) -> ne plante pas, relations = []', mapMemberRow({ ...rowOther, member_children: undefined }, 'uid-me').relations, []);

// 4. mapMemberRow — une entrée member_children dont `children` est null (ligne enfant supprimée
// entre-temps) est filtrée, jamais un crash ni une relation à moitié vide dans l'UI.
const rowWithDeletedChild = {
  id: 'row-4', user_id: 'uid-4', display_name: 'Amina Cissé', role: 'member',
  member_children: [
    { label: 'Maman', children: null },
    { label: 'Maman', children: { id: 'child-5', first_name: 'Noa', group_label: 'Moyenne section' } },
  ],
};
check('17. mapMemberRow — entrée avec children=null filtrée (jamais un crash)', mapMemberRow(rowWithDeletedChild, 'uid-me').relations, [
  { childId: 'child-5', label: 'Maman', firstName: 'Noa', groupLabel: 'Moyenne section' },
]);

// 5. mapMemberRows — tri alphabétique par prénom (même ordre que la donnée de démonstration
// affichait déjà dans LaBande.jsx), locale 'fr' (accents corrects).
const rows = [
  { id: 'r-a', user_id: 'u-a', display_name: 'Zoé Martin', role: 'member', member_children: [] },
  { id: 'r-b', user_id: 'u-b', display_name: 'Émilie Dubois', role: 'member', member_children: [] },
  { id: 'r-c', user_id: 'u-c', display_name: 'Ahmed Benali', role: 'admin', member_children: [] },
];
check('18. mapMemberRows — tri par prénom, locale fr (accents ordonnés correctement)', mapMemberRows(rows, null).map((m) => m.firstName), ['Ahmed', 'Émilie', 'Zoé']);
check('19. mapMemberRows — tableau vide -> tableau vide, jamais une exception', mapMemberRows([], 'uid-me'), []);
check('20. mapMemberRows — le membre courant est bien repéré même au milieu d\'une liste triée', mapMemberRows(rows, 'u-b').find((m) => m.id === 'mem-vous')?.firstName, 'Émilie');

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail ? 1 : 0);
