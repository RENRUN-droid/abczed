// V7.77 (19 nov.) — liens cliquables partout où un texte libre est affiché.
//
// Demande : un lien collé dans une description de partage (photo, fichier…), dans les
// "Détails" d'un événement de l'Agenda, dans un message ou dans le p'tit billet doit être
// cliquable, pas seulement dans un partage de type "Lien".
//
// Fonction PURE (testable sans React, voir scripts/test-linkify.mjs) : découpe un texte en
// segments `{ type: 'text', value }` / `{ type: 'link', value, href }`.
//
// Règles :
// - reconnaît `http://…`, `https://…` et `www.…` (ce dernier reçoit `https://` devant) ;
// - la ponctuation finale collée au lien (point, virgule, `)` non ouverte dans le lien,
//   guillemets, `»`…) reste du TEXTE — "voir https://ecole.fr." ouvre bien https://ecole.fr ;
// - sécurité : seul un href http(s) validé par isValidAbsoluteUrl est rendu cliquable —
//   jamais `javascript:`/`data:` (même garde-fou que le champ "Lien" d'AddShareSheet).
import { isValidAbsoluteUrl } from './urlValidation.js';

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCT = /[.,;:!?'"»”’…]$/;

function trimTrailing(candidate) {
  let url = candidate;
  for (;;) {
    if (TRAILING_PUNCT.test(url)) { url = url.slice(0, -1); continue; }
    if (url.endsWith(')')) {
      const opens = (url.match(/\(/g) || []).length;
      const closes = (url.match(/\)/g) || []).length;
      if (closes > opens) { url = url.slice(0, -1); continue; }
    }
    return url;
  }
}

export function linkifySegments(text) {
  const source = typeof text === 'string' ? text : '';
  const segments = [];
  let cursor = 0;
  URL_PATTERN.lastIndex = 0;
  let match;
  while ((match = URL_PATTERN.exec(source)) !== null) {
    const raw = trimTrailing(match[0]);
    const start = match.index;
    const end = start + raw.length;
    const href = /^www\./i.test(raw) ? `https://${raw}` : raw;
    // "www." seul, ou URL mal formée : on laisse en texte.
    if (raw.length <= 4 || !isValidAbsoluteUrl(href) || !new URL(href).hostname.includes('.')) {
      continue;
    }
    if (start > cursor) segments.push({ type: 'text', value: source.slice(cursor, start) });
    segments.push({ type: 'link', value: raw, href });
    cursor = end;
    URL_PATTERN.lastIndex = end;
  }
  if (cursor < source.length) segments.push({ type: 'text', value: source.slice(cursor) });
  return segments;
}
