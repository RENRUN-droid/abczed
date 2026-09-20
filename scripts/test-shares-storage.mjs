// V7.14 (phase 3, item 11) — persistance locale des partages : lit/écrit directement les
// fonctions pures de production (src/sharesStorage.js), pas une réimplémentation locale.
import { readSharesFromStorage, writeSharesToStorage, SHARES_STORAGE_KEY, MAX_LOCAL_FILE_BYTES } from '../src/sharesStorage.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${e}, obtenu ${a}`); fail++; }
}

// Faux localStorage en mémoire — même contrat (getItem/setItem), pour tester sans DOM.
function fakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    _store: store,
  };
}

// 1. Aucun storage (null) -> repli sur fallback, jamais d'exception.
check('1. storage=null -> fallback', readSharesFromStorage(null, ['fallback']), ['fallback']);

// 2. Storage vide (première visite) -> repli sur fallback.
check('2. Rien encore écrit -> fallback', readSharesFromStorage(fakeStorage(), ['fallback']), ['fallback']);

// 3. Écriture puis lecture -> round-trip exact.
{
  const storage = fakeStorage();
  const shares = [{ id: 'sh-1', title: 'Un partage' }];
  const result = writeSharesToStorage(storage, shares);
  check('3a. Écriture réussie', result, { ok: true });
  check('3b. Relecture identique (round-trip)', readSharesFromStorage(storage, []), shares);
}

// 4. Contenu corrompu (JSON invalide) -> repli sur fallback, pas d'exception non attrapée.
{
  const storage = fakeStorage({ [SHARES_STORAGE_KEY]: '{not valid json' });
  check('4. JSON corrompu -> fallback', readSharesFromStorage(storage, ['fallback']), ['fallback']);
}

// 5. Contenu valide mais pas un tableau -> fallback (jamais planter le .map()/.filter() appelant).
{
  const storage = fakeStorage({ [SHARES_STORAGE_KEY]: JSON.stringify({ not: 'an array' }) });
  check('5. Objet au lieu d\'un tableau -> fallback', readSharesFromStorage(storage, ['fallback']), ['fallback']);
}

// 6. Écriture qui échoue (storage.setItem lève, ex. quota dépassé) -> { ok:false, error } lisible,
// jamais une exception qui remonterait jusqu'à React.
{
  const storage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  const result = writeSharesToStorage(storage, [{ id: 'sh-1' }]);
  check('6a. Écriture en échec -> ok:false', result.ok, false);
  check('6b. Message d\'erreur non vide', typeof result.error === 'string' && result.error.length > 0, true);
}

// 7. storage=null en écriture -> échec propre, pas d'exception.
{
  const result = writeSharesToStorage(null, [{ id: 'sh-1' }]);
  check('7. storage=null -> ok:false sans exception', result.ok, false);
}

// 8. La limite de taille de fichier est bien positive et raisonnable (documentée, pas un
// détail d'implémentation caché) — pas de valeur absurde (0, négative, ou > le quota
// localStorage typique de 5 Mo, ce qui garantirait un échec systématique).
check('8. MAX_LOCAL_FILE_BYTES raisonnable (entre 100 Ko et 5 Mo)', MAX_LOCAL_FILE_BYTES > 100_000 && MAX_LOCAL_FILE_BYTES < 5_000_000, true);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
