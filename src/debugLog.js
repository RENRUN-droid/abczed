// V7.68 (3 oct.) — journal de diagnostic temporaire pour le bug "la feuille Partages se ferme
// toute seule au choix d'un fichier" (Samsung Galaxy S22 Ultra). Sans câble disponible pour
// brancher le téléphone à un ordinateur, impossible de lire la console du navigateur à
// distance — ce module enregistre à la place une trace texte, lisible et copiable directement
// sur le téléphone (voir DebugLogSheet.jsx), de chaque étape clé du choix de fichier.
//
// Persisté en `localStorage` (pas seulement en mémoire) : si le bug est en réalité Android qui
// tue l'appli en arrière-plan plutôt qu'un bug JS de ce composant, la page entière recharge et
// toute trace uniquement en mémoire serait perdue — `localStorage` survit à ce rechargement.
// Un marqueur `app_boot` est posé au chargement de ce module (donc à chaque vrai démarrage de
// l'appli) : si le journal contient un `app_boot` inattendu juste après l'ouverture du
// sélecteur de fichier, ça prouve qu'Android a rechargé l'appli entière entre-temps.
const STORAGE_KEY = 'abczed_debug_log_v1';
const MAX_ENTRIES = 100;

function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(entries) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Stockage indisponible (navigation privée, quota dépassé) — le journal reste simplement
    // vide au prochain accès ; jamais une erreur qui casserait le reste de l'appli.
  }
}

export function logDebug(tag, extra) {
  const entries = readAll();
  const now = new Date();
  entries.push({
    t: now.toLocaleTimeString('fr-FR', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0'),
    tag,
    extra: extra ?? null,
  });
  writeAll(entries);
}

export function getDebugLogText() {
  const entries = readAll();
  if (entries.length === 0) return 'Journal vide — aucune action enregistrée pour le moment.';
  return entries.map((e) => `${e.t}  ${e.tag}${e.extra ? '  ' + JSON.stringify(e.extra) : ''}`).join('\n');
}

export function clearDebugLog() {
  writeAll([]);
}

logDebug('app_boot', { path: typeof window !== 'undefined' ? window.location.pathname : null });
