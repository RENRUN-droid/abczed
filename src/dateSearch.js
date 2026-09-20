// Interprétation tolérante d'une recherche de date dans Messages (delta §13) — reconnaît au
// minimum : "24 mai", "24/05", "24/05/2026", "24-05-2026", "aujourd'hui", "hier", et les
// abréviations usuelles de mois ("24 sept"). Module séparé et pur (aucune dépendance React)
// pour rester importable tel quel par scripts/test-date-search.mjs, comme searchUtils.js et
// agendaSearch.js le sont déjà par leurs propres tests.
import { normalize } from './searchUtils.js';
import { localIso } from './localDate.js';

const MONTHS = [
  { index: 1, names: ['janvier', 'janv'] },
  { index: 2, names: ['fevrier', 'fevr', 'fev'] }, // normalize() retire les accents : "février" -> "fevrier"
  { index: 3, names: ['mars'] },
  { index: 4, names: ['avril', 'avr'] },
  { index: 5, names: ['mai'] },
  { index: 6, names: ['juin'] },
  { index: 7, names: ['juillet', 'juil'] },
  { index: 8, names: ['aout'] },
  { index: 9, names: ['septembre', 'sept', 'sep'] },
  { index: 10, names: ['octobre', 'oct'] },
  { index: 11, names: ['novembre', 'nov'] },
  { index: 12, names: ['decembre', 'dec'] },
];

function monthIndexFromName(token) {
  const t = normalize(token);
  if (!t) return null;
  const found = MONTHS.find((m) => m.names.some((n) => t === n || t.startsWith(n)));
  return found ? found.index : null;
}

function isoToParts(iso) {
  const [y, mo, d] = iso.split('-').map(Number);
  return { day: d, month: mo, year: y };
}

// Essaie d'interpréter `query` comme une date. Retourne { day, month, year } (year vaut
// `null` si la requête ne précise pas d'année, ex. "24 mai" ou "24/05") ou `null` si la
// requête ne ressemble à aucune date reconnue.
//
// Volontairement strict sur la forme : un nombre nu comme "24" (sans séparateur ni nom de
// mois) ne matche AUCUN des motifs ci-dessous et retourne donc `null` — c'est l'exigence
// explicite du brief ("éviter les faux positifs grossiers pour des requêtes très courtes
// comme 24"). Il continue à fonctionner comme recherche texte large via anyFieldMatches,
// simplement pas comme date.
export function parseDateQuery(query, todayIso) {
  const q = normalize((query || '').trim());
  if (!q) return null;

  if (q === "aujourd'hui" || q === 'aujourdhui') {
    // Bug corrigé (contre-vérification indépendante, spécifique à La Réunion) : voir
    // ./localDate.js — .toISOString() renvoyait la date UTC, pas la date locale.
    return isoToParts(todayIso || localIso());
  }
  if (q === 'hier') {
    const ref = todayIso ? new Date(todayIso + 'T00:00:00') : new Date();
    ref.setDate(ref.getDate() - 1);
    return { day: ref.getDate(), month: ref.getMonth() + 1, year: ref.getFullYear() };
  }

  let m = q.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // 24/05/2026 ou 24-05-2026
  if (m) return { day: +m[1], month: +m[2], year: +m[3] };

  m = q.match(/^(\d{1,2})[/-](\d{1,2})$/); // 24/05 ou 24-05
  if (m) return { day: +m[1], month: +m[2], year: null };

  m = q.match(/^(\d{1,2})\s+([a-z]+)\.?\s*(\d{4})?$/); // 24 mai, 24 sept, 24 septembre 2026
  if (m) {
    const month = monthIndexFromName(m[2]);
    if (month) return { day: +m[1], month, year: m[3] ? +m[3] : null };
  }

  return null;
}

// Vrai si `messageDateIso` (YYYY-MM-DD) correspond à la date interprétée dans `query`.
// Jour + mois doivent toujours correspondre ; l'année n'est comparée que si la requête la
// précisait explicitement ("24 mai" doit retrouver un message de N'IMPORTE QUELLE année,
// mais "24/05/2026" doit rester exact si l'utilisateur précise l'année).
export function messageMatchesDateQuery(messageDateIso, query, todayIso) {
  if (!messageDateIso) return false;
  const parsed = parseDateQuery(query, todayIso);
  if (!parsed) return false;
  const [y, mo, d] = messageDateIso.split('-').map(Number);
  if (parsed.day !== d || parsed.month !== mo) return false;
  if (parsed.year != null && parsed.year !== y) return false;
  return true;
}
