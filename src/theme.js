// Tokens alignés sur ABCZed_MASTER_FOR_CLAUDE.md — valeurs exactes, pas d'approximation.
export const BLUE = '#0D47A1';
export const RED = '#E53935';
export const BG = '#FBF6EC';
export const INK = '#172033';        // --abczed-ink
export const MUTED = '#6F7885';      // --abczed-muted (texte secondaire)
export const CARD_BORDER = '#E8E5DE'; // --abczed-line
export const SURFACE = '#FFFFFF';     // --abczed-surface
export const BLUE_TINT = '#EAF1FB';
export const RED_TINT = '#FCE9E7';
export const SOFT_SURFACE = '#F4F0E6';

// ============================================================================
// CONVENTION COULEUR — APLATS SOLIDES vs TEINTES (V7.14, correctif UAT point 6)
// ============================================================================
// Retour utilisateur explicite sur V7.13 : l'interface "lit" comme pastel délavé malgré des
// tokens de marque francs (BLUE/RED/couleurs de catégorie, inchangés ici — aucune teinte de
// marque n'est modifiée par cette passe). Cause identifiée par audit du code réel, pas d'une
// impression seule : les teintes (`*_TINT`, `*.tint` de CATEGORIES/SECTION_THEMES/
// SHARE_TYPE_THEMES) servaient de FOND À DES ÉLÉMENTS INTERACTIFS eux-mêmes — ex.
// `ActionButton.jsx` ("Ouvrir"/"Télécharger" en fond #EAF1FB + texte bleu 12px) et les deux
// boutons rapides de l'Accueil (fond teinté + bordure colorée, V7.12). Un aplat pâle à faible
// contraste, répété sur beaucoup d'écrans, est précisément ce qui lit comme "délavé" — pas
// les couleurs de marque elles-mêmes.
//
// Règle à appliquer par CETTE passe et par toutes les phases suivantes qui consomment ces
// tokens :
//   • APLAT SOLIDE (`color`) → action primaire/importante, état actif ou sélectionné, anneau
//     de focus. Le texte associé est TOUJOURS `onColor` du même groupe (CATEGORIES,
//     SECTION_THEMES) — jamais une couleur de texte choisie à la main au cas par cas — car
//     `onColor` est précalculé pour un contraste ≥ 4,5:1 sur CET aplat précis (contrôlé pour
//     chaque entrée par `scripts/test-design-system.mjs`).
//   • TEINTE (`tint`) → réservée aux fonds NON interactifs ou aux états NON sélectionnés :
//     fond de carte, badge informatif, chip inactif, halo décoratif derrière une icône. Une
//     teinte ne doit JAMAIS être le fond d'un bouton/lien qui déclenche une action — c'est
//     exactement le défaut corrigé dans `ActionButton.jsx` et les boutons rapides de
//     l'Accueil par cette passe.
//   • API réutilisable pour les phases suivantes, plutôt que du style ad hoc recopié écran
//     par écran : `src/components/Button.jsx` exporte `Button` (variantes `primary` /
//     `secondary` / `destructive` / `icon`) et la fonction `buttonStyle(variant, opts)`
//     ci-dessous. L'anneau de focus visible et le retour "pressé" ne sont PAS à redéfinir
//     composant par composant : les classes CSS globales déjà partagées `.tap-surface`
//     (l'élément EST la cible cliquable) et `.tap-container` (l'élément CONTIENT des actions)
//     restent le seul mécanisme — voir le `<style>` global de `src/App.jsx` — et
//     `Button.jsx` les applique automatiquement ; aucun style de focus/pressed ne doit être
//     recréé à la main dans un composant de phase suivante.
// ============================================================================

export const RADIUS_CARD = 18;
export const RADIUS_SM = 10;
export const RADIUS_MD = 14;
export const RADIUS_PILL = 999;
export const BUTTON_H = 48;
// Zone tactile minimale pour toute action "importante" (nav, bouton primaire, chip
// actionnable) — brief V7.14, cohérent avec les contrôles déjà en place en V7.13 (flèches de
// calendrier, jours, champs de formulaire). Valeur seuil réutilisée par les tests (design
// system + recette V7.14), pas seulement une convention documentée sans contrôle.
export const MIN_TOUCH_TARGET = 44;

// Échelle d'espacement — un seul jeu de valeurs pour toute l'app plutôt que des marges/
// paddings choisis au pixel près à chaque écran. Les valeurs déjà en usage (14/16/18/20 sur
// .page-shell, gap 8/10/12 sur les listes...) restent valables : cette échelle est un
// vocabulaire commun pour les NOUVEAUX styles, pas une réécriture rétroactive de l'existant.
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

