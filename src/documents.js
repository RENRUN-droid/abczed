// Brief pts 29/30/39/42, arbitrage D1 : source unique pour une pièce jointe partagée entre
// plusieurs écrans. Avant cette passe, "la même" autorisation parentale sortie piscine
// existait sous 3 formes divergentes : nom et taille différents dans EventDetail (pièce
// jointe de l'événement), dans Messages (fichier partagé dans le fil) et dans Partages
// (document partagé) — rien ne garantissait qu'un changement dans l'un se reflète dans les
// deux autres, alors qu'il s'agit du même fichier dans le scénario de démonstration. Chaque
// écran référence désormais un id de ce catalogue plutôt que de recopier filename/size.
//
// Forme verrouillée par l'arbitrage : {id, filename, displayName, size, mimeType, url}.
// `url` pointe vers public/demo/ — un vrai fichier statique servi par Vite, présent aussi
// après `npm run build` (public/ est copié tel quel à la racine du build), pas une image de
// stockage fictive. Le nom du fichier et son contenu indiquent clairement qu'il s'agit d'un
// exemple ; ce n'est le document d'aucun établissement réel. Aucune donnée Supabase Storage :
// l'arbitrage exclut explicitement d'y toucher dans cette passe.
export const DOCUMENTS = {
  'doc-autorisation-piscine': {
    id: 'doc-autorisation-piscine',
    filename: 'autorisation-piscine.pdf',
    displayName: 'Autorisation parentale (modèle vierge)',
    size: '2 Ko',
    mimeType: 'application/pdf',
    url: '/demo/autorisation-piscine.pdf',
  },
};

export function documentById(id) {
  return DOCUMENTS[id] || null;
}
