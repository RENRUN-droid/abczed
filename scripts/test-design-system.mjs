import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLUE, RED, BG, CATEGORIES, SECTION_THEMES, SHARE_TYPE_THEMES,
  MIN_TOUCH_TARGET, BUTTON_H, buttonStyle,
} from '../src/theme.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assert.equal(BLUE, '#0D47A1');
assert.equal(RED, '#E53935');
assert.equal(BG, '#FBF6EC');

assert.deepEqual(
  Object.fromEntries(Object.entries(CATEGORIES).map(([key, value]) => [key, value.color])),
  {
    anniversaire: '#F4B41A',
    sortie: '#169B68',
    ecole: '#5A2AA6',
    autre: '#7C838D',
  },
  'Les couleurs métier Agenda doivent rester canoniques.',
);

assert.equal(new Set(Object.values(SECTION_THEMES).map((theme) => theme.color)).size, 5, 'Chaque rubrique doit avoir un accent distinct.');
assert.equal(Object.keys(SHARE_TYPE_THEMES).length, 4, 'Les quatre types de Partages doivent être thémés.');

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/ig).map((pair) => parseInt(pair, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

for (const [key, category] of Object.entries(CATEGORIES)) {
  assert.ok(contrast(category.color, category.onColor) >= 4.5, `${key} doit rester lisible sur son aplat actif.`);
}

// V7.14 (point 6) : SECTION_THEMES a désormais un `onColor` par accent — nécessaire dès qu'un
// accent de rubrique sert de fond SOLIDE à un bouton (ActionButton, actions rapides de
// l'Accueil). Même seuil que pour les catégories Agenda : ≥4,5:1. Le rouge Messages
// (#E53935) échoue ce seuil avec du blanc (~4,23:1) — c'est précisément pourquoi son
// `onColor` doit être un texte quasi noir, pas blanc comme les 4 autres ; ce test l'affirme
// explicitement pour ne pas régresser silencieusement vers du blanc en cas de refactor futur.
for (const [key, theme] of Object.entries(SECTION_THEMES)) {
  assert.ok(
    typeof theme.onColor === 'string',
    `SECTION_THEMES.${key} doit avoir un onColor (utilisé par tout bouton en aplat de cette couleur).`,
  );
  assert.ok(
    contrast(theme.color, theme.onColor) >= 4.5,
    `SECTION_THEMES.${key} : onColor doit rester lisible (≥4.5:1) sur l'aplat solide ${theme.color}.`,
  );
}
assert.equal(
  SECTION_THEMES.messages.onColor.toLowerCase() !== '#ffffff', true,
  "Le rouge Messages échoue le contraste 4.5:1 avec du blanc — son onColor doit rester un texte sombre.",
);

// V7.14 : `buttonStyle()` est la fonction partagée derrière src/components/Button.jsx — les
// variantes 'primary' générées avec chaque couleur de SECTION_THEMES doivent, elles aussi,
// rester lisibles avec leur onColor (contrôle bout en bout de la fonction réellement utilisée
// par Accueil.jsx, pas seulement des tokens bruts).
for (const [key, theme] of Object.entries(SECTION_THEMES)) {
  const style = buttonStyle('primary', { color: theme.color, onColor: theme.onColor });
  assert.equal(style.background, theme.color);
  assert.equal(style.color, theme.onColor);
  assert.ok(contrast(style.background, style.color) >= 4.5, `buttonStyle('primary') pour ${key} doit rester lisible.`);
}

// Zones tactiles (brief V7.14 : ≥44px pour toute action importante).
assert.ok(MIN_TOUCH_TARGET >= 44, 'MIN_TOUCH_TARGET doit être au moins 44px.');
assert.ok(BUTTON_H >= MIN_TOUCH_TARGET, 'BUTTON_H (bouton principal) ne doit jamais descendre sous le plancher tactile.');
for (const variant of ['primary', 'secondary', 'destructive']) {
  assert.ok(buttonStyle(variant).minHeight >= MIN_TOUCH_TARGET, `buttonStyle('${variant}') doit garantir ≥44px par défaut.`);
  assert.ok(buttonStyle(variant, { compact: true }).minHeight >= MIN_TOUCH_TARGET, `buttonStyle('${variant}', {compact:true}) ne doit jamais descendre sous 44px.`);
}
assert.equal(buttonStyle('icon').width, MIN_TOUCH_TARGET, "buttonStyle('icon') doit être un carré ≥44px.");

// Composants partagés touchés par cette passe : contrôle statique (lecture du code source,
// pas une supposition) que la zone tactile déclarée est bien ≥44px là où le brief l'exige.
const srcRoot = path.resolve(__dirname, '..', 'src');
const actionButtonSrc = fs.readFileSync(path.join(srcRoot, 'components', 'ActionButton.jsx'), 'utf8');
assert.ok(
  /minHeight:\s*MIN_TOUCH_TARGET/.test(actionButtonSrc) && /MIN_TOUCH_TARGET/.test(actionButtonSrc),
  'ActionButton.jsx doit garantir MIN_TOUCH_TARGET (44px) de hauteur minimale — corrige la pastille "Ouvrir/Télécharger" trop petite de V7.13.',
);
assert.ok(
  actionButtonSrc.includes("background: BLUE, color: '#FFFFFF'"),
  "ActionButton.jsx (état actionnable) doit être en aplat solide BLUE, plus en teinte pâle (#EAF1FB) — correctif UAT point 6.",
);
const bottomNavSrc = fs.readFileSync(path.join(srcRoot, 'components', 'BottomNav.jsx'), 'utf8');
assert.ok(/minHeight:\s*64/.test(bottomNavSrc), 'BottomNav.jsx : chaque onglet doit garder une cible tactile ≥44px (64px déjà en place).');

// ---------------------------------------------------------------------------
// Logo (correctif UAT point 1) : géométrie vérifiée par calcul, pas à l'œil.
// ---------------------------------------------------------------------------
const logoSrc = fs.readFileSync(path.join(srcRoot, 'components', 'Logo.jsx'), 'utf8');

const circleMatch = logoSrc.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
assert.ok(circleMatch, 'Logo.jsx doit contenir le cercle central bleu.');
const [, cxStr, cyStr, rStr] = circleMatch;
const cx = Number(cxStr), cy = Number(cyStr), circleR = Number(rStr);
assert.equal(cx, cy, 'Le cercle central doit rester parfaitement centré (cx === cy) pour une répartition symétrique des rayons.');

const pathMatch = logoSrc.match(/<path\s+d="([^"]+)"[\s\S]*?stroke=\{RED\}\s+strokeWidth="([\d.]+)"/);
assert.ok(pathMatch, 'Logo.jsx doit contenir le tracé des rayons rouges.');
const [, dAttr, strokeWidthStr] = pathMatch;
const strokeWidth = Number(strokeWidthStr);

// Chaque rayon est un sous-tracé "Mx1 y1Lx2 y2" (extrémité proche du centre, puis extrémité
// éloignée) — on extrait les deux points de chaque sous-tracé, dans cet ordre.
const rayPoints = [...dAttr.matchAll(/M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)/g)].map((m) => ({
  x1: Number(m[1]), y1: Number(m[2]), x2: Number(m[3]), y2: Number(m[4]),
}));

