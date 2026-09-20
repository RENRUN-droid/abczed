// Prénoms volontaires des adultes/enfants d'un foyer inscrit à une sortie "entre familles"
// (mode RSVP 'family') — brief (recette réelle sur PC, point 2) : "Test A1 — 2 adultes ·
// 1 enfant" n'identifie personne ; il faut permettre à l'utilisateur de saisir lui-même les
// prénoms, JAMAIS les déduire automatiquement depuis La Bande (le RSVP n'enregistre que des
// quantités, La Bande ne sait pas qui a été inscrit à quelle sortie). Fonctions pures,
// utilisées par EventDetail.jsx (UI) et testées directement par
// scripts/test-attendee-names.mjs, comme les autres modules de logique du projet.

// Redimensionne un tableau de noms à `length` : tronque l'excédent, complète par des chaînes
// vides — jamais par un nom inventé ou déduit. Appelé quand un stepper adultes/enfants change,
// pour garder exactement un champ de saisie par personne indiquée dans le décompte.
export function resizeNames(names, length) {
  const next = names.slice(0, length);
  while (next.length < length) next.push('');
  return next;
}

// Nettoie les noms avant envoi/stockage : trim, retire les entrées vides — une case laissée
// vide par l'utilisateur (saisie facultative) ne doit jamais être stockée comme chaîne vide.
export function cleanNames(names) {
  return names.map((n) => n.trim()).filter(Boolean);
}

// Construit le payload attendeeNames à partir des brouillons adultes/enfants — `null` (pas un
// objet aux tableaux vides) quand rien n'a été saisi, pour distinguer sans ambiguïté "aucun
// prénom donné" d'un éventuel futur "0 adulte nommé explicitement" si le modèle évolue, et pour
// que agendaApi.js puisse omettre la colonne entièrement quand elle est vide (voir son
// commentaire sur la détection de la migration 05 non appliquée).
export function buildAttendeeNames(draftAdultNames, draftChildNames) {
  const adults = cleanNames(draftAdultNames);
  const children = cleanNames(draftChildNames);
  if (adults.length === 0 && children.length === 0) return null;
  return { adults, children };
}

// Ligne d'affichage compacte pour la liste "Qui vient ?" — chaîne vide (donc rien affiché) si
// aucun prénom n'a été renseigné, jamais un texte de repli inventé.
export function attendeeNamesLine(attendeeNames) {
  if (!attendeeNames) return '';
  const all = [...(attendeeNames.adults || []), ...(attendeeNames.children || [])];
  return all.join(', ');
}
