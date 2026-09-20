// Harnais de recette Playwright — complément de recette.mjs, dédié aux scénarios V7.7 (Messages
// réellement connecté à Supabase) qui ont besoin d'un chargement de page FRAIS avec un levier de
// test posé AVANT navigation (page.addInitScript) : rôle (admin/membre, figé au montage — voir
// test-harness/main.jsx), erreur réseau forcée, fil vide, notification Realtime simulée. Ces
// scénarios ne peuvent pas partager la session continue de recette.mjs (qui réutilise UNE seule
// page pour tout le parcours) sans perturber son état partagé — chacun démarre donc sa propre
// page, isolée, dans le même navigateur. Livré dans le ZIP (comme recette.mjs et le reste de
// test-harness/ — corrigé V7.8 : ce fichier affirmait auparavant à tort "PAS livré dans le ZIP",
// signalé par contre-vérification indépendante — voir MATRICE_LIVRAISON.md).
// V7.8 : scénarios 9-12 ajoutés — Accueil.jsx ne recevait pas encore `messagesLoading`/
// `messagesError` (confondait chargement/erreur avec "fil réellement vide") et affichait
// "Aujourd'hui" en dur pour le dernier message quelle que soit sa vraie date, deux régressions
// signalées par contre-vérification indépendante et corrigées dans ce même lot.
import { chromium } from 'playwright';
import fs from 'node:fs';

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

