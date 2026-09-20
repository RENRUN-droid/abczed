// Logique de filtrage/recherche Partages, extraite de Partages.jsx pour être testable
// directement (même principe que src/agendaSearch.js pour l'Agenda, brief §33) — la
// fonction que le composant utilise en production est celle que les scripts de test
// importent et exécutent, pas une reproduction séparée.

import { anyFieldMatches } from './searchUtils.js';
import { documentById } from './documents.js';

// Delta pts 29/30/39/42 (arbitrage D1) : `s.fileName` n'existe plus depuis que les partages de
// type document référencent un id du catalogue (src/documents.js) — la recherche doit
// continuer à matcher le nom du fichier réel, donc on le résout ici plutôt que de perdre
// silencieusement ce critère de recherche.
export function computeFilteredShares(shares, filter, query) {
  const byType = filter === 'tous' ? shares : shares.filter((s) => s.type === filter);
  return byType.filter((s) => {
    const doc = s.documentId ? documentById(s.documentId) : null;
    // Repli sur fileName : un partage créé via "Ajouter un partage" (aucun import de fichier
    // réel n'existe encore) n'a jamais de documentId, mais son nom tapé à la main doit rester
    // trouvable par la recherche exactement comme avant cette passe.
    return anyFieldMatches([s.title, s.description, doc?.displayName, doc?.filename, s.fileName, s.author], query);
  });
}