assert.ok(rayPoints.length >= 6, `Le soleil doit avoir au moins 6 rayons répartis uniformément (trouvé ${rayPoints.length}) — pas 3 amassés comme en V7.13.`);

function dist(x, y) { return Math.hypot(x - cx, y - cy); }

const MIN_VISIBLE_GAP = 1.5; // unités de viewBox — jeu net entre le cercle et le début visible d'un rayon.
const rays = rayPoints.map(({ x1, y1, x2, y2 }) => {
  const dInner = dist(x1, y1);
  const dOuter = dist(x2, y2);
  // L'extrémité "proche" n'est pas forcément dInner < dOuter dans le tracé, on normalise.
  const inner = Math.min(dInner, dOuter);
  const outer = Math.max(dInner, dOuter);
  const outerPoint = dOuter >= dInner ? { x: x2, y: y2 } : { x: x1, y: y1 };
  const angleDeg = (Math.atan2(outerPoint.y - cy, outerPoint.x - cx) * 180) / Math.PI;
  return { inner, outer, angleDeg: (angleDeg + 360) % 360 };
});

for (const [i, ray] of rays.entries()) {
  assert.ok(
    ray.inner - circleR >= MIN_VISIBLE_GAP,
    `Rayon #${i} : jeu visible cercle↔rayon = ${(ray.inner - circleR).toFixed(2)} unités, doit être ≥ ${MIN_VISIBLE_GAP} ("nettement séparés du centre").`,
  );
  const maxExtent = ray.outer + strokeWidth / 2;
  assert.ok(
    maxExtent <= 20,
    `Rayon #${i} : extension max (${maxExtent.toFixed(2)}) doit rester dans le viewBox 40×40 (rayon max 20 depuis le centre).`,
  );
}

// Répartition angulaire strictement égale (soleil, pas un amas de rayons d'un seul côté).
const sortedAngles = rays.map((r) => r.angleDeg).sort((a, b) => a - b);
const gaps = sortedAngles.map((a, i) => {
  const next = sortedAngles[(i + 1) % sortedAngles.length];
  return ((next - a) + 360) % 360 || 360;
});
const expectedGap = 360 / rays.length;
for (const [i, gap] of gaps.entries()) {
  assert.ok(
    Math.abs(gap - expectedGap) < 0.5,
    `Écart angulaire #${i} = ${gap.toFixed(2)}°, attendu ${expectedGap}° (répartition parfaitement uniforme) — trouvé gaps=${JSON.stringify(gaps.map((g) => +g.toFixed(1)))}.`,
  );
}

console.log(`Design system : couleurs de marque, rubriques, catégories, contrastes, zones tactiles et géométrie du logo (${rays.length} rayons, jeu mini ${Math.min(...rays.map((r) => r.inner - circleR)).toFixed(2)}u, écart angulaire ${expectedGap}°) OK.`);