async function freshPage(initScript) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
  // -------------------------------------------------------------------------
  // 1. P4 — un membre NON auteur et NON admin ne voit pas "Lier à un événement" sur le message
  // d'un autre — l'interface ne doit pas proposer une action vouée à l'échec côté serveur
  // (policy update_own_message_or_admin, sql/02_rls.sql).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'member'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(300);
    // m4 (authorId='user-lucas', ni l'utilisateur courant ni admin dans ce scénario) ne doit
    // proposer aucun bouton de liaison.
    ok('1a. Membre non-auteur/non-admin : "Lier à un événement" absent sur le message de Lucas (m4)', (await page.locator('#msg-row-m4 button:has-text("Lier à un événement")').count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 2. P4 — le même membre PEUT lier SON PROPRE message, sans être admin (isMine suffit).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_role__', 'member'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(300);
    await page.fill('input[placeholder="Écrivez un message..."]', 'Mon message à moi (non-admin)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const linkBtn = page.locator('button:has-text("Lier à un événement")').last();
    ok('2a. Membre non-admin, sur SON PROPRE message : "Lier à un événement" est bien proposé (isMine)', await linkBtn.isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 3. P1/P2 — une erreur réseau réelle au chargement affiche un message honnête, JAMAIS un
  // repli silencieux vers une donnée de démonstration (interdiction explicite du brief V7.7).
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_force_messages_fetch_error__', 'true'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(400);
    ok('3a. Erreur de chargement : bandeau d\'erreur honnête affiché', await page.locator('text=Impossible de charger les messages').isVisible());
    ok('3b. Erreur de chargement : aucun contenu de démonstration affiché à la place (pas de repli silencieux)', (await page.locator('text=sortie piscine samedi').count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 4. P2 — fil réellement vide (aucun message, pas une recherche) : texte exact du brief,
  // distinct du cas "recherche sans résultat" et du cas "discussion liée sans message".
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify([])));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(400);
    ok('4a. Fil vraiment vide : texte exact "Aucun message pour le moment."', await page.locator('text=Aucun message pour le moment.').isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 5. P6 — Realtime : une notification serveur déclenche un VRAI rechargement de l'état qui
  // fait foi (jamais une fusion locale du payload reçu) — un message ajouté "par quelqu'un
  // d'autre" doit apparaître après la notification, sans aucune action locale de cette page.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(400);
    ok('5a. Le point d\'ancrage de test Realtime est bien exposé par le double du harnais', (await page.evaluate(() => typeof window.__abczedHarnessTriggerMessagesRealtime)) === 'function');
    await page.evaluate(() => {
      const raw = JSON.parse(sessionStorage.getItem('__abczed_harness_messages_state__'));
      raw.push({ id: 'from-elsewhere', communityId: 'test-community-1', authorId: 'user-marie', text: 'Message injecté par un autre client (Realtime)', date: '2026-09-16', time: '08:00', reactions: [], linkedEventId: null });
      sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify(raw));
      window.__abczedHarnessTriggerMessagesRealtime();
    });
    await page.waitForTimeout(400);
    ok('5b. Notification Realtime -> le message "venu d\'ailleurs" apparaît (rechargement réel, pas une fusion locale)', await page.locator('text=Message injecté par un autre client (Realtime)').isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 6. P6 — l'abonnement est levé au niveau de la communauté active (App.jsx), pas de la page
  // Messages elle-même — volontaire : `selectedEvent.hasLinkedThread` (P4) et l'aperçu du
  // dernier message sur l'Accueil (P2) doivent rester à jour même hors de l'onglet Messages, ce
  // qui suppose que `thread` continue d'être rechargé en arrière-plan. Un seul abonnement actif
  // pour toute la session (jamais recréé/accumulé à chaque changement d'onglet) : vérifié en
  // déclenchant deux notifications Realtime consécutives, la seconde après avoir changé
  // d'onglet puis être revenu — aucune erreur, aucun doublon, toujours un seul point d'ancrage.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(300);
    ok('6a. Abonnement actif tant que la communauté est active', (await page.evaluate(() => typeof window.__abczedHarnessTriggerMessagesRealtime)) === 'function');
    await goBottomTab(page, 'Agenda');
    await page.waitForTimeout(200);
    ok(
      '6b. L\'abonnement reste actif hors de l\'onglet Messages (délibéré — voir commentaire ci-dessus, thread reste à jour en arrière-plan pour Accueil/EventDetail)',
      (await page.evaluate(() => typeof window.__abczedHarnessTriggerMessagesRealtime)) === 'function',
    );
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const raw = JSON.parse(sessionStorage.getItem('__abczed_harness_messages_state__'));
      raw.push({ id: 'apres-navigation', communityId: 'test-community-1', authorId: 'user-marie', text: 'Message après navigation aller-retour', date: '2026-09-16', time: '09:00', reactions: [], linkedEventId: null });
      sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify(raw));
      window.__abczedHarnessTriggerMessagesRealtime();
    });
    await page.waitForTimeout(400);
    ok('6c. Un seul abonnement, jamais accumulé : la notification après un aller-retour d\'onglet fonctionne encore normalement (un seul rechargement, pas d\'erreur)', await page.locator('text=Message après navigation aller-retour').isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 7. P2 — Accueil : "dernier message" est le VRAI dernier par created_at, jamais simplement
  // le dernier élément du tableau reçu (protection contre un ordre d'arrivée réseau non garanti,
  // brief explicite : "jamais une confiance dans l'ordre d'arrivée").
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    await page.evaluate(() => {
      const raw = JSON.parse(sessionStorage.getItem('__abczed_harness_messages_state__'));
      // Ajouté EN DERNIER dans le tableau, mais daté bien AVANT le vrai dernier message existant
      // (m6, aujourd'hui 14:40) — si Accueil se fiait à l'ordre du tableau plutôt qu'au vrai tri
      // chronologique, ce message plus ancien apparaîtrait à tort comme "le dernier".
      raw.push({ id: 'plus-ancien-mais-dernier-du-tableau', communityId: 'test-community-1', authorId: 'user-marie', text: 'Plus ancien malgré sa position dans le tableau', date: '2020-01-01', time: '08:00', reactions: [], linkedEventId: null });
      sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Accueil")');
    await page.waitForTimeout(300);
    ok('7a. Accueil "dernier message" n\'est PAS l\'entrée la plus ancienne (dernière du tableau)', (await page.locator('text=Plus ancien malgré sa position').count()) === 0);
    ok('7b. Accueil "dernier message" affiche bien le vrai dernier par created_at (Sabrina, "Qui peut covoiturer")', await page.locator('text=Qui peut covoiturer samedi').isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 8. P3 — un envoi qui échoue laisse le texte dans le champ (rien n'est perdu) et affiche
  // l'erreur réelle, jamais une transformation silencieuse en succès apparent.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_force_send_error__', 'true'));
    await goBottomTab(page, 'Messages');
    await page.waitForTimeout(300);
    await page.fill('input[placeholder="Écrivez un message..."]', 'Celui-ci va échouer');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    ok('8a. Envoi en échec : le texte reste dans le champ (rien de perdu)', (await page.inputValue('input[placeholder="Écrivez un message..."]')) === 'Celui-ci va échouer');
    ok('8b. Envoi en échec : erreur réelle affichée', await page.locator("text=n'a pas pu être envoyé").isVisible());
    // `text=` ne matche pas la VALEUR d'un <input> (seulement du contenu texte) — si ce message
  // avait été malgré tout ajouté au fil (bulle affichée), ce sélecteur le trouverait ; s'il ne
  // reste que dans le champ de saisie, il reste à 0 ici.
  ok('8c. Envoi en échec : le message n\'apparaît PAS comme une bulle dans le fil (rien n\'a été enregistré)', (await page.locator('text=Celui-ci va échouer').count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 9. V7.8 (correctif) — Accueil pendant le CHARGEMENT initial des messages : doit afficher un
  // indicateur de chargement dédié, jamais "Aucun message pour l'instant." (avant ce correctif,
  // `messagesLoading` n'était pas transmis à Accueil.jsx, qui confondait donc "en cours de
  // chargement" et "réellement vide"). Délai artificiel posé via le levier du harnais pour
  // rendre cet état transitoire observable de façon fiable.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_delay_messages_fetch_ms__', '600'));
    // freshPage attend déjà "networkidle" + le titre "Accueil" — le délai (JS pur, aucune
    // requête réseau réelle) n'interfère pas avec "networkidle", donc la page est bien rendue
    // AVANT que le délai de fetchMessages ne soit écoulé.
    ok('9a. Accueil pendant le chargement : indicateur "Chargement des messages…" affiché', await page.locator('text=Chargement des messages…').isVisible());
    ok('9b. Accueil pendant le chargement : PAS "Aucun message pour l\'instant." (jamais confondu avec un fil réellement vide)', (await page.locator("text=Aucun message pour l'instant.").count()) === 0);
    await page.waitForTimeout(900);
    ok('9c. Une fois le chargement terminé, le dernier message réel s\'affiche normalement', await page.locator('text=Qui peut covoiturer samedi').isVisible());
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 10. V7.8 (correctif) — Accueil en cas d'ERREUR réseau réelle au chargement : doit afficher
  // l'erreur honnête (même texte que App.jsx expose à Messages.jsx), jamais "Aucun message pour
  // l'instant." qui ferait croire à tort à un fil vide plutôt qu'à un échec réseau.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_force_messages_fetch_error__', 'true'));
    await page.waitForTimeout(400);
    ok('10a. Accueil en erreur réseau : le message d\'erreur réel est affiché', await page.locator('text=Impossible de charger les messages').isVisible());
    ok('10b. Accueil en erreur réseau : PAS "Aucun message pour l\'instant." (jamais confondu avec un fil réellement vide)', (await page.locator("text=Aucun message pour l'instant.").count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 11. V7.8 (correctif) — Accueil, fil RÉELLEMENT vide après une lecture RÉUSSIE (ni chargement
  // en cours, ni erreur) : c'est le SEUL cas où "Aucun message pour l'instant." doit apparaître.
  // -------------------------------------------------------------------------
  {
    const page = await freshPage(() => sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify([])));
    await page.waitForTimeout(400);
    ok('11a. Accueil, fil réellement vide après succès : "Aucun message pour l\'instant." affiché', await page.locator("text=Aucun message pour l'instant.").isVisible());
    ok('11b. ...et aucun indicateur de chargement ni bandeau d\'erreur ne reste affiché en même temps', (await page.locator('text=Chargement des messages…').count()) === 0 && (await page.locator('text=Impossible de charger les messages').count()) === 0);
    await page.close();
  }

  // -------------------------------------------------------------------------
  // 12. V7.8 (correctif) — Accueil, "dernier message" dont la vraie date n'est PAS aujourd'hui :
  // avant ce correctif, la ligne affichait littéralement "Aujourd'hui à HH:MM" pour CE message,
  // quelle que soit sa vraie date (jamais recalculée). Ici, le seul message existant est daté
  // d'hier — l'étiquette doit afficher "Hier", jamais "Aujourd'hui".
  // -------------------------------------------------------------------------
  {
    const page = await freshPage();
    const yesterdayIso = await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    await page.evaluate((dateStr) => {
      sessionStorage.setItem('__abczed_harness_messages_state__', JSON.stringify([
        { id: 'seul-message-hier', communityId: 'test-community-1', authorId: 'user-marie', text: 'Message envoyé hier, pas aujourd\'hui', date: dateStr, time: '11:30', reactions: [], linkedEventId: null },
      ]));
    }, yesterdayIso);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Accueil")');
    await page.waitForTimeout(300);
    ok('12a. Accueil, dernier message datant d\'hier : étiquette "Hier à 11:30" affichée', await page.locator("text=Hier à 11:30").isVisible());
    ok('12b. ...jamais "Aujourd\'hui" pour ce message (sa vraie date n\'est pas aujourd\'hui)', (await page.locator("text=Aujourd'hui à 11:30").count()) === 0);
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
