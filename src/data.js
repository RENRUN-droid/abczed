import { localIso } from './localDate.js';

// Modèle d'événement verrouillé :
// - type 'anniversaire' = rappel minimal SEULEMENT (jour + mois, jamais d'année ni d'âge,
//   pas de participants, pas de "Je viens", jamais proposé dans "Lier à un événement")
// - tous les autres types sont de vrais événements organisables (lieu, horaires, participants)
//
// V7.14 (correctif UAT point 15) : les cinq dates ci-dessous (jour/mois inchangés, ANNÉE
// seule décalée de 2025 à 2032) — jamais une réécriture du jour/mois, pour ne pas invalider le
// texte narratif qui les cite ("24 mai" dans le titre d'evt-piscine et dans le message m1 de
// démonstration, voir plus bas). Cause du décalage : `isUpcomingEvent` (src/agendaSearch.js,
// correctif de cette passe) exclut désormais réellement "À venir"/"Prochain événement" (Agenda.jsx/
// Accueil.jsx) des événements dont la date est passée — ces cinq dates, figées à mai/juin 2025
// lors de l'écriture initiale de ce jeu de démonstration, étaient devenues des dates PASSÉES au
// moment de cette passe (2026-09-19), ce qui masquait entièrement ces événements de "À venir" une
// fois le bug corrigé et cassait, par ricochet, une bonne partie de test-harness/recette.mjs (qui
// s'appuie sur ces événements comme "toujours à venir" pour de nombreux scénarios sans rapport
// avec cette passe — RSVP, prénoms de participants, audit couleur, navigation précédent/suivant...).
// 2032 est un choix délibérément généreux (pas simplement "l'année prochaine") : ce jeu de
// démonstration n'a pas vocation à être retouché à chaque passe corrective future uniquement
// parce que le calendrier a avancé.
export const EVENTS = [
  {
    id: 'evt-piscine',
    category: 'sortie',
    subtype: 'sortie_ecole', // sortie organisée avec l'école -> autorisation possible
    title: 'Sortie piscine — 24 mai',
    date: '2032-05-24',
    startTime: '10:00',
    endTime: '12:00',
    // Delta pt 40/41 (arbitrage D2) : adresse réelle vérifiée (recherche web, voir la matrice
    // de livraison pour la source) — remplace une adresse fictive qui portait par erreur le
    // code postal de Sainte-Clotilde (97490) au lieu de Saint-Denis (97400). Pas de lat/lng :
    // voir le commentaire en tête de src/mapsUrl.js sur ce choix.
    location: 'Piscines Municipales',
    address: '3 allée Bois Joli Coeur, 97400 Saint-Denis',
    description: 'Prévoir maillot, serviette, bonnet de bain et brassards.',
    // Delta pts 29/30/39/42 (arbitrage D1) : référence un id du catalogue src/documents.js —
    // source unique, plus de nom/taille recopiés ici.
    attachments: ['doc-autorisation-piscine'],
    participants: ['Sophie', 'Thomas', 'Marie', 'Lucas', 'Julie'],
    hasLinkedThread: true,
  },
  {
    id: 'evt-zoo',
    category: 'sortie',
    subtype: 'sortie_ecole',
    title: 'Sortie au zoo',
    date: '2032-05-28',
    startTime: '14:00',
    endTime: '17:00',
    location: 'Zoo de Saint-Denis',
    description: '',
    attachments: [],
    participants: Array.from({ length: 23 }, (_, i) => `Parent ${i + 1}`),
    hasLinkedThread: false,
  },
  {
    id: 'evt-piquenique',
    category: 'sortie',
    subtype: 'sortie_parents', // organisée entre parents, pas par l'école -> pas d'autorisation
    title: 'Pique-nique entre familles',
    date: '2032-06-01',
    startTime: '15:00',
    endTime: '',
    location: 'Plage de l’Hermitage',
    description: '',
    attachments: [],
    // Point 2 (recette réelle sur PC) : "Test A1 — 2 adultes · 1 enfant" n'identifiait pas les
    // personnes présentes — deux foyers ci-dessous illustrent honnêtement l'état réel une fois
    // les prénoms disponibles : l'un les a saisis (attendeeNames rempli), l'autre non (saisie
    // facultative, attendeeNames reste `null` — jamais un nom inventé ou déduit de La Bande).
    // Les 13 autres foyers restent au format "chaîne simple" (démonstration historique) pour
    // prouver que ce format legacy continue de s'afficher sans erreur (voir participantId/
    // participantLabel dans EventDetail.jsx) — pas une migration silencieuse de toute la donnée
    // de démo, seulement un ajout honnête de ce qui est réellement possible maintenant.
    participants: [
      { userId: 'demo-parent-1', label: 'Parent 1', adultsCount: 2, childrenCount: 1, attendeeNames: { adults: ['Nadia', 'Karim'], children: ['Yasmine'] } },
      { userId: 'demo-parent-2', label: 'Parent 2', adultsCount: 1, childrenCount: 0, attendeeNames: null },
      ...Array.from({ length: 13 }, (_, i) => `Parent ${i + 3}`),
    ],
    hasLinkedThread: false,
  },
  {
    // Point 1 (2e contre-vérification, ZIP V7.2) : aucun événement mode 'family' de la donnée
    // de démonstration n'avait 0 participant au départ — evt-piquenique en a toujours au moins
    // un (Parent 1), donc le bug signalé ("Aucun participant pour le moment" reste affiché
    // pendant la saisie, même à 2 adultes/1 enfant") ne pouvait jamais être exercé ni prouvé
    // corrigé par la recette navigateur sur les événements existants : la condition fautive
    // (`participants.length === 0`) n'était jamais vraie au moment d'ouvrir le formulaire.
    // Ajout de cet événement, mode 'family' (category 'sortie', subtype 'sortie_parents'),
    // délibérément avec `participants: []`, pour rendre ce chemin réellement testable de bout
    // en bout (voir test-harness/recette.mjs, scénario dédié).
    id: 'evt-gouter-voisins',
    category: 'sortie',
    subtype: 'sortie_parents',
    title: 'Goûter entre voisins',
    date: '2032-06-08',
    startTime: '16:00',
    endTime: '',
    location: 'Square des Camélias',
    description: '',
    attachments: [],
    participants: [],
    hasLinkedThread: false,
  },
  {
    id: 'evt-rentree',
    category: 'ecole',
    subtype: 'evenement_scolaire',
    title: 'Rentrée décalée',
    date: '2032-05-30',
    startTime: '08:45',
    endTime: '',
    location: 'École élémentaire',
    description: '',
    attachments: [],
    participants: [],
    hasLinkedThread: false,
  },
  {
    id: 'evt-lea',
    category: 'anniversaire',
    title: 'Anniversaire de Léa',
    // Volontairement : jour + mois seulement, jamais d'année ni d'âge stockés
    day: 24,
    month: 5,
  },
];

