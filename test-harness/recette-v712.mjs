// V7.12 — recette ciblée du lot Accueil / Messages / Anniversaires.
// Lancer le serveur avec : npx vite --config vite.harness.config.js
// Puis : node test-harness/recette-v712.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:5183/';
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = { headless: true };
if (fs.existsSync(SANDBOX_CHROMIUM)) launchOptions.executablePath = SANDBOX_CHROMIUM;

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, condition) {
  if (condition) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label}`); fail++; failures.push(label); }
}

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(5000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function tab(name) {
  await page.getByRole('button', { name, exact: true }).click();
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("Accueil")');

  await page.click('#home-create-event');
  ok('1. Accueil : « Créer un événement » ouvre le formulaire existant', await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');

  await page.click('#home-write-message');
  const composer = page.locator('input[placeholder="Écrivez un message..."]');
  ok('2a. Accueil : « Écrire un message » ouvre Messages', await page.locator('h1:has-text("Messages")').isVisible());
  ok('2b. Le compositeur reçoit immédiatement le focus', await composer.evaluate((el) => document.activeElement === el));

  const initialText = `Message V7.12 ${Date.now()}`;
  const editedText = `${initialText} modifié`;
  await composer.fill(initialText);
  await page.keyboard.press('Enter');
  const ownRow = page.locator('[id^="msg-row-"]', { hasText: initialText }).last();
  await ownRow.waitFor();
  await ownRow.getByRole('button', { name: 'Modifier ce message' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Modifier le message' });
  await editDialog.locator('textarea').fill(editedText);
  await editDialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.locator('[id^="msg-row-"]', { hasText: editedText }).waitFor();
  ok('3a. Message personnel modifié dans le fil', await page.getByText(editedText, { exact: true }).isVisible());
  await page.reload({ waitUntil: 'networkidle' });
  ok('3b. Modification du message persistante après F5', await page.getByText(editedText, { exact: true }).isVisible());

  // V7.14 (phase 3, item 8) : window.confirm() natif remplacé par une vraie modale ABCZed
  // (ConfirmDialog.jsx) — plus de `page.once('dialog', ...)` (qui n'intercepterait plus rien),
  // on clique désormais le bouton "Supprimer" DANS la boîte de dialogue elle-même.
  const editedRow = page.locator('[id^="msg-row-"]', { hasText: editedText }).last();
  await editedRow.getByRole('button', { name: 'Supprimer ce message' }).click();
  const deleteMsgDialog = page.getByRole('dialog', { name: 'Supprimer ce message ?' });
  await deleteMsgDialog.waitFor();
  await deleteMsgDialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByText(editedText, { exact: true }).waitFor({ state: 'detached' });
  ok('4a. Message supprimé après confirmation', (await page.getByText(editedText, { exact: true }).count()) === 0);
  await page.reload({ waitUntil: 'networkidle' });
  ok('4b. Suppression du message persistante après F5', (await page.getByText(editedText, { exact: true }).count()) === 0);

  await tab('Agenda');
  await page.getByRole('button', { name: 'Anniversaires', exact: true }).click();
  // V7.14 point 12 : "Ajouter un anniversaire" ouvre désormais le formulaire unifié
  // (CreateEventSheet, catégorie "Anniversaire" préremplie) — aria-label générique statique,
  // champs Prénom/Jour identifiés par leur <label> réel (plus de placeholder), et deux <select>
  // dans la boîte de dialogue (catégorie + mois) donc on cible le mois explicitement.
  await page.getByRole('button', { name: 'Ajouter un anniversaire', exact: true }).click();
  const birthdayDialog = page.getByRole('dialog', { name: 'Ajouter un événement' });
  await birthdayDialog.getByLabel('Prénom').fill('Recette V712');
  await birthdayDialog.getByLabel('Jour').fill('18');
  await birthdayDialog.getByLabel('Mois').selectOption('9');
  await birthdayDialog.getByRole('button', { name: 'Ajouter l’anniversaire' }).click();
  const birthdayRow = page.locator('[id^="agenda-row-"]', { hasText: 'Anniversaire de Recette V712' }).first();
  await birthdayRow.waitFor();
  await birthdayRow.click();
  const birthdayEdit = page.getByRole('dialog', { name: 'Anniversaire' });
  await birthdayEdit.locator('input[placeholder="Prénom"]').fill('Recette V712 corrigée');
  await birthdayEdit.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  const corrected = page.locator('[id^="agenda-row-"]', { hasText: 'Anniversaire de Recette V712 corrigée' }).first();
  await corrected.waitFor();
  ok('5a. Anniversaire modifié depuis sa ligne Agenda', await corrected.isVisible());
  await corrected.click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('dialog', { name: 'Anniversaire' }).getByRole('button', { name: 'Supprimer l’anniversaire' }).click();
  await corrected.waitFor({ state: 'detached' });
  ok('5b. Anniversaire supprimé après confirmation', (await corrected.count()) === 0);
  await page.reload({ waitUntil: 'networkidle' });
  ok('5c. Suppression de l’anniversaire persistante après F5', (await page.getByText('Anniversaire de Recette V712 corrigée', { exact: true }).count()) === 0);
  ok('6. Aucune erreur JavaScript pendant le parcours', errors.length === 0);
} finally {
  await browser.close();
}

console.log(`\nV7.12 : ${pass} succès, ${fail} échec(s).`);
if (fail) {
  console.error(`Échecs : ${failures.join(', ')}`);
  process.exit(1);
}
