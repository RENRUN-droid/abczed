// V7.11 (P1) — En-tête compact réutilisé par les vues "thread" (fil filtré par événement,
// Messages.jsx) et "event-detail" (EventDetail.jsx) : défaut confirmé en UAT réelle — le logo
// ABCZed ET l'avatar disparaissaient tous les deux en naviguant vers ces deux écrans (seules les
// 5 pages principales affichaient l'en-tête de App.jsx, voir la condition
// `['accueil','agenda','messages','partages','labande'].includes(view)`).
//
// Délibérément DISTINCT de l'en-tête principal (App.jsx) — brief explicite : "ne doit PAS être
// une copie complète de l'en-tête des pages principales, rester visuellement distinct/compact".
// Différences volontaires : logo et avatar nettement plus petits, padding réduit, pas de fond ni
// de marge basse propres (s'intègre directement au-dessus du bandeau titre déjà existant de
// chaque écran, jamais un second bloc qui doublerait l'espace vertical).
//
// Le "contrôle de retour vers la page d'origine" demandé par le brief n'est PAS dupliqué ici :
// EventDetail.jsx et Messages.jsx (vue thread) ont chacun DÉJÀ un bouton "Retour"
// (aria-label="Retour", déjà correctement câblé sur onBack/onBackToEvent) juste en dessous de ce
// bandeau — en ajouter un second avec le même aria-label aurait cassé le mode strict de
// Playwright (`page.click('button[aria-label="Retour"]')`, utilisé ~25 fois par
// test-harness/recette.mjs, échoue dès que ce sélecteur trouve plus d'un élément) sur les deux
// suites Playwright existantes, qui doivent rester intactes ET vertes. Ce bandeau et le bouton
// "Retour" existant juste en dessous forment ENSEMBLE le bloc d'identité + retour demandé par le
// brief — voir MATRICE_LIVRAISON.md, section V7.11, pour cette décision explicitée.
import Logo from './Logo';
import ConnectedAvatar from './ConnectedAvatar';

export default function CompactHeader({ currentUserId, displayName, avatarPath, onOpenProfile }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 0' }}>
      <Logo size={18} />
      <ConnectedAvatar userId={currentUserId} displayName={displayName} avatarPath={avatarPath} size={22} onClick={onOpenProfile} />
    </div>
  );
}