// Ombres — deux niveaux seulement, cohérents avec un rendu "chaleureux" (jamais un flat design
// sans profondeur, jamais une ombre dure). CARD : légère surélévation d'une carte sur le fond
// crème. ELEVATED : sheets/modales, qui doivent nettement se détacher du contenu en dessous.
export const SHADOW_CARD = '0 1px 3px rgba(23,32,51,0.07), 0 1px 2px rgba(23,32,51,0.04)';
export const SHADOW_ELEVATED = '0 16px 40px rgba(23,32,51,0.20), 0 6px 16px rgba(23,32,51,0.10)';

// V7.16 — demande explicite de l'utilisateur (recette réelle post-V7.15) : le texte courant
// (body/bodyStrong/small/tiny, jamais touché ici) reste en Nunito Sans Variable — c'est déjà la
// famille posée par défaut sur <body> dans index.html, lisible aux petites tailles, donc ces
// niveaux n'ont pas besoin de fontFamily explicite (ils héritent). Mais les titres/boutons/
// libellés de navigation restaient dans cette même police neutre alors que le mot-symbole du
// logo (public/abczed-logo-master.png) utilise un lettrage très arrondi et plein — écart de
// personnalité confirmé par l'utilisateur ("ça n'a jamais été traité"). `FONT_DISPLAY` (Baloo 2
// Variable, choisie par l'utilisateur après comparatif visuel direct contre 3 candidats sur les
// vrais titres/boutons de l'app) est réservée aux niveaux ci-dessous marqués "titre" — jamais au
// texte courant, pour ne pas dégrader la lisibilité à 13-14px (la police pleine/dense se prête
// mal aux petites tailles, contrairement à un display de grande taille ou un libellé de bouton
// court). Chargée via `@fontsource-variable/baloo-2` (voir src/main.jsx) — même mécanisme de
// self-hosting que Nunito Sans, aucun appel réseau externe à l'exécution.
export const FONT_DISPLAY = "'Baloo 2 Variable', 'Baloo 2', sans-serif";

// Échelle typographique — Nunito Sans Variable reste l'unique famille pour le texte courant.
// Ce qui manquait à l'origine : une échelle de poids/taille/interlignage délibérée plutôt que
// des valeurs ponctuelles par écran. `PageTitle.jsx` utilise déjà exactement les valeurs de
// TEXT.h1 (extraites ici, pas changées) ; `buttonStyle()` plus bas lit TEXT.button de la même
// façon, y compris son `fontFamily` — une seule source de vérité pour les deux.
export const TEXT = {
  // fontWeight 800 (au lieu de 820 avant cette passe) : c'est le poids MAXIMUM de l'axe
  // variable de Baloo 2 (400-800, voir @fontsource-variable/baloo-2) — un navigateur aurait de
  // toute façon écrêté 820 à 800 en le rendant, donc autant poser la valeur réellement atteinte.
  h1: { fontSize: 32, fontWeight: 800, letterSpacing: -0.55, lineHeight: 1.06, fontFamily: FONT_DISPLAY },      // titres de page (PageTitle)
  h2: { fontSize: 17, fontWeight: 750, letterSpacing: -0.1, lineHeight: 1.25, fontFamily: FONT_DISPLAY },       // titres de section
  body: { fontSize: 14, fontWeight: 500, lineHeight: 1.45 },                          // texte courant
  bodyStrong: { fontSize: 14, fontWeight: 700, lineHeight: 1.4 },                     // texte courant, emphase
  small: { fontSize: 13, fontWeight: 600, lineHeight: 1.35 },                        // texte secondaire lisible (légendes de carte)
  tiny: { fontSize: 11.5, fontWeight: 600, letterSpacing: 0.15, lineHeight: 1.4 },    // mentions annexes seulement
  button: { fontSize: 14.5, fontWeight: 700, letterSpacing: 0.1, fontFamily: FONT_DISPLAY },  // libellé de bouton
};

export const CATEGORIES = {
  // `onColor` garantit un libellé lisible sur l'aplat métier. Le jaune anniversaire
  // conserve sa teinte validée, mais reçoit un texte brun foncé plutôt que blanc.
  anniversaire: { label: 'Anniversaires', color: '#F4B41A', tint: '#FFF4D2', onColor: '#4A3200' },
  sortie:       { label: 'Sorties',        color: '#169B68', tint: '#E8F6F0', onColor: INK },
  ecole:        { label: 'École',          color: '#5A2AA6', tint: '#F0EAF8', onColor: '#FFFFFF' },
  autre:        { label: 'Autres',         color: '#7C838D', tint: '#F1F1EF', onColor: '#0C1320' },
};

// Couleur du filtre "Tous" — délibérément hors de CATEGORIES (qui est aussi parcouru par
// Object.entries() pour générer les chips de filtre réels ; y ajouter "tous" dupliquerait
// le chip déjà rendu séparément). Centralisée ici plutôt que codée en dur dans Agenda.jsx,
// pour que la cohérence de couleur ne dépende plus de deux fichiers synchronisés à la main.
export const ALL_FILTER_COLOR = BLUE;