// Dates réelles nécessaires aux séparateurs temporels (brief §22 : Aujourd'hui / Hier /
// date complète) — un fil de démonstration crédible a besoin de messages étalés sur
// plusieurs jours, pas d'un seul horodatage recopié partout. Calculées une fois au
// chargement du module, relatives à "aujourd'hui" pour que la démo reste vraie dans le temps.
const _today = new Date();
const _yesterday = new Date(_today); _yesterday.setDate(_today.getDate() - 1);
const _lastWeek = new Date(_today); _lastWeek.setDate(_today.getDate() - 6);
// Bug corrigé (contre-vérification indépendante, spécifique à La Réunion) : `_iso` utilisait
// `.toISOString()` (date UTC) — voir src/localDate.js pour le détail du bug et le correctif.
function _iso(d) { return localIso(d); }
export const TODAY_ISO = _iso(_today);
const YESTERDAY_ISO = _iso(_yesterday);
const LAST_WEEK_ISO = _iso(_lastWeek);

// Fil général unique — règle verrouillée : un seul fil collectif par communauté,
// pas de groupes multiples en V1.
export const GENERAL_THREAD = [
  {
    id: 'm0',
    author: 'Marie',
    initials: 'M',
    color: '#C9A6D4',
    text: 'Quelqu’un a des nouvelles du compte-rendu de la réunion de rentrée ?',
    date: LAST_WEEK_ISO,
    time: '18:42',
    reactions: [],
    linkedEventId: null,
  },
  {
    id: 'm1',
    author: 'Sophie',
    initials: 'S',
    color: '#E7A6B0',
    text: 'Bonjour à tous ! Rappel : sortie piscine samedi 24 mai de 10h00 à 12h00 à Saint-Denis.',
    date: YESTERDAY_ISO,
    time: '09:15',
    // Delta pts 26-28 (arbitrage D3) : modèle par personne — voir src/reactions.js. La donnée
    // démo inclut délibérément 'mem-vous' sur ce message pour que l'état "j'ai réagi" (pastille
    // mise en évidence) soit visible dès le premier chargement, sans action de test manuelle.
    reactions: [
      { userId: 'mem-marie', displayName: 'Marie', emoji: '❤️' },
      { userId: 'mem-thomas', displayName: 'Thomas', emoji: '❤️' },
      { userId: 'mem-sabrina', displayName: 'Sabrina', emoji: '❤️' },
      { userId: 'mem-vous', displayName: 'Vous', emoji: '❤️' },
    ],
    linkedEventId: 'evt-piscine',
  },
  {
    id: 'm2',
    author: 'Thomas',
    initials: 'T',
    color: '#9BB7D4',
    text: 'Merci Sophie ! On arrive un peu avant 10h00.',
    date: YESTERDAY_ISO,
    time: '09:18',
    reactions: [
      { userId: 'mem-sophie', displayName: 'Sophie', emoji: '👍' },
      { userId: 'mem-marie', displayName: 'Marie', emoji: '👍' },
    ],
    linkedEventId: 'evt-piscine',
  },
  {
    id: 'm3',
    author: 'Marie',
    initials: 'M',
    color: '#C9A6D4',
    text: 'N’oubliez pas les maillots, serviettes, bonnets de bain et brassards pour les plus petits !',
    date: YESTERDAY_ISO,
    time: '09:21',
    reactions: [
      { userId: 'mem-sophie', displayName: 'Sophie', emoji: '❤️' },
      { userId: 'mem-thomas', displayName: 'Thomas', emoji: '❤️' },
      { userId: 'mem-sabrina', displayName: 'Sabrina', emoji: '❤️' },
    ],
    linkedEventId: 'evt-piscine',
  },
  {
    id: 'm4',
    author: 'Lucas',
    initials: 'L',
    color: '#9BD4C0',
    text: 'Est-ce que quelqu’un a le compte-rendu de la réunion de mardi ?',
    date: TODAY_ISO,
    time: '10:12',
    reactions: [],
    linkedEventId: null,
  },
  {
    id: 'm5',
    author: 'Julie',
    initials: 'J',
    color: '#E7C89B',
    text: null,
    // Delta pts 29/30/39/42 (arbitrage D1) : même id que l'attachement de evt-piscine et le
    // partage sh-autorisation — c'est réellement le même fichier dans ce scénario de démo.
    fileId: 'doc-autorisation-piscine',
    date: TODAY_ISO,
    time: '10:18',
    reactions: [
      { userId: 'mem-sophie', displayName: 'Sophie', emoji: '👍' },
      { userId: 'mem-thomas', displayName: 'Thomas', emoji: '👍' },
      { userId: 'mem-marie', displayName: 'Marie', emoji: '👍' },
    ],
    linkedEventId: 'evt-piscine',
  },
  {
    id: 'm6',
    author: 'Sabrina',
    initials: 'SV',
    color: '#D4A69B',
    text: 'Qui peut covoiturer samedi ?',
    date: TODAY_ISO,
    time: '14:40',
    reactions: [],
    linkedEventId: null,
  },
];

