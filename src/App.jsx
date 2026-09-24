import { useState, useEffect, useCallback, useRef } from 'react';
import Logo from './components/Logo';
import BottomNav from './components/BottomNav';
import ConnectedAvatar from './components/ConnectedAvatar';
import CompactHeader from './components/CompactHeader';
import Accueil from './pages/Accueil';
import Agenda from './pages/Agenda';
import EventDetail from './pages/EventDetail';
import Messages from './pages/Messages';
import Partages from './pages/Partages';
import LaBande from './pages/LaBande';
import MemberDetail from './pages/MemberDetail';
import MyProfileSheet from './components/MyProfileSheet';
import CreateEventSheet from './components/CreateEventSheet';
import AddBirthdaySheet from './components/AddBirthdaySheet';
import AddShareSheet from './components/AddShareSheet';
import Toast from './components/Toast';
// V7.7 (P2/P9) : GENERAL_THREAD (MOCK_THREAD) n'est plus importé ici — brief explicite,
// "absence totale de MOCK_THREAD" une fois Messages connecté à Supabase (MESSAGES_FROM_SUPABASE).
// MOCK_EVENTS reste nécessaire (résolution de repli pour un événement encore référencé par une
// donnée de démonstration ancienne — voir resolveEventById plus bas). SHARES (données de
// démonstration Partages) n'est plus importé ici depuis le 23 septembre (backlog point 4) —
// Partages lit désormais Supabase, voir SHARES_FROM_SUPABASE ci-dessous ; SHARES reste sur
// disque dans data.js pour mémoire, même sort que GENERAL_THREAD avant elle.
import { EVENTS as MOCK_EVENTS, MEMBERS } from './data';
import * as agendaApi from './agendaApi';
// V7.7 : module dédié Messages, jamais l'ancien api.js (voir le commentaire en tête de
// src/messagesApi.js — author_name/avatar_color/member_name texte libre, incompatibles avec le
// schéma sécurisé réel). L'inventaire exhaustif (brief P1) confirme qu'avant ce lot, dans tout
// src/, seul App.jsx importait encore `api.js` (`import * as api from './api'`), avec deux
// seuls appels réels (api.sendMessage/api.linkMessageToEvent, dans les branches
// BUSINESS_DATA_FROM_SUPABASE de sendMessage/linkMessage ci-dessous, jamais atteintes puisque
// ce drapeau vaut false) — désormais entièrement remplacés par les appels équivalents sur
// `messagesApi`, d'où la suppression de cet import : plus aucun fichier de src/ n'importe
// api.js. api.js lui-même reste intact sur disque (dette Partages/La Bande, hors périmètre de
// ce lot) — aucun couplage entre messagesApi.js et api.js.
import * as messagesApi from './messagesApi';
// V7.18 : module dédié La Bande (annuaire réel), même principe que messagesApi.js/agendaApi.js.
import * as membersApi from './membersApi';
// Backlog point 4 (23 sept.) : module dédié Partages, même principe — voir le commentaire en
// tête de src/sharesApi.js pour le détail (table/policies/bucket déjà en place, jamais branchés
// avant ce lot).
import * as sharesApi from './sharesApi';
import { useAuth } from './auth/AuthProvider';
import { BG, INK, BLUE, RED } from './theme';
import { captureNavState, clearNavState } from './navMemory';
import { resolveEventById } from './resolveEvent';
import { toggleShareFlag } from './shareFlags';
import { setSectionOrigin, clearSectionOrigin } from './sectionOrigin';
import { pathForState, stateForPath } from './router';
import { createReloadScheduler } from './reloadScheduler';
// src/sharesStorage.js (persistance locale des partages, ère pré-Supabase) n'est plus importé
// ici depuis le 23 septembre — reste sur disque, même sort que src/api.js (jamais supprimé,
// simplement plus jamais appelé par App.jsx).
// Point 3 (recette réelle sur PC) : les drapeaux vivent dans un module dédié
// (src/dataSourceFlags.js), pas déclarés ici — Messages.jsx doit pouvoir lire son propre
// drapeau (MESSAGES_FROM_SUPABASE) pour son bandeau de confidentialité sans créer d'import
// circulaire avec App.jsx (qui importe lui-même Messages.jsx comme composant de page). Mêmes
// valeurs, mêmes commentaires qu'avant ce déplacement — voir ce module pour le détail de
// l'arbitrage derrière chaque drapeau.
import { AGENDA_FROM_SUPABASE, MESSAGES_FROM_SUPABASE, MEMBERS_FROM_SUPABASE, SHARES_FROM_SUPABASE, BILLET_FROM_SUPABASE } from './dataSourceFlags';
import * as billetApi from './billetApi';

