import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { BLUE, RED, INK, MUTED, BG, CARD_BORDER, FONT_DISPLAY } from '../theme';
import Logo from '../components/Logo';

export default function Login() {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    await signIn(email.trim(), password);
    setSubmitting(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="max-w-md mx-auto" style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 10 }}><Logo size={38} /></div>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            <span style={{ color: BLUE, fontWeight: 600 }}>De A</span> à <span style={{ color: RED, fontWeight: 600 }}>Zed</span>
          </p>
        </div>

        {/* fontWeight 800 (au lieu de 820) : poids maximum de l'axe variable de Baloo 2 — voir
            le commentaire équivalent sur TEXT.h1 dans theme.js. */}
        <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: -0.35, color: INK, textAlign: 'center', margin: '0 0 6px' }}>
          Bienvenue
        </h1>
        <p style={{ fontSize: 14.5, color: MUTED, textAlign: 'center', margin: '0 0 28px' }}>
          Connectez-vous pour retrouver votre bande.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
              Adresse e-mail
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
              Mot de passe
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {error && (
            <p role="alert" style={{ fontSize: 13, color: RED, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password}
            style={{
              marginTop: 6, padding: '13px 0', borderRadius: 14, border: 'none', minHeight: 48,
              fontSize: 15, fontWeight: 750,
              background: BLUE, color: '#fff',
              opacity: (submitting || !email.trim() || !password) ? 0.6 : 1,
              cursor: (submitting || !email.trim() || !password) ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`,
  fontSize: 15, minHeight: 48, boxSizing: 'border-box',
};