// Données de démonstration Partages — types : 'info' | 'document' | 'photo' | 'lien'.
// Local uniquement, jamais branché à Supabase tant que l'authentification n'existe pas
// (donnée décidée explicitement : documents et photos réels attendent la sécurisation).
export const SHARES = [
  {
    id: 'sh-autorisation',
    type: 'document',
    title: 'Autorisation sortie piscine',
    description: 'Modèle vierge à faire signer avant samedi.',
    author: 'Sabrina',
    date: '2025-05-20',
    // Delta pts 29/30/39/42 (arbitrage D1) : même id que l'attachement de evt-piscine et le
    // message m5 — plus de nom/taille de fichier recopiés à divergence garantie.
    documentId: 'doc-autorisation-piscine',
    linkedEventId: 'evt-piscine',
  },
  {
    id: 'sh-photos-zoo',
    type: 'photo',
    title: 'Photos sortie zoo',
    description: '',
    author: 'Thomas',
    date: '2025-05-18',
    photoCount: 12,
    linkedEventId: 'evt-zoo',
  },
  {
    id: 'sh-kermesse-info',
    type: 'info',
    title: 'Infos kermesse du 21 juin',
    description: 'Buvette tenue par les CM2 cette année, besoin de quelques parents volontaires.',
    author: 'Marie',
    date: '2025-05-15',
    linkedEventId: null,
  },
  {
    id: 'sh-lien-cantine',
    type: 'lien',
    title: 'Menus de la cantine',
    description: '',
    author: 'Julie',
    date: '2025-05-10',
    linkUrl: 'https://exemple-ecole.fr/menus',
    domain: 'exemple-ecole.fr',
    linkedEventId: null,
  },
];

