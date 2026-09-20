// V7.15 — correctif ciblé : identification des participants au survol/tap sur une pastille
// avatar (fiche détail d'un événement, modes "accompagnement"/"simple" — src/pages/EventDetail.jsx).
// Signalé lors d'une recette réelle sur poste utilisateur, post-V7.14 : l'attribut `title` HTML
// natif utilisé jusqu'ici pour le survol desktop met ~1s à apparaître et disparaît dès que la
// souris bouge, ce qui le rend facile à manquer pendant un usage normal. `hoveredId` (état React)
// déclenche désormais le même bandeau de révélation que le tap tactile (`revealedId`), sans ce
// délai — voir le commentaire en tête de EventDetail.jsx pour le détail de l'implémentation.
// Lancer le serveur avec : npx vite --config vite.harness.config.js --host 127.0.0.1
// Puis : node test-harness/recette-v715.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5183/';
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = { headless: true };
if (fs.existsSync(SANDBOX_CHROMIUM)) launchOptions.executablePath = SANDBOX_CHROMIUM;

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, condition, detail = '') {
  if (condition) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`); fail++; failures.push(label); }
}

const browser = await chromium.launch(launchOptions);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // evt-piscine (src/data.js) : sortie catégorisée "sortie_ecole" -> mode "accompaniment",
  // participants au format chaîne simple (données de démonstration) — cible représentative de
  // la liste de pastilles concernée par ce correctif.
  await page.goto(BASE + 'evenement/evt-piscine?from=agenda');
  await page.waitForSelector('text=Sortie piscine', { timeout: 10000 });

  const firstAvatar = page.locator('button[aria-label="Sophie"]').first();
  await firstAvatar.hover();
  await page.waitForTimeout(50); // marge courte : si le nom n'est pas là après 50ms, ce n'est pas "quasi immédiat"
  ok(
    '1a. Survol desktop révèle le nom quasi immédiatement (sans dépendre du délai du title natif)',
    (await page.locator('text=Sophie').count()) >= 1,
  );

  await page.mouse.move(5, 5);
  await page.waitForTimeout(50);
  ok(
    '1b. Le nom révélé disparaît quand la souris quitte la pastille',
    !(await page.evaluate(() => document.body.innerText.includes('Sophie'))),
  );

  // Tap tactile (mobile, jamais de mouseenter/mouseleave associés) sur une AUTRE pastille :
  // `dispatchEvent('click')` reproduit ça fidèlement — contrairement à `.click()` de Playwright,
  // qui simule aussi un survol souris réel et fausserait ce scénario (le hoveredId resterait
  // actif après le clic, masquant le comportement propre au tap qu'on veut isoler ici).
  const secondAvatar = page.locator('button[aria-label="Thomas"]').first();
  await secondAvatar.dispatchEvent('click');
  await page.waitForTimeout(50);
  ok('1c. Tap tactile révèle le nom (comportement indépendant du survol)', (await page.locator('text=Thomas').count()) >= 1);

  // Un second tap sur la MÊME pastille referme la révélation (bascule, pas un état qui s'empile).
  await secondAvatar.dispatchEvent('click');
  await page.waitForTimeout(50);
  ok('1d. Un second tap sur la même pastille referme la révélation', !(await page.evaluate(() => document.body.innerText.includes('Thomas'))));

  ok('1e. Aucune erreur JavaScript pendant le scénario', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
}

console.log(`\nV7.15 : ${pass} succès, ${fail} échec(s).`);
if (fail > 0) {
  console.log('Échecs :', failures.join(', '));
  process.exit(1);
}
