// V7.77 (19 nov.) — affiche un texte libre en rendant ses liens cliquables (voir
// src/linkify.js pour les règles de détection et le garde-fou http(s)).
//
// Le lien :
// - s'ouvre dans un nouvel onglet (`target="_blank"`, `rel="noopener noreferrer"`) — on ne
//   quitte jamais ABCZed (important en mode application installée sur l'écran d'accueil) ;
// - stoppe la propagation du clic : sur une carte de Partages déjà cliquable (ouvrir la
//   photo/le fichier), toucher le lien ouvre LE LIEN, pas la photo en plus ;
// - coupe les URL très longues au lieu de déborder du cadre (`overflowWrap: anywhere`,
//   même cause que le bug V7.67 des noms de fichiers longs).
import { linkifySegments } from '../linkify.js';
import { BLUE } from '../theme.js';

export default function LinkifiedText({ text }) {
  const segments = linkifySegments(text);
  return segments.map((seg, i) => (
    seg.type === 'link' ? (
      <a
        key={i}
        href={seg.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ color: BLUE, textDecoration: 'underline', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {seg.value}
      </a>
    ) : (
      <span key={i}>{seg.value}</span>
    )
  ));
}
