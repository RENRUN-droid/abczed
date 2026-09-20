// Régression V7.1 — bug spécifique à La Réunion (UTC+4) trouvé par contre-vérification
// indépendante : `new Date().toISOString().slice(0, 10)` renvoie la date calendaire UTC, pas
// la date locale. Entre 00h00 et 03h59 heure de La Réunion, l'heure UTC correspondante est
// encore la VEILLE, donc l'ancien code renvoyait la mauvaise date (repro citée : 14/09/2026
// 00:30 +04 -> "2026-09-13" au lieu de "2026-09-14").
//
// Ce test reproduit RÉELLEMENT le fuseau de La Réunion (pas seulement la logique locale)
// en relançant un sous-processus Node avec TZ=Indian/Reunion — sans ça, un test qui construit
// juste `new Date(2026, 8, 14, 0, 30)` passerait même avec l'ancien code bugué si l'environnement
// d'exécution est déjà à un fuseau proche d'UTC, ce qui masquerait la régression.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label}`); }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const localDatePath = path.join(here, '..', 'src', 'localDate.js').replace(/\\/g, '/');

function localIsoInTZ(tz, isoInstant) {
  const script = `
    import { localIso } from 'file://${localDatePath}';
    console.log(localIso(new Date(${JSON.stringify(isoInstant)})));
  `;
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  }).trim();
}

// 1. Repro exacte du bug signalé : 13/09/2026 20:30 UTC = 14/09/2026 00:30 à La Réunion.
// L'ancien code (.toISOString().slice(0,10)) aurait renvoyé "2026-09-13" (faux) ; localIso
// doit renvoyer "2026-09-14" (la date réellement affichée sur l'horloge de l'utilisateur).
check(
  '1. La Réunion 00:30 locale (13/09 20:30 UTC) -> localIso renvoie bien 2026-09-14, pas 2026-09-13',
  localIsoInTZ('Indian/Reunion', '2026-09-13T20:30:00Z') === '2026-09-14',
);

// 2. Même instant UTC, lu en UTC -> doit bien rester 2026-09-13 (le test ne doit pas être
// trivialement toujours vrai quel que soit le calcul : il vérifie qu'on lit vraiment l'heure
// locale du fuseau demandé, pas une valeur figée).
check(
  '2. Le même instant lu en UTC reste 2026-09-13 (le test discrimine vraiment le fuseau)',
  localIsoInTZ('UTC', '2026-09-13T20:30:00Z') === '2026-09-13',
);

// 3. En pleine journée (pas dans la fenêtre 00h-04h), La Réunion et UTC tombent sur la même
// date -> pas de régression sur le cas non ambigu.
check(
  '3. En pleine journée, La Réunion et UTC donnent la même date (pas de régression)',
  localIsoInTZ('Indian/Reunion', '2026-09-14T12:00:00Z') === '2026-09-14',
);

// 4. Padding correct des mois/jours à un chiffre (ex. 3 janvier), indépendant du fuseau.
check(
  '4. Padding à deux chiffres pour mois/jour à un chiffre (3 janvier)',
  localIsoInTZ('Indian/Reunion', '2026-01-02T21:00:00Z') === '2026-01-03',
);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
if (fail > 0) process.exit(1);
