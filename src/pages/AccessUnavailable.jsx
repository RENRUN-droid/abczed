import { useAuth } from '../auth/AuthProvider';
import { BLUE, INK, MUTED, BG, FONT_DISPLAY } from '../theme';

export default function AccessUnavailable() {
  const { signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="max-w-md mx-auto" style={{ width: '100%', textAlign: 'center' }}>
        <img src="/abczed-logo-master.png" alt="ABCZed" style={{ height: 40, width: 'auto', marginBottom: 28 }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT_DISPLAY, color: INK, margin: '0 0 10px' }}>
          Accès indisponible
        </h1>
        {/* Volontairement générique — ne révèle ni communautés existantes ni raison précise. */}
        <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.5, margin: '0 0 28px' }}>
          Ce compte n'a actuellement accès à aucun espace ABCZed.
        </p>
        <button
          onClick={signOut}
          style={{
            padding: '12px 24px', borderRadius: 14, border: `1px solid ${BLUE}`, minHeight: 44,
            fontSize: 14.5, fontWeight: 600,
            background: 'none', color: BLUE, cursor: 'pointer',
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