// memberships est reçu mais pas encore utilisé dans ce bloc — disponible pour la
// prochaine phase (migration des écrans métier), pas juste accessible "par accident"
// parce que Root.jsx le transmet.
export default function App({ activeCommunity, memberships }) {
  const communityId = activeCommunity?.community_id;
  const { session } = useAuth();
  const currentUserId = session?.user?.id || null;
  // P4 : seul l'auteur d'un message ou un administrateur de la communauté peut le lier à un
  // événement (policy update_own_message_or_admin, sql/02_rls.sql) — dérivé ici, une seule
  // fois, du rôle réel renvoyé par AuthProvider (members.role), jamais deviné côté interface.
  const isAdmin = activeCommunity?.role === 'admin';
  const [view, setView] = useState('accueil');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [threadFilterEventId, setThreadFilterEventId] = useState(null);
  const [events, setEvents] = useState(AGENDA_FROM_SUPABASE ? [] : MOCK_EVENTS);
  // V7.7 (P1/P9) : plus de repli MOCK_THREAD ici — tant que MESSAGES_FROM_SUPABASE est vrai
  // (seul drapeau qui pilote ce state désormais), `thread` démarre vide et n'est rempli que par
  // loadMessages() ci-dessous, jamais par une donnée de démonstration statique.
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(AGENDA_FROM_SUPABASE);
  const [dataError, setDataError] = useState('');
  // P1 (V7.7) : états DÉDIÉS à Messages, distincts de `loading`/`dataError` (Agenda) — un souci
  // réseau sur l'un des deux modules ne doit jamais afficher un message d'erreur qui concerne
  // l'autre, ni bloquer son chargement (brief : "états de chargement/erreur dédiés").
  const [messagesLoading, setMessagesLoading] = useState(MESSAGES_FROM_SUPABASE);
  const [messagesError, setMessagesError] = useState('');
  // V7.18 — annuaire La Bande réel. États dédiés, même raisonnement que messagesLoading/
  // messagesError ci-dessus : un souci réseau propre à La Bande ne doit jamais afficher une
  // erreur qui concerne un autre module, ni bloquer son propre chargement.
  const [members, setMembers] = useState(MEMBERS_FROM_SUPABASE ? [] : MEMBERS);
  const [membersLoading, setMembersLoading] = useState(MEMBERS_FROM_SUPABASE);
  const [membersError, setMembersError] = useState('');
  // P3 ("désactive pendant l'écriture") : géré localement dans Messages.jsx (état `sending`,
  // le temps de l'attente de la promesse renvoyée par `sendMessage` ci-dessous) — pas besoin de
  // le lever ici, Messages.jsx ne démonte jamais pendant son propre envoi (le clavier virtuel
  // et le focus restent sur ce champ tant que l'écriture est en vol).
  // P5 (exercice de correction V7.5) : vrai seulement quand fetchAgendaEvents a réellement dû
  // emprunter le repli "sans attendee_names" (colonne absente, migration sql/05 pas encore
  // appliquée) — jamais déduit autrement. Permet d'avertir PROACTIVEMENT dans le formulaire
  // d'inscription (EventDetail.jsx) que les prénoms ne seront pas enregistrés, avant même une
  // tentative réelle — complète, sans remplacer, l'avertissement réactif déjà géré par ailleurs
  // (ATTENDEE_NAMES_UNSUPPORTED, levé au moment d'un essai d'enregistrement réel).
  const [attendeeNamesUnsupported, setAttendeeNamesUnsupported] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // V7.14 (correctif UAT point 14) : confirmation brève après une création réussie (événement
  // ou anniversaire) — ce projet n'avait aucun système de toast avant cette passe (vérifié :
  // aucune occurrence de "toast"/"Toast" dans src/ avant l'ajout de src/components/Toast.jsx).
  // Un simple message (chaîne vide = rien affiché) suffit : une seule confirmation peut être
  // visible à la fois, jamais empilées.
  const [toastMessage, setToastMessage] = useState('');
  const [showAddBirthday, setShowAddBirthday] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(null);
  const [showAddShare, setShowAddShare] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [editingShare, setEditingShare] = useState(null);
  // Backlog point 4 (23 sept.) — Partages branché à Supabase, même principe que `thread`/
  // `members` : état DÉDIÉ, jamais de repli MOCK_SHARES une fois SHARES_FROM_SUPABASE actif
  // (voir loadShares ci-dessous, seul responsable de son remplissage).
  const [shares, setShares] = useState([]);
  const [sharesLoading, setSharesLoading] = useState(SHARES_FROM_SUPABASE);
  const [sharesError, setSharesError] = useState('');
  // V7.28 (25 sept.) — "Le p'tit billet" branché à Supabase, même principe que `shares`
  // ci-dessus : `billet` reste `null` (jamais `undefined`) tant qu'aucune ligne n'existe encore
  // pour cette communauté (billetApi.fetchBillet renvoie explicitement `null` dans ce cas) —
  // état normal avant toute première publication, distinct de billetLoading/billetError
  // (Accueil.jsx ne confond jamais les trois).
  const [billet, setBillet] = useState(null);
  const [billetLoading, setBilletLoading] = useState(BILLET_FROM_SUPABASE);
  const [billetError, setBilletError] = useState('');
  const [rsvpBusy, setRsvpBusy] = useState(false);
  // V7.11 (P1) — un seul ordonnanceur partagé pour toute la session (App.jsx ne se démonte
  // jamais), par domaine ('messages' couvre messages+réactions, 'agenda' couvre
  // événements+RSVP/participants — voir src/reloadScheduler.js pour l'explication complète de
  // ce choix de granularité). `useRef` plutôt que `useState` : c'est un objet de coordination
  // interne, jamais une donnée affichée — le recréer à chaque rendu (ce que ferait un
  // `useState(createReloadScheduler())` sans fonction d'initialisation) casserait sa mémoire
  // d'un rendu à l'autre.
  const reloadSchedulerRef = useRef(null);
  if (!reloadSchedulerRef.current) reloadSchedulerRef.current = createReloadScheduler();
  // V7.11 (P1) — état "pending" dédié aux réactions, symétrique à `rsvpBusy` pour
  // l'Agenda : un `Set` (pas un simple booléen) puisque plusieurs messages DIFFÉRENTS peuvent
  // chacun avoir une réaction en vol en même temps — un booléen unique aurait désactivé à tort
  // TOUTES les réactions de la page dès qu'une seule est en vol. `has(messageId)` gouverne à la
  // fois la désactivation du contrôle concerné (Messages.jsx) et la protection anti double-clic
  // (toggleMessageReaction ci-dessous ignore un second appel pour le même message tant que le
  // premier n'est pas retombé).
  const [reactionPendingIds, setReactionPendingIds] = useState(() => new Set());
  const [messageMutationPendingIds, setMessageMutationPendingIds] = useState(() => new Set());
  const [focusComposerToken, setFocusComposerToken] = useState(0);
  // V7.11 (P0) — état "pending" dédié à la suppression d'un événement, même contrat pessimiste
  // que `rsvpBusy`/`reactionPendingIds` : un seul événement peut être en cours de suppression à
  // la fois (la fiche événement n'affiche qu'un seul événement), un booléen suffit donc ici.
  const [eventDeleteBusy, setEventDeleteBusy] = useState(false);
  // Correction post-livraison (contre-vérification indépendante) : les flags de partage de
  // "Vous" (§19/§21) vivaient uniquement dans un useState local à MyProfileSheet, qui est
  // démonté à chaque fermeture ({showMyProfile && <MyProfileSheet .../>}) — fermer puis
  // rouvrir la modale perdait donc silencieusement tout changement, y compris en dehors de
  // toute question de compte/Supabase. Remonté ici : App.jsx ne démonte jamais, donc l'état
  // survit à l'ouverture/fermeture de la modale pour le reste de la session. `toggleMeShareFlag`
  // est écrit comme le futur point d'appel API (un seul endroit à modifier pour appeler
  // Supabase plus tard) sans brancher quoi que ce soit aujourd'hui.
  // V7.18 : `members` (réel) n'a aucune colonne de partage de contact — cette fonctionnalité
  // reste locale à la session, comme documenté par le TODO ci-dessous depuis avant ce lot.
  // Repli sûr à "rien de partagé" plutôt qu'un `MEMBERS.find(...)` qui plantait dès que
  // MEMBERS_FROM_SUPABASE valait true (l'annuaire réel démarre vide, avant le premier
  // chargement — `me` aurait été `undefined`).
  const [meShareFlags, setMeShareFlags] = useState(() => {
    if (MEMBERS_FROM_SUPABASE) {
      return { share_whatsapp: false, share_phone: false, share_sms: false, share_email: false };
    }
    const me = MEMBERS.find((m) => m.id === 'mem-vous');
    return {
      share_whatsapp: me.share_whatsapp,
      share_phone: me.share_phone,
      share_sms: me.share_sms,
      share_email: me.share_email,
    };
  });
  function toggleMeShareFlag(key) {
    // TODO (hors périmètre de ce lot) : une fois La Bande branchée à Supabase, remplacer ce
    // setMeShareFlags local par un appel API réel (ex. api.updateMyShareFlag(key, value)) suivi
    // d'une mise à jour optimiste identique — la signature exposée à MyProfileSheet ne change pas.
    setMeShareFlags((prev) => toggleShareFlag(prev, key));
  }
  // État de navigation Agenda, volontairement ici et pas dans Agenda.jsx : ce composant est
  // démonté/remonté à chaque changement de vue ({view === 'agenda' && <Agenda .../>}),
  // donc tout état local qui y vivait était perdu en repassant par EventDetail. App.jsx ne
  // se démonte jamais — pas besoin d'un store global, juste le bon niveau du composant.
  const [agendaFilter, setAgendaFilter] = useState('tous');
  const now = new Date();
  const [agendaYear, setAgendaYear] = useState(now.getFullYear());
  const [agendaMonthIndex, setAgendaMonthIndex] = useState(now.getMonth());
  const [agendaSelectedDate, setAgendaSelectedDate] = useState(null);
  const [agendaSearchQuery, setAgendaSearchQuery] = useState('');

  // Même logique pour Partages et La Bande (brief §4) : leur filtre/recherche doit survivre
  // un aller-retour par EventDetail / MemberDetail, ce qui suppose qu'ils ne soient PAS
  // remis à zéro par un démontage — donc levés ici, pas locaux à ces pages.
  const [partagesFilter, setPartagesFilter] = useState('tous');
  const [partagesQuery, setPartagesQuery] = useState('');
  const [labandeQuery, setLabandeQuery] = useState('');
  const [messagesQuery, setMessagesQuery] = useState('');
  // Lot consolidé UX/navigation (point 8) : la recherche Accueil était locale à Accueil.jsx,
  // donc perdue à chaque aller-retour vers une fiche (composant démonté/remonté). Levée ici
  // pour survivre exactement comme les 4 autres recherches ci-dessus — sans ça, "recherche
  // Accueil -> résultat -> retour" ne pouvait jamais retrouver la requête tapée.
  const [accueilQuery, setAccueilQuery] = useState('');

  // Provenance réelle de navigation (brief §4) : d'où vient-on quand on ouvre une fiche
  // événement, pour que la flèche retour renvoie là, pas vers la rubrique "naturelle" du
  // type de contenu. Un seul état simple plutôt qu'un routeur ou des if(origin===...)
  // dispersés dans chaque composant.
  const [eventReturnTo, setEventReturnTo] = useState('accueil');

  // Liens profonds depuis l'Accueil (brief §7/§8/§24/§27) : quelle carte cible précise
  // scroller/surligner en arrivant sur Messages ou Partages.
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const [highlightShareId, setHighlightShareId] = useState(null);
  // Lot consolidé UX/navigation (point 1/9) : remplace messagesCameFromAccueil/
  // sharesCameFromAccueil (deux booléens ad hoc, un par page, qui ne couvraient QUE le lien
  // profond vers un message/partage précis — pas le CTA "Voir tous les X", qui passait par
  // goTo() et perdait donc silencieusement toute trace de provenance). Un seul mécanisme
  // générique { [page]: originPage | null }, extensible sans nouveau booléen à chaque écran.
  const [sectionOrigin, setSectionOriginState] = useState({});

  // Provenance réelle pour la fiche membre (delta §2.2/§18/§26), symétrique à eventReturnTo :
  // sans elle, une fiche membre ouverte depuis la recherche de l'Accueil renverrait par défaut
  // vers La Bande au lieu de l'Accueil — exactement le bug de provenance déjà corrigé pour les
  // événements en 2e passe, généralisé ici à member-detail.
  const [memberReturnTo, setMemberReturnTo] = useState('labande');

  // Mémoire de navigation par page (delta §2.2/§14/§26) : { [page]: { scrollY, focusId } }.
  // Complète ce que agendaFilter/partagesFilter/labandeQuery/etc. font déjà pour l'état
  // logique (filtre/recherche) — ceci restaure en plus la position de lecture ET l'élément
  // déclencheur, au retour d'une fiche événement/membre. captureNavState/clearNavState sont
  // des fonctions pures (src/navMemory.js, testées par scripts/test-nav-memory.mjs) ; ce
  // useState ne fait que les appliquer.
  const [navMemory, setNavMemory] = useState({});
  function captureNav(page, focusId) {
    if (!page) return;
    setNavMemory((prev) => captureNavState(prev, page, window.scrollY, focusId));
  }
  function consumeNav(page) {
    setNavMemory((prev) => clearNavState(prev, page));
  }

  // Polices chargées une seule fois dans index.html (contrat visuel §4/§6).


  const loadAgendaEvents = useCallback(async () => {
    if (!AGENDA_FROM_SUPABASE || !communityId) return;
    try {
      const { events: evs, attendeeNamesUnsupported: namesUnsupported } = await agendaApi.fetchAgendaEvents(communityId);
      setEvents(evs);
      setAttendeeNamesUnsupported(namesUnsupported);
      setDataError('');
    } catch (err) {
      // Une erreur reste une erreur — jamais transformée silencieusement en liste vide.
      setDataError("Impossible de charger l'agenda — vérifie ta connexion et réessaie.");
      // V7.11.1 (correctif bug 2) : relancée après le setDataError ci-dessus — ce message
      // reste donc affiché tel quel, RIEN ne change de ce côté. Ce qui change : avant ce
      // correctif, cette fonction avalait silencieusement l'échec (elle gérait son erreur en
      // interne puis se contentait de `return`), donc un appelant qui l'attendait via
      // `reloadSchedulerRef.current.requestAndWait('agenda', loadAgendaEvents)` (voir
      // `reloadAgenda()` plus bas) recevait toujours une promesse résolue normalement — MÊME
      // quand le rechargement avait réellement échoué. Un contrôle "pending" (RSVP, suppression
      // d'événement) pouvait ainsi sortir de son état pessimiste, voire naviguer, en pensant que
      // l'état affiché reflétait sa mutation, alors que ce rechargement n'avait jamais abouti.
      // Cette relance permet à chaque appelant (voir `reloadAgendaOrWarn` plus bas) de
      // distinguer explicitement "ma mutation a échoué" de "ma mutation a réussi mais je n'ai
      // pas pu le confirmer" — deux cas qui ne doivent jamais être annoncés par le même message.
      throw err;
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (!AGENDA_FROM_SUPABASE) return;
    // V7.11 (P1) : ce chargement initial/de changement de communauté contourne délibérément
    // l'ordonnanceur partagé (jamais `reloadSchedulerRef.current.request(...)` ici) — un
    // changement de communauté doit TOUJOURS déclencher un chargement immédiat, jamais être
    // retardé/coalescé par un cycle encore en vol pour l'ANCIENNE communauté. `reset('agenda')`
    // abandonne la comptabilité de ce cycle précédent (la promesse elle-même continue de se
    // résoudre normalement en arrière-plan — voir le commentaire de `reset` dans
    // src/reloadScheduler.js) pour repartir sur une base saine.
    reloadSchedulerRef.current.reset('agenda');
    // V7.11.1 : `loadAgendaEvents` peut désormais rejeter (voir son commentaire) — ce chargement
    // initial/de changement de communauté ne passe délibérément pas par l'ordonnanceur partagé
    // (voir ci-dessus) et personne d'autre n'attend cette promesse ici : `.catch(() => {})`
    // évite seulement un rejet de promesse non intercepté, il n'avale RIEN à l'écran — l'erreur
    // honnête a déjà été posée par `setDataError` à l'intérieur de `loadAgendaEvents` avant le
    // rejet.
    loadAgendaEvents().catch(() => {});
    // Pas de temps réel dans ce bloc (décision explicite) : lecture -> mutation ->
    // rechargement manuel après chaque action, rien d'automatique en arrière-plan.
  }, [loadAgendaEvents]);

  // ---------------------------------------------------------------------------------------
  // V7.18 — La Bande (annuaire réel). Pas d'ordonnanceur/Realtime ici (scope volontairement
  // minimal, comme Agenda) : chargement au changement de communauté, PLUS un rechargement
  // chaque fois que la vue "labande" devient active (voir le second effet ci-dessous) — pour
  // qu'un parent tout juste accepté via un lien d'invitation apparaisse sans recharger toute
  // la page. `membersRequestId` : même garde anti-réponse-obsolète que messagesRequestId.
  // ---------------------------------------------------------------------------------------
  const membersRequestId = useRef(0);
  const loadMembers = useCallback(async () => {
    if (!MEMBERS_FROM_SUPABASE || !communityId) return;
    const myRequestId = ++membersRequestId.current;
    setMembersLoading(true);
    setMembersError('');
    try {
      const rows = await membersApi.fetchCommunityMembers(communityId, currentUserId);
      if (myRequestId !== membersRequestId.current) return;
      setMembers(rows);
    } catch (err) {
      if (myRequestId !== membersRequestId.current) return;
      setMembersError("Impossible de charger La Bande — vérifie ta connexion et réessaie.");
    } finally {
      if (myRequestId === membersRequestId.current) setMembersLoading(false);
    }
  }, [communityId, currentUserId]);

  useEffect(() => {
    if (!MEMBERS_FROM_SUPABASE) return;
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!MEMBERS_FROM_SUPABASE || view !== 'labande') return;
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ---------------------------------------------------------------------------------------
  // V7.7 — Messages (P1/P2/P6). Même méthode défensive que loadMemberships (AuthProvider.jsx) :
  // un identifiant de requête incrémenté à chaque appel, comparé après l'attente réseau, pour
  // qu'une réponse OBSOLÈTE (communauté déjà changée entre-temps) n'écrase jamais un état plus
  // récent — un risque réel ici puisque loadMessages est aussi appelé depuis l'abonnement
  // Realtime (P6), potentiellement en rafale.
  // ---------------------------------------------------------------------------------------
  const messagesRequestId = useRef(0);
  const loadMessages = useCallback(async () => {
    if (!MESSAGES_FROM_SUPABASE || !communityId) return;
    const myRequestId = ++messagesRequestId.current;
    setMessagesError('');
    try {
      const rows = await messagesApi.fetchMessages(communityId);
      if (myRequestId !== messagesRequestId.current) return; // réponse obsolète, ignorée
      setThread(rows);
    } catch (err) {
      if (myRequestId !== messagesRequestId.current) return;
      // Interdiction explicite du brief : jamais de repli silencieux vers une donnée de
      // démonstration en cas d'échec réseau — une vraie erreur reste affichée telle quelle.
      setMessagesError("Impossible de charger les messages — vérifie ta connexion et réessaie.");
      // V7.11.1 (correctif bug 2) : relancée après le setMessagesError ci-dessus, même
      // raisonnement que loadAgendaEvents (voir son commentaire) — avant ce correctif, un appel
      // via `reloadSchedulerRef.current.requestAndWait('messages', loadMessages)` (envoi de
      // message, réaction, liaison, suppression d'événement) se résolvait toujours normalement
      // même quand ce rechargement avait réellement échoué, laissant un contrôle "pending"
      // sortir de son état pessimiste sans que l'état affiché reflète quoi que ce soit de
      // confirmé. Réponse obsolète (myRequestId périmé) : toujours PAS relancée (le `return`
      // juste au-dessus reste inchangé) — une réponse qui ne concerne déjà plus la communauté
      // affichée n'a jamais à faire échouer quoi que ce soit pour l'appelant courant.
      throw err;
    } finally {
      if (myRequestId === messagesRequestId.current) setMessagesLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (!MESSAGES_FROM_SUPABASE) return;
    // Changement de communauté (ou perte de communauté active) : jamais conserver le fil de la
    // communauté précédente pendant le rechargement, même brièvement — reset explicite avant de
    // relancer le chargement, plutôt que de laisser le fil précédent visible à tort.
    setThread([]);
    setMessagesLoading(true);
    setMessagesError('');
    // V7.11 (P1) : même raisonnement que pour 'agenda' ci-dessus — ce chargement contourne
    // délibérément l'ordonnanceur partagé et lui fait juste abandonner sa comptabilité d'un
    // cycle en vol pour l'ancienne communauté (`reset`), pour ne jamais retarder un changement
    // de communauté réel.
    reloadSchedulerRef.current.reset('messages');
    // V7.11.1 : voir le commentaire équivalent sur `loadAgendaEvents().catch(() => {})`
    // ci-dessus, même raisonnement exact pour 'messages'.
    loadMessages().catch(() => {});
  }, [communityId, loadMessages]);

  // P6 — Realtime, un seul abonnement actif à la fois, filtré par communauté. Nettoyage complet
  // (désabonnement) au changement de communauté ET au démontage — messagesApi.subscribeToMessages
  // renvoie la fonction de nettoyage à utiliser telle quelle en retour d'effet React.
  useEffect(() => {
    if (!MESSAGES_FROM_SUPABASE || !communityId) return;
    const unsubscribe = messagesApi.subscribeToMessages(communityId, () => {
      // Contrat volontaire (P6) : jamais de fusion locale du payload Realtime reçu — un
      // rechargement complet depuis l'état qui fait foi, exactement comme après une mutation.
      // V7.11 (P1) : passe désormais par l'ordonnanceur partagé ('messages', même domaine que
      // sendMessage/linkMessage/toggleMessageReaction ci-dessous, puisque tous rechargent le
      // MÊME état via `loadMessages`) — un écho Realtime de sa propre mutation locale (scénario
      // de course nommé "mutation locale suivie de son propre écho") ne déclenche ainsi jamais
      // un second chargement réellement en vol EN PARALLÈLE de celui déjà lancé par la
      // mutation ; au pire, un unique rechargement de rattrapage, jamais deux en parallèle.
      // Fire-and-forget délibéré (`request`, pas `requestAndWait`) : ce déclencheur n'est lié à
      // aucun contrôle "pending" particulier à l'écran, contrairement à une mutation locale.
      // V7.11.1 : `.catch(() => {})` ajouté ici pour la même raison que sur les chargements
      // initiaux ci-dessus (`loadMessages` peut désormais rejeter) — évite seulement un rejet de
      // promesse non intercepté ; l'erreur honnête est déjà affichée par `loadMessages`
      // lui-même (`setMessagesError`) avant le rejet, rien n'est avalé côté écran.
      reloadSchedulerRef.current.request('messages', loadMessages).catch(() => {});
    });
    return unsubscribe;
  }, [communityId, loadMessages]);

  // ---------------------------------------------------------------------------------------
  // Backlog point 4 (23 sept.) — Partages. Même méthode exacte que Messages ci-dessus
  // (identifiant de requête incrémenté, réinitialisation au changement de communauté,
  // ordonnanceur partagé 'shares', Realtime avec rechargement complet plutôt que fusion locale
  // du payload) — voir les commentaires détaillés du bloc Messages pour le raisonnement complet
  // derrière chaque choix, non redupliqués ici mot pour mot.
  // ---------------------------------------------------------------------------------------
  const sharesRequestId = useRef(0);
  const loadShares = useCallback(async () => {
    if (!SHARES_FROM_SUPABASE || !communityId) return;
    const myRequestId = ++sharesRequestId.current;
    setSharesError('');
    try {
      const rows = await sharesApi.fetchShares(communityId);
      if (myRequestId !== sharesRequestId.current) return; // réponse obsolète, ignorée
      setShares(rows);
    } catch (err) {
      if (myRequestId !== sharesRequestId.current) return;
      setSharesError("Impossible de charger les partages — vérifie ta connexion et réessaie.");
      throw err;
    } finally {
      if (myRequestId === sharesRequestId.current) setSharesLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (!SHARES_FROM_SUPABASE) return;
    setShares([]);
    setSharesLoading(true);
    setSharesError('');
    reloadSchedulerRef.current.reset('shares');
    loadShares().catch(() => {});
  }, [communityId, loadShares]);

  useEffect(() => {
    if (!SHARES_FROM_SUPABASE || !communityId) return;
    const unsubscribe = sharesApi.subscribeToShares(communityId, () => {
      reloadSchedulerRef.current.request('shares', loadShares).catch(() => {});
    });
    return unsubscribe;
  }, [communityId, loadShares]);

  // ---------------------------------------------------------------------------------------
  // V7.28 (25 sept.) — "Le p'tit billet". Même méthode exacte que Messages/Partages ci-dessus
  // (identifiant de requête incrémenté, réinitialisation au changement de communauté,
  // ordonnanceur partagé 'billet', Realtime avec rechargement complet) — voir les commentaires
  // détaillés du bloc Messages pour le raisonnement complet derrière chaque choix.
  // ---------------------------------------------------------------------------------------
  const billetRequestId = useRef(0);
  const loadBillet = useCallback(async () => {
    if (!BILLET_FROM_SUPABASE || !communityId) return;
    const myRequestId = ++billetRequestId.current;
    setBilletError('');
    try {
      const row = await billetApi.fetchBillet(communityId);
      if (myRequestId !== billetRequestId.current) return; // réponse obsolète, ignorée
      setBillet(row);
    } catch (err) {
      if (myRequestId !== billetRequestId.current) return;
      setBilletError('Impossible de charger le billet — vérifie ta connexion et réessaie.');
      throw err;
    } finally {
      if (myRequestId === billetRequestId.current) setBilletLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (!BILLET_FROM_SUPABASE) return;
    setBillet(null);
    setBilletLoading(true);
    setBilletError('');
    reloadSchedulerRef.current.reset('billet');
    loadBillet().catch(() => {});
  }, [communityId, loadBillet]);

  useEffect(() => {
    if (!BILLET_FROM_SUPABASE || !communityId) return;
    const unsubscribe = billetApi.subscribeToBillet(communityId, () => {
      reloadSchedulerRef.current.request('billet', loadBillet).catch(() => {});
    });
    return unsubscribe;
  }, [communityId, loadBillet]);

  // Admin uniquement (EditBilletSheet.jsx n'est même rendu que pour lui, côté Accueil.jsx) —
  // recharge explicitement après écriture (`requestAndWait`), même principe que
  // handleSaveShare/handleSaveMessage : l'auteur de l'action voit le résultat immédiatement,
  // sans attendre l'écho Realtime (qui rafraîchira aussi les autres appareils/onglets ouverts).
  async function handleSaveBillet(content) {
    await billetApi.upsertBillet(communityId, content);
    await reloadSchedulerRef.current.requestAndWait('billet', loadBillet);
  }

  // P1 (exercice de correction V7.5) : `view`/`selectedEventId`/`eventReturnTo` vivaient
  // uniquement dans cet état React — une actualisation du navigateur perdait tout et renvoyait
  // systématiquement vers Accueil (état initial de `view`). Ce bloc synchronise l'URL réelle
  // avec cet état, dans les deux sens, via l'History API native (voir src/router.js pour le
  // détail des choix). Aucune des fonctions de navigation existantes (openEvent, goTo,
  // enterSection, onBack...) n'est modifiée : elles continuent de piloter `view`/
  // `selectedEventId`/`eventReturnTo` exactement comme avant — c'est ce bloc qui observe leurs
  // changements et pousse l'URL correspondante, ou, à l'inverse, réagit à un changement d'URL
  // (navigation navigateur, actualisation) pour remettre cet état à niveau.
  //
  // `pendingUrlEventId` : un id d'événement lu dans l'URL (au montage ou via précédent/suivant)
  // mais pas encore résolu contre `events`/MOCK_EVENTS — nécessaire parce que `events` peut
  // encore être vide (chargement Supabase en cours) au moment où l'URL est lue. Tant qu'il est
  // non-null, le rendu reste sur `!loading` (déjà le cas existant), donc aucun flash d'Accueil
  // n'est visible : rien ne s'affiche avant la résolution, comme pour tout chargement d'agenda.
  const [pendingUrlEventId, setPendingUrlEventId] = useState(null);
  // true juste après avoir remis `view`/`selectedEventId`/`eventReturnTo` À NIVEAU depuis
  // l'URL (montage, popstate, ou repli "événement introuvable") — évite que l'effet de poussée
  // ci-dessous ne pousse une NOUVELLE entrée d'historique pour un état qui vient déjà de l'URL.
  const suppressPushRef = useRef(false);
  // V7.6 — correctif d'un vrai bug signalé par une contre-vérification indépendante (pas une
  // supposition : confirmé en traçant la pile d'historique) : le repli "événement introuvable"
  // ci-dessous change RÉELLEMENT l'URL (donc ne peut pas utiliser `suppressPushRef`, qui SE TAIT
  // — voir juste au-dessus), mais l'effet de poussée plus bas utilisait `pushState` par défaut,
  // ce qui EMPILAIT une entrée `/agenda` par-dessus l'URL invalide au lieu de la remplacer. Une
  // fois sur `/agenda`, "Précédent" ramenait le navigateur sur l'URL invalide, qui se résolvait
  // aussitôt de nouveau en "introuvable" et repoussait une NOUVELLE entrée `/agenda` — boucle
  // sans fin, "Précédent" ne ramenant jamais réellement en arrière. `forceReplaceRef` demande
  // explicitement à l'effet de poussée d'utiliser `replaceState` (corrige l'entrée d'historique
  // invalide en place) au lieu de `pushState` (en empilerait une nouvelle) pour ce seul cas.
  const forceReplaceRef = useRef(false);

  // Lecture initiale de l'URL (une seule fois au montage) : détermine la section demandée, ou
  // mémorise l'id d'événement à résoudre dès que possible. 'accueil' est déjà l'état initial de
  // `view` — inutile de le repousser explicitement.
  useEffect(() => {
    // Bug réel détecté et corrigé (recette Playwright, pas une supposition) : au tout premier
    // montage, React exécute TOUS les effets de ce composant après le premier rendu commis, y
    // compris l'effet de poussée d'URL plus bas (3e), qui ne se limite normalement à s'exécuter
    // que quand `view`/`selectedEventId`/`eventReturnTo` CHANGENT — mais lors de ce tout premier
    // commit, il n'y a rien à comparer, donc React le lance quand même, avec la valeur INITIALE
    // de `view` ('accueil', pas encore mise à jour). Pour une fiche événement (id résolu de
    // façon asynchrone via `pendingUrlEventId`, voir plus bas), rien ne signalait encore à cet
    // effet de poussée de se taire : il voyait `view === 'accueil'` et écrasait IMMÉDIATEMENT
    // une URL de fiche valide (`/evenement/...`) par '/' — avant même d'avoir eu la chance de la
    // restaurer. Le contenu affiché finissait quand même par être correct (piloté par l'état
    // React, résolu ensuite par le 2e effet), mais l'URL, elle, restait fausse pour de bon
    // (`suppressPushRef` empêchait toute correction ultérieure) : un rechargement RÉEL à ce
    // stade aurait alors, lui, atterri sur Accueil — exactement le défaut que ce point corrige.
    // `suppressPushRef.current = true` ICI, synchrone, AVANT le `setPendingUrlEventId` (comme
    // c'était déjà fait pour l'autre branche juste en dessous), ferme cette fenêtre : l'effet de
    // poussée, lancé juste après dans ce même premier commit, le voit déjà à `true` et se tait.
    const parsed = stateForPath(window.location.pathname, window.location.search);
    if (parsed.view === 'event-detail') {
      suppressPushRef.current = true;
      setPendingUrlEventId({ id: parsed.eventId, origin: parsed.eventOrigin });
    } else if (parsed.view !== 'accueil') {
      suppressPushRef.current = true;
      setView(parsed.view);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Résolution d'un id d'événement en attente (montage sur une URL de fiche, ou précédent/
  // suivant du navigateur vers une telle URL) — attend explicitement la fin du chargement réel
  // de l'agenda avant de conclure qu'un événement "n'existe pas" : sans cette attente, un
  // rechargement sur une fiche pourtant valide afficherait à tort le repli "introuvable" pendant
  // que `events` est encore vide (chargement Supabase en cours), avant même d'avoir eu la
  // moindre chance de le trouver.
  useEffect(() => {
    if (!pendingUrlEventId) return;
    if (AGENDA_FROM_SUPABASE && loading) return;
    const found = resolveEventById(events, MOCK_EVENTS, pendingUrlEventId.id);
    if (found) {
      // Cas "trouvé" : on ne fait que remettre l'état React À NIVEAU pour qu'il corresponde à
      // l'URL déjà présente dans la barre d'adresse (celle-ci représentait déjà correctement
      // cette fiche, ex. après une actualisation) — rien à pousser dans l'historique, d'où
      // `suppressPushRef`.
      suppressPushRef.current = true;
      setEventReturnTo(pendingUrlEventId.origin);
      setSelectedEventId(pendingUrlEventId.id);
      setView('event-detail');
    } else {
      // Repli propre demandé par le brief (P1) : jamais une fiche vide ni une erreur bloquante
      // — retour à l'Agenda avec un message compréhensible, réutilisant le même bandeau
      // d'erreur que le reste de l'application (dataError), pas un nouveau composant ad hoc.
      //
      // Bug réel détecté et corrigé (recette Playwright, pas une supposition) : CE cas-ci,
      // contrairement au cas "trouvé" ci-dessus, change RÉELLEMENT la destination (l'URL
      // d'origine pointait vers un id introuvable, ce n'est PLUS l'état voulu) — `suppressPushRef`
      // ne doit PAS être posé ici, sans quoi l'effet de poussée d'URL plus bas se taisait à tort
      // et l'URL restait bloquée sur l'id introuvable alors que l'écran affichait déjà Agenda,
      // ce qui cassait ensuite le bouton "Précédent" du navigateur (URL et écran désynchronisés).
      setDataError("Cet événement n'existe plus ou n'a pas pu être chargé — retour à l'agenda.");
      setView('agenda');
      // V7.6 : voir le commentaire sur `forceReplaceRef` plus haut — corrige l'entrée d'URL
      // invalide en place plutôt que d'en empiler une nouvelle, pour que "Précédent" ne boucle
      // jamais indéfiniment sur cette URL.
      forceReplaceRef.current = true;
    }
    setPendingUrlEventId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUrlEventId, events, loading]);

  // Pousse une nouvelle entrée d'historique quand la navigation change RÉELLEMENT (pas quand
  // cet état vient lui-même d'être remis à niveau depuis l'URL — voir suppressPushRef ci-dessus).
  // Volontairement limité aux vues représentées dans l'URL (voir src/router.js) : 'thread' et
  // 'member-detail' continuent de fonctionner exactement comme avant (état React en mémoire),
  // hors du périmètre explicite de ce point.
  useEffect(() => {
    if (pendingUrlEventId) return; // résolution en cours, rien de stable à pousser encore
    if (suppressPushRef.current) { suppressPushRef.current = false; return; }
    if (!['accueil', 'agenda', 'messages', 'partages', 'labande', 'event-detail'].includes(view)) return;
    const path = view === 'event-detail' ? pathForState(view, selectedEventId, eventReturnTo) : pathForState(view);
    const current = window.location.pathname + window.location.search;
    if (path !== current) {
      if (forceReplaceRef.current) {
        // V7.6 : corrige l'entrée d'historique invalide EN PLACE (jamais de nouvelle entrée)
        // — voir le commentaire sur `forceReplaceRef` plus haut pour le bug que ceci corrige.
        forceReplaceRef.current = false;
        window.history.replaceState(null, '', path);
      } else {
        window.history.pushState(null, '', path);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedEventId, eventReturnTo]);

  // Précédent/suivant du navigateur : relit l'URL réelle et remet l'état à niveau, exactement
  // comme au montage — jamais une navigation "devinée" à partir de l'état React précédent, qui
  // pourrait diverger de l'historique réel du navigateur.
  useEffect(() => {
    function onPopState() {
      const parsed = stateForPath(window.location.pathname, window.location.search);
      if (parsed.view === 'event-detail') {
        setPendingUrlEventId({ id: parsed.eventId, origin: parsed.eventOrigin });
      } else {
        suppressPushRef.current = true;
        setView(parsed.view);
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Ouvre une fiche événement en mémorisant la provenance réelle (brief §4) : `from` est la
  // vue à laquelle revenir. Par défaut, la vue courante — donc un appel sans second argument
  // reste correct partout où l'appelant EST déjà la provenance.
  // `focusId` (delta §2.2/§14/§26) : identifiant DOM du bouton/carte qui a déclenché
  // l'ouverture, pour lui rendre le focus clavier au retour — optionnel, capturé avec la
  // position de scroll courante de la page d'origine avant de basculer la vue.
  function openEvent(id, from, focusId) {
    const origin = from || view;
    captureNav(origin, focusId);
    setEventReturnTo(origin);
    setSelectedEventId(id);
    setView('event-detail');
  }

  // Ouvre une fiche membre (delta §2.2/§18/§26), symétrique à openEvent. Cas particulier
  // explicite (§18) : "Vous" n'est pas un tiers — présenter ses propres coordonnées via une
  // fiche générique ("Contacter Vous", "Vous n'a pas partagé...") n'a pas de sens. Centraliser
  // cette redirection ICI (plutôt que dans chaque appelant : Accueil, La Bande) garantit qu'un
  // clic sur "Vous" ouvre toujours la même modale Mon profil que l'avatar du header, quel que
  // soit l'endroit d'où on clique — un seul chemin, pas deux mécaniques divergentes à tenir
  // synchronisées.
  function openMember(id, from, focusId) {
    if (id === 'mem-vous') {
      setShowMyProfile(true);
      return;
    }
    const origin = from || view;
    captureNav(origin, focusId);
    setMemberReturnTo(origin);
    setSelectedMemberId(id);
    setView('member-detail');
  }

  // Lot consolidé UX/navigation (point 1/9) : point d'entrée unique pour "j'ouvre une page
  // principale (Messages/Partages...) en douceur depuis une autre page", qu'il y ait une
  // cible précise à surligner ou non. Remplace openMessageFromAccueil/openShareFromAccueil
  // ET couvre en plus le cas qui manquait (CTA "Voir tous les X", sans cible précise) sans
  // dupliquer un mécanisme par écran — un futur "voir tout" ailleurs appelle la même fonction.
  function enterSection(page, origin, { highlightId, focusId } = {}) {
    captureNav(origin, focusId);
    setSectionOriginState((prev) => setSectionOrigin(prev, page, origin));
    if (highlightId) {
      // Lien profond vers une cible précise (brief §7/§8/§24/§27) : garantir sa visibilité
      // en réinitialisant filtre/recherche de la page de destination à leur état neutre au
      // moment même où on cible — jamais après (contre-vérification indépendante, 2e passe).
      if (page === 'messages') { setMessagesQuery(''); setHighlightMessageId(highlightId); }
      if (page === 'partages') { setPartagesFilter('tous'); setPartagesQuery(''); setHighlightShareId(highlightId); }
    }
    setView(page);
  }

  function openMessageComposerFromAccueil() {
    captureNav('accueil', 'home-write-message');
    setSectionOriginState((prev) => setSectionOrigin(prev, 'messages', 'accueil'));
    setMessagesQuery('');
    setHighlightMessageId(null);
    setView('messages');
    setFocusComposerToken((n) => n + 1);
  }

  function myParticipation(event) {
    return event?.participants.find((p) => p.userId === currentUserId) || null;
  }

  // Bug corrigé (contre-vérification indépendante du ZIP V7) : ces trois fonctions ne
  // cherchaient QUE dans `events` (l'agenda Supabase réel), jamais avec le repli
  // `resolveEventById` que `selectedEvent`/`filteredEvent` utilisent déjà pour l'AFFICHAGE
  // (ligne ~431) — exactement la même classe de bug que la 6e passe avait déjà corrigée pour
  // `filteredEvent`, mais jamais migrée ici. Conséquence réelle : ouvrir evt-piscine (mock,
  // référencé par Messages/Partages, absent de l'agenda Supabase réel) affichait bien la fiche
  // et le bouton "Je peux accompagner", mais `event` valait `undefined` dans `joinEvent` —
  // l'action retournait EN SILENCE, sans la moindre erreur affichée, donnant l'impression d'un
  // bouton mort.
  //
  // Le repli résout maintenant l'événement pour lire ses données (participants existants,
  // etc.), mais une inscription/désinscription/modification réelle ne peut être PERSISTÉE que
  // pour un événement qui existe vraiment dans l'agenda Supabase — écrire avec l'id d'un
  // événement mock échouerait côté serveur (clé étrangère inexistante) de toute façon. Plutôt
  // que de laisser cet échec serveur se produire silencieusement ou avec un message générique
  // trompeur, `isLiveEvent` distingue explicitement ce cas et affiche un message honnête
  // plutôt qu'un no-op invisible.
  function resolveSelectedEvent() {
    return resolveEventById(events, MOCK_EVENTS, selectedEventId);
  }
  function isLiveEvent(id) {
    return events.some((e) => e.id === id);
  }
  const MOCK_FALLBACK_RSVP_MESSAGE =
    "Cette fiche vient d'une donnée de démonstration (Messages/Partages) — l'inscription réelle n'est possible que depuis un événement de l'Agenda.";

  // V7.11 (P1) : petit raccourci partagé par toutes les mutations Agenda (RSVP et, plus bas,
  // suppression d'événement) — route le rechargement post-mutation par l'ordonnanceur partagé
  // ('agenda') plutôt qu'un appel direct à `loadAgendaEvents()`. `requestAndWait` (pas
  // `request`) : le contrat pessimiste (P1) exige que le contrôle concerné (`rsvpBusy`/
  // `eventDeleteBusy`) ne sorte de son état "pending" qu'une fois ce rechargement RÉELLEMENT
  // terminé — y compris quand il a fallu attendre un cycle déjà en vol (déclenché par une autre
  // mutation ou par Realtime) plus son éventuel rattrapage.
  function reloadAgenda() {
    return reloadSchedulerRef.current.requestAndWait('agenda', loadAgendaEvents);
  }

  // V7.11.1 (correctif bug 2) : `reloadAgenda()` peut désormais rejeter (`loadAgendaEvents`
  // relance son erreur — voir son commentaire). Sans ce petit relais, chaque appelant ci-dessous
  // qui fait `await agendaApi.xxx(...); await reloadAgenda();` dans le MÊME bloc `try` verrait un
  // échec du RECHARGEMENT tomber dans le même `catch` qu'un échec de la MUTATION elle-même — et
  // afficherait à tort "l'inscription/la modification/la suppression a échoué" alors que
  // l'action a en réalité bien été enregistrée côté serveur, seule sa confirmation à l'écran a
  // échoué. Ce relais isole ce cas précis : message honnête et DISTINCT, jamais confondu avec un
  // échec de l'action ; renvoie `true`/`false` pour que l'appelant sache s'il peut appliquer un
  // message métier par-dessus (ex. ATTENDEE_NAMES_UNSUPPORTED) — jamais s'il doit prétendre que
  // l'état affiché est désormais à jour.
  async function reloadAgendaOrWarn(honestMessage) {
    try {
      await reloadAgenda();
      return true;
    } catch (err) {
      setDataError(honestMessage);
      return false;
    }
  }
  const RSVP_RELOAD_FAILED_MESSAGE =
    "Ta réponse a été enregistrée mais l'actualisation a échoué — réessaie ou recharge la page.";

  async function joinEvent(counts) {
    const event = resolveSelectedEvent();
    if (!event || !currentUserId || rsvpBusy || myParticipation(event)) return;
    if (!isLiveEvent(event.id)) { setDataError(MOCK_FALLBACK_RSVP_MESSAGE); return; }
    setRsvpBusy(true);
    try {
      await agendaApi.joinAgendaEvent(event.id, communityId, currentUserId, counts);
      await reloadAgendaOrWarn(RSVP_RELOAD_FAILED_MESSAGE);
    } catch (err) {
      if (err.code === 'ATTENDEE_NAMES_UNSUPPORTED') {
        // Point 2 (recette réelle sur PC) : l'inscription elle-même a bien réussi (compteurs
        // adultes/enfants enregistrés) — seuls les prénoms n'ont pas pu l'être, migration 05
        // pas encore appliquée. Ce n'est pas un échec : on recharge l'état réel (qui montre
        // bien l'inscription) puis on informe honnêtement, sans le message d'échec générique —
        // SAUF si ce rechargement lui-même échoue (V7.11.1), auquel cas le message de
        // rechargement honnête prend le pas (on ne sait alors même pas si l'état affiché est à
        // jour, `err.message` sur les prénoms serait prématuré).
        const reloaded = await reloadAgendaOrWarn(RSVP_RELOAD_FAILED_MESSAGE);
        if (reloaded) setDataError(err.message);
      } else {
        setDataError("Impossible d'enregistrer ta réponse — réessaie.");
      }
    } finally {
      setRsvpBusy(false);
    }
  }

  async function leaveEvent() {
    const event = resolveSelectedEvent();
    if (!event || !currentUserId || rsvpBusy || !myParticipation(event)) return;
    if (!isLiveEvent(event.id)) { setDataError(MOCK_FALLBACK_RSVP_MESSAGE); return; }
    setRsvpBusy(true);
    try {
      await agendaApi.leaveAgendaEvent(event.id, currentUserId);
      await reloadAgendaOrWarn(RSVP_RELOAD_FAILED_MESSAGE);
    } catch (err) {
      setDataError("Impossible d'enregistrer ta réponse — réessaie.");
    } finally {
      setRsvpBusy(false);
    }
  }

  async function modifyParticipation(newCounts) {
    const event = resolveSelectedEvent();
    const current = myParticipation(event);
    if (!event || !currentUserId || rsvpBusy || !current) return;
    if (!isLiveEvent(event.id)) { setDataError(MOCK_FALLBACK_RSVP_MESSAGE); return; }
    // attendeeNames inclus : si l'INSERT de restauration doit rejouer l'ancien état (voir
    // agendaApi.modifyAgendaParticipation), il doit restaurer les anciens prénoms aussi, pas
    // seulement les compteurs — sinon une modification échouée effacerait des prénoms qui
    // avaient pourtant bien été enregistrés avant la tentative.
    const oldCounts = { adultsCount: current.adultsCount, childrenCount: current.childrenCount, attendeeNames: current.attendeeNames };
    setRsvpBusy(true);
    // Le message métier est construit ici puis appliqué APRÈS le rechargement — pas dans
    // le même bloc que loadAgendaEvents(), qui fait lui-même setDataError('') en cas de
    // succès. Sans cette séparation, un rechargement réussi effaçait aussitôt le message
    // "restaurée" ou "perdue", rendant la promesse de signalement creuse.
    let failureMessage = '';
    try {
      await agendaApi.modifyAgendaParticipation(event.id, communityId, currentUserId, oldCounts, newCounts);
    } catch (err) {
      if (err.code === 'PARTICIPATION_LOST') {
        failureMessage = "Ta participation a été perdue suite à une erreur — réinscris-toi si besoin.";
      } else if (err.code === 'STALE_STATE') {
        failureMessage = "Ta participation avait changé entre-temps — l'état affiché vient d'être actualisé.";
      } else if (err.code === 'RESTORED_AFTER_FAILURE') {
        failureMessage = "La modification a échoué — ton ancienne réponse a été conservée.";
      } else if (err.code === 'ATTENDEE_NAMES_UNSUPPORTED') {
        // Point 2 : les compteurs de la modification ont bien été enregistrés — seuls les
        // prénoms n'ont pas pu l'être (migration 05 pas encore appliquée). Pas un échec de la
        // modification elle-même, mais l'utilisateur doit quand même le savoir explicitement.
        failureMessage = err.message;
      } else {
        failureMessage = "La modification a échoué — réessaie.";
      }
    }
    // On recharge l'état réel dans tous les cas — c'est la base qui fait foi, pas notre
    // supposition sur ce qui a marché — puis on applique le message métier par-dessus, SAUF si
    // ce rechargement lui-même échoue (V7.11.1) : dans ce cas précis, on ne peut de toute façon
    // pas confirmer lequel des messages métier ci-dessus reflète l'état réel (l'ancien état
    // local reste affiché tel quel — `loadAgendaEvents` n'a jamais appelé `setEvents` avant de
    // rejeter) — le message de rechargement honnête prend donc le pas sur `failureMessage`.
    const reloaded = await reloadAgendaOrWarn(RSVP_RELOAD_FAILED_MESSAGE);
    if (reloaded && failureMessage) setDataError(failureMessage);
    setRsvpBusy(false);
  }

  // V7.11 (P0) — Suppression réelle d'un événement, réservée au créateur ou à un admin (le
  // bouton lui-même n'est proposé par EventDetail.jsx qu'à ces deux profils — voir `canDeleteEvent`
  // ci-dessous — mais la policy RLS `delete_own_event_or_admin`, sql/02_rls.sql, non modifiée,
  // reste la garantie serveur indépendante si jamais l'interface se trompait ou qu'un appel était
  // forgé directement). Même contrat pessimiste que le reste de ce lot (P1) : "pending" immédiat
  // (`eventDeleteBusy`, avec protection anti double-clic explicite), mutation envoyée, PUIS
  // rechargement de l'état réel (agenda ET, puisqu'un message resté lié perd son
  // `linked_event_id` côté serveur — `on delete set null`, sql/02_rls.sql — messages aussi, pour
  // que le badge d'événement disparaisse sans attendre un rechargement de page complet), le
  // contrôle ne retombe qu'une fois ce rechargement terminé, jamais de mise à jour optimiste
  // locale (ni retrait immédiat de l'événement de `events`, ni retrait immédiat du badge sur le
  // message — les deux attendent la confirmation réelle du serveur, rechargée par
  // `loadAgendaEvents`/`loadMessages`). Sur succès : retour à la liste Agenda (brief explicite).
  // Sur échec : reste sur la fiche événement (jamais de navigation), erreur honnête affichée,
  // l'événement reste visible exactement comme avant le clic.
  async function deleteEvent(eventId) {
    if (!eventId || eventDeleteBusy) return false;
    setEventDeleteBusy(true);
    setDataError('');
    try {
      await agendaApi.deleteAgendaEvent(eventId);
      // V7.11.1 (correctif bug 2) : `reloadAgenda()` (agenda, PAS le rechargement messages
      // best-effort ci-dessous) doit désormais être isolé dans son propre `try/catch` — la
      // suppression elle-même a déjà réussi à ce stade, un échec de CE rechargement n'est donc
      // plus une "suppression échouée" (faux, trompeur) mais un rechargement de confirmation
      // manqué. Point crucial du correctif : cet échec ne doit JAMAIS atteindre `setView('agenda')`
      // ci-dessous en prétendant un succès complet — d'où le `return false` explicite ici, avant
      // toute navigation, plutôt que de laisser l'ancien comportement (avant ce correctif,
      // `loadAgendaEvents` avalait son erreur et `await reloadAgenda()` se résolvait quand même
      // normalement, ce qui menait tout droit à `setView('agenda')` malgré l'échec réel).
      try {
        await reloadAgenda();
      } catch (reloadErr) {
        setDataError("L'événement a été supprimé mais l'actualisation a échoué — réessaie ou recharge la page.");
        return false;
      }
      if (MESSAGES_FROM_SUPABASE) {
        // Best-effort délibéré : si CE rechargement échoue (souci réseau distinct de la
        // suppression, déjà réussie), on ne fait pas échouer la suppression pour autant — le
        // badge se remettra à jour au prochain chargement normal du fil (changement d'onglet,
        // Realtime, actualisation). V7.11.1 : `requestAndWait` peut désormais réellement
        // rejeter (avant ce correctif, ce `.catch(() => {})` était mort — `loadMessages` n'avait
        // jamais l'occasion de rejeter) — on ne l'avale plus en silence pour autant : trace
        // explicite pour le débogage (l'erreur honnête utilisateur, elle, a déjà été affichée
        // par `loadMessages` lui-même via `setMessagesError`, ce best-effort n'a pas à en
        // ajouter une seconde pour une action qui n'a jamais été promise comme bloquante).
        try {
          await reloadSchedulerRef.current.requestAndWait('messages', loadMessages);
        } catch (msgReloadErr) {
          console.warn('[ABCZed] Rechargement des messages après suppression d\'événement : échec (best-effort, non bloquant)', msgReloadErr);
        }
      }
      setView('agenda');
      return true;
    } catch (err) {
      setDataError("La suppression de l'événement a échoué — réessaie.");
      return false;
    } finally {
      setEventDeleteBusy(false);
    }
  }

  // V7.7 (P3) — Envoi réel. Contrat de retour explicite (boolean) avec Messages.jsx : `true`
  // signifie "le champ de saisie peut être vidé", `false` signifie "garder le texte tel quel,
  // rien n'a été persisté". Jamais de mise à jour optimiste locale du fil : après un envoi
  // réussi, on RECHARGE l'état réel (loadMessages), qui fait foi — un message qui semblerait
  // envoyé côté interface mais rejeté côté serveur (ex. RLS) ne doit jamais rester affiché.
  async function sendMessage({ text, linkedEventId }) {
    // Défense en profondeur : Messages.jsx bloque déjà l'envoi d'un texte vide/blanc côté
    // interface (bouton désactivé), mais on ne fait pas confiance à l'appelant pour ça seul.
    if (!(text || '').trim()) return false;
    if (!communityId || !currentUserId) {
      setMessagesError('Session invalide — reconnecte-toi.');
      return false;
    }
    try {
      await messagesApi.sendMessage(communityId, currentUserId, { text, linkedEventId });
    } catch (err) {
      // Interdiction explicite du brief : jamais une erreur réelle masquée ou transformée en
      // silence — message honnête, le texte reste dans le champ côté Messages.jsx (contrat de
      // retour `false`).
      setMessagesError("Le message n'a pas pu être envoyé — réessaie.");
      return false;
    }
    try {
      // V7.11 (P1) : passe par l'ordonnanceur partagé ('messages') — voir le commentaire sur
      // l'abonnement Realtime plus haut pour la raison (échos concurrents sur le même domaine).
      await reloadSchedulerRef.current.requestAndWait('messages', loadMessages);
    } catch (reloadErr) {
      // V7.11.1 (correctif bug 2) : le message a bien été envoyé ci-dessus (persisté côté
      // serveur) — seul le rechargement qui devait le faire apparaître a échoué. `true` reste le
      // retour correct (Messages.jsx peut vider le champ, le texte a bien été persisté ; le
      // renvoyer produirait un doublon, pas une correction) : l'erreur honnête est de toute
      // façon déjà affichée par `loadMessages` lui-même (`setMessagesError`) avant son rejet —
      // prévenant honnêtement que le fil affiché peut ne pas (encore) montrer ce message.
    }
    return true;
  }

  // P4 — Lier un message existant à un événement réel de l'Agenda. Messages.jsx ne propose ce
  // bouton qu'à l'auteur du message ou un admin (`isAdmin`, dérivé plus haut) — la policy
  // update_own_message_or_admin (sql/02_rls.sql) reste la garantie serveur indépendante.
  async function linkMessage(messageId, eventId) {
    try {
      await messagesApi.linkMessageToEvent(messageId, eventId);
    } catch (err) {
      setMessagesError("Impossible de lier ce message — réessaie.");
      return;
    }
    try {
      await reloadSchedulerRef.current.requestAndWait('messages', loadMessages);
    } catch (reloadErr) {
      // V7.11.1 (correctif bug 2) : la liaison a bien réussi côté serveur ci-dessus — seul le
      // rechargement qui devait la refléter à l'écran a échoué. Ne pas afficher "Impossible de
      // lier ce message" ici (ce serait faux) : l'erreur honnête de rechargement est déjà
      // affichée par `loadMessages` (`setMessagesError`) avant son rejet.
    }
  }

  async function editMessage(messageId, text) {
    if (!(text || '').trim() || messageMutationPendingIds.has(messageId)) return false;
    setMessageMutationPendingIds((prev) => new Set(prev).add(messageId));
    setMessagesError('');
    try {
      await messagesApi.updateMessageText(messageId, text);
      try {
        await reloadSchedulerRef.current.requestAndWait('messages', loadMessages);
      } catch {
        // La modification est persistée ; loadMessages a déjà affiché l'erreur de rechargement.
      }
      return true;
    } catch {
      setMessagesError("Le message n'a pas pu être modifié — réessaie.");
      return false;
    } finally {
      setMessageMutationPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }

  async function deleteMessage(messageId) {
    if (messageMutationPendingIds.has(messageId)) return false;
    setMessageMutationPendingIds((prev) => new Set(prev).add(messageId));
    setMessagesError('');
    try {
      await messagesApi.deleteMessage(messageId);
      try {
        await reloadSchedulerRef.current.requestAndWait('messages', loadMessages);
      } catch {
        // La suppression est persistée ; loadMessages a déjà affiché l'erreur de rechargement.
      }
      return true;
    } catch {
      setMessagesError("Le message n'a pas pu être supprimé — réessaie.");
      return false;
    } finally {
      setMessageMutationPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }

  // P5 — Réactions sécurisées (table normalisée message_reactions, sql/06). Toujours un
  // rechargement complet après mutation, jamais une fusion locale du payload — même principe
  // que sendMessage/linkMessage ci-dessus, cohérent avec le rechargement déclenché par Realtime
  // (P6) pour tout autre membre qui observerait le même changement.
  //
  // V7.11 (P1) — stratégie pessimiste unifiée, IDENTIQUE à celle déjà appliquée au RSVP
  // (joinEvent/leaveEvent/modifyParticipation ci-dessus, non réécrits pour ce lot puisqu'ils
  // suivaient déjà exactement ce contrat) : (1) passage immédiat en "pending" — POUR CE MESSAGE
  // PRÉCIS uniquement (`reactionPendingIds`, un Set, jamais un booléen global qui aurait
  // désactivé les réactions de tous les autres messages) ; (2) le contrôle concerné est
  // désactivé pendant ce temps (voir Messages.jsx, prop `reactionPendingIds`) ; (3) la mutation
  // Supabase est envoyée ; (4) l'état qui fait foi est rechargé via l'ordonnanceur partagé
  // ('messages' — même domaine que sendMessage/linkMessage/Realtime ci-dessus, jamais un
  // domaine 'reactions' séparé : les deux rechargent le MÊME appel réseau,
  // `loadMessages`, voir src/reloadScheduler.js) ; (5) le "pending" ne retombe qu'une fois ce
  // rechargement RÉELLEMENT terminé (`finally`) ; (6) en cas d'échec, l'état précédent est
  // conservé tel quel (aucun rechargement déclenché, `thread` n'est pas touché) et une erreur
  // honnête est affichée. Protection anti double-soumission explicite : un second appel pour LE
  // MÊME message pendant que le premier est encore en vol est purement et simplement ignoré.
  async function toggleMessageReaction(messageId, emoji) {
    if (!communityId || !currentUserId) return;
    if (reactionPendingIds.has(messageId)) return;
    setReactionPendingIds((prev) => new Set(prev).add(messageId));
    try {
      await messagesApi.toggleMessageReaction(messageId, communityId, currentUserId, emoji);
      try {
        await reloadSchedulerRef.current.requestAndWait('messages', loadMessages);
      } catch (reloadErr) {
        // V7.11.1 (correctif bug 2) : la réaction a bien été enregistrée côté serveur
        // ci-dessus — seul le rechargement qui devait la confirmer à l'écran a échoué. Ne pas
        // afficher "Impossible d'enregistrer ta réaction" ici (ce serait faux, la mutation a
        // réussi) : l'erreur honnête de rechargement est déjà affichée par `loadMessages`
        // (`setMessagesError`) avant son rejet. `thread` n'est pas touché (aucune mise à jour
        // optimiste) : aucune pastille fantôme n'apparaît tant que ce rechargement n'a pas
        // réussi — exactement le même contrat pessimiste qu'un échec de MUTATION, appliqué ici
        // à un échec de RECHARGEMENT (le point précis visé par ce correctif).
      }
    } catch (err) {
      setMessagesError("Impossible d'enregistrer ta réaction — réessaie.");
    } finally {
      setReactionPendingIds((prev) => {
        if (!prev.has(messageId)) return prev;
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }

  async function handleCreateEvent(payload) {
    if (AGENDA_FROM_SUPABASE) {
      if (!currentUserId) { setDataError('Session invalide — reconnecte-toi.'); return false; }
      // created_by vient de la session réelle, jamais d'une valeur fournie par l'interface — la
      // policy insert_own_event_in_own_community l'exige de toute façon (created_by =
      // auth.uid()), mais on ne veut pas non plus compter sur RLS pour rattraper un payload qui
      // aurait tenté de fournir un autre auteur.
      //
      // V7.11.2 (correctif doublon de création, contre-vérification indépendante) : l'INSERT est
      // désormais isolé dans SON PROPRE `try/catch`, séparé du rechargement qui suit. Seul un
      // échec de CET appel (l'INSERT lui-même) renvoie `false` : c'est le seul cas où aucune
      // ligne n'a été créée et où il est honnête de laisser CreateEventSheet.jsx rouvrir le
      // formulaire pour une nouvelle tentative.
      let createdId = null;
      try {
        const created = await agendaApi.createAgendaEvent(communityId, currentUserId, payload);
        createdId = created?.id || null;
      } catch (err) {
        setDataError("La création de l'événement a échoué — réessaie.");
        return false;
      }
      // L'INSERT ci-dessus a RÉELLEMENT réussi à ce stade — la ligne existe déjà côté serveur.
      // Avant ce correctif, un échec du RECHARGEMENT qui suit (`reloadAgendaOrWarn`, qui PEUT
      // désormais rejeter depuis V7.11.1 — voir son commentaire sur `loadAgendaEvents`) faisait
      // `return false` ICI, exactement le même signal que "l'INSERT a échoué". Or
      // CreateEventSheet.jsx (`submit()`) traite tout retour `!== true` comme un échec de
      // CRÉATION : le formulaire restait donc ouvert, `saving` retombait à `false`, le bouton
      // "Créer l'événement" redevenait actionnable — et un utilisateur voyant ce qui ressemblait
      // à un échec cliquait à nouveau, relançant un VRAI second `createAgendaEvent` avec le même
      // payload (aucune contrainte d'unicité ni de clé d'idempotence côté base ne l'empêche) :
      // doublon réel en base. Ce correctif ne laisse plus JAMAIS un échec de rechargement
      // retomber dans un `catch` d'échec de création : le message honnête ("créé mais
      // actualisation a échoué") reste affiché — via le bandeau `dataError`, déjà posé par
      // `reloadAgendaOrWarn` — mais SANS jamais faire renvoyer `false` à cette fonction, pour ne
      // jamais rouvrir le formulaire sur une création qui a pourtant déjà eu lieu. `setAgendaFilter`
      // ne bascule que si le rechargement a réussi (sinon la liste locale ne contient de toute
      // façon pas encore le nouvel événement).
      // V7.11 (P1) : passe désormais par l'ordonnanceur partagé ('agenda'), comme toutes les
      // autres mutations Agenda — voir `reloadAgenda()`.
      const reloaded = await reloadAgendaOrWarn(
        "L'événement a été créé mais l'actualisation a échoué — réessaie ou recharge la page.",
      );
      if (reloaded) {
        setAgendaFilter(payload.category);
        // V7.14 (correctif UAT point 14) : avant ce lot, une création réussie se contentait de
        // fermer la feuille et de changer le filtre Agenda, laissant l'utilisateur exactement
        // où il était (souvent l'Accueil, à une position de défilement quelconque) — jamais de
        // confirmation ni de destination informative. Destination choisie : la fiche du NOUVEL
        // événement lui-même (la plus informative — on y voit directement ce qui vient d'être
        // créé), `eventReturnTo` fixé à 'agenda' pour que la flèche "Retour" ramène vers
        // l'Agenda déjà filtré sur sa catégorie, jamais vers l'écran de départ (Accueil) qui n'a
        // plus rien à voir avec cette création. Repli sur l'Agenda seul si l'id n'a pas pu être
        // lu (`createdId` null — ne devrait pas arriver, défense en profondeur) plutôt qu'un
        // écran d'événement vide.
        setToastMessage('Événement créé.');
        if (createdId) {
          setEventReturnTo('agenda');
          setSelectedEventId(createdId);
          setView('event-detail');
        } else {
          setView('agenda');
        }
      }
      return true;
    }
    setEvents((prev) => [...prev, {
      id: 'evt-' + Date.now(),
      category: payload.category,
      subtype: payload.subtype,
      title: payload.title,
      description: payload.description,
      date: payload.date,
      startTime: payload.startTime || '',
      endTime: '',
      location: payload.location,
      attachments: [],
      participants: [],
      hasLinkedThread: false,
    }]);
    // Cohérence avec la branche Supabase ci-dessus, même si ce chemin est aujourd'hui
    // inatteignable (AGENDA_FROM_SUPABASE est figé à true) — pas de risque de course ici,
    // setEvents est synchrone, rien à attendre.
    setAgendaFilter(payload.category);
    return true;
  }

  // Brief §20 : chemin de création dédié, symétrique à handleCreateEvent mais jamais mélangé
  // avec lui — un anniversaire n'est pas un événement standard (pas de subtype, pas de date
  // complète, pas de lieu). Non vérifié sur le vrai schéma Supabase (voir agendaApi.js) :
  // implémenté ici pour ne pas bloquer le reste du lot, à confirmer avant usage réel.
  async function handleCreateBirthday(payload) {
    if (!currentUserId) { setDataError('Session invalide — reconnecte-toi.'); return false; }
    // V7.11.2 (correctif doublon de création) : même correctif, même raisonnement, que
    // handleCreateEvent ci-dessus — voir son commentaire détaillé. L'INSERT est isolé dans son
    // propre `try/catch` : seul un échec de CET appel (rien n'a été créé) renvoie `false` et
    // laisse AddBirthdaySheet.jsx rouvrir le formulaire. Un échec du rechargement qui suit ne
    // doit plus jamais être confondu avec un échec de création (l'ajout, lui, a déjà réussi à ce
    // stade) : le message honnête reste affiché via `dataError`, mais cette fonction renvoie
    // `true` pour que le formulaire se ferme et n'invite jamais un second INSERT du même
    // anniversaire.
    let createdId = null;
    try {
      const created = await agendaApi.createAgendaBirthday(communityId, currentUserId, payload);
      createdId = created?.id || null;
    } catch (err) {
      setDataError("L'ajout de l'anniversaire a échoué — réessaie.");
      return false;
    }
    const reloaded = await reloadAgendaOrWarn(
      "L'anniversaire a été ajouté mais l'actualisation a échoué — réessaie ou recharge la page.",
    );
    if (reloaded) {
      setAgendaFilter('anniversaire');
      // V7.14 (correctif UAT point 14) : même correction que handleCreateEvent ci-dessus, mais
      // un anniversaire n'a pas de fiche de détail propre (il n'ouvre qu'une feuille d'édition,
      // voir onOpenBirthday) — destination cohérente choisie ici : retour à l'Agenda, DÉJÀ
      // scrollé et surligné directement sur la ligne du nouvel anniversaire, via le même
      // mécanisme de surlignage que le reste de l'app (`navMemory` + `.nav-restore-highlight`,
      // appliqué par useScrollRestore.js au montage d'Agenda — voir son commentaire ; aucun
      // second mécanisme de scroll/surlignage inventé ici). `agenda-row-<id>` est exactement
      // l'id DOM que EventRow (Agenda.jsx) pose déjà sur chaque ligne.
      setToastMessage('Anniversaire ajouté.');
      if (createdId) {
        setNavMemory((prev) => captureNavState(prev, 'agenda', 0, `agenda-row-${createdId}`));
      }
      setView('agenda');
    }
    return true;
  }

  async function handleUpdateBirthday(eventId, payload) {
    try {
      await agendaApi.updateAgendaBirthday(eventId, payload);
    } catch {
      setDataError("La modification de l'anniversaire a échoué — réessaie.");
      return false;
    }
    await reloadAgendaOrWarn(
      "L'anniversaire a été modifié mais l'actualisation a échoué — réessaie ou recharge la page.",
    );
    return true;
  }

  async function handleDeleteBirthday(eventId) {
    if (!eventId || eventDeleteBusy) return false;
    setEventDeleteBusy(true);
    setDataError('');
    try {
      await agendaApi.deleteAgendaEvent(eventId);
    } catch {
      setDataError("La suppression de l'anniversaire a échoué — réessaie.");
      setEventDeleteBusy(false);
      return false;
    }
    // À ce stade la suppression est réellement persistée. Même si le rechargement échoue, la
    // feuille doit se fermer pour éviter qu'un second clic tente de supprimer à nouveau une
    // ligne qui n'existe déjà plus ; le bandeau explique alors honnêtement l'état affiché.
    try {
      await reloadAgenda();
    } catch {
      setDataError("L'anniversaire a été supprimé mais l'actualisation a échoué — recharge la page.");
    } finally {
      setEditingBirthday(null);
      setShowAddBirthday(false);
      setEventDeleteBusy(false);
    }
    return true;
  }

  // Backlog point 4 (23 sept.) — création/modification réelles via sharesApi.js. Même contrat
  // de retour qu'avant cette bascule ({ ok, error? }) pour qu'AddShareSheet.jsx n'ait rien à
  // changer de son propre côté : un échec (réseau, RLS, upload Storage) garde le formulaire
  // ouvert, erreur affichée inline, jamais une fermeture silencieuse qui ferait croire le
  // partage enregistré. `file` = objet File réel transmis tel quel par AddShareSheet.jsx
  // (`undefined`/`null` pour un partage 'lien'/'info', ou en modification sans remplacement).
  async function handleCreateShare(payload, file) {
    if (!communityId || !currentUserId) {
      return { ok: false, error: 'Session invalide — reconnecte-toi.' };
    }
    try {
      if (payload.id) {
        const previous = shares.find((s) => s.id === payload.id);
        await sharesApi.updateShare(payload.id, communityId, currentUserId, payload, file, previous?.filePath || null);
      } else {
        await sharesApi.createShare(communityId, currentUserId, payload, file);
      }
    } catch (err) {
      return { ok: false, error: "Le partage n'a pas pu être enregistré — réessaie." };
    }
    try {
      // Même raisonnement que sendMessage (P1, ordonnanceur partagé 'shares') — voir le
      // commentaire équivalent sur ce bloc pour Messages, non redupliqué ici.
      await reloadSchedulerRef.current.requestAndWait('shares', loadShares);
    } catch (reloadErr) {
      // Le partage a bien été enregistré ci-dessus (persisté côté serveur) — seul le
      // rechargement qui devait le faire apparaître a échoué. L'erreur honnête est déjà
      // affichée par loadShares lui-même (setSharesError) avant son rejet.
      console.warn('[ABCZed] Rechargement des partages après création/modification : échec (best-effort, non bloquant)', reloadErr);
    }
    return { ok: true };
  }

  async function handleDeleteShare(id) {
    const target = shares.find((s) => s.id === id);
    try {
      await sharesApi.deleteShare(id, target?.filePath || null);
    } catch (err) {
      setSharesError("La suppression du partage a échoué — réessaie.");
      return;
    }
    try {
      await reloadSchedulerRef.current.requestAndWait('shares', loadShares);
    } catch (reloadErr) {
      console.warn('[ABCZed] Rechargement des partages après suppression : échec (best-effort, non bloquant)', reloadErr);
    }
  }

  // Repli explicite : un tag ouvert depuis Messages/Partages (encore factices, ids type
  // 'evt-piscine') ne trouvera rien dans `events` (réel, ids Supabase). Sans ce repli,
  // EventDetail recevrait event=null et afficherait un écran vide au lieu de l'événement
  // fictif attendu — le même problème que celui qu'on corrige juste déplacé d'un cran.
  const selectedEvent = resolveEventById(events, MOCK_EVENTS, selectedEventId);
  // 6e passe : même résolution que selectedEvent (repli MOCK_EVENTS) — corrige le bug constaté
  // en usage réel où un événement encore mocké, référencé par un message/partage de
  // démonstration, devenait introuvable dans "Voir la discussion liée" dès qu'il n'existait pas
  // dans l'agenda réel (`events`).
  const filteredEvent = resolveEventById(events, MOCK_EVENTS, threadFilterEventId);

  // V7.7 (P4) : agendaApi.js mappe toujours `hasLinkedThread` à `false` en dur (commentaire
  // "Reconnecté au bloc Messages" dans agendaApi.js, puisque Messages n'était pas encore
  // branché avant ce lot) — recalculé ici à partir du VRAI fil (`thread`, chargé par
  // loadMessages) plutôt que depuis cette valeur figée, une fois MESSAGES_FROM_SUPABASE actif.
  // Un événement encore résolu par repli MOCK_EVENTS garde sa valeur d'origine (hors périmètre).
  const selectedEventWithThreadFlag = selectedEvent && MESSAGES_FROM_SUPABASE
    ? { ...selectedEvent, hasLinkedThread: thread.some((m) => m.linkedEventId === selectedEvent.id) }
    : selectedEvent;

  // Navigation "franche" (onglet du bas, ou lien "tout voir") : on quitte tout contexte de
  // ciblage précédent — pas de highlight résiduel, pas de faux "retour vers l'Accueil" qui
  // ne correspondrait plus à la façon dont on est arrivé sur la page.
  function goTo(tab) {
    setThreadFilterEventId(null);
    setHighlightMessageId(null);
    setHighlightShareId(null);
    // Une navigation franche (onglet du bas) abandonne toute provenance "douce" mémorisée
    // pour cet onglet — sans ça, revenir sur Messages/Partages par la nav du bas après un
    // détour par l'Accueil pourrait afficher à tort une flèche "Accueil" artificielle
    // (lot consolidé UX/navigation, point 1 : "si ouvert par la nav du bas, aucune flèche
    // retour artificielle ne doit apparaître").
    setSectionOriginState((prev) => clearSectionOrigin(prev, tab));
    // Une navigation franche (onglet du bas) abandonne aussi une éventuelle position de
    // lecture en attente pour l'onglet ciblé — cohérent avec le reste de cette fonction, qui
    // efface déjà tout contexte de ciblage précédent. Sans ce nettoyage, ré-ouvrir un onglet
    // par la nav du bas après un détour ailleurs pourrait restaurer un scroll obsolète au lieu
    // d'arriver en haut de page, comme attendu d'une navigation "franche".
    consumeNav(tab);
    setView(tab);
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Nunito Sans Variable', 'Nunito Sans', sans-serif", color: INK }}>
      <style>{`
        * { box-sizing: border-box; }
        button, input, select, textarea { font: inherit; }
        button, a { -webkit-tap-highlight-color: transparent; }
        button { cursor: pointer; touch-action: manipulation; }
        input, select, textarea { color: ${INK}; }
        input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid var(--section-accent, ${BLUE});
          outline-offset: 1px;
          border-color: transparent !important;
        }

        .page-shell { padding: 20px 20px 100px; --section-accent: ${BLUE}; }
        .icon-button {
          width: 44px !important; height: 44px !important; min-width: 44px; min-height: 44px;
          padding: 0 !important; display: inline-flex !important; align-items: center;
          justify-content: center; border-radius: 50%; touch-action: manipulation;
        }
        .search-field {
          min-height: 48px; padding: 0 4px 0 14px !important;
          box-shadow: 0 1px 0 rgba(23,32,51,0.02);
        }
        .filter-strip {
          display: flex; justify-content: center; gap: 6px; overflow-x: auto;
          margin-bottom: 14px; padding: 2px 1px 5px; scrollbar-width: none;
          scroll-snap-type: x proximity;
        }
        .filter-strip::-webkit-scrollbar { display: none; }
        .filter-strip > * { flex: 0 0 auto; scroll-snap-align: start; }
        /* V7.14 (correctif UAT, Partages) : à 320-360px, les 5 chips de Partages dépassaient
           la largeur visible de .filter-strip (défilement horizontal masqué — scrollbar-width:
           none ci-dessus — donc SANS indice visuel qu'il restait un chip hors champ, "Liens"
           dans les faits invisible sans le savoir). .filter-strip--wrap passe la ligne en
           multi-lignes (flex-wrap) au lieu du défilement : à une largeur donnée, elle NE
           déclenche que si le contenu ne tient réellement pas sur une ligne — donc toujours
           une seule ligne dès que la largeur le permet (≥400px pour ces 5 chips précis, mesuré),
           deux lignes en dessous, jamais de chip tronqué ni de défilement ccaché. Modificateur
           dédié plutôt qu'une modification globale de .filter-strip : Agenda.jsx utilise la
           même classe de base pour ses propres chips de catégorie et doit garder son
           défilement horizontal existant (hors périmètre de ce correctif, page non touchée). */
        .filter-strip--wrap { flex-wrap: wrap; overflow-x: visible; scroll-snap-type: none; }
        /* V7.14 — actions rapides de l'Accueil (Créer un événement / Écrire un message,
           V7.12) : grille à deux colonnes tant que les deux libellés y tiennent ; empilées
           verticalement en dessous, filet de sécurité pour un texte traduit plus long ou une
           police système plus large qu'ici, jamais un débordement horizontal (contrainte
           globale ≥320px). Mesuré sans régression à 320px avec le style solide actuel — voir
           le commentaire dans Accueil.jsx. */
        .home-quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 339px) {
          .home-quick-actions { grid-template-columns: 1fr; }
        }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
        .calendar-day { min-height: 46px; touch-action: manipulation; }
        .calendar-card { padding: 14px 12px; }

        /* Grammaire interactive commune (delta §9.1/§16/§24/§25) : mêmes retours visuels sur
           toutes les cartes/rangées/badges cliquables de l'application (La Bande, Agenda,
           Accueil, Messages, Partages, EventDetail...), pour ne pas réinventer un hover/focus
           différent à chaque écran. Deux variantes :
           - .tap-surface : l'élément LUI-MÊME est le bouton/la cible cliquable (rangées,
             badges, pastilles, chips) — assombrissement léger au survol/à l'appui, anneau de
             focus net au clavier. Un filtre CSS brightness() plutôt qu'une couleur de fond
             fixe : fonctionne aussi bien sur fond blanc que sur les fonds teintés par catégorie.
           - .tap-container : l'élément CONTIENT des actions distinctes (ex. carte Partages
             avec Ouvrir/Télécharger/Voir l'événement/menu ...) sans être lui-même une seule
             cible cliquable — la carte réagit légèrement dès qu'un de ses boutons a le focus
             ou le survol, ce qui signale "il y a des actions ici" sans mentir sur l'existence
             d'une action de carte entière qui n'existe pas.
           Aucune des deux ne dépend du hover seul (delta §25) : :active et :focus-visible sont
           couverts dans les deux cas, donc utilisables sans souris (clavier, tactile). */
        .tap-surface { transition: filter 0.15s ease, transform 0.05s ease; touch-action: manipulation; }
        .tap-surface:hover { filter: brightness(0.97); }
        .tap-surface:active { filter: brightness(0.93); transform: scale(0.99); }
        .tap-surface:focus-visible { outline: 2px solid var(--section-accent, ${BLUE}); outline-offset: 2px; }

        .tap-container { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        .tap-container:hover { box-shadow: 0 2px 10px rgba(23,32,51,0.07); }
        .tap-container:focus-within { outline: 2px solid var(--section-accent, ${BLUE}); outline-offset: 2px; }

        @media (max-width: 480px) {
          .page-shell { padding: 18px 14px 100px; }
          .filter-strip { justify-content: flex-start; margin-left: -2px; margin-right: -2px; }
          .calendar-card { padding: 12px 8px !important; }
          .calendar-grid { gap: 2px !important; }
          .calendar-day { min-height: 48px; padding-left: 0 !important; padding-right: 0 !important; }
        }

        /* À 360 px, les sept colonnes du calendrier gardent encore chacune une vraie
           cible tactile de 44 px sans provoquer de défilement horizontal. */
        @media (max-width: 380px) {
          .page-shell { padding-left: 6px; padding-right: 6px; }
          .calendar-card { padding-left: 2px !important; padding-right: 2px !important; }
          .calendar-grid { gap: 1px !important; }
        }

        @media (hover: none), (pointer: coarse) {
          .tap-surface:hover { filter: none; }
          .tap-surface:active { filter: brightness(0.92); transform: scale(0.985); }
        }

        /* Lot consolidé UX/navigation (point 6) : repère visuel bref "vous êtes ici" au
           retour d'une fiche — sans lui, filtre/recherche/scroll peuvent être corrects sans
           que l'utilisateur voie qu'il a bien retrouvé son point de départ exact. Un anneau
           temporaire (pas un fond, qui entrerait en conflit avec les styles inline déjà posés
           sur chaque carte/rangée) posé/retiré par useScrollRestore.js. */
        .nav-restore-highlight { animation: navRestorePulse 1.8s ease-out; }
        @keyframes navRestorePulse {
          0% { box-shadow: 0 0 0 3px ${BLUE}; }
          65% { box-shadow: 0 0 0 3px ${BLUE}; }
          100% { box-shadow: 0 0 0 0 rgba(13,71,161,0); }
        }
        /* 7e passe (brief pt 1, explicite) : la classe n'est déjà jamais posée par le JS si
           prefers-reduced-motion est actif (voir motionPrefs.js) — cette règle est une
           deuxième ligne de défense purement CSS, au cas où la classe serait posée par un
           autre chemin à l'avenir. */
        @media (prefers-reduced-motion: reduce) {
          .nav-restore-highlight { animation: none; box-shadow: 0 0 0 3px ${BLUE}; }
        }
      `}</style>

      <div className="max-w-md mx-auto" style={{ minHeight: '100vh', position: 'relative', background: BG }}>
        {/* Header cible (brief §2) : logo + avatar, simple et stable sur les 5 pages
            principales. Le + global a été supprimé (créations désormais contextuelles à
            chaque page : Agenda, Partages) et la loupe globale aussi (les 5 pages ont
            maintenant chacune leur propre recherche contextuelle — plus aucune page n'en a
            besoin). SearchOverlay.jsx reste sur disque mais n'est plus monté nulle part :
            plus aucun bouton ne l'ouvre, volontairement, plutôt que de le supprimer. */}
        {['accueil', 'agenda', 'messages', 'partages', 'labande'].includes(view) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
            <Logo size={30} />
            {/* V7.11 (P1) : remplace le "V" figé en dur — affiché auparavant quel que soit le
                compte réellement connecté (défaut confirmé en UAT réelle, A1 et A2 montraient
                tous deux la même lettre). `activeCommunity?.display_name` vient de
                `members.display_name` (AuthProvider.jsx, colonne ajoutée à la lecture pour ce
                lot) — jamais un fragment d'e-mail ni d'UUID. Voir
                src/components/ConnectedAvatar.jsx pour le repli neutre explicite (icône,
                jamais "V"/"?"/une initiale devinée) tant que ce profil n'est pas encore chargé. */}
            <ConnectedAvatar userId={currentUserId} displayName={activeCommunity?.display_name} size={30} onClick={() => setShowMyProfile(true)} />
          </div>
        )}

        {/* Bandeau "Partages affiche un contenu de démonstration" retiré le 23 septembre
            (backlog point 4) — ce module est désormais branché à Supabase (SHARES_FROM_SUPABASE,
            src/sharesApi.js) comme les quatre autres avant lui (Agenda/Messages/La Bande) ; le
            garder aurait été trompeur ("Interdiction de livraison trompeuse", même règle que les
            retraits précédents de ce même bandeau en V7.7/V7.18, visibles dans l'historique). */}
        {AGENDA_FROM_SUPABASE && dataError && (
          <div style={{ margin: '10px 20px 0', background: `${RED}14`, border: `1px solid ${RED}55`, borderRadius: 10, padding: '8px 12px', fontSize: 11.5, color: RED }}>
            {dataError}
          </div>
        )}
        {AGENDA_FROM_SUPABASE && loading && (
          <p style={{ textAlign: 'center', padding: 40, opacity: 0.5, fontSize: 13 }}>Chargement de l'agenda…</p>
        )}

        {!loading && (
          <>
            {view === 'accueil' && (
              <Accueil
                events={events}
                thread={thread}
                shares={shares}
                members={members}
                messagesLoading={messagesLoading}
                messagesError={messagesError}
                billet={billet}
                billetLoading={billetLoading}
                billetError={billetError}
                isAdmin={isAdmin}
                onSaveBillet={handleSaveBillet}
                onOpenEvent={(id, focusId) => openEvent(id, 'accueil', focusId)}
                onOpenMessage={(id, focusId) => enterSection('messages', 'accueil', { highlightId: id, focusId })}
                onOpenShare={(id, focusId) => enterSection('partages', 'accueil', { highlightId: id, focusId })}
                onOpenMember={(id, focusId) => openMember(id, 'accueil', focusId)}
                onViewAllMessages={() => enterSection('messages', 'accueil', { focusId: 'home-viewall-messages' })}
                onViewAllPartages={() => enterSection('partages', 'accueil', { focusId: 'home-viewall-partages' })}
                onCreateEvent={() => setShowCreate(true)}
                onWriteMessage={openMessageComposerFromAccueil}
                query={accueilQuery}
                onQueryChange={setAccueilQuery}
                restoreState={navMemory.accueil}
                onRestoreConsumed={() => consumeNav('accueil')}
              />
            )}
            {view === 'agenda' && (
              <Agenda
                events={events}
                onOpenEvent={(id, focusId) => openEvent(id, 'agenda', focusId)}
                onOpenBirthday={(id) => {
                  const birthday = events.find((event) => event.id === id && event.category === 'anniversaire');
                  if (!birthday) return;
                  setEditingBirthday(birthday);
                  setShowAddBirthday(true);
                }}
                onAdd={() => setShowCreate(true)}
                filter={agendaFilter}
                onFilterChange={setAgendaFilter}
                year={agendaYear}
                monthIndex={agendaMonthIndex}
                onMonthChange={(y, m) => { setAgendaYear(y); setAgendaMonthIndex(m); }}
                selectedDate={agendaSelectedDate}
                onSelectedDateChange={setAgendaSelectedDate}
                searchQuery={agendaSearchQuery}
                onSearchChange={setAgendaSearchQuery}
                restoreState={navMemory.agenda}
                onRestoreConsumed={() => consumeNav('agenda')}
              />
            )}
            {view === 'event-detail' && (
              <EventDetail
                event={selectedEventWithThreadFlag}
                currentUserId={currentUserId}
                onBack={() => setView(eventReturnTo)}
                onJoin={joinEvent}
                onLeave={leaveEvent}
                onModify={modifyParticipation}
                rsvpBusy={rsvpBusy}
                onOpenThread={() => { setThreadFilterEventId(selectedEvent.id); setView('thread'); }}
                // P5 (exercice de correction V7.5) : uniquement pour un événement réellement issu
                // de l'agenda Supabase (isLiveEvent) — un événement de démonstration
                // (Messages/Partages, MOCK_EVENTS) n'accepte de toute façon aucune inscription
                // réelle (MOCK_FALLBACK_RSVP_MESSAGE), l'avertissement "migration pas encore
                // appliquée" y serait donc trompeur, sans rapport avec ce cas.
                attendeeNamesUnsupported={isLiveEvent(selectedEvent?.id) && attendeeNamesUnsupported}
                // V7.11 (P0) : le bouton "Supprimer l'événement" n'est proposé QUE pour un
                // événement réellement issu de l'agenda Supabase (même garde-fou `isLiveEvent`
                // que pour le RSVP juste au-dessus — supprimer un événement encore mocké n'a pas
                // de sens, il n'existe pas côté serveur) ET seulement à son créateur ou à un
                // admin de la communauté (dérivé du rôle réel, `isAdmin`, jamais deviné côté
                // interface — voir le commentaire sur `isAdmin` en tête de ce fichier).
                canDeleteEvent={Boolean(
                  isLiveEvent(selectedEvent?.id)
                  && currentUserId
                  && (isAdmin || selectedEventWithThreadFlag?.createdBy === currentUserId),
                )}
                onDeleteEvent={() => deleteEvent(selectedEvent.id)}
                deleteBusy={eventDeleteBusy}
                // V7.11 (P1) : en-tête compact (logo + avatar connecté) — voir
                // src/components/CompactHeader.jsx pour la raison de ne PAS y dupliquer le
                // bouton "Retour" déjà présent juste en dessous.
                connectedUserId={currentUserId}
                connectedDisplayName={activeCommunity?.display_name}
                onOpenProfile={() => setShowMyProfile(true)}
              />
            )}
            {(view === 'messages' || view === 'thread') && (
              <Messages
                thread={thread}
                // V7.7 (P4) : plus MOCK_EVENTS — les vraies communautés de l'Agenda réel
                // (`events`, déjà chargées par loadAgendaEvents/AGENDA_FROM_SUPABASE), pour la
                // liaison à un événement ET pour résoudre le titre d'un événement déjà lié.
                events={events}
                linkedEvent={view === 'thread' ? filteredEvent : null}
                onSend={sendMessage}
                onLinkMessage={linkMessage}
                onToggleReaction={toggleMessageReaction}
                onEditMessage={editMessage}
                onDeleteMessage={deleteMessage}
                // V7.11 (P1) : quels messages ont une réaction en vol — voir le commentaire de
                // `toggleMessageReaction` ci-dessus pour le contrat pessimiste complet.
                reactionPendingIds={reactionPendingIds}
                messageMutationPendingIds={messageMutationPendingIds}
                focusComposerToken={focusComposerToken}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                messagesLoading={messagesLoading}
                messagesError={messagesError}
                // V7.11 (P1) : en-tête compact (thread uniquement — voir Messages.jsx, qui ne
                // l'affiche que quand `linkedEvent` est vrai ; la vue "messages" non filtrée
                // garde l'en-tête principal de App.jsx, déjà affiché juste au-dessus).
                connectedUserId={currentUserId}
                connectedDisplayName={activeCommunity?.display_name}
                onOpenProfile={() => setShowMyProfile(true)}
                // 6e passe (point 2/3) : la flèche ← de la discussion liée et le lien "Voir
                // tout le fil" ne font PLUS la même chose. La flèche revient à la fiche
                // événement qui a ouvert cette discussion (selectedEventId/eventReturnTo ne
                // sont pas touchés par onOpenThread, donc ils pointent toujours dessus) ; "Voir
                // tout le fil" quitte réellement le filtre et ouvre le fil général.
                onBackToEvent={() => setView('event-detail')}
                onExitFiltered={() => { setThreadFilterEventId(null); setView('messages'); }}
                onOpenEventFromTag={(id, focusId) => openEvent(id, view, focusId)}
                searchQuery={messagesQuery}
                onSearchChange={setMessagesQuery}
                highlightMessageId={highlightMessageId}
                onHighlightConsumed={() => setHighlightMessageId(null)}
                cameFromAccueil={sectionOrigin.messages === 'accueil'}
                // Lot consolidé UX/navigation (point 6) : setView direct, PAS goTo() — goTo()
                // est réservé à la navigation "franche" (barre du bas) et efface volontairement
                // navMemory.accueil ; ce retour doit au contraire le préserver, pour que
                // l'Accueil restaure scroll + recherche + repère visuel sur l'élément d'origine.
                onBackToAccueil={() => setView('accueil')}
                restoreState={navMemory.messages}
                onRestoreConsumed={() => consumeNav('messages')}
              />
            )}
            {view === 'partages' && (
              <Partages
                shares={shares}
                // Backlog point 4 : événements RÉELS de l'agenda Supabase (comme Messages
                // reçoit déjà `events` ci-dessus) — jamais MOCK_EVENTS, qui ne contient aucun
                // des événements qu'un partage réel peut désormais référencer.
                events={events}
                onDelete={handleDeleteShare}
                onEdit={(s) => { setEditingShare(s); setShowAddShare(true); }}
                onAdd={() => setShowAddShare(true)}
                onOpenEvent={(id, focusId) => openEvent(id, 'partages', focusId)}
                filter={partagesFilter}
                onFilterChange={setPartagesFilter}
                query={partagesQuery}
                onQueryChange={setPartagesQuery}
                highlightShareId={highlightShareId}
                onHighlightConsumed={() => setHighlightShareId(null)}
                cameFromAccueil={sectionOrigin.partages === 'accueil'}
                onBackToAccueil={() => setView('accueil')}
                restoreState={navMemory.partages}
                onRestoreConsumed={() => consumeNav('partages')}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                sharesLoading={sharesLoading}
                sharesError={sharesError}
              />
            )}
            {view === 'labande' && (
              <LaBande
                members={members}
                membersLoading={membersLoading}
                membersError={membersError}
                onOpenMember={(id, focusId) => openMember(id, 'labande', focusId)}
                query={labandeQuery}
                onQueryChange={setLabandeQuery}
                restoreState={navMemory.labande}
                onRestoreConsumed={() => consumeNav('labande')}
                isAdmin={isAdmin}
                communityId={communityId}
              />
            )}
            {view === 'member-detail' && <MemberDetail members={members} memberId={selectedMemberId} onBack={() => setView(memberReturnTo)} />}
          </>
        )}

        {showCreate && (
          <CreateEventSheet
            onClose={() => setShowCreate(false)}
            onCreate={handleCreateEvent}
            // V7.14 (points 12-14) : formulaire unifié, 'anniversaire' y est désormais créable
            // au même titre que les trois autres catégories (voir le commentaire en tête de
            // CreateEventSheet.jsx pour la décision produit qui remplace l'ancienne règle
            // verrouillée) — routage vers le bon gestionnaire selon la catégorie choisie.
            onCreateBirthday={handleCreateBirthday}
            // 'tous' -> pas de présélection ; les quatre autres filtres présélectionnent
            // désormais leur propre catégorie (anniversaire inclus).
            initialCategory={['sortie', 'ecole', 'autre', 'anniversaire'].includes(agendaFilter) ? agendaFilter : undefined}
          />
        )}
        {showAddBirthday && (
          // V7.14 : ce panneau n'est plus jamais ouvert en mode création (`editingBirthday`
          // vaut toujours un anniversaire réel désormais — voir onOpenBirthday ci-dessus et le
          // commentaire du bouton "Ajouter un anniversaire" dans Agenda.jsx) ; `onCreate` reste
          // passé pour que ce composant reste fonctionnel tel quel si un flux dédié en avait de
          // nouveau besoin, mais sa branche `editing === false` n'est plus atteinte en pratique.
          <AddBirthdaySheet
            key={editingBirthday?.id || 'new-birthday'}
            onClose={() => { setShowAddBirthday(false); setEditingBirthday(null); }}
            onCreate={handleCreateBirthday}
            birthday={editingBirthday}
            canManage={!editingBirthday || Boolean(currentUserId && (isAdmin || editingBirthday.createdBy === currentUserId))}
            onUpdate={handleUpdateBirthday}
            onDelete={handleDeleteBirthday}
            deleteBusy={eventDeleteBusy}
          />
        )}
        {showAddShare && (
          <AddShareSheet
            editingShare={editingShare}
            onClose={() => { setShowAddShare(false); setEditingShare(null); }}
            onCreate={handleCreateShare}
            events={events}
          />
        )}

        {showMyProfile && (
          <MyProfileSheet
            onClose={() => setShowMyProfile(false)}
            shareFlags={meShareFlags}
            onToggleShareFlag={toggleMeShareFlag}
          />
        )}

        {/* Brief §4 : la fiche événement peut venir de n'importe quel onglet désormais —
            l'onglet actif affiché doit refléter la provenance réelle (eventReturnTo),
            jamais "Agenda" par défaut. Même résolution pour member-detail depuis la 3e passe
            (memberReturnTo) : une fiche membre peut maintenant venir d'ailleurs que La Bande
            (ex. résultat de recherche de l'Accueil), donc BottomNav ne peut plus la mapper en
            dur sur 'labande' comme avant (voir BottomNav.jsx). */}
        <BottomNav
          active={view === 'event-detail' ? eventReturnTo : view === 'member-detail' ? memberReturnTo : view}
          onChange={goTo}
        />

        {/* V7.14 (correctif UAT point 14) : confirmation brève de création (événement ou
            anniversaire) — voir handleCreateEvent/handleCreateBirthday plus haut. */}
        <Toast message={toastMessage} onDismiss={() => setToastMessage('')} />
      </div>
    </div>
  );
}
