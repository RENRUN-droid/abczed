import { BG, MUTED } from '../theme';
import Logo from './Logo';

// Écran neutre utilisé pour loading-session ET authenticated-checking-membership —
// jamais de contenu ABCZed affiché tant que l'accès n'est pas confirmé.
//
// V7.35 (26 sept.) — même bug que AccessUnavailable.jsx (corrigé en V7.32), repéré cette fois-ci
// dans un second écran : celui-ci affichait le fichier image maître (/abczed-logo-master.png) en
// entier au lieu de passer par le composant <Logo/>. Ce fichier contient toujours, à gauche du
// mot "ABCZed", l'ancien symbole en deux blocs façon puzzle (remplacé depuis par l'icône soleil,
// jamais retiré du PNG lui-même) — <Logo/> ne prélève que la zone du mot-symbole et dessine
// l'icône soleil séparément, ce qui masquait le problème partout où il est déjà utilisé. C'est
// précisément l'écran affiché entre la validation du mot de passe et l'arrivée sur l'Accueil
// (statut `authenticated-checking-membership`, AuthProvider.jsx) — signalé à plusieurs reprises
// par l'utilisatrice sans qu'on ait identifié CET écran-ci comme la source jusqu'ici.
export default function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 14, opacity: 0.85, display: 'flex', justifyContent: 'center' }}><Logo size={36} /></div>
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Chargement…</p>
      </div>
    </div>
  );
}
