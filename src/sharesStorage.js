// V7.14 (phase 3, item 11) — persistance locale des partages (Partages.jsx), pour que
// `shares` (App.jsx, jusqu'ici un simple `useState(MOCK_SHARES)`, perdu à chaque rechargement)
// survive à un F5 réel. Fonctions pures (testables en Node sans DOM, même principe que
// navMemory.js/sectionOrigin.js) : `storage` est injecté (jamais `window.localStorage` lu en
// dur ici), donc testable avec un faux stockage en mémoire.
//
// Gardé strictement local à la démo : ce module N'A AUCUNE OPINION sur
// `BUSINESS_DATA_FROM_SUPABASE` (le drapeau, importé et vérifié par l'APPELANT — App.jsx —
// avant tout appel à ce module, jamais ici) pour ne jamais persister silencieusement dans
// l'hypothèse future où ce drapeau passerait à `true` (les partages viendraient alors
// réellement de Supabase, et ce module ne doit plus jamais être appelé).
export const SHARES_STORAGE_KEY = 'abczed:shares:v1';

// Limite volontairement prudente pour un fichier importé en `data:` URL (base64, ~+33% de la
// taille réelle) et stocké dans localStorage — quota typique ~5 Mo PAR ORIGINE, partagé avec
// TOUT le reste de l'app (aucun autre module n'y écrit actuellement, mais mieux vaut rester
// loin de la limite que la heurter au premier essai). Documentée ET appliquée côté formulaire
// (AddShareSheet.jsx) avant même de tenter la lecture du fichier — jamais découverte après
// coup via une erreur `QuotaExceededError` sur un gros fichier.
export const MAX_LOCAL_FILE_BYTES = 1_500_000; // ~1,5 Mo

export function readSharesFromStorage(storage, fallback) {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(SHARES_STORAGE_KEY);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    // JSON corrompu, storage inaccessible (navigation privée, quota déjà dépassé côté
    // lecture...) — jamais bloquer l'affichage de la page pour cette seule raison : repli
    // silencieux sur `fallback` (les données de démonstration), comme une première visite.
    return fallback;
  }
}

// Renvoie { ok: true } ou { ok: false, error: <message utilisateur honnête> } — jamais une
// exception qui remonterait jusqu'à React sans état d'erreur affichable dans le formulaire.
export function writeSharesToStorage(storage, shares) {
  if (!storage) {
    return { ok: false, error: "Le stockage local de cet appareil n'est pas disponible." };
  }
  try {
    storage.setItem(SHARES_STORAGE_KEY, JSON.stringify(shares));
    return { ok: true };
  } catch (err) {
    // QuotaExceededError (Chrome/Firefox/Safari ont chacun leur propre `name`/`code`, pas de
    // détection fiable universelle) — traité de façon générique plutôt que de parier sur un
    // nom d'exception précis qui varie d'un navigateur à l'autre.
    return {
      ok: false,
      error: "Espace de stockage local insuffisant sur cet appareil — ce partage n'a pas pu être enregistré durablement. Essaie avec un fichier plus léger, ou supprime d'anciens partages.",
    };
  }
}

// Accès défensif à `window.localStorage` — peut lever une exception (navigation privée Safari
// iOS notamment) rien qu'en le LISANT, avant même `getItem`/`setItem`. Centralisé ici pour que
// App.jsx n'ait jamais à connaître ce détail de plateforme.
export function getBrowserStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
