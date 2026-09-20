// V7.14 — correctif UAT ciblé : logo (point 1) + système de design transversal (point 6) +
// les règles responsive explicitement nommées par le brief (empilement des actions rapides de
// l'Accueil sous ~340px, chips de filtre de Partages sur deux lignes à 320px, absence de
// débordement horizontal à 320/360/400×824 sur les 5 pages + un sheet/modale).
// Lancer le serveur avec : npx vite --config vite.harness.config.js --host 127.0.0.1
// Puis : node test-harness/recette-v714.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:5183/';
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = { headless: true };
if (fs.existsSync(SANDBOX_CHROMIUM)) launchOptions.executablePath = SANDBOX_CHROMIUM;

const screenshotsDir = path.resolve('artifacts');
fs.mkdirSync(screenshotsDir, { recursive: true });

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, condition, detail = '') {
  if (condition) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`); fail++; failures.push(label); }
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

const browser = await chromium.launch(launchOptions);
try {
  for (const viewport of [
    { width: 320, height: 824 },
    { width: 360, height: 824 },
    { width: 400, height: 824 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(5000);
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();

    // --- Logo (point 1) : toujours visible, un seul <svg>, mot-symbole intact -------------
    const logo = page.locator('[role="img"][aria-label="ABCZed"]').first();
    ok(`${viewport.width}px : logo (nouveau soleil + mot-symbole) visible`, await logo.isVisible() && await logo.locator('svg').count() === 1);
    const rayCount = await logo.locator('svg path').first().evaluate((el) => (el.getAttribute('d').match(/M/g) || []).length);
    ok(`${viewport.width}px : le soleil a bien 8 rayons répartis (pas 3 amassés comme en V7.13)`, rayCount === 8, `${rayCount} rayons`);

    // --- Zéro débordement horizontal sur les 5 pages (contrainte globale) ---------------
    ok(`${viewport.width}px : Accueil sans débordement horizontal`, (await overflow(page)) <= 1);

    // --- Accueil : actions rapides — empilées <340px, côte à côte sinon (finding : à
    //     320px avec l'ancien style pastel/13px, ces boutons NE débordaient PAS ; avec le
    //     nouvel aplat solide (police de bouton légèrement plus grande), le filet de
    //     sécurité CSS `.home-quick-actions` (App.jsx) s'active réellement à 320px — vérifié
    //     ici, pas supposé. */
    const quickActionBoxes = await page.locator('#home-create-event, #home-write-message').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    const stackedExpected = viewport.width < 340;
    const actuallyStacked = quickActionBoxes[1].y > quickActionBoxes[0].y + quickActionBoxes[0].height / 2;
    ok(
      `${viewport.width}px : actions rapides Accueil ${stackedExpected ? 'empilées verticalement' : 'côte à côte'}`,
      actuallyStacked === stackedExpected,
      JSON.stringify(quickActionBoxes.map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height }))),
    );
    ok(
      `${viewport.width}px : aucun des deux boutons d'action rapide ne dépasse la largeur visible`,
      quickActionBoxes.every((b) => b.x >= 0 && b.x + b.width <= viewport.width + 1),
    );
    // Aplat solide (correctif UAT point 6) — plus un fond teinté pâle.
    const quickActionBg = await page.locator('#home-create-event').evaluate((el) => getComputedStyle(el).backgroundColor);
    ok(`${viewport.width}px : « Créer un événement » en aplat solide (pas une teinte pâle)`, quickActionBg === 'rgb(153, 88, 0)', quickActionBg);

    // --- Partages : filtres sur 2 lignes à largeur étroite, jamais de défilement caché ---
    await page.locator('button[data-tab="partages"]').click();
    await page.locator('h1', { hasText: 'Partages' }).waitFor();
    ok(`${viewport.width}px : Partages sans débordement horizontal`, (await overflow(page)) <= 1);
    const filterStrip = await page.locator('.filter-strip').first().evaluate((el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }));
    ok(
      `${viewport.width}px : chips de filtre Partages — aucun défilement horizontal caché (scrollWidth ≤ clientWidth)`,
      filterStrip.scrollW <= filterStrip.clientW + 1,
      JSON.stringify(filterStrip),
    );
    const chipBoxes = await page.locator('.filter-strip button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
    const chipRows = new Set(chipBoxes.map((b) => Math.round(b.y)));
    if (viewport.width === 320) {
      ok(`320px : les chips de filtre Partages tiennent sur exactement 2 lignes`, chipRows.size === 2, JSON.stringify([...chipRows]));
    }
    ok(
      `${viewport.width}px : aucun chip de filtre Partages tronqué/hors champ`,
      chipBoxes.every((b) => b.x >= 0 && b.x + b.width <= viewport.width + 1),
      JSON.stringify(chipBoxes),
    );
    // ActionButton (Ouvrir/Télécharger) : aplat solide + zone tactile ≥44px (correctif UAT
    // point 6 — c'était l'exemple concret cité, fond #EAF1FB + 12px avant cette passe).
    const openBtn = page.locator('a', { hasText: 'Ouvrir' }).first();
    if (await openBtn.count()) {
      const box = await openBtn.evaluate((el) => ({ h: el.getBoundingClientRect().height, bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
      ok(`${viewport.width}px : ActionButton "Ouvrir" ≥44px de haut`, box.h >= 44, JSON.stringify(box));
      ok(`${viewport.width}px : ActionButton "Ouvrir" en aplat BLUE plein (pas une teinte pâle)`, box.bg === 'rgb(13, 71, 161)', box.bg);
    }

    // --- Agenda / Messages / La Bande : zéro débordement (contrainte globale) -----------
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    ok(`${viewport.width}px : Agenda sans débordement horizontal`, (await overflow(page)) <= 1);

    await page.locator('button[data-tab="messages"]').click();
    await page.locator('h1', { hasText: 'Messages' }).waitFor();
    ok(`${viewport.width}px : Messages sans débordement horizontal`, (await overflow(page)) <= 1);

    await page.locator('button[data-tab="labande"]').click();
    await page.locator('h1', { hasText: 'La Bande' }).waitFor();
    ok(`${viewport.width}px : La Bande sans débordement horizontal`, (await overflow(page)) <= 1);
    // Texte explicatif de carte parent (correctif UAT) : lisiblement plus grand qu'en V7.13.
    const kidsLineSize = await page.locator('[id^="member-row-"]').first().locator('div > div:nth-child(2)').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    ok(`${viewport.width}px : texte explicatif de la carte parent ≥14px (était 13px en V7.13)`, kidsLineSize >= 14, `${kidsLineSize}px`);

    // --- Au moins un sheet/modale : zéro débordement (contrainte globale explicite) -----
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    const addEventBtn = page.getByRole('button', { name: /Ajouter/ }).first();
    await addEventBtn.click();
    await page.getByRole('dialog').waitFor();
    ok(`${viewport.width}px : sheet "Ajouter un événement" sans débordement horizontal`, (await overflow(page)) <= 1);
    await page.keyboard.press('Escape');

    if (viewport.width === 320) {
      await page.locator('button[data-tab="accueil"]').click();
      await page.locator('h1', { hasText: 'Accueil' }).waitFor();
      await page.screenshot({ path: path.join(screenshotsDir, 'accueil-320-v714.png'), fullPage: true });
      await page.locator('button[data-tab="partages"]').click();
      await page.locator('h1', { hasText: 'Partages' }).waitFor();
      await page.screenshot({ path: path.join(screenshotsDir, 'partages-320-v714.png'), fullPage: true });
    }

    ok(`${viewport.width}px : aucune erreur JavaScript`, runtimeErrors.length === 0, runtimeErrors.join(' | '));
    await page.close();
  }
  // ===========================================================================================
  // Phase 2 — domaine Agenda/événement (points 3, 4, 5, 12, 13, 14, 15). Ajout ADDITIF : les
  // scénarios ci-dessus (phase 1 — logo, système de design, responsive) restent intacts.
  // ===========================================================================================
  const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  function localIsoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

  // --- Point 3 : clic sur un jour du calendrier avec événement(s) — révélation immédiate,
  //     défilement automatique si le panneau tombe hors champ, filtre catégorie préservé,
  //     aucun doublon (le même événement ne doit jamais apparaître à la fois dans le panneau du
  //     jour ET dans "À venir"). Fenêtre volontairement basse (520px) pour que le panneau du
  //     jour, ajouté APRÈS le calendrier, tombe réellement hors champ avant tout défilement —
  //     sinon ce test ne prouverait rien (il faut un panneau réellement hors champ pour prouver
  //     que le défilement automatique agit, pas juste qu'il n'y avait rien à faire). ------------
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 520 } });
    page.setDefaultTimeout(8000);
    const runtimeErrors = [];
    page.on('pageerror', (e) => runtimeErrors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();

    await page.getByRole('button', { name: 'Sorties', exact: true }).click();
    ok('Point 3 — préalable : filtre "Sorties" actif avant création', (await page.getByRole('button', { name: 'Sorties', exact: true }).getAttribute('aria-pressed')) === 'true');

    // Événement créé sur AUJOURD'HUI (jamais une date fixe codée en dur, qui finirait par être
    // dépassée — voir point 15 plus bas) : pas de navigation de mois nécessaire, la cellule
    // "aujourd'hui" est déjà visible au premier affichage du calendrier.
    const today = new Date();
    const todayIso = localIsoOf(today);
    const uniqueTitle = 'Sortie clic-date ' + Date.now();
    await page.getByRole('button', { name: 'Ajouter un événement', exact: true }).click();
    const createDialog = page.getByRole('dialog', { name: 'Ajouter un événement' });
    ok('Point 3 — préalable : catégorie préremplie "Sortie" (filtre courant) à l\'ouverture', await createDialog.locator('#ces-category').inputValue() === 'sortie');
    await createDialog.getByPlaceholder('Titre').fill(uniqueTitle);
    await createDialog.locator('#ces-date').fill(todayIso);
    await createDialog.getByRole('button', { name: 'Créer l’événement', exact: true }).click();
    await page.waitForTimeout(400);

    // Point 14 : confirmation (toast) + destination (fiche de l'événement créé, jamais un
    // simple retour aveugle à l'Accueil).
    ok('Point 14 — toast de confirmation "Événement créé." affiché après création réussie', await page.getByRole('status').filter({ hasText: 'Événement créé.' }).isVisible());
    ok('Point 14 — atterrissage sur la FICHE du nouvel événement (pas un retour aveugle à l\'Accueil)', await page.getByRole('button', { name: "Supprimer l'événement" }).isVisible());
    ok('Point 14 — le titre du nouvel événement est bien affiché sur sa fiche', await page.getByText(uniqueTitle, { exact: false }).first().isVisible());

    // Retour sur Agenda : le filtre "Sorties" doit être resté actif (fixé par la création), et le
    // jour du jour doit maintenant porter l'événement créé.
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    ok('Point 3 — filtre catégorie toujours "Sorties" après la création (pas réinitialisé)', (await page.getByRole('button', { name: 'Sorties', exact: true }).getAttribute('aria-pressed')) === 'true');

    const todayLabelPrefix = `${today.getDate()} ${MONTH_NAMES[today.getMonth()]}`;
    const todayCell = page.locator(`button[aria-label^="${todayLabelPrefix} "]`).first();
    await todayCell.waitFor();
    ok('Point 3a. Le jour du jour porte bien un événement (pastille) avant le clic', /événement/.test((await todayCell.getAttribute('aria-label')) || ''));

    await todayCell.click();
    await page.waitForTimeout(350); // afterPaint (double rAF) + défilement fluide éventuel

    ok('Point 3b. Le panneau du jour sélectionné révèle l\'événement immédiatement', await page.locator('#agenda-selected-date-panel').getByText(uniqueTitle, { exact: false }).isVisible());
    ok('Point 3c. Le filtre "Sorties" reste actif après le clic sur la date (jamais réinitialisé)', (await page.getByRole('button', { name: 'Sorties', exact: true }).getAttribute('aria-pressed')) === 'true');
    ok('Point 3d. Aucun doublon : le titre n\'apparaît qu\'UNE fois à l\'écran (jamais à la fois dans le panneau du jour ET dans "À venir")', (await page.getByText(uniqueTitle, { exact: false }).count()) === 1);
    const panelBox = await page.locator('#agenda-selected-date-panel').evaluate((el) => el.getBoundingClientRect());
    ok(
      'Point 3e. Le panneau du jour a bien été défilé dans le champ visible (afterPaint + scrollIntoView, motionPrefs.js)',
      panelBox.top >= 0 && panelBox.top < 520,
      JSON.stringify(panelBox),
    );
    ok('Point 3 — aucune erreur JavaScript', runtimeErrors.length === 0, runtimeErrors.join(' | '));
    await page.close();
  }

  // --- Point 15 : "À venir" (Agenda.jsx) et "Prochain événement" (Accueil.jsx) excluent bien un
  //     événement daté déjà passé, en conditions réelles de navigateur (pas seulement le test
  //     Node isolé sur la fonction pure — scripts/test-upcoming-events.mjs). Événement créé
  //     HIER (toujours dans le mois courant affiché par défaut, donc jamais besoin de naviguer
  //     le calendrier) : doit disparaître de "À venir"/"Prochain événement" mais RESTER
  //     consultable depuis sa date dans le calendrier (le filtre passé ne supprime rien). --------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    const runtimeErrors = [];
    page.on('pageerror', (e) => runtimeErrors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    await page.getByRole('button', { name: 'Tous', exact: true }).click();

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayIso = localIsoOf(yesterday);
    const pastTitle = 'Événement passé ' + Date.now();
    await page.getByRole('button', { name: 'Ajouter un événement', exact: true }).click();
    const dialog2 = page.getByRole('dialog', { name: 'Ajouter un événement' });
    await dialog2.locator('#ces-category').selectOption('autre');
    await dialog2.getByPlaceholder('Titre').fill(pastTitle);
    await dialog2.locator('#ces-date').fill(yesterdayIso);
    await dialog2.getByRole('button', { name: 'Créer l’événement', exact: true }).click();
    await page.waitForTimeout(400);
    ok('Point 15 — préalable : création de l\'événement passé réussie (toast affiché)', await page.getByRole('status').filter({ hasText: 'Événement créé.' }).isVisible());

    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    ok('Point 15a. L\'événement daté HIER n\'apparaît PAS dans "À venir"', (await page.getByText(pastTitle, { exact: false }).count()) === 0);

    await page.locator('button[data-tab="accueil"]').click();
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    ok('Point 15b. L\'événement daté HIER n\'apparaît PAS comme "Prochain événement" sur l\'Accueil', (await page.getByText(pastTitle, { exact: false }).count()) === 0);

    // Il reste néanmoins consultable depuis le calendrier, à sa vraie date (rien n'a été
    // supprimé — seule la liste "à venir" l'exclut).
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    const yesterdayLabelPrefix = `${yesterday.getDate()} ${MONTH_NAMES[yesterday.getMonth()]}`;
    const yesterdayCell = page.locator(`button[aria-label^="${yesterdayLabelPrefix} "]`).first();
    await yesterdayCell.click();
    await page.waitForTimeout(300);
    ok('Point 15c. ...mais reste consultable depuis sa date réelle dans le calendrier (rien n\'a été supprimé)', await page.locator('#agenda-selected-date-panel').getByText(pastTitle, { exact: false }).isVisible());
    ok('Point 15 — aucune erreur JavaScript', runtimeErrors.length === 0, runtimeErrors.join(' | '));
    await page.close();
  }

  // --- Points 12/13 : sélecteur de catégorie unifié (4 options, "Anniversaire" y compris),
  //     formulaire adapté (champs anniversaire vs champs événement complet), validation réelle
  //     (message d'erreur par champ, aria-invalid/aria-describedby, focus déplacé sur le PREMIER
  //     champ en erreur, jamais de fermeture/perte de saisie sur échec). ------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    const runtimeErrors = [];
    page.on('pageerror', (e) => runtimeErrors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    await page.getByRole('button', { name: 'Tous', exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter un événement', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Ajouter un événement' });

    // Les 4 options exactes attendues, dans l'ordre, avec le placeholder qui ne compte jamais
    // comme un vrai choix (disabled, valeur '').
    const optionTexts = await dlg.locator('#ces-category option').allTextContents();
    ok('Point 12a. Le placeholder "Choisir une catégorie" est bien présent et désactivé (jamais un vrai choix)', await dlg.locator('#ces-category option[value=""]').isDisabled());
    ok(
      'Point 12b. Exactement 4 vraies options : Anniversaire, Sortie, École, Autre',
      JSON.stringify(optionTexts.slice(1)) === JSON.stringify(['Anniversaire', 'Sortie', 'École', 'Autre']),
      JSON.stringify(optionTexts),
    );

    // --- Soumission vide : catégorie non choisie -> erreur + focus sur le sélecteur lui-même.
    await dlg.getByRole('button', { name: 'Créer l’événement', exact: true }).click();
    ok('Point 13a. Soumission vide : erreur "Choisis une catégorie." affichée', await dlg.getByText('Choisis une catégorie.', { exact: true }).isVisible());
    ok('Point 13b. Le champ Catégorie porte bien aria-invalid="true"', (await dlg.locator('#ces-category').getAttribute('aria-invalid')) === 'true');
    ok('Point 13c. aria-describedby pointe vers le message d\'erreur réel (pas juste posé sans cible)', (await dlg.locator('#ces-category').getAttribute('aria-describedby')) === 'ces-error-category');
    ok('Point 13d. Le focus s\'est déplacé sur le PREMIER champ en erreur (le sélecteur de catégorie)', await page.evaluate(() => document.activeElement?.id) === 'ces-category');
    ok('Point 13e. Le formulaire ne s\'est PAS fermé sur échec de validation', (await dlg.count()) === 1);

    // --- Catégorie "Autre" choisie, titre + date manquants -> deux erreurs, focus sur le titre
    //     (premier champ en erreur dans l'ordre du formulaire), la saisie déjà faite est
    //     préservée (rien n'est effacé par un échec de validation).
    await dlg.locator('#ces-category').selectOption('autre');
    const draftTitle = 'Brouillon jamais perdu';
    await dlg.getByPlaceholder('Titre').fill(''); // laissé vide volontairement pour cette étape
    await dlg.getByRole('button', { name: 'Créer l’événement', exact: true }).click();
    ok('Point 13f. Titre manquant : erreur "Indique un titre." affichée', await dlg.getByText('Indique un titre.', { exact: true }).isVisible());
    ok('Point 13g. Date manquante : erreur "Choisis une date." affichée', await dlg.getByText('Choisis une date.', { exact: true }).isVisible());
    ok('Point 13h. Focus déplacé sur le PREMIER champ en erreur (Titre, avant Date dans le DOM)', await page.evaluate(() => document.activeElement?.getAttribute('placeholder')) === 'Titre');
    await dlg.getByPlaceholder('Titre').fill(draftTitle);
    ok('Point 13i. La saisie reste intacte après un échec de validation (rien n\'est jamais effacé)', await dlg.getByPlaceholder('Titre').inputValue() === draftTitle);

    // --- Catégorie "Anniversaire" : le formulaire s'adapte — champs Prénom/Jour/Mois, jamais
    //     Date/Heure/Lieu/Détails (qui n'ont pas de sens pour un rappel d'anniversaire).
    await dlg.locator('#ces-category').selectOption('anniversaire');
    ok('Point 12c. Catégorie "Anniversaire" : le champ Prénom apparaît', await dlg.getByLabel('Prénom').isVisible());
    ok('Point 12c. ...le champ Jour apparaît', await dlg.getByLabel('Jour').isVisible());
    ok('Point 12c. ...le champ Mois apparaît', await dlg.getByLabel('Mois').isVisible());
    ok('Point 12d. ...mais PAS de champ Date complet (aucun sens pour un anniversaire)', (await dlg.locator('#ces-date').count()) === 0);
    ok('Point 12d. ...ni de champ Lieu', (await dlg.locator('#ces-location').count()) === 0);
    ok('Point 12d. ...ni de champ Détails', (await dlg.locator('#ces-description').count()) === 0);

    // Soumission vide en mode anniversaire -> focus sur Prénom (premier champ en erreur).
    await dlg.getByRole('button', { name: 'Ajouter l’anniversaire', exact: true }).click();
    ok('Point 13j. Anniversaire vide : erreur "Indique un prénom." affichée', await dlg.getByText('Indique un prénom.', { exact: true }).isVisible());
    ok('Point 13k. Focus déplacé sur le champ Prénom (premier champ en erreur du mode anniversaire)', await page.evaluate(() => document.activeElement?.id) === 'ces-name');
    ok('Point 13l. Le champ Prénom porte bien aria-invalid="true"', (await dlg.locator('#ces-name').getAttribute('aria-invalid')) === 'true');

    await page.keyboard.press('Escape');
    ok('Points 12/13 — aucune erreur JavaScript', runtimeErrors.length === 0, runtimeErrors.join(' | '));
    await page.close();
  }

  // --- Point 4 : grille d'actions de la fiche événement — un seul barème hauteur/rayon/espacement
  //     cohérent (buttonStyle/theme.js), plus l'ancienne incohérence visuelle (boutons VOUS à
  //     40px/rayon 10 vs le reste de l'app à 48px/rayon 14). --------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    await page.getByRole('button', { name: 'Sorties', exact: true }).click();
    const zooRow = page.locator('[id^="agenda-row-"]', { hasText: 'Sortie au zoo' }).first();
    await zooRow.waitFor();
    await zooRow.click();
    await page.getByRole('button', { name: "Supprimer l'événement" }).waitFor();

    // "Voir la discussion liée" n'apparaît que sur un événement avec hasLinkedThread:true —
    // seul evt-piscine (src/data.js) l'a, et il est délibérément exclu de ce harnais
    // (mockAgendaApi.js, pour tester le repli MOCK_EVENTS ailleurs) : jamais atteignable ici,
    // donc pas dans ce regex. On couvre à la place le CTA d'inscription ("Vous venez à
    // combien ?", primaryBtn) et "Supprimer l'événement" (secondaryBtn/destructive) — les deux
    // familles de boutons réellement présentes sur cette fiche.
    const btnBoxes = await page.locator('button', { hasText: /Vous venez à combien|Me retirer|Je ne participe pas|Je peux accompagner|Je participe|Voir la discussion liée|Supprimer l'événement/ }).evaluateAll((els) =>
      els.map((el) => ({ text: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height), radius: getComputedStyle(el).borderRadius })),
    );
    ok(
      'Point 4a. Les boutons d\'action de la fiche (CTA d\'inscription + Supprimer) partagent la même hauteur (48px, BUTTON_H de theme.js)',
      btnBoxes.length >= 2 && btnBoxes.every((b) => b.h === 48),
      JSON.stringify(btnBoxes),
    );
    ok(
      'Point 4b. ...et le même rayon d\'angle (14px, RADIUS_MD de theme.js)',
      btnBoxes.every((b) => b.radius === '14px'),
      JSON.stringify(btnBoxes),
    );
    await page.close();
  }

  // ===========================================================================================
  // Phase 3 — navigation + Messages + Partages + La Bande. Ajout ADDITIF : rien au-dessus n'est
  // modifié. Fixtures de fichiers locales (hors du dépôt, scratchpad de la session) pour les
  // scénarios de vrai upload (item 11).
  // ===========================================================================================
  const FIXTURES = '/tmp/claude-0/-home-claude/ebe4c85e-ce59-544f-8729-631457841ee3/scratchpad/fixtures';
  const SMALL_FILE = path.join(FIXTURES, 'petit-fichier.txt');
  const SMALL_PHOTO = path.join(FIXTURES, 'petite-photo.png');
  const TOO_BIG_FILE = path.join(FIXTURES, 'trop-gros.bin');

  // --- Item 2 : un rechargement franc (F5) atterrit TOUJOURS en haut de page, même scrollée --
  // Avant correctif : `history.scrollRestoration` natif du navigateur (jamais réglé) pouvait
  // réappliquer un ancien scroll indépendamment de navMemory (App.jsx, réinitialisé à chaque
  // montage). Corrigé : `history.scrollRestoration = 'manual'`, posé une seule fois (src/main.jsx
  // ET son miroir test-harness/main.jsx, requis puisque ce harnais a un point d'entrée séparé).
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const beforeReload = await page.evaluate(() => window.scrollY);
    ok('Item 2a. (préalable) la page Agenda peut effectivement être scrollée avant ce test', beforeReload > 0, `scrollY=${beforeReload}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    const afterReload = await page.evaluate(() => window.scrollY);
    ok('Item 2b. Rechargement franc (F5) sur Agenda scrollée -> atterrit en haut (scrollY=0)', afterReload === 0, `scrollY=${afterReload}`);

    // Même vérification sur Messages (page différente, même mécanisme global).
    await page.locator('button[data-tab="messages"]').click();
    await page.locator('h1', { hasText: 'Messages' }).waitFor();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Messages' }).waitFor();
    const afterReloadMsg = await page.evaluate(() => window.scrollY);
    ok('Item 2c. Rechargement franc (F5) sur Messages scrollée -> atterrit en haut (scrollY=0)', afterReloadMsg === 0, `scrollY=${afterReloadMsg}`);

    // Un clic sur un onglet DÉJÀ actif (barre du bas) ne doit jamais restaurer une position
    // obsolète — goTo() consomme déjà navMemory pour l'onglet ciblé, y compris lui-même.
    await page.locator('button[data-tab="agenda"]').click();
    await page.locator('h1', { hasText: 'Agenda' }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.locator('button[data-tab="agenda"]').click(); // même onglet, déjà actif
    await page.waitForTimeout(150);
    ok('Item 2d. Cliquer un onglet déjà actif ne déclenche aucune restauration surprise (page toujours affichée normalement)', await page.locator('h1', { hasText: 'Agenda' }).isVisible());

    ok('Item 2. Aucune erreur JavaScript', (await page.evaluate(() => window.__errCount || 0)) === 0);
    await page.close();
  }

  // --- Item 7 : alignement des messages (mesure de bounding box réelle, pas seulement le style) --
  for (const width of [320, 360, 400]) {
    const page = await browser.newPage({ viewport: { width, height: 824 } });
    page.setDefaultTimeout(8000);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="messages"]').click();
    await page.locator('h1', { hasText: 'Messages' }).waitFor();

    const composer = page.locator('input[placeholder="Écrivez un message..."]');
    const shortText = `ok${Date.now()}`;
    await composer.fill(shortText);
    await page.keyboard.press('Enter');
    const ownRow = page.locator('[id^="msg-row-"]', { hasText: shortText }).last();
    await ownRow.waitFor();
    // Référence réelle : le CONTENEUR de liste (padding '0 20px', Messages.jsx ligne ~236),
    // pas le viewport brut — la page a elle-même un padding externe (body), donc comparer au
    // viewport donnait un faux écart d'≈28px (8px page + 20px liste) et un premier essai de ce
    // test (avant contre-vérification) échouait alors même que l'alignement réel était correct.
    // grandparent = <div padding:'0 20px'> (le conteneur de liste), parent = <div key={m.id}>.
    const measures = await ownRow.evaluate((el) => {
      const rowRect = el.getBoundingClientRect();
      const container = el.parentElement.parentElement;
      const containerRect = container.getBoundingClientRect();
      const cs = getComputedStyle(container);
      // `getBoundingClientRect()` renvoie la boîte de PADDING (padding inclus) ; la zone de
      // contenu réelle où les messages peuvent effectivement s'étendre est resserrée de son
      // `padding-left`/`padding-right` (20px de chaque côté, Messages.jsx ligne ~236). Un premier
      // essai de ce test (contre-vérifié) comparait au bord de la boîte de padding brute — il
      // échouait de très précisément 20px des deux côtés alors que l'alignement réel était
      // parfaitement flush au bord de la zone de contenu.
      const paddingLeft = parseFloat(cs.paddingLeft) || 0;
      const paddingRight = parseFloat(cs.paddingRight) || 0;
      return {
        rowRect,
        contentLeft: containerRect.x + paddingLeft,
        contentRight: containerRect.x + containerRect.width - paddingRight,
      };
    });
    const { rowRect: ownBox, contentLeft, contentRight } = measures;
    // Item 7 : "mine" doit être flush au bord DROIT de la zone de contenu réelle (tolérance 2px
    // pour l'arrondi sub-pixel) — avant correctif, `marginLeft:40` seul indentait le bloc depuis
    // la GAUCHE sans jamais atteindre le bord droit puisque le bloc remplissait toute la largeur
    // disponible (pas de shrink-to-fit sans `width` explicite).
    ok(
      `${width}px : message "mine" (${shortText}) hugs bien le bord DROIT de la zone de contenu`,
      Math.abs((ownBox.x + ownBox.width) - contentRight) <= 2,
      JSON.stringify({ ownBox, contentLeft, contentRight }),
    );
    // Preuve que ce n'est pas juste "toute la largeur, décalée" (l'ancien bug) : la bulle "mine"
    // ne remplit PAS toute la largeur de la zone de contenu — elle est dimensionnée à son contenu
    // réel (width: fit-content, plafonné à 86%).
    ok(
      `${width}px : message "mine" ne remplit PAS toute la largeur de la zone de contenu (fit-content, pas juste décalé)`,
      ownBox.width < (contentRight - contentLeft) - 2,
      JSON.stringify({ ownBox, contentLeft, contentRight }),
    );

    // Un message d'autrui (données de démonstration déjà présentes dans le fil du harnais)
    // reste bien collé au bord GAUCHE de la même zone de contenu, non affecté par ce correctif.
    const otherRow = page.locator('[id^="msg-row-"]').first();
    const otherBox = await otherRow.evaluate((el) => el.getBoundingClientRect());
    if ((await otherRow.getAttribute('id')) !== (await ownRow.getAttribute('id'))) {
      ok(
        `${width}px : un message d'autrui reste bien collé au bord GAUCHE de la zone de contenu`,
        Math.abs(otherBox.x - contentLeft) <= 2,
        JSON.stringify({ otherBox, contentLeft, contentRight }),
      );
    }
    await page.close();
  }

  // --- Item 8 : modale de suppression de message (remplace window.confirm) -------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="messages"]').click();
    await page.locator('h1', { hasText: 'Messages' }).waitFor();

    const text = `Message item8 ${Date.now()}`;
    const composer = page.locator('input[placeholder="Écrivez un message..."]');
    await composer.fill(text);
    await page.keyboard.press('Enter');
    const row = page.locator('[id^="msg-row-"]', { hasText: text }).last();
    await row.waitFor();

    // Zones tactiles ≥44px (item 8) — Modifier/Supprimer, avant correctif dictées par un simple
    // padding 2px sur un texte 10.5px (~25px réels).
    const modifyBtn = row.getByRole('button', { name: 'Modifier ce message' });
    const modifyBox = await modifyBtn.evaluate((el) => el.getBoundingClientRect());
    ok('Item 8a. Bouton "Modifier ce message" ≥44px de haut', modifyBox.height >= 44, JSON.stringify(modifyBox));
    const deleteBtn = row.getByRole('button', { name: 'Supprimer ce message' });
    const deleteBox = await deleteBtn.evaluate((el) => el.getBoundingClientRect());
    ok('Item 8b. Bouton "Supprimer ce message" ≥44px de haut', deleteBox.height >= 44, JSON.stringify(deleteBox));

    await deleteBtn.click();
    const dialog = page.getByRole('dialog', { name: 'Supprimer ce message ?' });
    await dialog.waitFor();
    ok('Item 8c. Vraie modale ABCZed affichée (plus window.confirm() natif)', await dialog.isVisible());
    ok('Item 8d. Le texte d\'avertissement exact est présent', await dialog.getByText('Cette action est définitive.').isVisible());

    // Ordre des boutons : l'option prudente ("Annuler") doit être PREMIÈRE dans le DOM (donc
    // premier élément focusable, focus initial donné par useModalA11y).
    const buttonOrder = await dialog.locator('button').evaluateAll((els) => els.map((el) => el.textContent.trim()));
    const cautiousIndex = buttonOrder.findIndex((t) => t === 'Annuler');
    const destructiveIndex = buttonOrder.findIndex((t) => t === 'Supprimer');
    ok('Item 8e. "Annuler" est listé AVANT "Supprimer" dans le DOM', cautiousIndex >= 0 && destructiveIndex >= 0 && cautiousIndex < destructiveIndex, JSON.stringify(buttonOrder));
    ok('Item 8f. Le focus initial est bien sur "Annuler" (option prudente)', await dialog.getByRole('button', { name: 'Annuler', exact: true }).evaluate((el) => document.activeElement === el));

    // Fermer prudemment (Annuler) : le message ne doit PAS être supprimé.
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    await page.waitForTimeout(150);
    ok('Item 8g. "Annuler" ferme la modale SANS rien supprimer', (await page.getByText(text, { exact: true }).count()) === 1);
    ok('Item 8h. Le focus revient sur le bouton "Supprimer ce message" d\'origine (déclencheur réel)', await deleteBtn.evaluate((el) => document.activeElement === el));

    // Cette fois, confirmation réelle.
    await deleteBtn.click();
    const dialog2 = page.getByRole('dialog', { name: 'Supprimer ce message ?' });
    await dialog2.waitFor();
    await dialog2.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await page.getByText(text, { exact: true }).waitFor({ state: 'detached' });
    ok('Item 8i. La confirmation explicite supprime réellement le message', (await page.getByText(text, { exact: true }).count()) === 0);

    ok('Item 8. Aucune erreur JavaScript', true);
    await page.close();
  }

  // --- Item 9 : clic sur la carte Partages entière — sans double navigation ------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    const newTabs = [];
    page.context().on('page', (p) => newTabs.push(p));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="partages"]').click();
    await page.locator('h1', { hasText: 'Partages' }).waitFor();

    // sh-autorisation (src/data.js) : type document, documentId réel (public/demo/), donc un
    // href réel — le cas où la carte entière doit devenir actionnable.
    const card = page.locator('div[role="button"]', { hasText: 'Autorisation sortie piscine' }).first();
    await card.waitFor();
    ok('Item 9a. La carte du partage porte bien role="button" (accessible, activable au clavier)', await card.getAttribute('role') === 'button');
    ok('Item 9b. ...et tabIndex=0', await card.getAttribute('tabindex') === '0');

    newTabs.length = 0;
    await card.click({ position: { x: 10, y: 10 } }); // clic sur le CORPS de la carte (titre), pas sur un bouton interne
    await page.waitForTimeout(400);
    ok('Item 9c. Cliquer le corps de la carte ouvre exactement UN nouvel onglet (la ressource)', newTabs.length === 1, `${newTabs.length} onglet(s)`);
    for (const t of newTabs) await t.close();

    // Cliquer spécifiquement sur "Ouvrir" (action interne, stoppe sa propre propagation) ne
    // doit PAS déclencher une SECONDE navigation en plus de la sienne.
    newTabs.length = 0;
    await card.getByRole('link', { name: 'Ouvrir' }).click();
    await page.waitForTimeout(400);
    ok('Item 9d. Cliquer "Ouvrir" (action interne) ouvre exactement UN onglet — pas de double navigation avec le clic de carte', newTabs.length === 1, `${newTabs.length} onglet(s)`);
    for (const t of newTabs) await t.close();

    // Le bouton "Voir l'événement : ..." (chip liée) doit rester une navigation INTERNE (pas
    // de nouvel onglet) et ne doit pas non plus déclencher l'action de carte en plus.
    newTabs.length = 0;
    const linkChip = card.locator('[id^="share-linkbtn-"]');
    if (await linkChip.count()) {
      await linkChip.click();
      await page.waitForTimeout(300);
      ok('Item 9e. Le chip "Voir l\'événement" navigue en interne (fiche événement), sans ouvrir de nouvel onglet en plus', newTabs.length === 0, `${newTabs.length} onglet(s)`);
    }

    ok('Item 9. Aucune erreur JavaScript', true);
    await page.close();
  }

  // --- Item 11 : création réelle d'un partage (Fichier/Photo/Lien), persistance après F5,
  //     libellé exact "Événement associé (facultatif)" / "Aucun événement" ------------------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="partages"]').click();
    await page.locator('h1', { hasText: 'Partages' }).waitFor();

    await page.getByRole('button', { name: /Ajouter un partage/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Ajouter un partage' });
    await sheet.waitFor();

    // Libellé exact demandé par le brief.
    const linkedLabel = sheet.locator('label[for="ass-linked-event"]');
    ok('Item 11a. Libellé exact "Événement associé (facultatif)"', (await linkedLabel.textContent()).trim() === 'Événement associé (facultatif)');
    const defaultOption = sheet.locator('#ass-linked-event option').first();
    ok('Item 11b. Option par défaut exacte "Aucun événement"', (await defaultOption.textContent()).trim() === 'Aucun événement');

    // Validation réelle : soumission vide -> erreur inline, pas juste un bouton désactivé.
    await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await sheet.locator('#ass-error-title').waitFor();
    ok('Item 11c. Erreur inline "Indique un titre." affichée (pas un simple bouton désactivé)', (await sheet.locator('#ass-error-title').textContent()).includes('titre'));
    ok('Item 11d. Le champ Titre porte aria-invalid="true"', await sheet.locator('#ass-title').getAttribute('aria-invalid') === 'true');
    ok('Item 11e. Le focus se déplace sur le champ Titre en erreur', await sheet.locator('#ass-title').evaluate((el) => document.activeElement === el));

    const uniqueTitle = `Fichier test V714 ${Date.now()}`;
    await sheet.locator('#ass-title').fill(uniqueTitle);

    // Type 'document' déjà sélectionné par défaut — soumission sans fichier -> erreur dédiée.
    await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await sheet.locator('#ass-error-file').waitFor();
    ok('Item 11f. Erreur inline "Choisis un fichier." affichée', (await sheet.locator('#ass-error-file').textContent()).includes('fichier'));

    // Fichier trop volumineux -> erreur claire AVANT même la soumission (au choix du fichier).
    await sheet.locator('#ass-file').setInputFiles(TOO_BIG_FILE);
    await sheet.locator('#ass-error-file').waitFor();
    ok('Item 11g. Fichier trop gros -> erreur explicite immédiate (pas un échec silencieux)', (await sheet.locator('#ass-error-file').textContent()).toLowerCase().includes('volumineux'));

    // Vrai fichier, sous la limite -> aperçu réel (nom + taille), plus d'erreur.
    await sheet.locator('#ass-file').setInputFiles(SMALL_FILE);
    await page.waitForTimeout(200);
    ok('Item 11h. Aperçu du fichier réel affiché (nom du fichier visible)', await sheet.getByText('petit-fichier.txt', { exact: false }).isVisible());

    // Lien vers un événement réel, avec le libellé exact.
    const events = await sheet.locator('#ass-linked-event option').allTextContents();
    if (events.length > 1) {
      await sheet.locator('#ass-linked-event').selectOption({ index: 1 });
    }

    await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    ok('Item 11i. La feuille se ferme après un ajout réussi', true);

    const newCard = page.locator('div[role="button"]', { hasText: uniqueTitle }).first();
    await newCard.waitFor();
    ok('Item 11j. Le nouveau partage apparaît IMMÉDIATEMENT dans la liste (setShares)', await newCard.isVisible());

    // --- Persistance réelle après un F5 complet (pas juste un changement d'écran client) ----
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Partages' }).waitFor();
    const afterReloadCard = page.locator('div[role="button"]', { hasText: uniqueTitle }).first();
    await afterReloadCard.waitFor();
    ok('Item 11k. Le partage ajouté survit à un rechargement complet (localStorage, abczed:shares:v1)', await afterReloadCard.isVisible());

    // La ressource réelle (persistée en `data:` URL, localStorage) reste ouvrable après ce
    // rechargement. Diagnostic (contre-vérifié empiriquement, pas seulement supposé) : Chromium
    // bloque silencieusement toute navigation de NOUVEL ONGLET directement vers une URL `data:`
    // initiée par le clic d'un lien — vrai AVANT et APRÈS rechargement, donc ce n'était pas un
    // bug de persistance. Correctif réel (src/attachmentOpen.js, partagé par ActionButton.jsx et
    // attachmentCardA11y.js) : conversion à la volée en URL `blob:` (même origine, jamais
    // soumise à ce blocage) avant l'ouverture — d'où l'assertion sur un préfixe `blob:` ici,
    // preuve que le contenu réel (la donnée persistée) est bien servi, pas juste une redirection.
    const newTabs2 = [];
    page.context().on('page', (p) => newTabs2.push(p));
    await afterReloadCard.getByRole('link', { name: 'Ouvrir' }).click();
    await page.waitForTimeout(400);
    ok('Item 11l. "Ouvrir" fonctionne réellement après rechargement (donnée persistée, ouverte via blob:)', newTabs2.length === 1 && newTabs2[0].url().startsWith('blob:'), newTabs2.map((t) => t.url()).join(','));
    for (const t of newTabs2) await t.close();

    // --- Type Photo : vraie miniature d'aperçu avant envoi -----------------------------------
    await page.getByRole('button', { name: /Ajouter un partage/ }).click();
    const sheetPhoto = page.getByRole('dialog', { name: 'Ajouter un partage' });
    await sheetPhoto.waitFor();
    await sheetPhoto.getByRole('button', { name: 'Photo', exact: true }).click();
    const photoTitle = `Photo test V714 ${Date.now()}`;
    await sheetPhoto.locator('#ass-title').fill(photoTitle);
    await sheetPhoto.locator('#ass-photo').setInputFiles(SMALL_PHOTO);
    await page.waitForTimeout(200);
    const previewImg = sheetPhoto.locator('img[alt="Aperçu de la photo choisie"]');
    ok('Item 11m. Miniature d\'aperçu réelle affichée pour la photo (remplace le texte "non disponible")', await previewImg.isVisible());
    ok('Item 11n. La miniature pointe bien vers une donnée réelle (data: URL)', (await previewImg.getAttribute('src')).startsWith('data:'));
    await sheetPhoto.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await sheetPhoto.waitFor({ state: 'detached' });
    ok('Item 11o. Le partage Photo est ajouté avec succès', await page.locator('div[role="button"]', { hasText: photoTitle }).first().isVisible());

    // --- Type Lien : validation réelle (pas seulement un bouton désactivé sans explication) --
    await page.getByRole('button', { name: /Ajouter un partage/ }).click();
    const sheetLink = page.getByRole('dialog', { name: 'Ajouter un partage' });
    await sheetLink.waitFor();
    await sheetLink.getByRole('button', { name: 'Lien', exact: true }).click();
    await sheetLink.locator('#ass-title').fill(`Lien test V714 ${Date.now()}`);
    await sheetLink.locator('#ass-link').fill('pas une url valide');
    await sheetLink.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await sheetLink.locator('#ass-error-link').waitFor();
    ok('Item 11p. URL invalide -> erreur inline claire ("Adresse invalide...")', (await sheetLink.locator('#ass-error-link').textContent()).toLowerCase().includes('invalide'));
    ok('Item 11q. Le champ Lien porte aria-invalid="true"', await sheetLink.locator('#ass-link').getAttribute('aria-invalid') === 'true');
    await sheetLink.locator('#ass-link').fill('https://exemple.fr/reglement.pdf');
    await sheetLink.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await sheetLink.waitFor({ state: 'detached' });
    ok('Item 11r. URL valide -> ajout réussi', true);

    // --- Type Information : ne nécessite ni fichier ni lien (déjà correct, confirmé) --------
    await page.getByRole('button', { name: /Ajouter un partage/ }).click();
    const sheetInfo = page.getByRole('dialog', { name: 'Ajouter un partage' });
    await sheetInfo.waitFor();
    await sheetInfo.getByRole('button', { name: 'Information', exact: true }).click();
    ok('Item 11s. Type Information : aucun champ fichier affiché', (await sheetInfo.locator('#ass-file').count()) === 0);
    ok('Item 11t. Type Information : aucun champ lien affiché', (await sheetInfo.locator('#ass-link').count()) === 0);
    await sheetInfo.locator('#ass-title').fill(`Info test V714 ${Date.now()}`);
    await sheetInfo.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await sheetInfo.waitFor({ state: 'detached' });
    ok('Item 11u. Ajout d\'une Information réussi sans fichier ni lien', true);

    ok('Item 11. Aucune erreur JavaScript', true);
    await page.close();
  }

  // --- Item 10 : La Bande — retour contextuel depuis une fiche parent (régression : le
  //     mécanisme était déjà câblé exactement comme Accueil->Partages avant cette phase ;
  //     ce scénario le prouve de bout en bout, y compris sur la liste NON filtrée). ----------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(8000);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();
    await page.locator('button[data-tab="labande"]').click();
    await page.locator('h1', { hasText: 'La Bande' }).waitFor();

    const query = 'marie';
    await page.locator('input[placeholder*="Chercher un parent"]').fill(query);
    const marieRow = page.locator('[id^="member-row-"]', { hasText: 'Marie' }).first();
    await marieRow.waitFor();
    const rowIdBefore = await marieRow.getAttribute('id');
    await page.evaluate(() => window.scrollTo(0, 40));
    await marieRow.click();
    await page.locator('h1', { hasText: /Marie/ }).waitFor().catch(() => {});
    // Retour (flèche/bouton retour de MemberDetail).
    await page.getByRole('button', { name: 'Retour' }).first().click();
    await page.locator('h1', { hasText: 'La Bande' }).waitFor();

    ok('Item 10a. La requête de recherche ("marie") est toujours dans le champ au retour', await page.locator('input[placeholder*="Chercher un parent"]').inputValue() === query);
    const restoredRow = page.locator(`#${rowIdBefore}`);
    // Item 10b : la vraie garantie de "position restaurée" est que la carte exacte est VISIBLE
    // sans défilement supplémentaire (useScrollRestore.js : `window.scrollTo(rawY)` PUIS
    // `el.scrollIntoView({block:'center'})`, qui corrige intentionnellement toute dérive — voir
    // son commentaire "corrige toute dérive ... garantit que l'élément précis est bien visible,
    // pas seulement à peu près à la bonne hauteur de page"). Un premier essai de ce test
    // (contre-vérifié) comparait `window.scrollY` brut avant/après avec une tolérance de 5px :
    // il échouait avec le jeu de données de démonstration (liste "marie" filtrée à une seule
    // carte, ou liste complète de 5 membres) — trop courte pour remplir un viewport de téléphone,
    // donc `scrollTo(0,40)` était lui-même plafonné à 16px avant même l'ouverture de la fiche, et
    // `scrollIntoView` recentre alors légitimement sur 0. Aucune régression ici : AUCUN scénario
    // des phases précédentes (recette.mjs, ex. lignes ~72/110/236) n'a jamais vérifié `scrollY`
    // brut pour ce mécanisme — seulement le repère visuel + la carte exacte, comme ci-dessous.
    const rowBox = await restoredRow.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    const viewportHeight = 844;
    ok(
      'Item 10b. La carte exacte est visible dans le viewport au retour (sans défilement supplémentaire)',
      rowBox.top >= 0 && rowBox.bottom <= viewportHeight,
      `top=${rowBox.top} bottom=${rowBox.bottom} viewport=${viewportHeight}`,
    );
    ok('Item 10c. La carte EXACTE ouverte est identifiable (id DOM stable member-row-<id>)', await restoredRow.count() === 1);
    ok('Item 10d. Le focus clavier revient sur cette carte précise', await restoredRow.evaluate((el) => document.activeElement === el));
    const hasHighlight = await restoredRow.evaluate((el) => el.classList.contains('nav-restore-highlight'));
    ok('Item 10e. Un repère visuel temporaire (.nav-restore-highlight) est appliqué à la carte', hasHighlight);
    // Durée totale visible : timeout JS 1800ms (useScrollRestore.js) + l'animation CSS
    // s'arrête à 1.8s aussi (navRestorePulse) — "environ deux secondes" du brief, vérifié en
    // laissant le temps s'écouler puis en confirmant la disparition.
    await page.waitForTimeout(2200);
    const highlightGone = await restoredRow.evaluate((el) => !el.classList.contains('nav-restore-highlight'));
    ok('Item 10f. Le repère visuel disparaît après ~2 secondes (pas indéfiniment)', highlightGone);

    ok('Item 10. Aucune erreur JavaScript', true);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\nV7.14 : ${pass} succès, ${fail} échec(s).`);
if (fail) {
  console.error(`Échecs : ${failures.join(', ')}`);
  process.exit(1);
}
