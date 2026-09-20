// Brief pt 40/41, arbitrage D2 : URL Google Maps universelle CONSERVÉE (fonctionne aussi bien
// en ouverture web que via la gestion des liens "maps" par le système d'exploitation sur
// mobile) — aucune détection d'OS ni de schéma personnalisé (`geo:`/`maps:`), explicitement
// exclue par l'arbitrage, plus fragile et jamais vérifiable dans cet environnement. Ce qui
// change : la PRÉCISION de la requête passée à cette même URL universelle, à 3 niveaux, du
// plus précis au plus générique — jamais l'inverse, un niveau n'est utilisé que si le
// précédent n'a pas de donnée.
//
//   1) lat/lng — coordonnées précises (une "épingle" exacte, pas une recherche par texte).
//      Aucun événement de démonstration n'en a aujourd'hui : plutôt que de fabriquer des
//      coordonnées non vérifiées pour un lieu réel (risque d'épingle FAUSSE, pire qu'une
//      absence de précision), ce niveau reste prouvé uniquement par les tests unitaires
//      (scripts/test-maps-url.mjs, avec des coordonnées de test explicitement fictives) —
//      documenté tel quel dans la matrice de livraison plutôt que présenté comme couvert par
//      une donnée réelle qu'il ne l'est pas.
//   2) adresse complète + nom du lieu — le niveau déjà utilisé avant cette passe, conservé
//      pour tout événement qui a une adresse. L'adresse de la sortie piscine a été corrigée
//      (donnée réelle vérifiée par recherche web, voir data.js) : l'ancienne adresse fictive
//      portait par erreur un code postal qui correspond à Sainte-Clotilde (97490), pas
//      Saint-Denis (97400).
//   3) recherche générique — dernier recours, nom du lieu seul, quand aucune adresse n'existe
//      (ex. "École élémentaire"). Moins précis que les deux niveaux précédents, mais reste
//      meilleur qu'un lien mort ou l'absence de lien.
export function buildMapsUrl(event) {
  if (Number.isFinite(event?.lat) && Number.isFinite(event?.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lng}`;
  }
  if (event?.address) {
    const q = encodeURIComponent(event.location ? `${event.location}, ${event.address}` : event.address);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  const q = encodeURIComponent(event?.location || '');
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
