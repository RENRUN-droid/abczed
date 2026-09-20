// V7.13 — contrôle responsive, identité visuelle, code couleur et zones tactiles.
// Lancer le serveur avec : npx vite --config vite.harness.config.js --host 127.0.0.1
// Puis : node test-harness/recette-v713.mjs
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

const expectedActiveColors = {
  accueil: 'rgb(13, 71, 161)',
  agenda: 'rgb(153, 88, 0)',
  messages: 'rgb(229, 57, 53)',
  partages: 'rgb(8, 126, 139)',
  labande: 'rgb(109, 69, 150)',
};

const browser = await chromium.launch(launchOptions);
try {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 768, height: 1024 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(5000);
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('h1', { hasText: 'Accueil' }).waitFor();

    const fontFamily = await page.locator('#root > div').first().evaluate((el) => getComputedStyle(el).fontFamily);
    ok(`${viewport.width}px : Nunito Sans est la police active`, fontFamily.includes('Nunito Sans'), fontFamily);

    const logo = page.locator('[role="img"][aria-label="ABCZed"]');
    ok(`${viewport.width}px : nouveau symbole solaire et mot-symbole visibles`, await logo.isVisible() && await logo.locator('svg').count() === 1);

    const navBoxes = await page.locator('button[data-tab]').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    ok(`${viewport.width}px : navigation principale tactile ≥ 44 px`, navBoxes.length === 5 && navBoxes.every((height) => height >= 44), JSON.stringify(navBoxes));

    for (const [tab, expectedColor] of Object.entries(expectedActiveColors)) {
      const button = page.locator(`button[data-tab="${tab}"]`);
      await button.click();
      const activeColor = await button.evaluate((el) => getComputedStyle(el).color);
      ok(`${viewport.width}px : accent cohérent pour ${tab}`, activeColor === expectedColor, activeColor);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(`${viewport.width}px : ${tab} sans débordement horizontal`, overflow <= 1, `${overflow}px`);
    }

    await page.locator('button[data-tab="agenda"]').click();
    const arrowBoxes = await page.locator('button[aria-label="Mois précédent"], button[aria-label="Mois suivant"]').evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return [box.width, box.height];
    }));
    ok(`${viewport.width}px : flèches du calendrier ≥ 44 × 44 px`, arrowBoxes.length === 2 && arrowBoxes.every(([width, height]) => width >= 44 && height >= 44), JSON.stringify(arrowBoxes));

    const dayBoxes = await page.locator('.calendar-day').evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return [box.width, box.height];
    }));
    ok(`${viewport.width}px : jours du calendrier tactiles ≥ 44 × 44 px`, dayBoxes.length >= 28 && dayBoxes.every(([width, height]) => width >= 44 && height >= 44), JSON.stringify(dayBoxes.slice(0, 3)));

    const visibleDots = page.locator('.day-dots [data-category]');
    if (await visibleDots.count()) {
      const colors = await visibleDots.evaluateAll((dots) => Object.fromEntries(dots.map((dot) => [dot.dataset.category, getComputedStyle(dot).backgroundColor])));
      const canonical = {
        anniversaire: 'rgb(244, 180, 26)',
        sortie: 'rgb(22, 155, 104)',
        ecole: 'rgb(90, 42, 166)',
        autre: 'rgb(124, 131, 141)',
      };
      ok(`${viewport.width}px : pastilles Agenda conformes aux catégories`, Object.entries(colors).every(([category, color]) => canonical[category] === color), JSON.stringify(colors));
    }

    await page.getByRole('button', { name: 'Anniversaires', exact: true }).click();
    const birthdayChip = page.getByRole('button', { name: 'Anniversaires', exact: true });
    const birthdayChipStyles = await birthdayChip.evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    ok(`${viewport.width}px : jaune anniversaire lisible sur texte sombre`, birthdayChipStyles.background === 'rgb(244, 180, 26)' && birthdayChipStyles.color === 'rgb(74, 50, 0)', JSON.stringify(birthdayChipStyles));
    // V7.14 point 12 : "Ajouter un anniversaire" ouvre désormais le formulaire unifié
    // (CreateEventSheet, catégorie "Anniversaire" préremplie) dont l'aria-label est le libellé
    // générique statique "Ajouter un événement" (plus de boîte de dialogue dédiée séparée).
    await page.getByRole('button', { name: 'Ajouter un anniversaire', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter un événement' });
    const closeBox = await dialog.getByRole('button', { name: 'Fermer' }).evaluate((el) => {
      const box = el.getBoundingClientRect(); return [box.width, box.height];
    });
    const fieldHeights = await dialog.locator('input, select').evaluateAll((fields) => fields.map((field) => field.getBoundingClientRect().height));
    ok(`${viewport.width}px : fermeture de modale ≥ 44 × 44 px`, closeBox[0] >= 44 && closeBox[1] >= 44, JSON.stringify(closeBox));
    ok(`${viewport.width}px : champs de modale ≥ 44 px`, fieldHeights.every((height) => height >= 44), JSON.stringify(fieldHeights));
    await page.keyboard.press('Escape');

    if (viewport.width === 360) await page.screenshot({ path: path.join(screenshotsDir, 'agenda-360.png'), fullPage: true });
    if (viewport.width === 390) {
      await page.locator('button[data-tab="accueil"]').click();
      await page.screenshot({ path: path.join(screenshotsDir, 'accueil-390.png'), fullPage: true });
      await page.locator('button[data-tab="partages"]').click();
      await page.screenshot({ path: path.join(screenshotsDir, 'partages-390.png'), fullPage: true });
    }

    ok(`${viewport.width}px : aucune erreur JavaScript`, runtimeErrors.length === 0, runtimeErrors.join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\nV7.13 : ${pass} succès, ${fail} échec(s).`);
if (fail) {
  console.error(`Échecs : ${failures.join(', ')}`);
  process.exit(1);
}
