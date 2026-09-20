// V7.11 (P1) — Ordonnanceur de rechargement partagé, par domaine.
//
// Généralise le motif déjà utilisé ailleurs dans le projet — un identifiant de requête
// incrémenté à chaque tentative, comparé après l'attente réseau, pour qu'une réponse OBSOLÈTE
// n'écrase jamais un état plus récent (voir `messagesRequestId` dans App.jsx et `requestId` dans
// `loadMemberships`, AuthProvider.jsx, tous deux non remplacés par ce module — ils protègent un
// problème DIFFÉRENT et complémentaire : "cette réponse concerne-t-elle encore la communauté
// actuelle ?", une question que CE module ne se pose pas du tout). Ce que ce module ajoute,
// que ces deux gardes-fous existants ne faisaient pas : empêcher QUE DEUX RECHARGEMENTS DU MÊME
// DOMAINE PARTENT EN PARALLÈLE (ex. une mutation locale — j'ajoute une réaction — et un écho
// Realtime de cette même mutation, arrivés à quelques millisecondes d'écart), et garantir qu'au
// plus UN rechargement de rattrapage est effectué après celui déjà en vol — jamais une file
// d'attente illimitée, même si le domaine est sollicité 10 fois pendant qu'un chargement tourne.
//
// Décision de conception délibérée (voir MATRICE_LIVRAISON.md, section V7.11, P1) : les
// "domaines" utilisés par App.jsx sont 'messages' (couvre à la fois l'envoi/la liaison de
// messages ET les réactions — les deux sont relus par LE MÊME appel réseau, `loadMessages()`,
// qui renvoie déjà messages+réactions en un seul aller-retour ; leur donner deux clés de domaine
// séparées aurait autorisé exactement la course qu'on veut empêcher : deux appels
// `loadMessages()` réellement en vol en même temps) et 'agenda' (couvre à la fois les
// événements ET les RSVP/participants, relus ensemble par LE MÊME appel `loadAgendaEvents()`,
// même raisonnement).
//
// Module volontairement pur (aucun accès à React, `window`, `fetch`...) — testable directement
// en Node avec de faux "loaders" à résolution contrôlée, voir scripts/test-reload-scheduler.mjs,
// même principe que src/agendaSearch.js/src/reactions.js.
export function createReloadScheduler() {
  const domains = new Map(); // domain -> { inFlight, dirty, currentCycle, totalLoads, maxConcurrentObserved, concurrentNow }

  function domainState(domain) {
    let s = domains.get(domain);
    if (!s) {
      s = { inFlight: false, dirty: false, currentCycle: null, totalLoads: 0, maxConcurrentObserved: 0, concurrentNow: 0 };
      domains.set(domain, s);
    }
    return s;
  }

  // Exécute réellement `loader()`, puis, si le domaine a été marqué "dirty" PENDANT cette
  // attente, exécute `loader()` À NOUVEAU — et répète cette vérification après CHAQUE
  // chargement suivant, pas seulement une fois — jusqu'à ce qu'un chargement se termine avec
  // `dirty === false`. (Correctif V7.11.1 — voir MATRICE_LIVRAISON.md : la version précédente ne
  // faisait ce contrôle QU'UNE fois, "au plus un rattrapage" codé en dur ; une demande arrivée
  // pendant CE rattrapage lui-même repassait alors inaperçue — `dirty` restait à `true` alors que
  // plus rien n'était en vol pour le traiter, un état `{ inFlight: false, dirty: true }` bloqué
  // pour de bon. Cette boucle rend cet état structurellement impossible sur un cycle qui se
  // termine SANS erreur : elle ne s'arrête que sur un chargement qui laisse `dirty === false`.)
  // Le drapeau `dirty` reste booléen, jamais un compteur : une rafale de N demandes arrivées
  // PENDANT un même chargement (quel que soit son rang dans la boucle) ne produit jamais qu'UN
  // seul chargement supplémentaire, jamais N — la file reste bornée par le nombre de RAFALES de
  // demande reçues pendant un chargement en vol, jamais par le nombre de demandes lui-même.
  //
  // Gestion d'erreur (V7.11.1, voir bug 2 du correctif) : si `loader()` rejette, ce rejet est
  // immédiatement répercuté sur TOUT le cycle (jamais un faux succès pour un appelant qui
  // attendait ce chargement précis) — choix délibéré et documenté ici plutôt que dans App.jsx
  // seul, puisque c'est ce module qui décide du sort de `dirty` dans ce cas. Si le domaine avait
  // été marqué `dirty` PENDANT ce chargement en échec, ce marquage n'est PAS effacé : une
  // prochaine demande (`request`/`requestAndWait`) retrouvera le domaine "dirty" et pourra
  // retenter un chargement frais, plutôt que la demande arrivée pendant l'échec soit perdue en
  // silence. C'est l'unique cas où l'état final peut légitimement rester `{ inFlight: false,
  // dirty: true }` — jamais après un cycle qui se termine SANS erreur.
  async function runCycle(domain, s, loader) {
    s.inFlight = true;
    const cycle = (async () => {
      for (;;) {
        s.dirty = false;
        s.concurrentNow += 1;
        s.maxConcurrentObserved = Math.max(s.maxConcurrentObserved, s.concurrentNow);
        s.totalLoads += 1;
        try {
          await loader();
        } finally {
          s.concurrentNow -= 1;
        }
        if (!s.dirty) break;
      }
    })();
    s.currentCycle = cycle;
    try {
      await cycle;
    } finally {
      s.inFlight = false;
      s.currentCycle = null;
    }
  }

  // `request(domain, loader)` — déclenche un rechargement "en tâche de fond" (ex. Realtime) :
  // n'attend jamais un chargement déjà en vol, se contente de marquer le domaine "dirty" pour
  // qu'il soit rattrapé une fois celui en cours terminé. Ne renvoie jamais le résultat du
  // rechargement à l'appelant — pas adapté à un contrat pessimiste (voir `requestAndWait`).
  function request(domain, loader) {
    const s = domainState(domain);
    if (s.inFlight) { s.dirty = true; return s.currentCycle; }
    return runCycle(domain, s, loader);
  }

  // `requestAndWait(domain, loader)` — même mécanique, mais l'APPELANT reçoit la promesse du
  // cycle qui couvre sa propre demande (le chargement déjà en vol s'il y en avait un, PLUS son
  // rattrapage si ce chargement était déjà trop avancé pour refléter la mutation qu'on vient de
  // faire) — nécessaire pour le contrat pessimiste P1 : un contrôle ne doit sortir de son état
  // "pending" qu'une fois un rechargement qui reflète RÉELLEMENT sa propre mutation terminé,
  // jamais après un rechargement déjà lancé avant elle.
  function requestAndWait(domain, loader) {
    const s = domainState(domain);
    if (s.inFlight) {
      s.dirty = true;
      // `s.currentCycle` couvre déjà le rattrapage (voir runCycle) : par construction, quand ce
      // cycle se termine, `s.dirty` a été traité — donc l'appelant est notifié d'un état qui
      // tient bien compte de la mutation qu'il vient de faire, jamais d'un état intermédiaire.
      return s.currentCycle;
    }
    return runCycle(domain, s, loader);
  }

  // Réinitialise la comptabilité (jamais les promesses déjà en vol, qui continuent de se
  // résoudre normalement) — utilisé quand le CONTEXTE change sous les pieds du domaine (ex.
  // changement de communauté active) et qu'un rechargement frais, immédiat, sans passer par la
  // coalescence habituelle, est explicitement voulu (voir App.jsx : le chargement initial
  // Messages/Agenda après un changement de communauté n'utilise jamais `request`/
  // `requestAndWait`, justement pour ne jamais être retardé par un cycle en vol pour l'ancienne
  // communauté — mais sans ce reset, la comptabilité `inFlight` de cet ancien cycle resterait à
  // tort active, un problème que `messagesRequestId`/`requestId` (AuthProvider) traitent déjà
  // correctement pour l'ÉTAT affiché, pas pour cette comptabilité NOUVELLE, distincte).
  function reset(domain) {
    domains.delete(domain);
  }

  function isInFlight(domain) {
    return domainState(domain).inFlight;
  }

  // Introspection pure, sans effet de bord — utilisée par les tests (Node ET Playwright, ce
  // dernier via un pont exposé uniquement par le harnais, jamais par ce module lui-même, voir
  // test-harness/main.jsx) pour vérifier concrètement "jamais deux chargements en vol en
  // parallèle pour le même domaine" (`maxConcurrentObserved` ne doit jamais dépasser 1) plutôt
  // que de le supposer à partir du comportement observable seul.
  function stats(domain) {
    const s = domainState(domain);
    return { inFlight: s.inFlight, dirty: s.dirty, totalLoads: s.totalLoads, maxConcurrentObserved: s.maxConcurrentObserved };
  }

  return { request, requestAndWait, reset, isInFlight, stats };
}
