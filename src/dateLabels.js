// V7.8 — module dédié : logique d'étiquette de date relative (Aujourd'hui / Hier / date
// complète) UNIQUE, désormais partagée entre Messages.jsx (séparateurs de date dans le fil)
// et Accueil.jsx (ligne "dernier message"). Avant ce lot, cette fonction était dupliquée
// (locale à Messages.jsx) ET Accueil.jsx n'en utilisait aucune version — il affichait
// littéralement "Aujourd'hui à HH:MM" pour CHAQUE dernier message, y compris quand son vrai
// `date` était hier ou plus ancien (bug signalé par contre-vérification indépendante de la
// V7.7). Une seule fonction, partagée, élimine à la fois la duplication et le risque que les
// deux écrans divergent silencieusement à l'avenir.
import { TODAY_ISO } from './data';
import { localIso } from './localDate.js';

export function dateSeparatorLabel(dateStr) {
  if (!dateStr) return null;
  if (dateStr === TODAY_ISO) return "Aujourd'hui";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  // localIso (pas .toISOString()) : évite le bug de fuseau UTC/local déjà corrigé ailleurs
  // dans ce fichier avant son extraction (voir ../localDate.js).
  if (dateStr === localIso(yesterday)) return 'Hier';
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
