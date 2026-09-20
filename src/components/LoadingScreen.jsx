import { BG, MUTED } from '../theme';

// Écran neutre utilisé pour loading-session ET authenticated-checking-membership —
// jamais de contenu ABCZed affiché tant que l'accès n'est pas confirmé.
export default function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/abczed-logo-master.png" alt="ABCZed" style={{ height: 36, width: 'auto', marginBottom: 14, opacity: 0.85 }} />
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Chargement…</p>
      </div>
    </div>
  );
}
