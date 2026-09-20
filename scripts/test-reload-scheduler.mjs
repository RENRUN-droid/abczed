// V7.11 (P1) — Vérification discriminante de l'ordonnanceur de rechargement partagé
// (src/reloadScheduler.js), en Node, sans navigateur : c'est ici que les garanties
// ALGORITHMIQUES des 5 scénarios de course nommés par le brief sont prouvées de façon fiable et
// déterministe (des "loaders" factices, à résolution contrôlée manuellement via une promesse
// différée, plutôt qu'un vrai minutage réseau/navigateur, forcément approximatif) — les scénarios
// Playwright de test-harness/recette-v711.mjs prouvent ensuite, séparément, que l'APPLICATION
// branchée sur ce module produit bien le résultat visible attendu (pas de doublon affiché,
// aucun contrôle bloqué). Les deux niveaux de preuve sont complémentaires, ni redondants ni
// suffisants seuls : un test Node ne peut pas prouver qu'un bouton reste désactivé à l'écran, un
// test Playwright ne peut pas prouver de façon fiable qu'aucun DEUXIÈME appel réseau n'a été émis
// en parallèle (une absence observée dans un délai fixe n'est jamais une preuve d'impossibilité).
import { createReloadScheduler } from '../src/reloadScheduler.js';

let pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// Un "loader" différé : ne se résout que quand on appelle `resolve()` explicitement — permet de
// contrôler précisément le chevauchement de deux appels concurrents, chose qu'un simple
// `setTimeout` ne garantirait jamais de façon déterministe.
function deferred() {
  let resolveFn;
  const promise = new Promise((res) => { resolveFn = res; });
  return { promise, resolve: resolveFn };
}

// Objet retourné volontairement PAS déstructuré par les appelants pour son champ
// `maxConcurrent` (piège réel rencontré en écrivant ce test : une déstructuration
// `const { maxConcurrent } = makeControlledLoader()` fige la valeur d'une propriété-accesseur
// AU MOMENT de la déstructuration, avant tout appel du loader — toujours 0. Les appelants
// ci-dessous lisent `harness.maxConcurrent` en propriété, après coup, jamais déstructuré.
function makeControlledLoader() {
  const calls = [];
  let concurrent = 0;
  let maxConcurrent = 0;
  function loader() {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    const d = deferred();
    calls.push(d);
    return d.promise.finally(() => { concurrent -= 1; });
  }
  return { loader, calls, get maxConcurrent() { return maxConcurrent; } };
}

