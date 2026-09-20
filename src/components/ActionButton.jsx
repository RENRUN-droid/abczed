// Bouton d'action secondaire (Ouvrir / Télécharger), réutilisé tel quel par EventDetail.jsx et
// Partages.jsx — même composant, jamais une copie visuelle divergente.
//
// Delta pts 29/30/39/42 (arbitrage D1) : réellement actionnable dès qu'un `href` réel est
// fourni (fichier du catalogue src/documents.js, servi depuis public/demo/, ou URL externe
// d'un partage de type lien) — ce n'était vrai pour AUCUN cas avant cette passe, le bouton
// était unconditionnellement désactivé avec un texte expliquant "tant que le stockage n'est
// pas activé". Ce texte devient faux pour les cas qui ont désormais un `href` réel, donc il ne
// s'affiche plus que pour les cas qui n'en ont vraiment pas (ex. l'album photo du zoo, qui n'a
// aucune image de démonstration associée) — et le texte explique alors CE cas précis plutôt
// qu'une raison technique globale qui ne serait plus vraie pour les autres boutons de l'écran.
//
import { BLUE, MIN_TOUCH_TARGET, TEXT } from '../theme';
import { isDataUrl, openInNewTab } from '../attachmentOpen';

// V7.14 (correctif UAT point 6) : ce bouton était l'exemple concret cité du défaut "pastel
// délavé" — fond #EAF1FB (teinte) + texte bleu 12px, pour une action pourtant réelle et
// cliquable ("Ouvrir"/"Télécharger"). Conformément à la convention couleur ajoutée en tête de
// src/theme.js (aplat solide pour toute action, teinte réservée au non-interactif), l'état
// actionnable passe en aplat BLUE plein + texte blanc (contraste ≥4,5:1, très large marge —
// voir scripts/test-design-system.mjs). Zone tactile portée à MIN_TOUCH_TARGET (44px, seuil
// documenté dans theme.js) au lieu d'une hauteur non garantie par un simple padding de 6px —
// toujours compact (ce sont deux boutons côte à côte dans une carte, pas des CTA pleine
// largeur), mais jamais sous le plancher tactile attendu pour une action importante.
// V7.16 : `fontFamily: TEXT.button.fontFamily` ajouté pour cohérence avec `buttonStyle()`
// (theme.js) — ce bouton compact n'en est pas issu (deux boutons côte à côte dans une carte,
// jamais pleine largeur) mais reste un VRAI bouton d'action, donc il suit la même police que
// tous les autres plutôt qu'une troisième famille de facto.
const commonStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  borderRadius: 999, padding: '0 14px', minHeight: MIN_TOUCH_TARGET,
  fontSize: 13, fontWeight: 700, fontFamily: TEXT.button.fontFamily, textDecoration: 'none', border: 'none',
};

// Un vrai `<a>` (pas un `<button onClick=window.open>`) : ouvrable dans un nouvel onglet,
// annonçable par un lecteur d'écran comme un lien, fonctionnel avec Ctrl/Cmd+clic — et ça
// fonctionne aussi après `npm run build` puisque public/ est copié tel quel à la racine du
// build (aucune dépendance à un serveur de dev).
export default function ActionButton({ icon: Icon, children, href, download, title, onClick }) {
  const disabled = !href;

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={title || 'Indisponible pour cet élément'}
        style={{ ...commonStyle, background: '#F1F1EF', color: '#6F7885', opacity: 0.65, cursor: 'not-allowed' }}
      >
        <Icon size={14} /> {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      target={download ? undefined : '_blank'}
      rel={download ? undefined : 'noopener noreferrer'}
      download={download || undefined}
      title={title}
      className="tap-surface"
      onClick={(e) => {
        e.stopPropagation();
        // Le blocage Chromium (voir src/attachmentOpen.js) ne concerne que la navigation de
        // NOUVEL ONGLET ("Ouvrir") — jamais "Télécharger" (`download` posé), qui déclenche un
        // téléchargement natif plutôt qu'une navigation et n'est pas soumis à cette restriction.
        if (!download && isDataUrl(href)) {
          e.preventDefault();
          openInNewTab(href);
        }
        onClick?.(e);
      }}
      style={{ ...commonStyle, background: BLUE, color: '#FFFFFF', cursor: 'pointer' }}
    >
      <Icon size={14} /> {children}
    </a>
  );
}
