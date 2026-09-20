import { BG, INK, MUTED, FONT_DISPLAY } from '../theme';

// État distinct de "signed-out" : ici, ce n'est pas l'utilisateur qui n'est pas connecté,
// c'est le projet qui n'a pas de .env rempli. Un écran de connexion aurait été trompeur —
// il aurait toujours échoué, mais pour une raison invisible pour la personne qui l'utilise.
export default function NotConfigured() {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="max-w-md mx-auto" style={{ width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT_DISPLAY, color: INK, margin: '0 0 10px' }}>
          Configuration Supabase manquante
        </h1>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.5, margin: 0 }}>
          <code>VITE_SUPABASE_URL</code> et/ou <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> ne sont pas définis.
          Vérifie ton fichier <code>.env</code> (voir README, étape 5-6).
        </p>
      </div>
    </div>
  );
}
