import { useAuth } from './auth/AuthProvider';
import Login from './pages/Login';
import AccessUnavailable from './pages/AccessUnavailable';
import NotConfigured from './pages/NotConfigured';
import InviteAccept from './pages/InviteAccept';
import LoadingScreen from './components/LoadingScreen';
import App from './App';

// V7.18 — reconnaît /invite/<token>, en dehors de src/router.js (délibérément : ce module est
// documenté comme limité aux 5 sections de l'app AUTHENTIFIÉE, voir son en-tête — un lien
// d'invitation est, par nature, ouvert par quelqu'un qui n'a PAS encore de session ni
// d'appartenance, donc avant toute page de ce routeur).
// RÉVISION (2026-09-21) : le jeton n'est plus un uuid (36 caractères, tirets compris) mais 32
// octets aléatoires encodés en hexadécimal (64 caractères) — voir sql/09_invitations.sql,
// create_invitation(). Jamais stocké en clair côté serveur (seul son hash SHA-256 l'est), donc
// jamais devinable à partir du schéma de la base.
const INVITE_PATH = /^\/invite\/([0-9a-f]{64})\/?$/i;

export default function Root() {
  const { status, activeCommunity, memberships } = useAuth();

  // Prioritaire sur TOUT le reste, quel que soit `status` — un visiteur qui clique ce lien
  // peut être signed-out, authenticated-but-no-access (nouveau compte, pas encore membre) ou
  // même déjà authorized (compte existant invité dans une 2e communauté) : dans les trois cas,
  // c'est InviteAccept.jsx qui décide de la suite, jamais Login/AccessUnavailable/App.
  const inviteMatch = typeof window !== 'undefined' ? window.location.pathname.match(INVITE_PATH) : null;
  if (inviteMatch && status !== 'loading-session') {
    return <InviteAccept token={inviteMatch[1]} />;
  }

  if (status === 'not-configured') {
    return <NotConfigured />;
  }
  if (status === 'loading-session' || status === 'authenticated-checking-membership') {
    return <LoadingScreen />;
  }
  if (status === 'signed-out') {
    return <Login />;
  }
  if (status === 'authenticated-but-no-access') {
    return <AccessUnavailable />;
  }
  // status === 'authorized'
  return <App activeCommunity={activeCommunity} memberships={memberships} />;
}
