// Harnais de recette Playwright — voir MATRICE_LIVRAISON.md, section "Vérification finale",
// pour le mode d'emploi complet (lancement du serveur `vite.harness.config.js`, puis exécution
// de ce script). PAS livré dans les passes 1-6 (voir note dans la matrice) ; inclus à partir de
// la V7.1 pour que ces résultats soient indépendamment reproductibles, pas seulement rapportés.
// V7.6 : `playwright` est désormais une dépendance déclarée dans `package.json` (`npm install`
// suffit) — avant cette passe, il fallait l'installer séparément (`npm install --no-save
// playwright`), un pas manuel non couvert par un simple `npm install` du projet livré, repéré
// par une contre-vérification indépendante du ZIP V7.5 comme un frein réel à la reproductibilité.
// Seul le binaire Chromium reste à installer séparément si besoin (`npx playwright install
// chromium`) — irréductible, comme pour tout projet basé sur Playwright.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:5183/';
// Ce chemin est spécifique à l'environnement où cette passe a été développée (Chromium déjà
// préinstallé). Sur une autre machine, il n'existera presque certainement pas : on retombe
// alors sur la résolution standard de Playwright (le Chromium téléchargé par
// `npx playwright install chromium`), sans quoi ce script échouerait immédiatement partout
// ailleurs qu'ici.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = { headless: true };
if (fs.existsSync(SANDBOX_CHROMIUM)) launchOptions.executablePath = SANDBOX_CHROMIUM;
let pass = 0, fail = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}${detail ? ' — ' + detail : ''}`); fail++; failures.push(label); }
}

async function activeId(page) {
  return page.evaluate(() => document.activeElement && document.activeElement.id);
}
async function hasClass(page, id, cls) {
  return page.evaluate(({ id, cls }) => {
    const el = document.getElementById(id);
    return el ? el.classList.contains(cls) : false;
  }, { id, cls });
}
async function bgIsWhite(locator) {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)').catch(() => null);
}
async function heading(page, name) {
  return page.locator(`h1:has-text("${name}")`).isVisible().catch(() => false);
}

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(4000);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

async function goBottomTab(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Accueil")');

  // -------------------------------------------------------------------------
  // 1. Accueil -> "Voir tous les messages" -> flèche retour visible -> retour = Accueil
  // -------------------------------------------------------------------------
  await page.click('#home-viewall-messages');
  await page.waitForTimeout(150);
  ok('1a. CTA "Voir tous les messages" ouvre bien Messages', await heading(page, 'Messages'));
  ok('1b. Une flèche "Accueil" apparaît (contrairement à un accès par la nav du bas)', await page.locator('#back-to-accueil').isVisible());
  await page.click('#back-to-accueil');
  await page.waitForTimeout(250);
  ok('1c. Retour = Accueil', await heading(page, 'Accueil'));
  ok('1d. Le focus revient sur le CTA "Voir tous les messages" d\'origine', (await activeId(page)) === 'home-viewall-messages', `focus=${await activeId(page)}`);
  ok('1e. Repère visuel temporaire appliqué sur ce même CTA', await hasClass(page, 'home-viewall-messages', 'nav-restore-highlight'));

  // -------------------------------------------------------------------------
  // 2. Accueil -> "Voir tous les partages" -> flèche retour -> retour = Accueil
  // -------------------------------------------------------------------------
  await page.click('#home-viewall-partages');
  await page.waitForTimeout(150);
  ok('2a. CTA "Voir tous les partages" ouvre bien Partages', await heading(page, 'Partages'));
  ok('2b. Une flèche "Accueil" apparaît', await page.locator('#back-to-accueil').isVisible());
  await page.click('#back-to-accueil');
  await page.waitForTimeout(250);
  ok('2c. Retour = Accueil', await heading(page, 'Accueil'));
  ok('2d. Focus revient sur le CTA "Voir tous les partages" d\'origine', (await activeId(page)) === 'home-viewall-partages', `focus=${await activeId(page)}`);

  // -------------------------------------------------------------------------
  // 3. Navigation principale (bas) -> Messages/Partages : PAS de flèche artificielle
  // -------------------------------------------------------------------------
  await goBottomTab('Messages');
  await page.waitForTimeout(150);
  ok('3a. Nav du bas -> Messages : aucune flèche "Accueil" artificielle', (await page.locator('#back-to-accueil').count()) === 0);
  await goBottomTab('Partages');
  await page.waitForTimeout(150);
  ok('3b. Nav du bas -> Partages : aucune flèche "Accueil" artificielle', (await page.locator('#back-to-accueil').count()) === 0);

  // -------------------------------------------------------------------------
  // 4. La Bande -> fiche parent -> retour exact sur la carte source (+ recherche conservée)
  // -------------------------------------------------------------------------
  await goBottomTab('La Bande');
  await page.waitForTimeout(150);
  await page.fill('input[placeholder*="Chercher un parent"]', 'sabrina');
  await page.waitForTimeout(150);
  await page.click('#member-row-mem-sabrina');
  await page.waitForTimeout(150);
  ok('4a. Ouvre bien la fiche de Sabrina', await page.locator('text=Sabrina').first().isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('4b. Retour sur La Bande avec la recherche "sabrina" conservée', (await page.inputValue('input[placeholder*="Chercher un parent"]')) === 'sabrina');
  ok('4c. Focus revient sur la carte de Sabrina', (await activeId(page)) === 'member-row-mem-sabrina', `focus=${await activeId(page)}`);
  ok('4d. Repère visuel temporaire appliqué sur cette carte', await hasClass(page, 'member-row-mem-sabrina', 'nav-restore-highlight'));

  // -------------------------------------------------------------------------
  // 5. Partages -> "Voir l'événement" -> retour exact sur le partage source (+ filtre)
  // -------------------------------------------------------------------------
  await goBottomTab('Partages');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(150);
  await page.click('#share-linkbtn-sh-autorisation');
  await page.waitForTimeout(150);
  ok('5a. Ouvre bien la fiche liée (sortie piscine)', await page.locator('text=piscine').first().isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('5b. Retour sur Partages avec le filtre "Documents" toujours actif', !(await bgIsWhite(page.locator('button:has-text("Documents")'))));
  ok('5c. Focus revient sur le lien "Voir l\'événement" d\'origine', (await activeId(page)) === 'share-linkbtn-sh-autorisation', `focus=${await activeId(page)}`);

  // -------------------------------------------------------------------------
  // 5bis. Partages -> "Voir l'événement" (piscine) -> "Voir la discussion liée" ->
  // seuls les messages de cet événement -> flèche = fiche événement (PAS le fil général) ->
  // flèche = Partages, filtre conservé. Reproduit le bug signalé en usage réel : sans le repli
  // MOCK_EVENTS sur filteredEvent, "Voir la discussion liée" retombait sur le fil général.
  // Le mock d'agenda du harnais exclut désormais 'evt-piscine' de l'agenda "live" (voir
  // mockAgendaApi.js) pour forcer exactement ce chemin de repli, au lieu de le masquer.
  // -------------------------------------------------------------------------
  await goBottomTab('Partages');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(150);
  await page.click('#share-linkbtn-sh-autorisation');
  await page.waitForTimeout(150);
  ok('5bis-a. Ouvre bien la fiche liée (sortie piscine), malgré son absence de l\'agenda "live" du harnais', await page.locator('text=piscine').first().isVisible());
  await page.getByRole('button', { name: 'Voir la discussion liée', exact: true }).click();
  await page.waitForTimeout(200);
  ok('5bis-b. La discussion liée s\'ouvre bien filtrée (et pas le fil général)', await page.locator('text=Vous voyez ici uniquement les messages liés à cet événement').isVisible());
  ok('5bis-c. L\'en-tête affiche bien "Discussion liée" avec le titre de l\'événement', await page.locator('text=Discussion liée').isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(200);
  ok('5bis-d. La flèche ← ramène à la fiche événement (piscine), PAS au fil général de Messages', await page.locator('text=piscine').first().isVisible());
  ok('5bis-e. On est bien repassé par la fiche événement (le bouton "Voir la discussion liée" est de nouveau visible)', await page.getByRole('button', { name: 'Voir la discussion liée', exact: true }).isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('5bis-f. Une 2e flèche ramène bien sur Partages, filtre "Documents" toujours actif', (await heading(page, 'Partages')) && !(await bgIsWhite(page.locator('button:has-text("Documents")'))));

  // -------------------------------------------------------------------------
  // 6. Messages -> badge événement lié -> retour exact sur le badge source
  // -------------------------------------------------------------------------
  await goBottomTab('Messages');
  await page.waitForTimeout(150);
  await page.click('#msg-event-btn-m1');
  await page.waitForTimeout(150);
  ok('6a. Ouvre bien la fiche liée au message', await page.locator('text=piscine').first().isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('6b. Focus revient sur le badge d\'événement d\'origine', (await activeId(page)) === 'msg-event-btn-m1', `focus=${await activeId(page)}`);

  // -------------------------------------------------------------------------
  // 7. Agenda -> fiche événement -> retour exact sur la rangée source (+ filtre)
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  const agendaRow = page.locator('[id^="agenda-row-"]').first();
  const agendaRowId = await agendaRow.getAttribute('id');
  await agendaRow.click();
  await page.waitForTimeout(150);
  ok('7a. Ouvre bien une fiche événement depuis Agenda', await page.locator('button[aria-label="Retour"]').isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('7b. Retour sur Agenda avec le filtre "Sorties" toujours actif', !(await bgIsWhite(page.locator('button:has-text("Sorties")'))));
  ok('7c. Focus revient sur la rangée d\'événement d\'origine', (await activeId(page)) === agendaRowId, `focus=${await activeId(page)}, attendu=${agendaRowId}`);

  // -------------------------------------------------------------------------
  // 8. Accueil -> "Prochain événement" -> retour = Accueil (PAS Agenda)
  // -------------------------------------------------------------------------
  await goBottomTab('Accueil');
  await page.waitForTimeout(150);
  const nextEventRow = page.locator('[id^="home-nextevent-"]').first();
  const hasNextEvent = (await nextEventRow.count()) > 0;
  if (hasNextEvent) {
    await nextEventRow.click();
    await page.waitForTimeout(150);
    await page.click('button[aria-label="Retour"]');
    await page.waitForTimeout(250);
    ok('8a. Accueil -> Prochain événement -> retour = Accueil (pas Agenda)', await heading(page, 'Accueil'));
  } else {
    console.log('(i)  8. Pas de "Prochain événement" dans le jeu de données du harnais — scénario non exercé.');
  }

  // -------------------------------------------------------------------------
  // 9. Accueil -> recherche "piscine" -> résultat Message -> retour recherche conservée
  // -------------------------------------------------------------------------
  await goBottomTab('Accueil');
  await page.waitForTimeout(150);
  await page.fill('input[placeholder*="Rechercher dans ABCZed"]', 'piscine');
  await page.waitForTimeout(150);
  const msgResult = page.locator('[id^="home-search-message-"]').first();
  const msgResultId = await msgResult.getAttribute('id');
  await msgResult.click();
  await page.waitForTimeout(300);
  ok('9a. Résultat de recherche Message ouvre bien Messages', await heading(page, 'Messages'));
  ok('9b. Une flèche retour vers Accueil est proposée', await page.locator('#back-to-accueil').isVisible());
  await page.click('#back-to-accueil');
  await page.waitForTimeout(250);
  ok('9c. Retour sur Accueil avec la requête "piscine" conservée', (await page.inputValue('input[placeholder*="Rechercher dans ABCZed"]')) === 'piscine');
  ok('9d. Focus revient sur le résultat de recherche d\'origine', (await activeId(page)) === msgResultId, `focus=${await activeId(page)}, attendu=${msgResultId}`);

  // -------------------------------------------------------------------------
  // 10. La Bande, SANS recherche (liste complète) -> Marie -> retour -> repère visuel.
  // Complète le scénario 4 (qui passe par une recherche filtrée sur Sabrina) : signalé en
  // usage réel comme manquant spécifiquement depuis la liste NON filtrée.
  // -------------------------------------------------------------------------
  await goBottomTab('La Bande');
  await page.waitForTimeout(150);
  // Le scénario 4 a laissé "sabrina" dans la recherche de La Bande (préservée exprès entre
  // navigations, brief §26) — on la vide explicitement pour retrouver la liste NON filtrée,
  // condition même du scénario 10 (reclassé : signalé manquant spécifiquement hors recherche).
  await page.fill('input[placeholder*="Chercher un parent"]', '');
  await page.waitForTimeout(150);
  await page.click('#member-row-mem-marie');
  await page.waitForTimeout(150);
  ok('10a. Ouvre bien la fiche de Marie depuis la liste non filtrée', await page.locator('text=Marie').first().isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('10b. Focus revient sur la carte de Marie', (await activeId(page)) === 'member-row-mem-marie', `focus=${await activeId(page)}`);
  ok('10c. Repère visuel temporaire appliqué sur cette carte (liste non filtrée)', await hasClass(page, 'member-row-mem-marie', 'nav-restore-highlight'));

  // -------------------------------------------------------------------------
  // 11. Messages -> badge événement -> retour -> repère visuel sur le message source.
  // Complète le scénario 6 (qui ne vérifiait que le focus, pas la classe de repère visuel).
  // -------------------------------------------------------------------------
  await goBottomTab('Messages');
  await page.waitForTimeout(150);
  await page.click('#msg-event-btn-m1');
  await page.waitForTimeout(150);
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('11a. Repère visuel temporaire appliqué sur le badge événement source', await hasClass(page, 'msg-event-btn-m1', 'nav-restore-highlight'));

  // -------------------------------------------------------------------------
  // 12. Agenda "À venir" -> fiche événement -> retour -> repère visuel sur la rangée source.
  // Complète le scénario 7 (qui ne vérifiait que le focus/filtre, pas la classe).
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  const zooRow = page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first();
  const zooRowId = await zooRow.getAttribute('id');
  await zooRow.click();
  await page.waitForTimeout(150);
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('12a. Focus revient sur la rangée "À venir" d\'origine', (await activeId(page)) === zooRowId, `focus=${await activeId(page)}`);
  ok('12b. Repère visuel temporaire appliqué sur cette rangée "À venir"', await hasClass(page, zooRowId, 'nav-restore-highlight'));

  // -------------------------------------------------------------------------
  // 13-15. La Bande -> Vous -> "Mon profil" (modale qui ne change jamais `view`, donc
  // useScrollRestore ne s'y déclenche jamais) -> Escape / clic fond / piège de focus / retour
  // de focus+repère — brief pt 6/45, mécanisme générique useModalA11y.
  // -------------------------------------------------------------------------
  await goBottomTab('La Bande');
  await page.waitForTimeout(150);
  await page.click('#member-row-mem-vous');
  await page.waitForTimeout(200);
  ok('13a. Clic sur "Vous" ouvre la modale Mon profil (pas une fiche membre)', await page.locator('[role="dialog"][aria-label="Mon profil"]').isVisible());
  ok('13b. Le focus initial est dans la modale (premier élément focusable)', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Fermer');
  // Piège de focus : Shift+Tab depuis le premier élément doit boucler vers le DERNIER
  // (jamais s'échapper vers La Bande derrière la modale).
  await page.keyboard.press('Shift+Tab');
  ok('13c. Piège de focus : Shift+Tab depuis le premier élément boucle vers le dernier ("Se déconnecter")', (await page.evaluate(() => document.activeElement?.textContent || '')).includes('déconnecter'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok('13d. Escape ferme la modale', (await page.locator('[role="dialog"][aria-label="Mon profil"]').count()) === 0);
  ok('13e. Le focus revient sur la carte "Vous" d\'origine', (await activeId(page)) === 'member-row-mem-vous', `focus=${await activeId(page)}`);
  ok('13f. Repère visuel temporaire appliqué sur cette carte (fermeture de modale, pas de navigation de page)', await hasClass(page, 'member-row-mem-vous', 'nav-restore-highlight'));

  await page.click('#member-row-mem-vous');
  await page.waitForTimeout(200);
  await page.mouse.click(5, 5); // clic sur le fond, hors du panneau ancré en bas
  await page.waitForTimeout(200);
  ok('14a. Un clic sur le fond (hors panneau) ferme aussi la modale', (await page.locator('[role="dialog"][aria-label="Mon profil"]').count()) === 0);

  // -------------------------------------------------------------------------
  // 16. prefers-reduced-motion émulé -> le repère visuel ne s'applique JAMAIS (brief pt 1,
  // explicite), mais le focus se restaure quand même.
  // -------------------------------------------------------------------------
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await goBottomTab('La Bande');
  await page.waitForTimeout(150);
  await page.click('#member-row-mem-marie');
  await page.waitForTimeout(150);
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(250);
  ok('16a. Focus restauré même avec reduced-motion', (await activeId(page)) === 'member-row-mem-marie');
  ok('16b. AUCUN repère visuel (classe) appliqué avec reduced-motion', !(await hasClass(page, 'member-row-mem-marie', 'nav-restore-highlight')));
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // -------------------------------------------------------------------------
  // 17. Réactions Messages réellement interactives (delta pts 26-28, arbitrage D3).
  // -------------------------------------------------------------------------
  await goBottomTab('Messages');
  await page.waitForTimeout(150);
  const msgRow = page.locator('#msg-row-m4');
  await msgRow.getByLabel('Ajouter une réaction').click();
  await page.waitForTimeout(100);
  await page.getByRole('menuitem').first().click();
  await page.waitForTimeout(150);
  const pill = msgRow.locator('button[title*="taper pour"]');
  ok('17a. Une pastille de réaction apparaît après sélection', await pill.first().isVisible());
  ok('17b. Le compte est bien 1', (await pill.first().textContent())?.trim().endsWith('1'));
  // Re-taper sa PROPRE pastille la retire (toggle).
  await pill.first().click();
  await page.waitForTimeout(150);
  ok('17c. Re-taper sa propre pastille la retire', (await pill.count()) === 0);

  // -------------------------------------------------------------------------
  // 18. Accompagnateurs : identification TAP-ONLY, sans jamais déclencher de survol souris
  // (brief pt 6.2/20 — le nom doit apparaître explicitement au tap, pas seulement via `title`
  // au survol). Sortie zoo = mode "accompagnement".
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  const zooRow2 = page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first();
  await zooRow2.click(); // .click() de Playwright ne survole pas la page au préalable
  await page.waitForTimeout(150);
  const firstAvatar = page.getByRole('button', { name: 'Parent 1', exact: true });
  await firstAvatar.click();
  await page.waitForTimeout(100);
  ok('18a. Le nom de l\'accompagnateur s\'affiche explicitement au tap (pas seulement au survol)', await page.locator('text=Parent 1').first().isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 19. Pièce jointe réellement actionnable (delta pts 29/30/39/42, arbitrage D1) — le partage
  // "Autorisation sortie piscine" a désormais un vrai lien, pas un bouton désactivé.
  // -------------------------------------------------------------------------
  await goBottomTab('Partages');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(150);
  const openBtn = page.locator('a:has-text("Ouvrir")').first();
  ok('19a. Le bouton "Ouvrir" est un vrai lien (pas un <button disabled>)', (await openBtn.count()) === 1);
  ok('19b. Il pointe vers le fichier de démonstration réel', (await openBtn.getAttribute('href')) === '/demo/autorisation-piscine.pdf');
  const dlBtn = page.locator('a:has-text("Télécharger")').first();
  ok('19c. Le bouton "Télécharger" porte l\'attribut download avec le bon nom de fichier', (await dlBtn.getAttribute('download')) === 'autorisation-piscine.pdf');

  // -------------------------------------------------------------------------
  // 20. La carte de pièce jointe elle-même est actionnable — précision reçue de l'utilisateur
  // avant codage (arbitrage D1) : pas seulement les boutons Ouvrir/Télécharger. Clic ET clavier
  // (Entrée), sur l'icône de Partages ET sur la carte complète d'EventDetail.
  // -------------------------------------------------------------------------
  const attachIcon = page.getByRole('button', { name: 'Ouvrir la pièce jointe' }).first();
  ok('20a. L\'icône de la pièce jointe (Partages) est exposée comme un bouton accessible', await attachIcon.isVisible());
  const [popup1, pdfRequest1] = await Promise.all([
    page.context().waitForEvent('page'),
    page.context().waitForEvent('request', { predicate: (request) => request.url().endsWith('/demo/autorisation-piscine.pdf') }),
    attachIcon.click(),
  ]);
  ok('20b. Clic sur l\'icône -> ouvre bien le fichier de démonstration réel', pdfRequest1.url().endsWith('/demo/autorisation-piscine.pdf'));
  await popup1.close();

  // Activation clavier (Entrée) sur ce même bouton, sans clic souris.
  await attachIcon.focus();
  const [popup2, pdfRequest2] = await Promise.all([
    page.context().waitForEvent('page'),
    page.context().waitForEvent('request', { predicate: (request) => request.url().endsWith('/demo/autorisation-piscine.pdf') }),
    page.keyboard.press('Enter'),
  ]);
  ok('20c. Activation clavier (Entrée) sur la carte -> ouvre aussi le fichier', pdfRequest2.url().endsWith('/demo/autorisation-piscine.pdf'));
  await popup2.close();

  // Carte complète dans EventDetail (pas seulement les boutons) : ouvrir la fiche piscine et
  // cliquer n'importe où sur la cartouche de pièce jointe (hors des deux boutons).
  await page.click('#share-linkbtn-sh-autorisation');
  await page.waitForTimeout(150);
  const attachCard = page.getByRole('button', { name: 'Ouvrir la pièce jointe' }).first();
  ok('20d. La carte de pièce jointe d\'EventDetail est aussi exposée comme un bouton accessible', await attachCard.isVisible());
  const [popup3, pdfRequest3] = await Promise.all([
    page.context().waitForEvent('page'),
    page.context().waitForEvent('request', { predicate: (request) => request.url().endsWith('/demo/autorisation-piscine.pdf') }),
    attachCard.click({ position: { x: 5, y: 5 } }), // coin de la carte, hors des boutons internes
  ]);
  ok('20e. Clic sur la carte (hors des boutons) -> ouvre aussi le fichier', pdfRequest3.url().endsWith('/demo/autorisation-piscine.pdf'));
  await popup3.close();
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 21. Bug corrigé (contre-vérification indépendante) : Entrée sur "Télécharger" (lien
  // imbriqué DANS la carte actionnable) ne doit plus être interceptée par le onKeyDown de la
  // carte parente — qui appelait window.open() (nouvel onglet, sans sémantique de
  // téléchargement) au lieu de laisser le lien natif déclencher son propre téléchargement.
  // Le scénario 20 ne testait Entrée QUE sur la carte elle-même, jamais sur un lien interne :
  // c'est exactement ce qui a laissé passer ce bug. Reproduit sur EventDetail (pas Partages :
  // là, Ouvrir/Télécharger sont SIBLINGS de la zone actionnable, jamais imbriqués dedans — le
  // bug ne peut se reproduire que là où les boutons vivent À L'INTÉRIEUR de la carte, soit
  // EventDetail.jsx et Messages.jsx).
  // -------------------------------------------------------------------------
  await goBottomTab('Partages');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(150);
  await page.click('#share-linkbtn-sh-autorisation');
  await page.waitForTimeout(150);
  const dlLink = page.locator('a:has-text("Télécharger")').first();
  await dlLink.focus();
  let openCallCount = await page.evaluate(() => {
    window.__openCallsCount = 0;
    const orig = window.open.bind(window);
    window.open = function (...args) { window.__openCallsCount++; return orig(...args); };
    return window.__openCallsCount;
  });
  const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
  await page.keyboard.press('Enter');
  const download = await downloadPromise;
  await page.waitForTimeout(300);
  openCallCount = await page.evaluate(() => window.__openCallsCount);
  ok(
    '21a. Entrée sur "Télécharger" (focus sur le lien, pas la carte) déclenche un vrai téléchargement, la carte ne l\'intercepte plus (window.open jamais appelé)',
    download !== null && openCallCount === 0,
    `download=${!!download}, window.open appelé ${openCallCount} fois`,
  );
  if (download) await download.delete().catch(() => {});
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 22. Bug corrigé (contre-vérification indépendante) : ouvrir un événement qui n'existe QUE
  // via le repli MOCK_EVENTS (evt-piscine, absent de l'agenda "live" du harnais — voir
  // scénario 5bis) depuis Partages, puis cliquer "Je peux accompagner". Avant le correctif,
  // `joinEvent` cherchait l'événement UNIQUEMENT dans `events` (agenda réel) : `event` valait
  // `undefined`, l'action retournait EN SILENCE, donnant l'impression d'un bouton mort. Le
  // correctif doit maintenant afficher un message honnête plutôt qu'un no-op invisible.
  // -------------------------------------------------------------------------
  await goBottomTab('Partages');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(150);
  await page.click('#share-linkbtn-sh-autorisation');
  await page.waitForTimeout(150);
  const accompagnerBtn = page.getByRole('button', { name: 'Je peux accompagner', exact: true });
  ok('22a. Le bouton "Je peux accompagner" est bien visible sur cette fiche venue du repli mock', await accompagnerBtn.isVisible());
  await accompagnerBtn.click();
  await page.waitForTimeout(200);
  ok(
    '22b. Un message honnête apparaît (plus de no-op silencieux) — la fiche vient d\'une donnée de démonstration',
    await page.locator('text=donnée de démonstration').isVisible(),
  );
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 23. Non-régression RSVP sur un événement RÉELLEMENT présent dans l'agenda "live" (evt-zoo,
  // à la différence d'evt-piscine au scénario 22) — signalé en contre-vérification indépendante
  // (ChatGPT) : le scénario 22 prouve le message honnête sur le cas mock-only, mais PAS que le
  // même correctif laisse une vraie inscription Supabase fonctionner. `mockAgendaApi.js` a été
  // rendu à état mutable pour cette passe (V7.1) précisément pour que ce scénario puisse
  // vérifier une inscription/désinscription de bout en bout, pas seulement l'absence d'erreur.
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  const zooRow3 = page.locator('[id^="agenda-row-"]', { hasText: 'zoo' }).first();
  await zooRow3.click();
  await page.waitForTimeout(150);
  const joinBtn = page.getByRole('button', { name: 'Je peux accompagner', exact: true });
  ok('23a. Le bouton "Je peux accompagner" est visible sur un événement réellement live (evt-zoo)', await joinBtn.isVisible());
  await joinBtn.click();
  await page.waitForTimeout(300);
  ok(
    '23b. Aucun message de repli mock (ce n\'est PAS un événement mock-only, la branche isLiveEvent doit rester vraie)',
    !(await page.locator('text=donnée de démonstration').isVisible()),
  );
  ok('23c. Aucun message d\'erreur générique non plus', !(await page.locator("text=Impossible d'enregistrer").isVisible()));
  const leaveBtn = page.getByRole('button', { name: 'Me retirer', exact: true });
  ok('23d. L\'inscription a bien été prise en compte de bout en bout : "Me retirer" apparaît (pas seulement l\'absence d\'erreur)', await leaveBtn.isVisible());
  await leaveBtn.click();
  await page.waitForTimeout(300);
  ok('23e. La désinscription fonctionne aussi : "Je peux accompagner" réapparaît', await joinBtn.isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 24. Point 2 (recette réelle sur PC) : "Test A1 — 2 adultes · 1 enfant" n'identifiait
  // personne — preuve de bout en bout que la saisie volontaire des prénoms fonctionne,
  // PERSISTE après modification ET après rechargement complet de la page (pas seulement en
  // mémoire côté client) sur "Pique-nique entre familles" (evt-piquenique, mode 'family',
  // réellement présent dans l'agenda "live" du harnais). Utilise aussi la donnée de
  // démonstration ajoutée à data.js (Parent 1 : "Nadia, Karim, Yasmine") pour vérifier
  // l'affichage sans aucune interaction.
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  const piqueniqueRow = page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first();
  await piqueniqueRow.click();
  await page.waitForTimeout(150);
  ok('24a. La fiche affiche un décompte réel (plus de "undefined personne(s) inscrite(s)")', await page.locator('text=personne').first().isVisible());
  ok('24b. Les prénoms déjà saisis dans la donnée de démonstration s\'affichent ("Nadia, Karim, Yasmine")', await page.locator('text=Nadia, Karim, Yasmine').isVisible());
  ok('24c. Un foyer sans prénom saisi n\'affiche ni "undefined" ni nom inventé (Parent 2)', !(await page.locator('text=Parent 2').locator('..').locator('text=undefined').count()));

  const joinFamilyBtn = page.getByRole('button', { name: 'Vous venez à combien ?', exact: true });
  ok('24d. Le bouton d\'inscription est visible (pas encore inscrit)', await joinFamilyBtn.isVisible());
  await joinFamilyBtn.click();
  await page.waitForTimeout(150);
  // Draft initial : 1 adulte / 0 enfant -> porte à 2 adultes / 1 enfant.
  await page.getByRole('button', { name: 'Augmenter — Adultes', exact: true }).click();
  await page.getByRole('button', { name: 'Augmenter — Enfants', exact: true }).click();
  await page.waitForTimeout(100);
  await page.getByLabel('Prénom adulte 1', { exact: true }).fill('Claire');
  await page.getByLabel('Prénom adulte 2', { exact: true }).fill('Marc');
  await page.getByLabel('Prénom enfant 1', { exact: true }).fill('Zoé');
  await page.getByRole('button', { name: 'Confirmer ma participation', exact: true }).click();
  await page.waitForTimeout(300);
  ok('24e. Après confirmation, "Votre participation" affiche les prénoms saisis ("Claire, Marc, Zoé")', await page.locator('text=Claire, Marc, Zoé').first().isVisible());

  // Rechargement complet de la page (pas juste un changement d'écran côté client) : les
  // prénoms doivent revenir de la "base" (mockAgendaApi, état mutable côté serveur du
  // harnais) exactement comme le reste de la participation, pas seulement survivre en
  // mémoire React.
  // P1 (exercice de correction V7.5) : avant ce correctif, une actualisation renvoyait
  // TOUJOURS vers Accueil (d'où le passage par Agenda -> Sorties -> la rangée pour rouvrir la
  // fiche, ci-dessous en commentaire) — ce n'est plus le cas : l'URL représente désormais la
  // fiche elle-même, donc l'actualisation la rouvre DIRECTEMENT (voir scénario dédié plus bas
  // pour la preuve explicite de ce point précis). On ne re-navigue donc plus manuellement ici.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Claire, Marc, Zoé');
  ok('24f. Après un rechargement complet de la page, les prénoms persistent bien ("Claire, Marc, Zoé"), ET la fiche se rouvre directement (P1, plus besoin de re-naviguer)', await page.locator('text=Claire, Marc, Zoé').first().isVisible());

  // Modification : un des prénoms change -> doit aussi persister après rechargement (pas
  // seulement la première saisie).
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.waitForTimeout(150);
  ok('24g. Le formulaire de modification repeuple bien les prénoms existants', (await page.getByLabel('Prénom enfant 1', { exact: true }).inputValue()) === 'Zoé');
  await page.getByLabel('Prénom enfant 1', { exact: true }).fill('Léa');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.waitForTimeout(300);
  ok('24h. Après modification, le nouveau prénom s\'affiche ("Claire, Marc, Léa")', await page.locator('text=Claire, Marc, Léa').first().isVisible());
  ok('24i. L\'ancien prénom a bien disparu (pas conservé en double)', (await page.locator('text=Claire, Marc, Zoé').count()) === 0);

  // P1 : même remarque que ci-dessus — l'actualisation rouvre directement la fiche.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Claire, Marc, Léa');
  ok('24j. Le prénom modifié persiste lui aussi après un second rechargement complet ("Claire, Marc, Léa")', await page.locator('text=Claire, Marc, Léa').first().isVisible());

  // Nettoyage : on se désinscrit pour laisser le harnais dans un état stable en cas de
  // relance de cette recette.
  // P4 (exercice de correction V7.5) : "Annuler ma participation" ouvre désormais une
  // confirmation (voir scénario dédié plus bas) — il faut confirmer explicitement pour que ce
  // nettoyage aboutisse réellement à une désinscription.
  await page.getByRole('button', { name: 'Annuler ma participation', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Oui, annuler ma participation', exact: true }).click();
  await page.waitForTimeout(300);
  ok('24k. Nettoyage : la désinscription fonctionne aussi en mode "famille"', await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 25. V7.7 : ce scénario vérifiait jusqu'ici (V7.6 et avant) que le bandeau NE promettait
  // PAS la confidentialité par groupe, tant que Messages restait sur des données de
  // démonstration (BUSINESS_DATA_FROM_SUPABASE=false, qui ne gouvernait de toute façon jamais
  // Messages — voir le correctif du bandeau, App.jsx/Messages.jsx). Assertions INVERSÉES ici :
  // Messages est maintenant réellement branché à Supabase (MESSAGES_FROM_SUPABASE=true), donc
  // c'est désormais le texte réel du brief qui doit apparaître, et le bandeau d'avertissement
  // de tête de page ne doit plus mentionner "Messages," (Partages/La Bande seuls restent
  // concernés) — l'inverse exact d'avant ce lot, "Interdiction de livraison trompeuse" oblige.
  // -------------------------------------------------------------------------
  await goBottomTab('Messages');
  await page.waitForTimeout(150);
  ok(
    '25a. Le bandeau Messages affiche désormais le texte réel du brief (messages réellement connectés à Supabase)',
    await page.locator('text=Les messages sont visibles uniquement par les membres du groupe.').isVisible(),
  );
  ok(
    '25b. L\'ancien texte "Messages de démonstration" n\'apparaît plus (ne serait plus honnête)',
    (await page.locator('text=Messages de démonstration — identiques pour toutes les communautés').count()) === 0,
  );
  ok(
    '25c. Le bandeau d\'avertissement de tête de page ne mentionne plus "Messages," (seuls Partages/La Bande restent démo)',
    await page.locator('text=Partages et La Bande affichent un contenu de démonstration').isVisible(),
  );
  ok(
    '25d. L\'ancien texte groupé "Messages, Partages et La Bande" a bien disparu',
    (await page.locator('text=Messages, Partages et La Bande affichent un contenu de démonstration').count()) === 0,
  );

  // -------------------------------------------------------------------------
  // 26. Point 4 (recette réelle sur PC, audit transversal des couleurs) : RED réservé à
  // l'annulation/suppression (jamais réutilisé pour une action neutre comme se déconnecter),
  // et l'action secondaire "Modifier" utilise bien BLUE de façon cohérente entre écrans (et
  // non plus la couleur de catégorie sur EventDetail, différente de Partages.jsx).
  // -------------------------------------------------------------------------
  async function rgbColor(locator) {
    return locator.evaluate((el) => getComputedStyle(el).color);
  }
  await goBottomTab('La Bande');
  await page.waitForTimeout(150);
  await page.click('#member-row-mem-vous');
  await page.waitForTimeout(200);
  const signOutBtn = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  ok('26a. "Se déconnecter" n\'utilise plus RED (n\'est pas une action d\'annulation/suppression)', (await rgbColor(signOutBtn)) !== 'rgb(229, 57, 53)', `couleur=${await rgbColor(signOutBtn)}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Confirmer ma participation', exact: true }).click();
  await page.waitForTimeout(300);
  const modifierBtn = page.getByRole('button', { name: 'Modifier', exact: true });
  ok(
    '26b. "Modifier" utilise BLUE (action secondaire), pas la couleur de catégorie "Sorties" (vert)',
    (await rgbColor(modifierBtn)) === 'rgb(13, 71, 161)',
    `couleur=${await rgbColor(modifierBtn)}`,
  );
  // Nettoyage : on laisse le harnais dans l'état stable utilisé par le reste de la recette.
  // P4 (exercice de correction V7.5) : confirmation désormais requise, voir scénario 24k.
  await page.getByRole('button', { name: 'Annuler ma participation', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Oui, annuler ma participation', exact: true }).click();
  await page.waitForTimeout(300);
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  async function stepperValue(label) {
    return page.locator(`button[aria-label="Diminuer — ${label}"] + span`).innerText();
  }

  // -------------------------------------------------------------------------
  // 27. Point 1 (2e contre-vérification, ZIP V7.2) : "Aucun participant pour le moment" ne
  // doit plus rester affiché AU-DESSUS du formulaire pendant que celui-ci est ouvert, même avec
  // un brouillon non vide (2 adultes / 1 enfant — reproduction exacte du signalement). Aucun
  // événement mode 'family' de la donnée de démonstration n'avait 0 participant AU DÉPART avant
  // ce correctif : evt-piquenique (utilisé au scénario 24) a toujours au moins un foyer déjà
  // inscrit (Parent 1), donc la condition fautive (`participants.length === 0`) n'y était
  // jamais vraie au moment d'ouvrir le formulaire — le bug ne pouvait pas y être exercé. D'où
  // evt-gouter-voisins, ajouté à src/data.js pour ce seul besoin (mode 'family',
  // `participants: []`).
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  const gouterRow = page.locator('[id^="agenda-row-"]', { hasText: 'Goûter entre voisins' }).first();
  await gouterRow.click();
  await page.waitForTimeout(150);
  ok(
    '27a. Avant toute saisie (formulaire fermé, 0 participant), le texte "Aucun participant pour le moment" est bien affiché',
    await page.locator('text=Aucun participant pour le moment').isVisible(),
  );

  await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Augmenter — Adultes', exact: true }).click();
  await page.getByRole('button', { name: 'Augmenter — Enfants', exact: true }).click();
  await page.waitForTimeout(100);
  ok('27b. Le brouillon affiche bien 2 adultes', (await stepperValue('Adultes')) === '2', `valeur=${await stepperValue('Adultes')}`);
  ok('27c. Le brouillon affiche bien 1 enfant', (await stepperValue('Enfants')) === '1', `valeur=${await stepperValue('Enfants')}`);
  ok(
    '27d. [correctif principal] Pendant cette saisie (formulaire ouvert, 2 adultes/1 enfant en brouillon), "Aucun participant pour le moment" est bien MASQUÉ — ne contredit plus visuellement ce qui est saisi juste en dessous',
    !(await page.locator('text=Aucun participant pour le moment').isVisible()),
  );

  // Abandon du brouillon (jamais confirmé) via Retour — evt-gouter-voisins doit rester à 0
  // participant pour ne pas fausser une relance de cette recette.
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);
  await gouterRow.click();
  await page.waitForTimeout(150);
  ok(
    '27e. Après abandon du brouillon (jamais confirmé), le texte réapparaît normalement (pas de régression sur le cas déjà correct)',
    await page.locator('text=Aucun participant pour le moment').isVisible(),
  );
  ok(
    '27f. Aucune participation n\'a été enregistrée par erreur (le bouton d\'inscription initial est toujours là)',
    await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).isVisible(),
  );
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 28. Point 4 (2e contre-vérification, ZIP V7.2 ; approfondi après la 3e contre-vérification,
  // ZIP V7.3, réserve 2) : la réserve de vérification signalait que seule la fonction pure
  // `impliedCategoryOf` était testée (scripts/test-agenda-selection.mjs) — jamais son effet
  // réellement rendu dans Agenda.jsx (chip de filtre + rond de sélection du calendrier). Ce
  // scénario sélectionne une date du calendrier réel dont TOUS les événements appartiennent à
  // une seule catégorie ('sortie'), filtre "Tous" toujours actif, et vérifie le rendu effectif.
  // Correctif V7.3 : la 1ère version de ce scénario contrôlait seulement l'attribut `title` du
  // chip (une marque d'accessibilité/info-bulle) — jamais la teinte visuelle elle-même que le
  // point prétendait vérifier. `getComputedStyle` est désormais utilisé sur le chip lui-même
  // (`color`, `backgroundColor`, `boxShadow`), pas seulement sur le rond du calendrier.
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  const tousChip = page.getByRole('button', { name: 'Tous', exact: true });
  await tousChip.click();
  await page.waitForTimeout(150);
  ok('28a. Le filtre "Tous" est bien actif avant de sélectionner une date', (await tousChip.getAttribute('aria-pressed')) === 'true');

  // Navigation jusqu'à juin 2032 (evt-gouter-voisins, seul événement du 8 juin, mode 'family' /
  // catégorie 'sortie') — nombre de clics calculé dynamiquement par rapport à la date réelle du
  // jour, pas une valeur écrite en dur qui se déréglerait mois après mois. Sens de la navigation
  // (mois précédent/suivant) lui aussi dérivé du signe de l'écart, pas supposé : la cible peut
  // être dans le passé ou le futur réel selon le moment où cette recette est rejouée (V7.14,
  // point 15 — dates de démonstration décalées vers 2032, voir le commentaire en tête de
  // src/data.js).
  await page.getByRole('button', { name: "Aujourd'hui", exact: true }).click();
  await page.waitForTimeout(150);
  const nowForNav = new Date();
  const TARGET_YEAR = 2032, TARGET_MONTH_INDEX = 5; // juin (0-indexé)
  const monthsDelta = (TARGET_YEAR - nowForNav.getFullYear()) * 12 + (TARGET_MONTH_INDEX - nowForNav.getMonth());
  const navMonthBtn = page.getByRole('button', { name: monthsDelta >= 0 ? 'Mois suivant' : 'Mois précédent', exact: true });
  for (let i = 0; i < Math.abs(monthsDelta); i++) {
    await navMonthBtn.click();
    await page.waitForTimeout(30);
  }
  ok('28b. Le calendrier affiche bien "Juin 2032" après la navigation', await page.locator('text=Juin 2032').isVisible());

  const day8Cell = page.locator('button[title]').filter({ hasText: /^8$/ });
  await day8Cell.click();
  await page.waitForTimeout(150);

  const sortieChip = page.getByRole('button', { name: 'Sorties', exact: true });
  ok(
    '28c. Le chip "Sorties" ne devient PAS le filtre actif (filtre "Tous" toujours réellement appliqué)',
    (await sortieChip.getAttribute('aria-pressed')) === 'false',
  );

  // Correctif V7.3 (réserve 2) : `getComputedStyle` sur le chip lui-même, pas seulement son
  // attribut `title` — vérifie la teinte réellement rendue, pas juste une info-bulle annexe.
  // `FilterChip` (Agenda.jsx) : quand `implied` est vrai et `active` faux (exactement le cas
  // ici — filtre "Tous" reste actif), `color: <couleur catégorie>` (texte), `background:
  // <couleur>1F` (fond translucide, ~12% d'opacité) et `boxShadow: 0 0 0 1.5px <couleur> inset`.
  const sortieTextColor = await sortieChip.evaluate((el) => getComputedStyle(el).color);
  ok(
    '28d. [rendu réel] Le texte du chip "Sorties" prend bien la couleur pleine de la catégorie (vert), pas la couleur neutre',
    sortieTextColor === 'rgb(22, 155, 104)',
    `color=${sortieTextColor}`,
  );
  const sortieBg = await sortieChip.evaluate((el) => getComputedStyle(el).backgroundColor);
  const bgMatch = sortieBg.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/);
  ok(
    '28e. [rendu réel] Le fond du chip "Sorties" prend bien une teinte translucide de la couleur de catégorie (pas blanc opaque, pas vert plein — ce dernier signalerait un filtre actif)',
    Boolean(bgMatch) && bgMatch[1] === '22' && bgMatch[2] === '155' && bgMatch[3] === '104' && parseFloat(bgMatch[4]) > 0 && parseFloat(bgMatch[4]) < 1,
    `background-color=${sortieBg}`,
  );
  const sortieBoxShadow = await sortieChip.evaluate((el) => getComputedStyle(el).boxShadow);
  ok(
    '28f. [rendu réel] Le liseré (boxShadow) du chip "Sorties" utilise bien la couleur de catégorie, pas la bordure neutre par défaut',
    sortieBoxShadow.includes('22, 155, 104'),
    `boxShadow=${sortieBoxShadow}`,
  );
  ok(
    '28g. Le chip "Sorties" porte aussi la marque d\'accessibilité dédiée (title, en complément du rendu visuel vérifié ci-dessus)',
    (await sortieChip.getAttribute('title'))?.includes('catégorie de la date sélectionnée') ?? false,
    `title=${await sortieChip.getAttribute('title')}`,
  );

  const dayCircle = day8Cell.locator('div').first();
  const circleColor = await dayCircle.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(
    '28h. [rendu réel] Le rond de sélection du 8 juin prend la couleur "Sorties" (vert), pas le bleu neutre de "Tous"',
    circleColor === 'rgb(22, 155, 104)',
    `couleur=${circleColor}`,
  );

  // Nettoyage : désélection + retour à "Tous"/mois courant pour laisser le harnais dans l'état
  // par défaut attendu par une relance de cette recette.
  await day8Cell.click();
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: "Aujourd'hui", exact: true }).click();
  await page.waitForTimeout(100);

  // ===========================================================================================
  // EXERCICE_CLAUDE_ABCZED_V7.5 — scénarios dédiés aux 5 points de ce lot (P1 à P5), en plus des
  // scénarios 1-28 ci-dessus (non-régression, déjà rejoués intégralement avant cette section).
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 29. P1 : actualiser le navigateur depuis Accueil, Agenda, Messages, Partages ou La Bande
  // doit rouvrir la MÊME section (défaut corrigé : ça renvoyait toujours vers Accueil) — et
  // l'URL réelle reflète bien la section (src/router.js), pas seulement l'état React interne.
  // -------------------------------------------------------------------------
  await goBottomTab('Accueil');
  await page.waitForTimeout(150);
  ok('29a. URL = "/" sur Accueil', new URL(page.url()).pathname === '/', `url=${page.url()}`);
  await page.reload({ waitUntil: 'networkidle' });
  ok('29b. Actualiser depuis Accueil rouvre bien Accueil', await heading(page, 'Accueil'));

  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  ok('29c. URL = "/agenda" sur Agenda', new URL(page.url()).pathname === '/agenda', `url=${page.url()}`);
  await page.reload({ waitUntil: 'networkidle' });
  ok('29d. Actualiser depuis Agenda rouvre bien Agenda (pas Accueil)', await heading(page, 'Agenda'));

  await goBottomTab('Messages');
  await page.waitForTimeout(150);
  ok('29e. URL = "/messages" sur Messages', new URL(page.url()).pathname === '/messages', `url=${page.url()}`);
  await page.reload({ waitUntil: 'networkidle' });
  ok('29f. Actualiser depuis Messages rouvre bien Messages (pas Accueil)', await heading(page, 'Messages'));

  await goBottomTab('Partages');
  await page.waitForTimeout(150);
  ok('29g. URL = "/partages" sur Partages', new URL(page.url()).pathname === '/partages', `url=${page.url()}`);
  await page.reload({ waitUntil: 'networkidle' });
  ok('29h. Actualiser depuis Partages rouvre bien Partages (pas Accueil)', await heading(page, 'Partages'));

  await goBottomTab('La Bande');
  await page.waitForTimeout(150);
  ok('29i. URL = "/labande" sur La Bande', new URL(page.url()).pathname === '/labande', `url=${page.url()}`);
  await page.reload({ waitUntil: 'networkidle' });
  ok('29j. Actualiser depuis La Bande rouvre bien La Bande (pas Accueil)', await heading(page, 'La Bande'));

  // -------------------------------------------------------------------------
  // 30. P1 : actualiser depuis une fiche événement rouvre EXACTEMENT cette fiche après le
  // chargement des données (pas Accueil) ; un id d'événement qui n'existe plus/plus jamais
  // chargé retombe proprement sur Agenda avec un message compréhensible (jamais une page
  // blanche ni une exception).
  // -------------------------------------------------------------------------
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().click();
  await page.waitForTimeout(150);
  ok(
    '30a. L\'URL représente bien la fiche ouverte ("/evenement/evt-piquenique?from=agenda")',
    new URL(page.url()).pathname + new URL(page.url()).search === '/evenement/evt-piquenique?from=agenda',
    `url=${page.url()}`,
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Pique-nique entre familles');
  ok('30b. Actualiser depuis cette fiche la rouvre EXACTEMENT (titre visible, pas Accueil)', await page.locator('text=Pique-nique entre familles').first().isVisible());
  ok(
    '30c. L\'URL reste bien celle de la fiche après actualisation (pas corrompue/réinitialisée à "/")',
    new URL(page.url()).pathname + new URL(page.url()).search === '/evenement/evt-piquenique?from=agenda',
    `url=${page.url()}`,
  );

  // Id d'événement inexistant (ex. lien devenu obsolète) : repli propre vers Agenda, message
  // compréhensible — jamais une page blanche ni une exception JS.
  await page.goto(BASE + 'evenement/id-qui-n-existe-plus?from=agenda', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  ok('30d. Repli propre vers Agenda pour un id d\'événement introuvable', await heading(page, 'Agenda'));
  ok(
    '30e. Un message compréhensible est affiché (pas une page blanche silencieuse)',
    await page.locator("text=Cet événement n'existe plus ou n'a pas pu être chargé").isVisible(),
  );
  ok('30f. L\'URL est bien retombée sur "/agenda", pas restée sur l\'id introuvable', new URL(page.url()).pathname === '/agenda', `url=${page.url()}`);

  // -------------------------------------------------------------------------
  // 31. P1 : les boutons précédent/suivant du navigateur suivent l'historique de navigation
  // réel (pas seulement l'actualisation) — Agenda -> fiche -> précédent = Agenda, suivant =
  // la fiche de nouveau.
  // -------------------------------------------------------------------------
  await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().click();
  await page.waitForTimeout(150);
  ok('31a. Fiche ouverte (préalable au test précédent/suivant)', await page.locator('text=Pique-nique entre familles').first().isVisible());
  await page.goBack();
  await page.waitForTimeout(250);
  ok('31b. "Précédent" du navigateur ramène bien sur Agenda', await heading(page, 'Agenda'));
  ok('31c. URL cohérente après "Précédent" ("/agenda")', new URL(page.url()).pathname === '/agenda', `url=${page.url()}`);
  await page.goForward();
  await page.waitForTimeout(250);
  ok('31d. "Suivant" du navigateur rouvre bien la fiche quittée', await page.locator('text=Pique-nique entre familles').first().isVisible());
  ok(
    '31e. URL cohérente après "Suivant" ("/evenement/evt-piquenique?from=agenda")',
    new URL(page.url()).pathname + new URL(page.url()).search === '/evenement/evt-piquenique?from=agenda',
    `url=${page.url()}`,
  );
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 32. P2 : la carte Agenda d'un événement "entre familles" AVEC participants affiche bien
  // "N participants · X adultes · Y enfants" (accords corrects), pas seulement une icône + un
  // total brut. evt-piquenique (état de démonstration inchangé à ce stade de la recette) :
  // Parent 1 (2 adultes/1 enfant) + Parent 2 (1 adulte/0 enfant) + 13 foyers "chaîne simple"
  // (1 adulte/0 enfant chacun, repli documenté dans agendaSearch.js) = 17 personnes, 16
  // adultes, 1 enfant.
  // -------------------------------------------------------------------------
  const piqueniqueRow32 = page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first();
  ok(
    '32a. La carte Agenda d\'evt-piquenique affiche bien "17 participants · 16 adultes · 1 enfant"',
    await piqueniqueRow32.locator('text=17 participants · 16 adultes · 1 enfant').isVisible(),
  );

  // -------------------------------------------------------------------------
  // 33. P2 : la carte Agenda d'un événement "entre familles" SANS AUCUN participant n'affiche
  // aucun résumé du tout (ni "0 participant", ni une ligne vide) — evt-gouter-voisins est
  // encore à 0 participant à ce stade (scénario 27 l'a laissé ainsi).
  // -------------------------------------------------------------------------
  const gouterRow33 = page.locator('[id^="agenda-row-"]', { hasText: 'Goûter entre voisins' }).first();
  const gouterRowText33 = await gouterRow33.innerText();
  ok(
    '33a. Aucun résumé participants sur la carte d\'evt-gouter-voisins (0 participant)',
    !/participant/i.test(gouterRowText33),
    `texte de la carte="${gouterRowText33}"`,
  );

  // -------------------------------------------------------------------------
  // 34. P3 : une seule ligne "VOUS" dans "Qui vient ?" (jamais un second bloc "Votre
  // participation" séparé et redondant), actions Modifier/Annuler intégrées dans cette même
  // ligne, et "Modifier" repeuple bien le formulaire avec les valeurs existantes.
  // evt-gouter-voisins (0 participant à ce stade) permet un contrôle exact, sans interférence
  // d'autres foyers.
  // -------------------------------------------------------------------------
  await gouterRow33.click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Augmenter — Adultes', exact: true }).click();
  await page.getByRole('button', { name: 'Augmenter — Enfants', exact: true }).click();
  await page.getByLabel('Prénom adulte 1', { exact: true }).fill('Claire');
  await page.getByLabel('Prénom adulte 2', { exact: true }).fill('Marc');
  await page.getByLabel('Prénom enfant 1', { exact: true }).fill('Zoé');
  await page.getByRole('button', { name: 'Confirmer ma participation', exact: true }).click();
  await page.waitForTimeout(300);

  // getByText(..., { exact: true }) est sensible à la casse — distingue bien la pastille
  // "VOUS" (tout en majuscules) du libellé de foyer "Vous" (le mock donne ce label au foyer de
  // l'utilisateur courant, voir mockAgendaApi.js), sans quoi un `text=VOUS` insensible à la
  // casse compterait à tort les deux.
  ok('34a. La pastille "VOUS" apparaît (exactement une fois)', (await page.getByText('VOUS', { exact: true }).count()) === 1);
  ok(
    '34b. Aucun second bloc "Votre participation" redondant nulle part sur la page',
    (await page.locator('text=Votre participation').count()) === 0,
  );
  ok('34c. Un seul bouton "Modifier" (intégré dans la ligne "Vous", pas dupliqué)', (await page.getByRole('button', { name: 'Modifier', exact: true }).count()) === 1);
  ok('34d. Un seul bouton "Annuler ma participation" (idem)', (await page.getByRole('button', { name: 'Annuler ma participation', exact: true }).count()) === 1);
  ok('34e. Les prénoms saisis s\'affichent bien dans cette même ligne ("Claire, Marc, Zoé")', await page.locator('text=Claire, Marc, Zoé').first().isVisible());

  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.waitForTimeout(150);
  ok('34f. "Modifier" (intégré à la ligne "Vous") repeuple bien 2 adultes', (await stepperValue('Adultes')) === '2', `valeur=${await stepperValue('Adultes')}`);
  ok('34g. "Modifier" repeuple bien 1 enfant', (await stepperValue('Enfants')) === '1', `valeur=${await stepperValue('Enfants')}`);
  ok('34h. "Modifier" repeuple bien les prénoms existants ("Zoé")', (await page.getByLabel('Prénom enfant 1', { exact: true }).inputValue()) === 'Zoé');
  // Abandon du brouillon de modification (bouton "Annuler" du FORMULAIRE, distinct de "Annuler
  // ma participation" — ne doit surtout pas déclencher la confirmation de suppression P4).
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await page.waitForTimeout(150);
  ok('34i. L\'abandon du brouillon de modification n\'a pas supprimé l\'inscription ("VOUS" toujours là)', await page.getByText('VOUS', { exact: true }).isVisible());

  // -------------------------------------------------------------------------
  // 35. P4 : "Annuler ma participation" ouvre une confirmation — titre/texte/libellés EXACTS —
  // et ne supprime RIEN tant qu'elle n'est pas explicitement confirmée. L'option prudente
  // ("Conserver ma participation") est visuellement mise en avant ET reçoit le focus initial.
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Annuler ma participation', exact: true }).click();
  await page.waitForTimeout(150);
  ok('35a. Titre exact de la confirmation : "Annuler votre participation ?"', await page.getByText('Annuler votre participation ?', { exact: true }).isVisible());
  ok(
    '35b. Texte exact de la confirmation : "Les nombres de participants et les prénoms saisis seront supprimés."',
    await page.getByText('Les nombres de participants et les prénoms saisis seront supprimés.', { exact: true }).isVisible(),
  );
  ok('35c. Bouton exact "Conserver ma participation"', await page.getByRole('button', { name: 'Conserver ma participation', exact: true }).isVisible());
  ok('35d. Bouton exact "Oui, annuler ma participation"', await page.getByRole('button', { name: 'Oui, annuler ma participation', exact: true }).isVisible());
  const activeText35 = await page.evaluate(() => document.activeElement?.textContent?.trim());
  ok('35e. Le focus initial est bien sur "Conserver ma participation" (option prudente)', activeText35 === 'Conserver ma participation', `focus="${activeText35}"`);
  ok(
    '35f. AUCUNE suppression n\'a encore eu lieu : la ligne "Vous" (prénoms inclus) est toujours visible derrière la confirmation',
    await page.locator('text=Claire, Marc, Zoé').first().isVisible(),
  );
  // "Conserver ma participation" : ferme la confirmation, ne supprime rien.
  await page.getByRole('button', { name: 'Conserver ma participation', exact: true }).click();
  await page.waitForTimeout(150);
  ok('35g. Après "Conserver ma participation", la confirmation est fermée', (await page.getByText('Annuler votre participation ?', { exact: true }).count()) === 0);
  ok('35h. L\'inscription est INCHANGÉE ("VOUS" et les prénoms toujours là)', await page.locator('text=Claire, Marc, Zoé').first().isVisible());

  // -------------------------------------------------------------------------
  // 36. P4 : Escape ferme aussi la confirmation, sans rien supprimer — l'inscription (et ses
  // prénoms) reste affichée exactement comme avant l'ouverture de la confirmation.
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Annuler ma participation', exact: true }).click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  ok('36a. Escape ferme bien la confirmation', (await page.getByText('Annuler votre participation ?', { exact: true }).count()) === 0);
  ok(
    '36b. L\'inscription (prénoms inclus) est bien PRÉSERVÉE après Escape — aucune perte silencieuse',
    await page.locator('text=Claire, Marc, Zoé').first().isVisible(),
  );
  ok('36c. Le bouton "Vous venez à combien ?" n\'est PAS réapparu (la participation existe toujours)', (await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).count()) === 0);

  // -------------------------------------------------------------------------
  // 37. P4 : confirmer explicitement ("Oui, annuler ma participation") supprime réellement
  // l'inscription et fait réapparaître l'état vide ("Aucun participant pour le moment",
  // bouton d'inscription initial) — jamais de DELETE avant ce clic explicite (scénarios 35/36
  // ci-dessus l'ont déjà prouvé).
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Annuler ma participation', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Oui, annuler ma participation', exact: true }).click();
  await page.waitForTimeout(300);
  ok('37a. La confirmation s\'est bien fermée après confirmation explicite', (await page.getByText('Annuler votre participation ?', { exact: true }).count()) === 0);
  ok('37b. L\'inscription a bien été supprimée : "Vous venez à combien ?" réapparaît', await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).isVisible());
  ok('37c. L\'état vide réapparaît bien : "Aucun participant pour le moment"', await page.locator('text=Aucun participant pour le moment').isVisible());
  ok('37d. Les prénoms supprimés n\'apparaissent plus nulle part ("Claire, Marc, Zoé")', (await page.locator('text=Claire, Marc, Zoé').count()) === 0);
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);

  // -------------------------------------------------------------------------
  // 38. P5 : quand la colonne attendee_names est absente (migration sql/05 pas encore
  // appliquée — simulé ici via le levier de test dédié du harnais, voir mockAgendaApi.js),
  // l'agenda continue de se charger normalement (plus de "Impossible de charger l'agenda"
  // générique) et le formulaire d'inscription affiche un avertissement explicite et
  // PROACTIF — les prénoms restent saisissables, mais l'avertissement dit clairement qu'ils
  // ne seront pas enregistrés pour l'instant.
  // -------------------------------------------------------------------------
  await page.evaluate(() => sessionStorage.setItem('__abczed_harness_names_unsupported__', 'true'));
  // P1 (rappel) : "Retour" depuis la fiche a ramené sur Agenda (eventReturnTo), pas Accueil —
  // l'URL courante est donc "/agenda" à ce stade, et une actualisation la rouvre bien telle
  // quelle (comportement attendu depuis le correctif P1, pas une régression).
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Agenda")');
  ok(
    '38a. Aucune erreur générique "Impossible de charger l\'agenda" malgré la colonne absente (repli attendu, pas une vraie panne)',
    (await page.locator("text=Impossible de charger l'agenda").count()) === 0,
  );
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  ok('38b. L\'agenda continue de s\'afficher normalement (evt-piquenique visible)', await page.locator('[id^="agenda-row-"]', { hasText: 'ique-nique' }).first().isVisible());
  await page.locator('[id^="agenda-row-"]', { hasText: 'Goûter entre voisins' }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).click();
  await page.waitForTimeout(150);
  ok(
    '38c. Le formulaire d\'inscription affiche un avertissement PROACTIF (avant tout essai d\'enregistrement) — les prénoms ne pourront pas être sauvegardés',
    await page.locator('text=ne pourront pas être enregistrés').isVisible(),
  );
  ok('38d. La saisie des prénoms reste bien ouverte (jamais désactivée)', await page.getByLabel('Prénom adulte 1', { exact: true }).isEditable());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);
  // Nettoyage du levier de test avant le scénario suivant.
  await page.evaluate(() => sessionStorage.removeItem('__abczed_harness_names_unsupported__'));

  // -------------------------------------------------------------------------
  // 39. P5 : une VRAIE erreur (ex. violation de contrainte — donnée malformée, PAS une colonne
  // absente) survenant pendant une inscription ne doit JAMAIS être avalée en silence comme si
  // c'était le cas "migration pas encore appliquée" — elle doit rester visible telle quelle.
  // -------------------------------------------------------------------------
  await page.evaluate(() => sessionStorage.setItem('__abczed_harness_force_join_error__', 'constraint'));
  await goBottomTab('Agenda');
  await page.waitForTimeout(150);
  await page.click('button:has-text("Sorties")');
  await page.waitForTimeout(150);
  await page.locator('[id^="agenda-row-"]', { hasText: 'Goûter entre voisins' }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Confirmer ma participation', exact: true }).click();
  await page.waitForTimeout(300);
  ok(
    '39a. Une vraie erreur générique est affichée (pas silencieusement transformée en repli "sans prénoms")',
    await page.locator("text=Impossible d'enregistrer ta réponse").isVisible(),
  );
  ok(
    '39b. Ce n\'est PAS le message "migration pas encore appliquée" (la distinction 42703/PGRST204 vs violation de contrainte reste correcte)',
    (await page.locator("text=n'ont pas pu être sauvegardés").count()) === 0,
  );
  ok('39c. Rien n\'a été enregistré par erreur : le bouton d\'inscription initial est toujours là', await page.getByRole('button', { name: 'Vous venez à combien ?', exact: true }).isVisible());
  await page.click('button[aria-label="Retour"]');
  await page.waitForTimeout(150);
  // Nettoyage du levier de test.
  await page.evaluate(() => sessionStorage.removeItem('__abczed_harness_force_join_error__'));

  // -------------------------------------------------------------------------
  // 40. P1 — bug réel signalé par une contre-vérification indépendante (pas une supposition) :
  // le repli "événement introuvable" empilait une entrée `/agenda` par-dessus l'URL invalide
  // (`pushState`) au lieu de la corriger en place (`replaceState`). Cette entrée invalide reste
  // alors atteignable via "Précédent" : le navigateur y revient réellement (nouvelle navigation
  // complète, cette entrée n'ayant jamais été créée par `pushState`/`replaceState` mais par un
  // chargement direct), ce qui redéclenche aussitôt la même résolution "introuvable", qui
  // repoussait alors une NOUVELLE entrée `/agenda` — boucle sans fin, "Précédent" ne ramenant
  // jamais réellement en arrière.
  //
  // Note méthode : une première version de ce test tentait de discriminer via
  // `window.history.length` (repoussée puis retirée) — mesuré empiriquement non fiable dans cet
  // environnement (Chromium + Playwright + Vite ne fait pas toujours croître cette valeur de la
  // façon attendue lors d'une navigation directe suivie d'un correctif JS côté client, y compris
  // sur le code CORRECT). Gardé ici seulement ce qui est observé, discriminant et vérifié : le
  // chemin d'URL réellement affiché après chaque "Précédent". Vérifié discriminant en pratique :
  // en réintroduisant le `pushState` fautif, 40d échoue exactement avec l'URL invalide qui
  // réapparaît dans la barre d'adresse ; restauré, il repasse au vert.
  // -------------------------------------------------------------------------
  await page.goto(BASE + 'evenement/id-qui-n-existe-plus?from=agenda', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  ok('40a. Repli propre vers Agenda pour un id d\'événement introuvable (rejeu direct)', await heading(page, 'Agenda'));
  ok('40b. URL retombée sur "/agenda"', new URL(page.url()).pathname === '/agenda', `url=${page.url()}`);
  await page.goBack();
  await page.waitForTimeout(300);
  ok(
    '40c. "Précédent" ne revient jamais sur l\'URL invalide elle-même',
    new URL(page.url()).pathname !== '/evenement/id-qui-n-existe-plus',
    `url=${page.url()}`,
  );
  // Un second "Précédent" doit continuer à progresser normalement (jamais rester bloqué à
  // osciller entre l'URL invalide et "/agenda").
  await page.goBack();
  await page.waitForTimeout(300);
  ok(
    '40d. Un second "Précédent" progresse encore dans l\'historique (jamais de blocage/oscillation)',
    new URL(page.url()).pathname !== '/evenement/id-qui-n-existe-plus',
    `url=${page.url()}`,
  );

  // ===========================================================================================
  // V7.7 — Messages réellement connecté à Supabase (test-harness/mockMessagesApi.js remplace
  // src/messagesApi.js via vite.harness.config.js, exactement comme mockAgendaApi.js/
  // mockAuth.jsx pour Agenda/session). `mockMessagesApi.js` reprend le CONTENU exact de l'ancien
  // GENERAL_THREAD de démonstration (mêmes ids m0/m1/m2/m3/m4/m6, mêmes textes) pour que les
  // scénarios déjà écrits plus haut (1, 3, 6, 9, 11, 17, 25, 29) continuent d'exercer le même
  // comportement observable, désormais via le vrai chemin réseau (messagesApi.js réel,
  // remplacé uniquement au niveau transport) plutôt que via l'état React local d'avant ce lot.
  // Les garanties SERVEUR (RLS, contrainte composite, trigger d'immuabilité) sont vérifiées
  // séparément et discriminativement contre un PostgreSQL local jetable — voir
  // MATRICE_LIVRAISON.md, section P8 — jamais reproduites ici : ce bloc n'exerce que le câblage
  // React (App.jsx/Messages.jsx/Accueil.jsx).
  // ===========================================================================================

  // -------------------------------------------------------------------------
  // 41. P3 — Envoi réel bout en bout : le texte est persisté (pas seulement affiché
  // localement), le champ se vide UNIQUEMENT après confirmation serveur, Entrée et le bouton
  // Envoyer empruntent le même chemin (ici testé via Entrée).
  // -------------------------------------------------------------------------
  await goBottomTab('Messages');
  await page.waitForTimeout(200);
  const sentText = 'Message envoyé par la recette V7.7 — ' + Date.now();
  await page.fill('input[placeholder="Écrivez un message..."]', sentText);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  ok('41a. Le message envoyé apparaît bien dans le fil (persisté, pas juste affiché)', await page.locator(`text=${sentText}`).isVisible());
  ok('41b. Le champ de saisie est vidé après un envoi réussi', (await page.inputValue('input[placeholder="Écrivez un message..."]')) === '');
  const sentRow = page.locator('[id^="msg-row-"]', { hasText: sentText }).last();

  // -------------------------------------------------------------------------
  // 42. P4 — Lier un message à un VRAI événement de l'agenda réel (pas evt-piscine, exclu de
  // l'agenda "live" du harnais pour exercer volontairement le repli MOCK_EVENTS ailleurs dans
  // cette recette — voir scénarios 5bis/6/11). Le sélecteur ne propose que des événements réels
  // de la communauté (`events`, plus MOCK_EVENTS/linkableEvents()), et exclut les anniversaires.
  // -------------------------------------------------------------------------
  // Cible le message qui vient réellement d'être envoyé. `.last()` sur tous les boutons du
  // fil dépendait de l'heure courante (les données de recette contiennent aussi un message à
  // 14 h 40) et pouvait donc lier un autre message selon l'heure d'exécution.
  const linkTrigger = sentRow.getByRole('button', { name: "Lier ce message à un événement de l'agenda" });
  ok('42a. Le bouton "Lier à un événement" est visible (auteur du message = utilisateur courant)', await linkTrigger.isVisible());
  await linkTrigger.click();
  await page.waitForTimeout(200);
  const dialogEventButtons = page.getByRole('dialog').getByRole('button');
  const eventButtonCount = await dialogEventButtons.count();
  ok('42b. Au moins un événement réel de l\'agenda est proposé (pas de repli mock)', eventButtonCount > 1, `count=${eventButtonCount}`);
  ok(
    '42c. Aucun anniversaire proposé dans la liste (règle héritée de l\'ancienne linkableEvents())',
    (await page.locator('div[role="dialog"] button:has-text("anniversaire")').count()) === 0,
  );
  await dialogEventButtons.nth(1).click(); // premier événement réel de la liste (index 0 = fermer)
  const linkedBadge = sentRow.locator('button[id^="msg-event-btn-"]');
  await linkedBadge.waitFor();
  ok('42d. Le badge d\'événement lié apparaît sur le message, avec un VRAI titre (pas vide)', ((await linkedBadge.textContent()) || '').trim().length > 0);

  // -------------------------------------------------------------------------
  // 43. P2 — État vide de recherche : texte exact du brief (distinct du cas "discussion liée
  // vide", déjà couvert ailleurs) — une recherche sans aucun résultat affiche le bon message,
  // jamais confondu avec l'état "aucun message pour le moment" (fil réellement vide).
  // -------------------------------------------------------------------------
  await page.fill('input[placeholder*="Mot, personne, événement ou date"]', 'zzz-aucun-resultat-possible-zzz');
  await page.waitForTimeout(200);
  ok(
    '43a. Recherche sans résultat -> message exact "Aucun résultat pour « ... »."',
    await page.locator('text=Aucun résultat pour « zzz-aucun-resultat-possible-zzz ».').isVisible(),
  );
  await page.fill('input[placeholder*="Mot, personne, événement ou date"]', '');
  await page.waitForTimeout(200);

  // -------------------------------------------------------------------------
  // 44. P3 — Persistance après un rechargement COMPLET de la page (pas seulement en mémoire
  // React) : le message envoyé au scénario 41 doit toujours être là après un vrai reload.
  // -------------------------------------------------------------------------
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Messages")');
  await page.waitForTimeout(300);
  ok('44a. Le message envoyé au scénario 41 persiste après un rechargement complet', await page.locator(`text=${sentText}`).isVisible());

} catch (err) {
  console.log('💥 Exception pendant la recette :', err.message);
  fail++;
} finally {
  console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
  if (pageErrors.length) console.log('Erreurs JS capturées pendant la session :', JSON.stringify(pageErrors));
  await browser.close();
}
process.exit(fail > 0 || pageErrors.length > 0 ? 1 : 0);
