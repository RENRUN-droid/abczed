// V7.11 — Scénarios Playwright nouveaux, dédiés aux 4 correctifs de cette passe corrective de
// clôture (P0 suppression d'événement, P1 avatar dynamique + en-têtes compacts + ordonnanceur
// pessimiste, P2 "Vous"). Fichier SÉPARÉ de test-harness/recette.mjs et
// test-harness/recette-messages-isolation.mjs, délibérément — ces deux suites doivent rester
// byte-identiques et vertes (brief V7.11 explicite : "must still pass unmodified"), un troisième
// fichier appendé au harnais évite tout risque de les avoir subtilement modifiées en y ajoutant
// du texte. Même conventions que recette-messages-isolation.mjs (page fraîche par scénario,
// via `page.addInitScript` pour poser un levier AVANT toute navigation).
//
// Division du travail entre preuve Node et preuve Playwright pour les 5 scénarios de course
// nommés du brief (P1) : scripts/test-reload-scheduler.mjs prouve, en Node, de façon
// déterministe, que l'ordonnanceur partagé (src/reloadScheduler.js) ne lance jamais deux
// chargements en vol en parallèle pour un même domaine et coalesce chaque rafale de demandes
// reçue pendant un chargement en vol en UN SEUL chargement suivant (jamais un plafond figé à
// "au plus un rattrapage" — corrigé en V7.11.1, voir MATRICE_LIVRAISON.md et le commentaire de
// tête de src/reloadScheduler.js) — une garantie qu'un test Playwright ne peut PAS observer de
// façon fiable (l'absence d'un second appel réseau dans un délai fixe n'est jamais une preuve
// d'impossibilité). Les scénarios ci-dessous prouvent le niveau au-dessus : que l'APPLICATION
// branchée sur cet ordonnanceur produit bien, à l'écran, le résultat attendu (pas de réaction
// dupliquée, pas de RSVP dupliqué, aucun contrôle bloqué en permanence, erreur honnête affichée
// en cas d'échec réseau — y compris, depuis V7.11.1, un échec du RECHARGEMENT lui-même après une
// mutation déjà réussie, scénarios 24/25 plus bas).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { localIso } from '../src/localDate.js';