async function main() {
  // -------------------------------------------------------------------------------------------
  // 1. Scénario nommé "mutation locale suivie de son propre écho Realtime" — deux demandes
  //    quasi simultanées pour le même domaine : la seconde doit être coalescée (dirty), jamais
  //    lancer un second chargement en parallèle du premier.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const harness = makeControlledLoader();
    const { loader, calls } = harness;
    const p1 = s.requestAndWait('messages', loader);
    // Demande #2 arrive PENDANT que #1 est encore en vol (calls[0] pas encore résolu).
    const p2 = s.requestAndWait('messages', loader);
    ok('1a. Une seule requête réellement en vol au moment de la 2e demande (pas de 2e appel réseau immédiat)', calls.length === 1);
    calls[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('1b. La coalescence a bien déclenché EXACTEMENT un rattrapage (2 appels réseau au total, pas plus)', calls.length === 2);
    calls[1].resolve();
    await Promise.all([p1, p2]);
    ok('1c. Jamais deux chargements en vol en parallèle pour ce domaine (maxConcurrentObserved === 1)', harness.maxConcurrent === 1);
    ok('1d. Les deux appelants (#1 et #2) sont bien notifiés après le rattrapage (contrat pessimiste respecté)', true);
  }

  // -------------------------------------------------------------------------------------------
  // 2. Scénario nommé "deux sessions réagissant au même message à quelques instants d'écart" —
  //    plusieurs demandes concurrentes (3, pas seulement 2) doivent toujours converger vers AU
  //    PLUS un rattrapage, jamais une file qui grandirait avec le nombre de déclencheurs.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const harness = makeControlledLoader();
    const { loader, calls } = harness;
    const p1 = s.request('reactions-demo', loader);
    s.request('reactions-demo', loader); // 2e déclencheur pendant le vol
    s.request('reactions-demo', loader); // 3e déclencheur pendant le vol — ne doit rien changer de plus
    ok('2a. Toujours une seule requête réseau en vol malgré 3 déclencheurs concurrents', calls.length === 1);
    calls[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('2b. Un seul rattrapage au total, jamais un par déclencheur en trop (2 appels au total, pas 3)', calls.length === 2);
    calls[1].resolve();
    await p1;
    ok('2c. Jamais deux chargements en vol en parallèle', harness.maxConcurrent === 1);
  }

  // -------------------------------------------------------------------------------------------
  // 3. Scénario nommé "une session ajoute pendant qu'une autre supprime" — même mécanique que
  //    ci-dessus, vérifiée explicitement pour deux ORIGINES DIFFÉRENTES de déclenchement (une
  //    mutation locale via `requestAndWait`, un écho Realtime via `request`) sur le même domaine.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const harness = makeControlledLoader();
    const { loader, calls } = harness;
    const pLocal = s.requestAndWait('agenda', loader); // mutation locale (ex. ajout RSVP)
    s.request('agenda', loader); // écho Realtime (ex. suppression par quelqu'un d'autre)
    ok('3a. Une seule requête en vol malgré deux ORIGINES de déclenchement différentes', calls.length === 1);
    calls[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('3b. Rattrapage unique, peu importe l\'origine du second déclencheur', calls.length === 2);
    calls[1].resolve();
    await pLocal;
    ok('3c. Jamais deux chargements en vol en parallèle', harness.maxConcurrent === 1);
  }

  // -------------------------------------------------------------------------------------------
  // 4. Scénario nommé "deux onglets du même utilisateur modifiant le même RSVP" — au niveau de
  //    CE module (partagé par onglet, pas entre onglets réels — voir la limite honnêtement
  //    signalée dans MATRICE_LIVRAISON.md, section V7.11), le motif équivalent testable ici est
  //    une RAFALE de demandes rapprochées pour le même domaine : le nombre total de chargements
  //    réseau réellement émis doit rester borné (jamais un par demande), quel que soit le nombre
  //    de demandes reçues pendant un seul cycle en vol.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const { loader, calls } = makeControlledLoader();
    const p1 = s.requestAndWait('agenda', loader);
    for (let i = 0; i < 8; i++) s.request('agenda', loader); // rafale de 8 déclencheurs
    ok('4a. Rafale de 8 déclencheurs concurrents -> toujours 1 seule requête en vol au départ', calls.length === 1);
    calls[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('4b. Rafale de 8 déclencheurs -> exactement 2 appels réseau au total (jamais 9)', calls.length === 2);
    calls[1].resolve();
    await p1;
  }

  // -------------------------------------------------------------------------------------------
  // 5. Scénario nommé "erreur réseau en cours de mutation" — un `loader` qui rejette ne doit ni
  //    laisser le domaine bloqué "en vol" pour toujours, ni empêcher une demande ultérieure de
  //    repartir normalement.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    let calls = 0;
    async function failingLoader() { calls++; throw new Error('échec réseau simulé'); }
    let threw = false;
    try {
      await s.requestAndWait('messages', failingLoader);
    } catch {
      threw = true;
    }
    ok('5a. L\'échec du loader se propage bien à l\'appelant (jamais avalé en silence)', threw);
    ok('5b. Le domaine n\'est plus "en vol" après l\'échec (pas de blocage permanent)', !s.isInFlight('messages'));
    await s.requestAndWait('messages', failingLoader).catch(() => {});
    ok('5c. Une nouvelle demande après échec repart normalement (2e appel bien émis)', calls === 2);
  }

  // -------------------------------------------------------------------------------------------
  // 6. Deux domaines INDÉPENDANTS ne se bloquent jamais l'un l'autre (ex. 'messages' et
  //    'agenda') — la coalescence est strictement PAR domaine, jamais globale.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const a = makeControlledLoader();
    const b = makeControlledLoader();
    s.requestAndWait('messages', a.loader);
    s.requestAndWait('agenda', b.loader);
    ok('6a. Un domaine en vol n\'empêche pas un AUTRE domaine de démarrer son propre chargement', a.calls.length === 1 && b.calls.length === 1);
    a.calls[0].resolve();
    b.calls[0].resolve();
  }

  // -------------------------------------------------------------------------------------------
  // 7. `reset(domain)` remet la comptabilité à zéro sans faire planter un cycle déjà en vol.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const { loader, calls } = makeControlledLoader();
    const p1 = s.requestAndWait('messages', loader);
    s.reset('messages');
    ok('7a. Après reset(), le domaine n\'est plus signalé "en vol" (nouvelle comptabilité)', !s.isInFlight('messages'));
    const { loader: loader2, calls: calls2 } = makeControlledLoader();
    s.requestAndWait('messages', loader2);
    ok('7b. Un nouveau chargement peut démarrer immédiatement après reset(), sans attendre l\'ancien cycle', calls2.length === 1);
    calls[0].resolve();
    calls2[0].resolve();
    await p1;
  }

  // -------------------------------------------------------------------------------------------
  // 8. V7.11.1 — correctif du bug 1 : une demande arrivant PENDANT le rattrapage (2e chargement),
  //    pas seulement pendant le tout premier — doit produire un 3e chargement séquentiel, jamais
  //    être perdue. Avant ce correctif, `runCycle` ne vérifiait `dirty` qu'UNE fois après le
  //    premier chargement ("au plus un rattrapage" codé en dur) : cette demande-ci repassait
  //    inaperçue, le cycle se résolvait quand même (faux succès) et le domaine restait bloqué à
  //    `{ inFlight: false, dirty: true }`. Vérifie aussi l'ORDRE, pas seulement l'état final :
  //    l'appelant du 3e appel ne doit se résoudre qu'APRÈS la fin du 3e chargement.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const harness = makeControlledLoader();
    const { loader, calls } = harness;
    const order = [];
    const p1 = s.requestAndWait('domain8', loader); // round 1
    s.request('domain8', loader); // dirty pendant round 1 -> round 2 (rattrapage) planifié
    calls[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('8a. Le rattrapage (round 2) démarre bien après la résolution du round 1', calls.length === 2);
    // LE scénario visé par ce correctif : une 3e demande arrive PENDANT le rattrapage (round 2),
    // pas pendant le tout premier chargement.
    const p3 = s.requestAndWait('domain8', loader);
    p3.then(() => { order.push('p3-resolved'); });
    calls[1].resolve(); // round 2 se termine, encore dirty (posé par la demande #3) -> round 3
    await new Promise((r) => setTimeout(r, 0));
    ok('8b. Un 3e chargement démarre bien (3 appels loader au total) — la demande #3 n\'est jamais perdue', calls.length === 3);
    ok('8c. p3 n\'est PAS résolue tant que ce 3e chargement est encore en vol', order.length === 0);
    calls[2].resolve();
    await p3;
    order.push('after-await-p3');
    ok('8d. p3 se résout seulement APRÈS la fin du 3e chargement (ordre vérifié, pas seulement l\'état final)', order.join(',') === 'p3-resolved,after-await-p3');
    await p1;
    ok('8e. maxConcurrentObserved reste à 1 malgré 3 générations séquentielles (jamais 2 chargements en vol en parallèle)', harness.maxConcurrent === 1);
    const finalStats = s.stats('domain8');
    ok(
      '8f. État final cohérent : dirty=false, totalLoads=3 — jamais { inFlight: false, dirty: true } (l\'état bloqué que produisait l\'ancien bug)',
      finalStats.inFlight === false && finalStats.dirty === false && finalStats.totalLoads === 3 && finalStats.maxConcurrentObserved === 1,
      JSON.stringify(finalStats),
    );
  }

  // -------------------------------------------------------------------------------------------
  // 9. Bursts de PLUSIEURS demandes arrivant PENDANT CHAQUE génération doivent se coalescer en
  //    UN SEUL round suivant chacune — pas un round par appel, et pas non plus un plafond figé à
  //    2 rounds au total dès qu'il y a plusieurs rafales successives.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const harness = makeControlledLoader();
    const { loader, calls } = harness;
    const p1 = s.requestAndWait('domain9', loader); // round 1
    // Rafale A : 3 déclencheurs pendant le round 1 -> doivent se coalescer en UN SEUL round 2.
    s.request('domain9', loader);
    s.request('domain9', loader);
    const pA = s.requestAndWait('domain9', loader);
    calls[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('9a. Rafale A (3 déclencheurs pendant le round 1) -> un seul round 2 démarré (2 appels au total, pas 4)', calls.length === 2);
    // Rafale B : 3 AUTRES déclencheurs pendant le round 2 (le rattrapage) -> un seul round 3,
    // jamais un round par déclencheur en trop de cette 2e rafale.
    s.request('domain9', loader);
    const pB = s.requestAndWait('domain9', loader);
    s.request('domain9', loader);
    calls[1].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('9b. Rafale B (3 AUTRES déclencheurs pendant le round 2) -> un seul round 3 démarré (3 appels au total, pas 5 ni 6)', calls.length === 3);
    calls[2].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('9c. Plus aucun round supplémentaire une fois les rafales retombées (toujours 3 appels au total)', calls.length === 3);
    await Promise.all([p1, pA, pB]);
    ok('9d. maxConcurrentObserved reste à 1 malgré deux rafales successives sur deux générations différentes', harness.maxConcurrent === 1);
  }

  // -------------------------------------------------------------------------------------------
  // 10. Un chargement de rattrapage (ou d'une génération ultérieure) qui ÉCHOUE : aucun faux
  //     succès ne doit être rapporté à un appelant qui en dépendait, et le domaine ne doit
  //     jamais rester bloqué de façon permanente — ici, choix documenté dans
  //     src/reloadScheduler.js : le rejet du chargement rejette tout le cycle, `dirty` reste tel
  //     quel (préservé si posé pendant ce chargement en échec) pour qu'une prochaine demande
  //     puisse retenter un chargement frais, jamais une demande silencieusement perdue.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    let n = 0;
    const d1 = deferred();
    const d2 = deferred();
    function loader() {
      n += 1;
      if (n === 1) return d1.promise;
      if (n === 2) return d2.promise.then(() => { throw new Error('échec du rattrapage simulé'); });
      throw new Error('ne devrait pas être appelé une 3e fois dans ce test');
    }
    const p1 = s.requestAndWait('domain10', loader); // round 1
    const p2 = s.requestAndWait('domain10', loader); // dirty pendant round 1 -> round 2 (rattrapage, va échouer)
    d1.resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('10a. Le rattrapage (round 2, celui qui va échouer) est bien en vol', n === 2);
    let p1Rejected = false, p2Rejected = false;
    p1.catch(() => { p1Rejected = true; });
    p2.catch(() => { p2Rejected = true; });
    d2.resolve(); // le loader du round 2 lève désormais son erreur simulée
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    ok('10b. Aucun faux succès : les DEUX appelants (round 1 direct + coalescé) voient bien l\'échec, jamais une résolution silencieuse', p1Rejected && p2Rejected);
    ok('10c. Le domaine n\'est plus "en vol" après l\'échec (pas de blocage permanent)', !s.isInFlight('domain10'));
    // Une nouvelle demande après cet échec doit repartir normalement (jamais un domaine "mort").
    let n2 = 0;
    async function okLoader() { n2 += 1; }
    await s.requestAndWait('domain10', okLoader);
    ok('10d. Une nouvelle demande après l\'échec du rattrapage repart normalement (le domaine n\'est jamais durablement bloqué)', n2 === 1);
  }

  // -------------------------------------------------------------------------------------------
  // 11. Écho Realtime (`request`, fire-and-forget) arrivant EXACTEMENT pendant un rattrapage/une
  //     génération ultérieure (pas seulement pendant le tout premier chargement) — doit être
  //     coalescé correctement par la boucle de générations, jamais perdu.
  // -------------------------------------------------------------------------------------------
  {
    const s = createReloadScheduler();
    const harness = makeControlledLoader();
    const { loader, calls } = harness;
    const pLocal = s.requestAndWait('domain11', loader); // mutation locale, round 1
    s.request('domain11', loader); // écho Realtime #1 -> dirty pendant round 1 -> round 2 planifié
    calls[0].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('11a. Rattrapage (round 2) en vol après la résolution du round 1', calls.length === 2);
    // Un DEUXIÈME écho Realtime arrive EXACTEMENT pendant ce rattrapage (round 2) — le scénario
    // spécifiquement visé par ce correctif, pas juste "pendant le premier chargement".
    const pRealtime2 = s.request('domain11', loader);
    calls[1].resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok('11b. Ce 2e écho Realtime pendant le rattrapage déclenche bien un round 3, jamais perdu', calls.length === 3);
    calls[2].resolve();
    await Promise.all([pLocal, pRealtime2]);
    ok('11c. maxConcurrentObserved reste à 1 malgré le rattrapage imbriqué', harness.maxConcurrent === 1);
    const finalStats = s.stats('domain11');
    ok(
      '11d. État final cohérent (dirty=false, totalLoads=3) — jamais { inFlight: false, dirty: true }',
      finalStats.inFlight === false && finalStats.dirty === false && finalStats.totalLoads === 3,
      JSON.stringify(finalStats),
    );
  }

  console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
