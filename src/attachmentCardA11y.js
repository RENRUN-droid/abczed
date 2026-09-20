// Brief pts 29/30/39/42, arbitrage D1 (précision reçue de l'utilisateur, à appliquer AVANT
// livraison) : "la carte de pièce jointe elle-même doit être actionnable" — desktop
// (survol + curseur + focus visible), mobile (carte entière tappable), clavier (activation
// accessible) — pas seulement les deux boutons explicites Ouvrir/Télécharger qui vivent à
// l'intérieur. Un clic sur la carte ouvre le fichier (même action que "Ouvrir") ; un clic sur
// un des deux boutons internes garde son propre comportement (ils stoppent déjà la propagation
// dans ActionButton, donc n'activent jamais aussi le clic de la carte).
//
// Spreadé sur le conteneur de la carte : `{...openableCardProps(doc?.url)}`. Retourne un objet
// vide (aucun rôle, aucun tabIndex, aucun gestionnaire) quand `url` est absent — une carte sans
// fichier réel associé ne devient pas un piège de focus/clic qui ne fait rien.
//
// Bug corrigé (contre-vérification indépendante du ZIP V7) : `onKeyDown` réagissait à
// N'IMPORTE QUEL keydown remontant par bubbling jusqu'au conteneur — y compris ceux des liens
// <a> Ouvrir/Télécharger imbriqués. Au clic, `ActionButton` appelle déjà `stopPropagation()`,
// donc le clic de la carte n'est jamais aussi déclenché ; mais `stopPropagation()` au clic
// n'arrête PAS l'évènement `keydown`, qui est distinct. Conséquence réelle : appuyer sur Entrée
// alors que le focus est sur "Télécharger" faisait remonter le keydown jusqu'à la carte, qui
// appelait `window.open()` (sans sémantique de téléchargement) au lieu de laisser le lien
// déclencher son propre comportement natif. Le garde `e.target !== e.currentTarget` ci-dessous
// fait que la carte ne réagit au clavier QUE quand c'est elle-même qui a le focus, jamais quand
// l'évènement provient d'un descendant interactif. Ce garde n'est PAS ajouté à `onClick` : au
// clic, seul `ActionButton` (les liens Ouvrir/Télécharger) stoppe la propagation, donc tout
// clic qui remonte jusqu'ici vient forcément d'une zone non interactive de la carte (icône,
// texte, fond) — c'est justement ce qui permet à la carte ENTIÈRE d'être cliquable (exigence
// D1), pas seulement son conteneur racine ; ajouter le même garde ici casserait cette exigence
// pour tout clic qui ne tombe pas pixel-pour-pixel sur l'élément racine.
import { openInNewTab } from './attachmentOpen';

export function openableCardProps(url) {
  if (!url) return {};
  function open() {
    // V7.14 (phase 3, item 11) : `url` peut désormais être une URL `data:` (fichier/photo de
    // partage ajouté localement, src/sharesStorage.js) — Chromium bloque silencieusement la
    // navigation d'un nouvel onglet directement vers une URL `data:` (voir le commentaire détaillé
    // de src/attachmentOpen.js, où ce même blocage a été diagnostiqué pour ActionButton.jsx).
    // `openInNewTab` convertit une URL `data:` en `blob:` avant d'ouvrir ; une URL http(s)
    // normale (catalogue src/documents.js) garde exactement son comportement précédent.
    openInNewTab(url);
  }
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': 'Ouvrir la pièce jointe',
    onClick: open,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    },
  };
}