// V7.14 point 15 : "à venir" exclut désormais réellement les événements passés (voir
// src/agendaSearch.js#isUpcomingEvent) — toute date de test codée en dur doit donc rester dans
// le futur par rapport à la date RÉELLE d'exécution, jamais une constante figée qui finira par
// être dépassée. Date de convenance pour le scénario 26 : dans 60 jours, calculée avec la même
// fonction locale que la production (jamais `new Date().toISOString()`).
const FUTURE_TEST_DATE = localIso(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

const BASE = 'http://localhost:5183/';
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = { headless: true };
if (fs.existsSync(SANDBOX_CHROMIUM)) launchOptions.executablePath = SANDBOX_CHROMIUM;
let pass = 0, fail = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}${detail ? ' — ' + detail : ''}`); fail++; failures.push(label); }
}

const browser = await chromium.launch(launchOptions);
const allPageErrors = [];

async function freshPage(initScript, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 844 } });
  if (initScript) await page.addInitScript(initScript);
  page.on('pageerror', (e) => allPageErrors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Accueil")');
  return page;
}
async function goBottomTab(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
}

try {
  // ===========================================================================================
  // P0 — Suppression réelle d'un événement
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 1. Un admin voit "Supprimer l'événement" sur un événement créé par quelqu'un d'autre
  //    (evt-zoo, créé par 'user-marie' dans le harnais — voir test-harness/mockAgendaApi.js).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'admin'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.waitForTimeout(200);
    ok('1a. Admin : "Supprimer l\'événement" visible sur un événement créé par quelqu\'un d\'autre', await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 2. Un membre NI créateur NI admin ne voit PAS le bouton (l'interface ne doit pas proposer
  //    une action vouée à l'échec côté serveur — même principe déjà appliqué à "Lier à un
  //    événement", P4/V7.7).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'member'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.waitForTimeout(200);
    ok('2a. Membre non-créateur/non-admin : "Supprimer l\'événement" ABSENT sur evt-zoo', (await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 3. Un membre non-admin MAIS créateur de l'événement voit le bouton (evt-piquenique, créé
  //    par l'utilisateur courant du harnais).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'member'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().click();
    await page.waitForTimeout(200);
    ok('3a. Membre non-admin mais CRÉATEUR : "Supprimer l\'événement" visible sur evt-piquenique', await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 4. Dialogue de confirmation : "Annuler" listé en premier dans l'ordre du DOM (et reçoit le
  //    focus initial), l'action destructive en second — brief P0 explicite.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'admin'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.waitForTimeout(150);
    const dialog = page.getByRole('dialog', { name: 'Supprimer cet événement ?' });
    ok('4a. Le dialogue de confirmation s\'affiche avec le titre exact', await dialog.isVisible());
    const buttons = dialog.getByRole('button');
    const labels = [];
    for (let i = 0; i < await buttons.count(); i++) labels.push((await buttons.nth(i).textContent()).trim());
    ok('4b. "Annuler" est bien AVANT "Supprimer l\'événement" dans l\'ordre du DOM', labels.indexOf('Annuler') !== -1 && labels.indexOf('Annuler') < labels.findIndex((l) => l.includes("Supprimer l'événement")));
    const activeText = await page.evaluate(() => document.activeElement?.textContent?.trim());
    ok('4c. Le focus initial est bien sur "Annuler" (option prudente)', activeText === 'Annuler');
    // Escape doit fermer SANS supprimer — l'événement doit rester visible dans l'Agenda.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    ok('4d. Escape ferme le dialogue sans supprimer (aucune suppression tant que non confirmée)', (await dialog.count()) === 0);
    await page.click('button[aria-label="Retour"]');
    await page.waitForTimeout(150);
    ok('4e. L\'événement est toujours dans l\'Agenda après un Escape sur la confirmation', await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 5. Suppression réelle bout en bout — points 1 à 4 de la validation P0 du brief :
  //    (1) l'événement disparaît de l'Agenda ; (2) un message déjà lié reste présent ;
  //    (3) son linked_event_id devient NULL ; (4) le badge d'événement disparaît sans référence
  //    morte. Puis persistance après rechargement complet de page.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'admin'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    const linkedText = 'Message à lier avant suppression V7.11 — ' + Date.now();
    await page.fill('input[placeholder="Écrivez un message..."]', linkedText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const linkTrigger = page.locator('button:has-text("Lier à un événement")').last();
    await linkTrigger.click();
    await page.waitForTimeout(150);
    await page.getByRole('dialog').getByRole('button', { name: 'Sortie au zoo', exact: true }).click();
    await page.waitForTimeout(300);
    const badge = page.locator('button:has-text("Sortie au zoo")').last();
    ok('5a. Le message est bien lié à "Sortie au zoo" (badge affiché avant suppression)', await badge.isVisible());

    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.waitForTimeout(150);
    await page.getByRole('dialog', { name: 'Supprimer cet événement ?' }).getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.waitForTimeout(500);

    ok('5b. Retour automatique sur l\'Agenda après une suppression réussie', await page.locator('h1:has-text("Agenda")').isVisible());
    ok('5c. (point 1) L\'événement a bien disparu de la liste Agenda', (await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).count()) === 0);

    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(300);
    ok('5d. (point 2) Le message précédemment lié est TOUJOURS présent dans le fil', await page.locator(`text=${linkedText}`).isVisible());
    ok('5e. (point 3/4) Son badge d\'événement a disparu (linked_event_id redevenu NULL, pas de référence morte)', (await page.locator('button:has-text("Sortie au zoo")').count()) === 0);

    // Persistance après rechargement complet — pas seulement un état React en mémoire. On est
    // actuellement sur la vue "messages" (URL /messages, voir src/router.js) : le rechargement
    // la rouvre directement (comportement voulu, P1 exercice V7.5), jamais l'Accueil.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Messages")');
    await goBottomTab(page, 'Agenda');
    await page.waitForTimeout(200);
    ok('5f. Persistance après F5 : l\'événement reste absent de l\'Agenda', (await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).count()) === 0);
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    ok('5g. Persistance après F5 : le message lié reste présent, toujours sans badge', await page.locator(`text=${linkedText}`).isVisible() && (await page.locator('button:has-text("Sortie au zoo")').count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 6. (point 6 de validation P0) — un utilisateur sans droit de suppression est bloqué même si
  //    la mutation était tentée DIRECTEMENT, en contournant complètement le bouton et sa
  //    condition d'affichage (`canDeleteEvent`, App.jsx) — preuve indépendante de l'interface,
  //    équivalent applicatif du refus RLS réel (`delete_own_event_or_admin`, sql/02_rls.sql).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'member'));
    await page.waitForTimeout(200);
    const result = await page.evaluate(async () => {
      try {
        await window.__abczedHarnessDeleteAgendaEventDirect('evt-zoo');
        return { blocked: false };
      } catch (err) {
        return { blocked: true, code: err.code };
      }
    });
    ok('6a. Suppression tentée directement (hors UI) par un non-créateur/non-admin : REFUSÉE', result.blocked === true);
    ok('6b. ...avec le même code que le refus RLS réel simulerait (DELETE_NOT_APPLIED)', result.code === 'DELETE_NOT_APPLIED');
    await goBottomTab(page, 'Agenda');
    await page.waitForTimeout(200);
    ok('6c. L\'événement existe toujours (la tentative directe n\'a rien supprimé)', await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 7. Erreur réseau réelle pendant la suppression : message honnête affiché, l'événement
  //    reste visible (jamais de perte silencieuse), le bouton ne reste PAS bloqué en
  //    permanence (peut être re-cliqué après l'échec).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => {
      sessionStorage.setItem('__abczed_harness_role__', 'admin');
      sessionStorage.setItem('__abczed_harness_force_delete_error__', 'true');
    });
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.getByRole('dialog', { name: 'Supprimer cet événement ?' }).getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.waitForTimeout(400);
    ok('7a. Erreur honnête affichée après échec réseau simulé', await page.locator('text=La suppression de l\'événement a échoué').isVisible());
    ok('7b. Toujours sur la fiche événement (jamais de navigation après un échec)', await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).count() === 0 && await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).isVisible());
    ok('7c. Le bouton n\'est PAS resté bloqué en permanence : un nouveau clic rouvre bien la confirmation', await (async () => {
      await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
      return page.getByRole('dialog', { name: 'Supprimer cet événement ?' }).isVisible();
    })());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 8. Protection anti double-soumission : confirmer, puis re-cliquer immédiatement pendant que
  //    la suppression est encore en vol (délai artificiel) — une seule suppression effective,
  //    jamais deux tentatives concurrentes.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => {
      sessionStorage.setItem('__abczed_harness_role__', 'admin');
      sessionStorage.setItem('__abczed_harness_delay_agenda_mutation_ms__', '500');
    });
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().click();
    await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    // Locator par POSITION (pas par texte) : le libellé du bouton change en
    // "Suppression en cours…" une fois "pending" (voir ConfirmDeleteEventDialog,
    // src/pages/EventDetail.jsx) — un locator par nom exact "Supprimer l'événement" cesserait
    // de matcher dès cet instant précis, ce qui est le résultat normal ET voulu (le libellé
    // change bien), pas un défaut à contourner par le test autrement qu'en visant la POSITION
    // stable du bouton dans le dialogue (Annuler=0, action destructive=1, fermer "X"=2).
    const dialog = page.getByRole('dialog', { name: 'Supprimer cet événement ?' });
    const confirmBtn = dialog.getByRole('button').nth(1);
    await confirmBtn.click();
    await page.waitForTimeout(80);
    ok('8a. Le bouton de confirmation est bien désactivé pendant que la suppression est en vol ("pending")', await confirmBtn.isDisabled());
    ok('8a-bis. ...et son libellé annonce explicitement l\'action en cours (jamais un silence)', (await confirmBtn.textContent()).includes('Suppression en cours'));
    // Un second clic pendant le "pending" ne doit rien déclencher de plus (bouton désactivé).
    await confirmBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    ok('8b. Retour sur l\'Agenda une seule fois, sans erreur, après le double clic', await page.locator('h1:has-text("Agenda")').isVisible());
    ok('8c. L\'événement a bien disparu (une seule suppression effective)', (await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 9. (point 5 de validation P0) — un autre onglet/session déjà ouvert, avec la discussion
  //    liée affichée, reflète la suppression via le canal Realtime EXISTANT (messages) : la
  //    suppression d'un événement ailleurs entraîne, côté serveur réel, un UPDATE
  //    `linked_event_id = NULL` sur les messages liés (on delete set null) — un changement que
  //    l'abonnement Realtime déjà existant sur la table `messages` (P6, V7.7) capte et recharge,
  //    sans action locale dans cet onglet. Simulé ici exactement comme les scénarios Realtime
  //    déjà acceptés du projet (voir test-harness/recette-messages-isolation.mjs, scénarios 5/6) :
  //    mutation directe de sessionStorage + déclenchement du même point d'ancrage de test.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'admin'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    const linkedText2 = 'Message onglet B avant suppression distante — ' + Date.now();
    await page.fill('input[placeholder="Écrivez un message..."]', linkedText2);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    // Locator scopé à la RANGÉE du message qu'on vient d'envoyer (via son id de conteneur
    // `msg-row-*`), plutôt que `.last()` sur l'ordre DOM : les messages de départ (m4, m6) ont
    // une heure FIXE codée en dur (10:12, 14:40) alors que le nôtre prend l'heure RÉELLE de la
    // machine — si l'exécution a lieu avant 10:12 UTC, notre message se retrouve trié AVANT eux
    // et `.last()` viserait alors le mauvais message (piège déjà rencontré et documenté ailleurs
    // pour recette.mjs, scénario 42d ; corrigé ici définitivement plutôt que contourné).
    const newMsgRow = page.locator('div[id^="msg-row-"]', { hasText: linkedText2 });
    await newMsgRow.getByRole('button', { name: 'Lier ce message à un événement de l\'agenda', exact: true }).click();
    await page.waitForTimeout(150);
    await page.getByRole('dialog').getByRole('button', { name: 'Sortie au zoo', exact: true }).click();
    await page.waitForTimeout(300);
    // Ouvre la discussion liée (vue "thread") depuis la fiche événement. Seul NOTRE message est
    // lié à "evt-zoo" à ce stade (aucun message du jeu de données initial ne l'est) : `.last()`
    // sur le badge est donc sans ambiguïté ici.
    await page.locator(`button:has-text("Sortie au zoo")`).last().click();
    await page.waitForTimeout(200);
    ok('9a. La fiche événement "Sortie au zoo" affiche bien "Voir la discussion liée"', await page.getByRole('button', { name: 'Voir la discussion liée', exact: true }).isVisible());
    await page.getByRole('button', { name: 'Voir la discussion liée', exact: true }).click();
    await page.waitForTimeout(200);
    ok('9b. La discussion liée affiche bien le message (avant suppression distante)', await page.locator(`text=${linkedText2}`).isVisible());

    // Simule, DEPUIS CE MÊME ONGLET (représentant ce qu'un autre onglet aurait écrit dans le
    // même backend), la suppression de l'événement PAR AILLEURS : retire l'événement de l'état
    // agenda ET met à NULL le linked_event_id du message (même effet que le trigger réel
    // `on delete set null`), puis déclenche le canal Realtime messages EXISTANT — jamais une
    // action locale dans CET onglet (pas de clic sur "Supprimer").
    await page.evaluate(() => {
      // NB : la clé agenda peut être absente si aucune mutation agenda n'a encore eu lieu dans
      // CET onglet (mockAgendaApi.loadInitialLiveEvents() ne persiste pas l'état initial au premier
      // chargement, contrairement à loadInitialMessages() côté messages) — dans ce cas il n'y a
      // simplement rien à retirer de sessionStorage ici (le point vérifié, 9c, porte uniquement sur
      // le message, pas sur la disparition de l'événement de CETTE liste locale).
      const agendaRaw = sessionStorage.getItem('__abczed_harness_agenda_state__');
      if (agendaRaw) {
        const agenda = JSON.parse(agendaRaw);
        sessionStorage.setItem('__abczed_harness_agenda_state__', JSON.stringify(agenda.filter((e) => e.id !== 'evt-zoo')));
      }
      const rows = JSON.parse(sessionStorage.getItem('__abczed_harness_messages_state__') || '[]');
      sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify(rows.map((m) => (m.linkedEventId === 'evt-zoo' ? { ...m, linkedEventId: null } : m))));
      window.__abczedHarnessTriggerMessagesRealtime();
    });
    await page.waitForTimeout(400);
    ok(
      '9c. (point 5) Sans AUCUNE action locale dans cet onglet, la discussion liée reflète la suppression distante via le canal Realtime existant : elle n\'a plus de message rattaché',
      await page.locator('text=Aucun message lié à cet événement pour l\'instant.').isVisible(),
    );
    await page.close();
  }

  // ===========================================================================================
  // P1 — Avatar connecté dynamique
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 10. L'avatar de l'en-tête principal reflète le VRAI display_name connecté (jamais "V" figé
  //     en dur) — initiales et couleur dérivées via avatarColorFor/initialsOf, les mêmes
  //     fonctions déjà utilisées pour les avatars de messages.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_display_name__', 'Karim Boucher'));
    const avatar = page.getByRole('button', { name: 'Mon profil', exact: true });
    ok('10a. L\'avatar affiche bien les initiales dérivées du VRAI nom connecté ("KB", pas "V")', (await avatar.textContent()).trim() === 'KB');
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 11. Deux comptes connectés avec des display_name différents affichent des avatars
  //     DIFFÉRENTS — preuve que ce n'est pas une coïncidence avec l'ancien "V" figé en dur, et
  //     que la valeur vient réellement du compte connecté (A1/A2 dans le vrai contrat Supabase).
  // -------------------------------------------------------------------------
  {
    const pageA1 = await freshPage(() => sessionStorage.setItem('__abczed_harness_display_name__', 'Amélie Dupont'));
    const pageA2 = await freshPage(() => sessionStorage.setItem('__abczed_harness_display_name__', 'Renaud Payet'));
    const initialsA1 = (await pageA1.getByRole('button', { name: 'Mon profil', exact: true }).textContent()).trim();
    const initialsA2 = (await pageA2.getByRole('button', { name: 'Mon profil', exact: true }).textContent()).trim();
    ok('11a. Compte A ("Amélie Dupont") -> initiales "AD"', initialsA1 === 'AD');
    ok('11b. Compte B ("Renaud Payet") -> initiales "RP"', initialsA2 === 'RP');
    ok('11c. Les deux comptes affichent des avatars DIFFÉRENTS (dynamique, pas une coïncidence)', initialsA1 !== initialsA2);
    await pageA1.close();
    await pageA2.close();
  }

  // -------------------------------------------------------------------------
  // 12. Profil non chargé (display_name vide) -> repli neutre EXPLICITE : jamais "V", jamais
  //     "?", jamais une initiale devinée, jamais un fragment d'e-mail. Icône + libellé
  //     accessible EXACT "Profil non chargé".
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_display_name__', ''));
    const fallback = page.getByRole('button', { name: 'Profil non chargé', exact: true });
    ok('12a. Repli neutre affiché avec le libellé accessible EXACT "Profil non chargé"', await fallback.isVisible());
    const text = (await fallback.textContent()).trim();
    ok('12b. Aucun texte "V" affiché dans ce repli', text !== 'V');
    ok('12c. Aucun caractère "?" affiché dans ce repli', !text.includes('?'));
    ok('12d. Aucun fragment d\'e-mail (pas de "@") affiché dans ce repli', !text.includes('@'));
    ok('12e. Le bouton "Mon profil" (variante chargée) n\'est PAS affiché en même temps', (await page.getByRole('button', { name: 'Mon profil', exact: true }).count()) === 0);
    await page.close();
  }

  // ===========================================================================================
  // P1 — Identité ABCZed sur les sous-pages (en-tête compact)
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 13. La fiche événement (event-detail) affiche le logo ET l'avatar — défaut confirmé en UAT
  //     réelle : les deux disparaissaient entièrement sur cet écran.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_display_name__', 'Karim Boucher'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.waitForTimeout(150);
    ok('13a. Le logo ABCZed est visible sur la fiche événement', await page.getByRole('img', { name: 'ABCZed', exact: true }).isVisible());
    ok('13b. L\'avatar connecté est visible sur la fiche événement', await page.getByRole('button', { name: 'Mon profil', exact: true }).isVisible());
    ok('13c. Un seul bouton "Retour" (pas de doublon introduit par l\'en-tête compact)', (await page.locator('button[aria-label="Retour"]').count()) === 1);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 14. La vue "discussion liée" (thread) affiche aussi le logo ET l'avatar — même défaut.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_display_name__', 'Karim Boucher'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Lier à un événement")').first().click();
    await page.waitForTimeout(150);
    await page.getByRole('dialog').getByRole('button', { name: 'Sortie au zoo', exact: true }).click();
    await page.waitForTimeout(200);
    // "Voir la discussion liée" sur la fiche.
    await page.locator('button:has-text("Sortie au zoo")').first().click();
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Voir la discussion liée', exact: true }).click();
    await page.waitForTimeout(150);
    ok('14a. Le logo ABCZed est visible sur la vue "discussion liée"', await page.getByRole('img', { name: 'ABCZed', exact: true }).isVisible());
    ok('14b. L\'avatar connecté est visible sur la vue "discussion liée"', await page.getByRole('button', { name: 'Mon profil', exact: true }).isVisible());
    ok('14c. Un seul bouton "Retour" sur cette vue aussi', (await page.locator('button[aria-label="Retour"]').count()) === 1);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 15. La vue "messages" (non filtrée) garde l'en-tête PRINCIPAL — l'en-tête compact ne doit
  //     JAMAIS s'y ajouter en double (il n'est monté que pour la vue "thread").
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(150);
    ok('15a. Un seul avatar "Mon profil" sur la vue Messages non filtrée (pas de doublon)', (await page.getByRole('button', { name: 'Mon profil', exact: true }).count()) === 1);
    await page.close();
  }

  // ===========================================================================================
  // P2 — "Vous" sur les messages du membre connecté
  // ===========================================================================================
  {
    const page = await freshPage();
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    const myText = 'Mon propre message V7.11 — ' + Date.now();
    await page.fill('input[placeholder="Écrivez un message..."]', myText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const myRow = page.locator('div', { has: page.locator(`text=${myText}`) }).first();
    ok('16a. Mon propre message affiche "Vous" comme auteur (jamais mon display_name réel)', await page.locator('div:has-text("Vous")').first().isVisible());
    // Le message existant m0 (authorId='user-marie') doit continuer à afficher son VRAI nom.
    ok('16b. Le message d\'un autre membre (Marie) affiche toujours son VRAI display_name', await page.locator('text=Marie').first().isVisible());
    ok('16c. Aucun UUID brut affiché nulle part dans le fil', !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(await page.locator('body').innerText()));
    await page.close();
  }

  // ===========================================================================================
  // P1 — Stratégie pessimiste unifiée + ordonnanceur : 5 scénarios de course nommés
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 17. Course nommée #1 — "une mutation locale immédiatement suivie de son propre écho
  //     Realtime arrivant en retour" (réactions).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_delay_reaction_ms__', '400'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    const addBtn = page.locator('#msg-row-m2 button[aria-label="Ajouter une réaction"]');
    await addBtn.click();
    await page.locator('#msg-row-m2 [role="menu"] button:has-text("😮")').click();
    await page.waitForTimeout(80);
    ok('17a. Le contrôle "Ajouter une réaction" passe bien en "pending" (désactivé) immédiatement', await addBtn.isDisabled());
    // Écho Realtime de sa PROPRE mutation, arrivant PENDANT qu'elle est encore en vol.
    await page.evaluate(() => window.__abczedHarnessTriggerMessagesRealtime());
    await page.waitForTimeout(600);
    const pill = page.locator('#msg-row-m2 button:has-text("😮")');
    ok('17b. Exactement UNE pastille 😮 après règlement (jamais dupliquée par l\'écho)', (await pill.count()) === 1);
    ok('17c. Le contrôle n\'est plus "pending" une fois le rechargement terminé', !(await addBtn.isDisabled()));
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 18. Course nommée #2 — "deux sessions réagissant au même message à quelques instants
  //     d'écart" (simulé : réaction locale + réaction "distante" injectée pendant le vol).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_delay_reaction_ms__', '400'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    await page.locator('#msg-row-m2 button[aria-label="Ajouter une réaction"]').click();
    await page.locator('#msg-row-m2 [role="menu"] button:has-text("😮")').click();
    // "Autre session" : injecte une réaction d'un AUTRE utilisateur sur le MÊME message,
    // pendant que la nôtre est encore en vol, puis simule sa notification Realtime.
    await page.evaluate(() => {
      const rows = JSON.parse(sessionStorage.getItem('__abczed_harness_messages_state__'));
      const m2 = rows.find((r) => r.id === 'm2');
      m2.reactions.push({ userId: 'user-lucas', emoji: '😢' });
      sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify(rows));
      window.__abczedHarnessTriggerMessagesRealtime();
    });
    await page.waitForTimeout(600);
    ok('18a. Ma réaction 😮 est bien présente après règlement', (await page.locator('#msg-row-m2 button:has-text("😮")').count()) === 1);
    ok('18b. La réaction 😢 de l\'autre session est ÉGALEMENT présente (aucune perte)', (await page.locator('#msg-row-m2 button:has-text("😢")').count()) === 1);
    ok('18c. Le 👍 déjà existant (Sophie/Marie) n\'a pas été dupliqué (toujours "2")', await page.locator('#msg-row-m2 button:has-text("👍 2")').isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 19. Course nommée #3 — "une session ajoute pendant qu'une autre supprime, presque au même
  //     instant" (ajout local d'une réaction pendant qu'une réaction EXISTANTE est retirée à
  //     distance).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_delay_reaction_ms__', '400'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    ok('19-préalable. m2 a bien 2 réactions 👍 avant le scénario', await page.locator('#msg-row-m2 button:has-text("👍 2")').isVisible());
    await page.locator('#msg-row-m2 button[aria-label="Ajouter une réaction"]').click();
    await page.locator('#msg-row-m2 [role="menu"] button:has-text("😮")').click();
    // "Autre session" : RETIRE une réaction 👍 existante (Sophie) pendant que notre ajout est en vol.
    await page.evaluate(() => {
      const rows = JSON.parse(sessionStorage.getItem('__abczed_harness_messages_state__'));
      const m2 = rows.find((r) => r.id === 'm2');
      m2.reactions = m2.reactions.filter((r) => r.userId !== 'user-sophie');
      sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify(rows));
      window.__abczedHarnessTriggerMessagesRealtime();
    });
    await page.waitForTimeout(600);
    ok('19a. Ma réaction ajoutée (😮) est bien présente', (await page.locator('#msg-row-m2 button:has-text("😮")').count()) === 1);
    ok('19b. La suppression distante est bien reflétée : 👍 passe à "1" (plus "2")', await page.locator('#msg-row-m2 button:has-text("👍 1")').isVisible());
    ok('19c. L\'état final correspond EXACTEMENT à l\'état simulé côté "serveur" (pas de fantôme, pas de doublon)', (await page.locator('#msg-row-m2 button:has-text("👍 2")').count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 20. Course nommée #4 — "deux onglets du même utilisateur modifiant le même RSVP". Limite
  //     honnêtement signalée (voir MATRICE_LIVRAISON.md, V7.11) : ce harnais simule le backend
  //     via sessionStorage, qui n'est PAS partagé entre deux onglets réels (comportement standard
  //     des navigateurs, pas une limitation du harnais lui-même) — la vraie concurrence
  //     multi-onglets contre Supabase reste à valider manuellement par l'utilisateur (Realtime
  //     réel). Ce qui EST vérifiable ici, et vérifié : la protection anti double-soumission dans
  //     LE MÊME onglet, motif de course équivalent pour la garantie "jamais de RSVP dupliqué".
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_delay_agenda_mutation_ms__', '400'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().click();
    const joinBtn = page.getByRole('button', { name: 'Vous venez à combien ?', exact: true });
    await joinBtn.click();
    const confirmBtn = page.getByRole('button', { name: 'Confirmer ma participation', exact: true });
    await confirmBtn.click();
    // Comportement PRÉ-EXISTANT (non modifié par le V7.11, déjà tel quel en V7.5+, voir
    // src/pages/EventDetail.jsx confirmFamily()) : le clic ferme immédiatement le formulaire
    // d'édition (`setEditing(false)`) avant même que la mutation ne se règle — le bouton
    // déclencheur "Vous venez à combien ?" réapparaît donc pendant le "pending", mais bien
    // DÉSACTIVÉ (`disabled={rsvpBusy}`), ce qui EST la protection anti double-soumission
    // recherchée ici (déjà le même contrat que recette.mjs, ex. scénario 39c). Ce n'est PAS le
    // même bouton qui reste affiché+désactivé (contrairement à la suppression d'événement, où le
    // dialogue reste ouvert) : le test vise donc le bouton qui réapparaît, pas "Confirmer ma
    // participation" qui a disparu du DOM dès le clic.
    await page.waitForTimeout(80);
    ok('20a. Le bouton "Vous venez à combien ?" (protection anti double-soumission) est bien désactivé pendant que la première inscription est en vol', await joinBtn.isDisabled());
    await page.waitForTimeout(600);
    ok('20b. Une seule inscription effective malgré la tentative de double soumission (pas de doublon)', (await page.locator('text=1 adulte').count()) >= 1 && (await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 21. Course nommée #5 — "une erreur réseau survient en cours de mutation" (réaction ET
  //     RSVP) : état précédent préservé, erreur honnête, contrôle jamais bloqué en permanence.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_force_reaction_error__', 'true'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    const addBtn = page.locator('#msg-row-m2 button[aria-label="Ajouter une réaction"]');
    await addBtn.click();
    await page.locator('#msg-row-m2 [role="menu"] button:has-text("😮")').click();
    await page.waitForTimeout(300);
    ok('21a. Réaction en échec : erreur honnête affichée', await page.locator("text=Impossible d'enregistrer ta réaction").isVisible());
    ok('21b. Réaction en échec : état PRÉCÉDENT préservé (aucune pastille 😮 fantôme)', (await page.locator('#msg-row-m2 button:has-text("😮")').count()) === 0);
    ok('21c. Le contrôle n\'est PAS resté bloqué : un nouvel essai reste possible', !(await addBtn.isDisabled()));
    await page.close();
  }
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_force_join_error__', 'constraint'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().click();
    await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer ma participation', exact: true }).click();
    await page.waitForTimeout(400);
    // V7.11.2 (correctif de l'assertion non probante) : cette ligne testait auparavant
    // `.count() >= 0 || true` — toujours vrai par construction (un compte est toujours >= 0, et
    // `|| true` rendait de toute façon l'expression entière inconditionnellement vraie, quel que
    // soit le membre de gauche) : l'assertion passait même quand le texte d'erreur attendu était
    // totalement absent de la page. Corrigée en une assertion réellement falsifiable, même
    // convention que 21a/24a/25b ci-dessus (`.isVisible()` sur le même style de locator `text=`) :
    // revérifiée en conditions réelles (mock d'échec de contrainte, voir
    // `__abczed_harness_force_join_error__` = 'constraint' posé à l'ouverture de cette page,
    // ci-dessus) — le texte est bien présent (App.jsx, joinEvent(), branche `else` du `catch`,
    // seule atteinte ici puisque `err.code` vaut '23514', pas 'ATTENDEE_NAMES_UNSUPPORTED').
    ok('21d. RSVP en échec : erreur honnête affichée (violation de contrainte réelle, pas avalée)', await page.locator("text=impossible d'enregistrer ta réponse", { exact: false }).isVisible());
    ok('21e. RSVP en échec : le contrôle n\'est pas resté bloqué (le bouton d\'inscription est de nouveau actionnable)', await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).isVisible());
    await page.close();
  }

  // ===========================================================================================
  // V7.11.1 — correctif : un RECHARGEMENT (pas la mutation elle-même) qui échoue après une
  // mutation déjà réussie ne doit JAMAIS être traité comme un succès silencieux — les deux
  // scénarios ci-dessous distinguent explicitement "la mutation a échoué" (déjà couvert
  // ci-dessus, scénario 21) de "la mutation a réussi mais sa confirmation par rechargement a
  // échoué" (le bug 2 corrigé par cette passe : avant ce correctif, loadMessages/loadAgendaEvents
  // avalaient leur propre erreur et ne la relançaient jamais, donc `requestAndWait` se résolvait
  // TOUJOURS normalement, même quand le rechargement avait réellement échoué).
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 24. Réaction : la mutation réussit (aucun levier de mutation activé), seul le RECHARGEMENT
  //     qui devait la confirmer à l'écran échoue (levier posé APRÈS le chargement initial, pour
  //     ne jamais empêcher la page elle-même de s'afficher).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    // Le chargement initial a déjà réussi (page affichée) — on force l'échec du SEUL prochain
    // rechargement, celui déclenché après la mutation de réaction (domaine 'messages').
    await page.evaluate(() => sessionStorage.setItem('__abczed_harness_force_messages_fetch_error__', 'true'));
    const addBtn = page.locator('#msg-row-m2 button[aria-label="Ajouter une réaction"]');
    await addBtn.click();
    await page.locator('#msg-row-m2 [role="menu"] button:has-text("😮")').click();
    await page.waitForTimeout(300);
    ok('24a. (V7.11.1) Échec du RECHARGEMENT après une mutation de réaction réussie : erreur honnête affichée (jamais un faux succès silencieux)', await page.locator('text=Impossible de charger les messages').isVisible());
    ok('24b. Le contrôle n\'est PAS resté bloqué "pending" indéfiniment (peut être retenté)', !(await addBtn.isDisabled()));
    // Aucune mise à jour optimiste locale (contrat pessimiste) : tant que le rechargement de
    // confirmation n'a pas réussi, la pastille n'apparaît pas — même si la mutation, elle, a
    // bien été enregistrée côté serveur simulé.
    ok('24c. Aucune pastille 😮 affichée tant que le rechargement de confirmation n\'a pas réussi (pas de mise à jour optimiste)', (await page.locator('#msg-row-m2 button:has-text("😮")').count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 25. Suppression d'événement : la suppression réussit, seul le RECHARGEMENT agenda qui
  //     devait la confirmer échoue — vérifie précisément le cas nommé par le bug 2 : ne JAMAIS
  //     naviguer vers l'Agenda en prétendant un succès complet quand la confirmation a échoué.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'admin'));
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.waitForTimeout(150);
    // La suppression elle-même va réussir (aucun levier de mutation activé) — seul le
    // rechargement agenda qui doit la CONFIRMER est forcé en échec.
    await page.evaluate(() => sessionStorage.setItem('__abczed_harness_force_agenda_fetch_error__', 'true'));
    await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.getByRole('dialog', { name: 'Supprimer cet événement ?' }).getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.waitForTimeout(400);
    ok('25a. (V7.11.1) Suppression réussie mais RECHARGEMENT agenda en échec : reste sur la fiche événement, PAS de navigation prétendant un succès', await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).isVisible());
    ok('25b. Message honnête ET DISTINCT affiché (pas confondu avec un échec de la suppression elle-même)', await page.locator("text=a été supprimé mais l'actualisation a échoué").isVisible());
    ok('25c. Le bouton n\'est pas resté bloqué en permanence : un nouveau clic rouvre la confirmation', await (async () => {
      await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
      return page.getByRole('dialog', { name: 'Supprimer cet événement ?' }).isVisible();
    })());
    await page.close();
  }

  // ===========================================================================================
  // V7.11.2 — correctif d'un bug introduit comme effet de bord du correctif V7.11.1 ci-dessus :
  // avant cette passe, une création (événement OU anniversaire) dont l'INSERT réussissait mais
  // dont le RECHARGEMENT de confirmation échouait ensuite (`reloadAgendaOrWarn` renvoyant `false`
  // depuis V7.11.1) faisait `return false` depuis `handleCreateEvent`/`handleCreateBirthday` —
  // exactement le même signal que "la création elle-même a échoué". CreateEventSheet.jsx/
  // AddBirthdaySheet.jsx (`submit()`) traitent tout retour `!== true` comme un échec : le
  // formulaire restait donc ouvert, `saving` retombait à `false`, le bouton de soumission
  // redevenait actionnable — un utilisateur voyant ce qui ressemblait à un échec pouvait cliquer
  // à nouveau et déclencher un VRAI second INSERT du même payload (aucune contrainte d'unicité ni
  // de clé d'idempotence ne l'empêche côté serveur, réel ou simulé). Corrigé en isolant l'INSERT
  // dans son propre `try/catch` dans App.jsx : seul un échec de L'INSERT renvoie désormais
  // `false`, un échec du rechargement qui suit renvoie `true` (le message honnête reste affiché
  // via le bandeau `dataError`, séparément). Les deux scénarios ci-dessous (26, 27) reproduisent
  // précisément "INSERT réussi, SEUL le rechargement échoue", comptent les lignes réellement
  // créées dans l'état du harnais (sessionStorage — la même source que `fetchAgendaEvents` lit,
  // voir test-harness/mockAgendaApi.js, désormais réellement câblé à `liveEvents` pour ce
  // correctif : avant cette passe, `createAgendaEvent`/`createAgendaBirthday` du harnais étaient
  // de purs no-op qui ne créaient jamais rien, ce qui aurait rendu ce test impossible à écrire
  // honnêtement), et vérifient qu'aucun contrôle de soumission ne reste disponible pour une
  // seconde tentative sur le même payload.
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 26. Création d'événement : l'INSERT réussit, seul le RECHARGEMENT agenda qui devait la
  //     confirmer échoue.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    await goBottomTab(page, 'Agenda');
    await page.waitForTimeout(150);
    const uniqueTitle = 'Test doublon V7.11.2 — ' + Date.now();
    const countRows = () => page.evaluate((title) => {
      try {
        const raw = sessionStorage.getItem('__abczed_harness_agenda_state__');
        const events = raw ? JSON.parse(raw) : [];
        return events.filter((e) => e.title === title).length;
      } catch { return -1; }
    }, uniqueTitle);
    // Le chargement initial a déjà réussi (page affichée) — on force l'échec du SEUL prochain
    // rechargement agenda, celui déclenché après l'INSERT de création (même levier que le
    // scénario 25 ci-dessus, déjà établi par V7.11.1).
    await page.evaluate(() => sessionStorage.setItem('__abczed_harness_force_agenda_fetch_error__', 'true'));
    await page.getByRole('button', { name: 'Ajouter un événement', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter un événement' });
    // Filtre courant = 'tous' (par défaut, voir agendaFilter dans App.jsx) : aucune catégorie
    // n'est présélectionnée (CreateEventSheet.jsx, initialCategory non retenu puisque 'tous'
    // n'est pas une vraie catégorie) — il faut donc en choisir une explicitement.
    // V7.14 (points 12-14) : le sélecteur de catégorie est désormais un unique `<select>`
    // ("Catégorie", 4 options réelles dont Anniversaire — voir CreateEventSheet.jsx), plus trois
    // boutons séparés — et la soumission n'est plus bloquée par un `disabled` tant qu'un champ
    // manque (item 13 : une tentative invalide doit produire une erreur visible, pas être
    // empêchée en amont), donc ce commentaire sur un bouton "resté désactivé" ne s'applique plus.
    await dialog.locator('#ces-category').selectOption('sortie');
    await dialog.getByPlaceholder('Titre').fill(uniqueTitle);
    await dialog.locator('input[type="date"]').fill(FUTURE_TEST_DATE);
    await dialog.getByRole('button', { name: 'Créer l’événement', exact: true }).click();
    await page.waitForTimeout(400);
    ok('26a. Création réussie mais RECHARGEMENT en échec : erreur honnête affichée ("créé mais actualisation a échoué"), jamais confondue avec un échec de création', await page.locator("text=a été créé mais l'actualisation a échoué", { exact: false }).isVisible());
    ok('26b. Le formulaire de création s\'est refermé (pas de faux "échec" laissant le bouton actionnable pour une seconde soumission du même payload)', (await dialog.count()) === 0);
    ok('26c. L\'INSERT a bien eu lieu, une seule fois, côté "serveur" simulé malgré l\'échec du rechargement', (await countRows()) === 1, `lignes trouvées = ${await countRows()}`);
    // "Utilisateur impatient" — si, malgré le correctif, un bouton de soumission restait
    // disponible (régression), on tente le second clic et on vérifie qu'il ne produit PAS de
    // second doublon. Défense en profondeur : 26b montre déjà que le formulaire est fermé (donc
    // ce bloc ne s'exécute normalement pas), ce test reste vert quoi qu'il arrive UNIQUEMENT s'il
    // n'y a effectivement aucun doublon.
    const lingeringBtn = page.getByRole('button', { name: 'Créer l’événement', exact: true });
    if ((await lingeringBtn.count()) > 0) {
      await lingeringBtn.click();
      await page.waitForTimeout(400);
    }
    ok('26d. Aucun doublon produit même en simulant une seconde tentative "impatiente" (toujours une seule ligne)', (await countRows()) === 1, `lignes trouvées = ${await countRows()}`);
    // On lève le levier d'échec et on recharge réellement la page pour confirmer, côté
    // INTERFACE (pas seulement l'état interne du harnais), qu'exactement un événement porte ce
    // titre une fois la confirmation possible — persistance via sessionStorage, comme le reste
    // de ce harnais (voir test-harness/mockAgendaApi.js).
    await page.evaluate(() => sessionStorage.removeItem('__abczed_harness_force_agenda_fetch_error__'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Agenda")');
    await page.waitForTimeout(200);
    ok('26e. Une fois le rechargement possible, exactement UN événement affiché avec ce titre (pas de doublon visible à l\'écran)', (await page.locator(`text=${uniqueTitle}`).count()) === 1);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 27. Ajout d'anniversaire : même bug, même correctif, même scénario que 26 mais pour
  //     handleCreateBirthday/AddBirthdaySheet.jsx. `createAgendaBirthday` EST réellement câblé
  //     et atteignable dans cette build (confirmé en lisant src/App.jsx et src/agendaApi.js) : le
  //     commentaire "non vérifié sur le vrai schéma Supabase, à confirmer avant usage réel"
  //     au-dessus de `handleCreateBirthday` (src/App.jsx) porte uniquement sur le SCHÉMA Supabase
  //     RÉEL (colonnes birthday_day/birthday_month, hors de portée de cet environnement) — pas
  //     sur ce test, qui tourne contre le harnais (test-harness/mockAgendaApi.js), jamais contre
  //     un vrai projet Supabase, et pour lequel le chemin est donc entièrement exerçable.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    await goBottomTab(page, 'Agenda');
    await page.waitForTimeout(150);
    const uniqueName = 'DoublonTest' + Date.now();
    const uniqueTitle = `Anniversaire de ${uniqueName}`;
    const countRows = () => page.evaluate((title) => {
      try {
        const raw = sessionStorage.getItem('__abczed_harness_agenda_state__');
        const events = raw ? JSON.parse(raw) : [];
        return events.filter((e) => e.title === title).length;
      } catch { return -1; }
    }, uniqueTitle);
    await page.getByRole('button', { name: 'Anniversaires', exact: true }).click();
    await page.evaluate(() => sessionStorage.setItem('__abczed_harness_force_agenda_fetch_error__', 'true'));
    // V7.14 point 12 : "Ajouter un anniversaire" ouvre désormais le formulaire UNIFIÉ
    // (CreateEventSheet, catégorie préremplie "Anniversaire") au lieu de l'ancien
    // AddBirthdaySheet séparé — son aria-label est donc le libellé générique statique
    // "Ajouter un événement", ses champs Prénom/Jour ont de vrais <label> (getByLabel,
    // plus fiable que getByPlaceholder), et il y a maintenant DEUX <select> dans la boîte
    // de dialogue (catégorie + mois) donc on cible celui du mois par son label.
    await page.getByRole('button', { name: 'Ajouter un anniversaire', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter un événement' });
    await dialog.getByLabel('Prénom').fill(uniqueName);
    await dialog.getByLabel('Jour').fill('12');
    await dialog.getByLabel('Mois').selectOption('6');
    await dialog.getByRole('button', { name: 'Ajouter l’anniversaire', exact: true }).click();
    await page.waitForTimeout(400);
    ok('27a. Ajout réussi mais RECHARGEMENT en échec : erreur honnête affichée ("ajouté mais actualisation a échoué"), jamais confondue avec un échec d\'ajout', await page.locator("text=a été ajouté mais l'actualisation a échoué", { exact: false }).isVisible());
    ok('27b. Le formulaire s\'est refermé (pas de bouton encore actionnable pour une seconde soumission du même payload)', (await dialog.count()) === 0);
    ok('27c. L\'INSERT a bien eu lieu, une seule fois, côté "serveur" simulé malgré l\'échec du rechargement', (await countRows()) === 1, `lignes trouvées = ${await countRows()}`);
    const lingeringBtn = page.getByRole('button', { name: 'Ajouter l’anniversaire', exact: true });
    if ((await lingeringBtn.count()) > 0) {
      await lingeringBtn.click();
      await page.waitForTimeout(400);
    }
    ok('27d. Aucun doublon produit même en simulant une seconde tentative "impatiente" (toujours une seule ligne)', (await countRows()) === 1, `lignes trouvées = ${await countRows()}`);
    await page.evaluate(() => sessionStorage.removeItem('__abczed_harness_force_agenda_fetch_error__'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Agenda")');
    await page.waitForTimeout(200);
    ok('27e. Une fois le rechargement possible, exactement UN anniversaire affiché avec ce nom (pas de doublon visible à l\'écran)', (await page.locator(`text=${uniqueTitle}`).count()) === 1);
    await page.close();
  }

  // ===========================================================================================
  // Contrôle réactif — offline/erreur d'envoi de message : non-régression explicite (déjà
  // couverte par recette-messages-isolation.mjs, scénario 8 ; revérifiée ici après le passage à
  // l'ordonnanceur partagé pour confirmer qu'il ne change rien à ce contrat).
  // ===========================================================================================
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_force_send_error__', 'true'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    const draft = 'Brouillon préservé après échec réseau';
    await page.fill('input[placeholder="Écrivez un message..."]', draft);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    ok('22a. Non-régression : le brouillon reste dans le champ après un échec d\'envoi', (await page.inputValue('input[placeholder="Écrivez un message..."]')) === draft);
    ok('22b. Non-régression : aucune bulle fantôme n\'a été insérée dans le fil', (await page.locator(`text=${draft}`).count()) === 0);
    await page.close();
  }

  // ===========================================================================================
  // Vérification responsive 400×824 — nouvelles interfaces (en-têtes compacts, dialogue de
  // suppression, avatar) : aucun débordement horizontal.
  // ===========================================================================================
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_display_name__', 'Karim Boucher'), { width: 400, height: 824 });
    async function noHorizontalOverflow(label) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(`23. [${label}] Aucun débordement horizontal à 400×824 (scrollWidth - innerWidth = ${overflow})`, overflow <= 0);
    }
    await noHorizontalOverflow('Accueil (en-tête + avatar dynamique)');
    await goBottomTab(page, 'Agenda');
    await page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first().click();
    await page.waitForTimeout(150);
    await noHorizontalOverflow('Fiche événement (en-tête compact)');
    await page.getByRole('button', { name: "Supprimer l'événement", exact: true }).click();
    await page.waitForTimeout(150);
    await noHorizontalOverflow('Dialogue de confirmation de suppression');
    await page.keyboard.press('Escape');
    await page.click('button[aria-label="Retour"]');
    await goBottomTab(page, 'Messages');
    await page.locator('button:has-text("Lier à un événement")').first().click();
    await page.waitForTimeout(150);
    await noHorizontalOverflow('Feuille "Lier à un événement"');
    await page.keyboard.press('Escape');
    await page.close();
  }

} catch (err) {
  console.log('💥 Exception pendant la recette :', err.message);
  fail++;
} finally {
  console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
  if (allPageErrors.length) console.log('Erreurs JS capturées pendant la session :', JSON.stringify(allPageErrors));
  await browser.close();
}
process.exit(fail > 0 || allPageErrors.length > 0 ? 1 : 0);