// La Bande — annuaire. Deux entités séparées pour éviter qu'un enfant devienne une chaîne
// de caractères recopiée dans chaque profil parent : CHILDREN existe une fois par enfant,
// MEMBERS référence les enfants via `relations` (many-to-many, libellé propre par relation).
// Volontairement minimal : children ne contient ni date de naissance ni âge (arbitrage
// explicite — le rappel d'anniversaire de l'Agenda reste une donnée indépendante et facultative).
export const CHILDREN = [
  { id: 'chi-lea', firstName: 'Léa', groupLabel: 'MS/GS' },
  { id: 'chi-indiana', firstName: 'Indiana', groupLabel: 'MS/GS' },
  { id: 'chi-mae', firstName: 'Mae', groupLabel: 'TPS' },
];

// Modèle de contacts (delta §19) : `phone_number`/`email` STOCKÉS UNE SEULE FOIS, séparés
// des flags de partage `share_whatsapp`/`share_phone`/`share_sms`/`share_email` qui autorisent
// (ou non) chaque canal indépendamment — WhatsApp/appel/SMS peuvent donc partager le même
// numéro tout en laissant le parent choisir les canaux réellement autorisés, plutôt que de
// dupliquer une même valeur dans quatre paires {value, shared} qui pouvaient diverger sans
// raison (ancien modèle, 2e passe). Rien n'est visible par défaut si le flag correspondant
// est faux — voir MemberDetail.jsx (lecture) et MyProfileSheet.jsx (édition, "Vous"
// seulement). Rappel du garde-fou déjà documenté ailleurs : cette protection reste pour
// l'instant uniquement côté UI (données locales `data.js`, pas encore RLS/API réelles) tant
// que La Bande n'est pas branchée à Supabase — §20, recette multi-comptes à refaire alors.
export const MEMBERS = [
  {
    id: 'mem-sabrina', firstName: 'Sabrina', lastName: 'Martin', avatarColor: '#D4A69B',
    relations: [{ childId: 'chi-lea', label: 'Maman' }],
    phone_number: '+33 6 12 34 56 78', email: 'sabrina.martin@exemple.fr',
    share_whatsapp: true, share_phone: false, share_sms: false, share_email: true,
  },
  {
    id: 'mem-sophie', firstName: 'Sophie', lastName: 'Vally', avatarColor: '#E7A6B0',
    relations: [{ childId: 'chi-lea', label: 'Responsable' }],
    phone_number: '', email: '',
    share_whatsapp: false, share_phone: false, share_sms: false, share_email: false,
  },
  {
    id: 'mem-thomas', firstName: 'Thomas', lastName: 'Renoir', avatarColor: '#9BB7D4',
    relations: [{ childId: 'chi-indiana', label: 'Papa' }],
    phone_number: '+33 6 98 76 54 32', email: '',
    share_whatsapp: true, share_phone: false, share_sms: false, share_email: false,
  },
  {
    id: 'mem-marie', firstName: 'Marie', lastName: 'Lebon', avatarColor: '#C9A6D4',
    relations: [{ childId: 'chi-mae', label: 'Maman' }],
    phone_number: '+33 6 11 22 33 44', email: 'marie.lebon@exemple.fr',
    share_whatsapp: false, share_phone: true, share_sms: false, share_email: true,
  },
  {
    id: 'mem-vous', firstName: 'Vous', lastName: '', avatarColor: '#0D47A1',
    relations: [{ childId: 'chi-indiana', label: 'Parent' }, { childId: 'chi-mae', label: 'Parent' }],
    phone_number: '', email: '',
    share_whatsapp: false, share_phone: false, share_sms: false, share_email: false,
  },
];

export function childrenOf(member) {
  return member.relations.map((r) => ({ ...CHILDREN.find((c) => c.id === r.childId), label: r.label }));
}

export const SHARE_TYPES = {
  info:     { label: 'Infos' },
  document: { label: 'Documents' },
  photo:    { label: 'Photos' },
  lien:     { label: 'Liens' },
};

// Événements pouvant recevoir un message ou un partage lié — les rappels d'anniversaire
// en sont explicitement exclus par la règle verrouillée.
export function linkableEvents() {
  return EVENTS.filter((e) => e.category !== 'anniversaire');
}