// Code couleur transversal des cinq espaces. Ces accents servent à l'orientation
// (titre, navigation, focus et sous-menus) ; les couleurs de catégories Agenda
// restent réservées au sens métier et ne sont jamais remplacées par celles-ci.
//
// `onColor` ajouté en V7.14 (même rôle que pour CATEGORIES ci-dessus) : nécessaire dès qu'un
// accent de rubrique sert de FOND SOLIDE à un bouton (ex. actions rapides de l'Accueil,
// désormais en aplat plein plutôt qu'en teinte pâle — voir la convention couleur en tête de
// fichier). Calculé, pas choisi à l'œil : le rouge messages (#E53935) ne passe PAS 4,5:1 avec
// du blanc (≈4,23:1, mesuré) ni avec `INK` (≈3,85:1) — seul un texte quasi noir y satisfait le
// seuil (contrôlé par scripts/test-design-system.mjs, comme pour CATEGORIES). Les quatre
// autres accents passent largement avec du blanc.
export const SECTION_THEMES = {
  accueil:  { color: BLUE,      tint: BLUE_TINT, onColor: '#FFFFFF' },
  agenda:   { color: '#995800', tint: '#FFF0D9', onColor: '#FFFFFF' },
  messages: { color: RED,       tint: RED_TINT,  onColor: '#1A0000' },
  partages: { color: '#087E8B', tint: '#E5F5F6', onColor: '#FFFFFF' },
  labande:  { color: '#6D4596', tint: '#F1EAF8', onColor: '#FFFFFF' },
};

export const SHARE_TYPE_THEMES = {
  document: { color: BLUE,      tint: BLUE_TINT },
  photo:    { color: '#6D4596', tint: '#F1EAF8' },
  lien:     { color: '#087E8B', tint: '#E5F5F6' },
  info:     { color: '#995800', tint: '#FFF0D9' },
};

export function categoryOf(event) {
  return CATEGORIES[event.category] || CATEGORIES.autre;
}

// ============================================================================
// BOUTONS — API partagée pour cette passe ET les phases suivantes (V7.14, point 6)
// ============================================================================
// `buttonStyle(variant, opts)` renvoie un objet de style prêt à étaler dans une prop `style`.
// Ce n'est PAS un composant : les boutons de l'app sont des éléments natifs `<button>`/`<a>`
// avec des attributs très variés (onClick, href, disabled, aria-*...) — imposer un composant
// wrapper aurait forcé soit une prolifération de props de passthrough, soit une réécriture des
// call-sites hors périmètre de cette passe. `src/components/Button.jsx` fournit tout de même
// un composant `Button` fin (voir ce fichier) pour les cas simples des phases suivantes, mais
// bâti sur exactement cette même fonction — une seule source de vérité pour les 4 variantes.
//
// Variantes :
//   - 'primary'     : aplat solide `opts.color` (défaut BLUE), texte `opts.onColor` (défaut
//                     blanc) — action principale d'un écran/d'une carte.
//   - 'secondary'   : fond blanc, bordure 1.5px `opts.color`, texte `opts.color` — action
//                     secondaire à côté d'une primaire, jamais un fond teinté pâle.
//   - 'destructive' : fond blanc, bordure 1.5px RED, texte RED — reprend le style déjà validé
//                     de "Supprimer l'anniversaire" (AddBirthdaySheet.jsx), formalisé ici.
//   - 'icon'        : bouton rond 44×44 sans fond ni bordure (mêmes dimensions que la classe
//                     CSS globale `.icon-button` déjà en place — cette variante existe pour
//                     les cas où le style est composé en JS plutôt que via className).
// Toutes les variantes retournent `minHeight: MIN_TOUCH_TARGET` (44) au minimum — `BUTTON_H`
// (48) reste le choix par défaut pour les actions principales pleine largeur, mais une
// variante compacte (ex. `opts.compact`) peut redescendre jusqu'au plancher de 44, jamais
// moins (brief : zone tactile ≥44px pour toute action importante).
export function buttonStyle(variant = 'primary', opts = {}) {
  const color = opts.color || BLUE;
  const onColor = opts.onColor || '#FFFFFF';
  const minHeight = opts.compact ? MIN_TOUCH_TARGET : BUTTON_H;
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight, borderRadius: RADIUS_MD, fontSize: TEXT.button.fontSize, fontWeight: TEXT.button.fontWeight,
    letterSpacing: TEXT.button.letterSpacing, fontFamily: TEXT.button.fontFamily, border: 'none', cursor: 'pointer',
  };
  switch (variant) {
    case 'secondary':
      return { ...base, background: '#FFFFFF', color, border: `1.5px solid ${color}` };
    case 'destructive':
      return { ...base, background: '#FFFFFF', color: RED, border: `1.5px solid ${RED}88` };
    case 'icon':
      return {
        ...base, width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET,
        padding: 0, borderRadius: RADIUS_PILL, background: 'none', color: opts.color || INK,
      };
    case 'primary':
    default:
      return { ...base, background: color, color: onColor };
  }
}
