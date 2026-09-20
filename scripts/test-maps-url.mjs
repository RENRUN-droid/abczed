// Test qui EXÉCUTE le code de production, pas une reproduction : import direct de
// src/mapsUrl.js, le même module que src/pages/EventDetail.jsx utilise réellement
// (brief pt 40/41, arbitrage D2 — 3 niveaux de précision, jamais de détection d'OS).
import { buildMapsUrl } from '../src/mapsUrl.js';

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — attendu ${expected}, obtenu ${actual}`); fail++; }
}
function checkContains(label, url, fragment) {
  if (url.includes(fragment)) { console.log(`✅ ${label}`); pass++; }
  else { console.log(`❌ ${label} — "${fragment}" absent de ${url}`); fail++; }
}

// Niveau 1 : lat/lng -> épingle précise, prioritaire sur tout le reste même si adresse/lieu
// sont aussi présents. Coordonnées explicitement FICTIVES (voir le commentaire de
// src/mapsUrl.js sur ce choix de test).
const withCoords = { lat: -20.8789, lng: 55.4481, address: '3 allée Bois Joli Coeur, 97400 Saint-Denis', location: 'Piscines Municipales' };
checkContains('1. lat/lng présents -> query = coordonnées exactes', buildMapsUrl(withCoords), 'query=-20.8789,55.4481');
check('2. lat/lng présents -> jamais le texte de l\'adresse dans l\'URL', buildMapsUrl(withCoords).includes(encodeURIComponent('allée')), false);

// Niveau 2 : adresse complète + nom du lieu, pas de coordonnées.
const withAddress = { address: '3 allée Bois Joli Coeur, 97400 Saint-Denis', location: 'Piscines Municipales' };
checkContains('3. Adresse sans lat/lng -> requête = lieu + adresse', buildMapsUrl(withAddress), encodeURIComponent('Piscines Municipales, 3 allée Bois Joli Coeur, 97400 Saint-Denis'));

// Adresse seule, sans nom de lieu distinct.
const addressOnly = { address: '1 rue de la Mairie, 97400 Saint-Denis' };
checkContains('4. Adresse seule (pas de location) -> requête = adresse seule', buildMapsUrl(addressOnly), encodeURIComponent('1 rue de la Mairie, 97400 Saint-Denis'));

// Niveau 3 : dernier recours, nom du lieu seul (ex. "École élémentaire", pas d'adresse connue).
const locationOnly = { location: 'École élémentaire' };
checkContains('5. Ni lat/lng ni adresse -> requête = lieu seul (dernier recours)', buildMapsUrl(locationOnly), encodeURIComponent('École élémentaire'));

// Robustesse : aucune donnée du tout -> ne lève jamais d'exception, produit une URL valide.
check('6. Événement sans aucune donnée de lieu -> ne plante pas', typeof buildMapsUrl({}), 'string');
check('7. URL toujours l\'endpoint universel Google Maps (jamais geo:/maps:)', buildMapsUrl(withCoords).startsWith('https://www.google.com/maps/search/?api=1&query='), true);
check('8. Aucune détection d\'OS/plateforme dans le module', /navigator\.|platform|userAgent/.test(buildMapsUrl.toString()), false);

console.log(`\n${pass} réussite(s), ${fail} échec(s).`);
process.exit(fail > 0 ? 1 : 0);
