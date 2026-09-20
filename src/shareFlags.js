// Correction post-livraison (contre-vérification indépendante de la 3e passe) : logique pure
// d'inversion d'un flag de partage, extraite pour être testable indépendamment de React —
// même principe que navMemory.js/dateSearch.js. Utilisée par App.jsx (toggleMeShareFlag) pour
// mettre à jour l'état des réglages "Mon profil", désormais porté par App.jsx (qui ne démonte
// jamais) plutôt que par un useState local à MyProfileSheet (qui, lui, était démonté à chaque
// fermeture de la modale et perdait donc silencieusement tout changement).
export function toggleShareFlag(flags, key) {
  return { ...flags, [key]: !flags[key] };
}
