import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { BLUE, RED, INK, MUTED, BG, CARD_BORDER, FONT_DISPLAY } from '../theme';
import Logo from '../components/Logo';
import PasswordField from '../components/PasswordField';

// V7.19 — "mot de passe oublié" ajouté comme deux phases supplémentaires de CET écran plutôt
// que comme une page séparée dans Root.jsx : contrairement à ResetPassword.jsx (qui dépend d'un
// statut d'authentification à part entière, `password-recovery`, atteint uniquement en ouvrant
// le lien reçu par e-mail), la DEMANDE de réinitialisation se fait par un visiteur signed-out
// ordinaire — même principe de machine à états explicite que InviteAccept.jsx, mais qui n'a pas
// besoin de sortir de ce composant.
export default function Login() {
  const { signIn, requestPasswordReset, error } = useAuth();
  const [phase, setPhase] = useState('signin'); // signin | forgot | forgot-sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    await signIn(email.trim(), password);
    setSubmitting(false);
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setForgotError('');
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (!result.ok) {
      setForgotError(result.error === 'not-configured' ? "L'application n'est pas configurée." : result.error);
      return;
    }
    setPhase('forgot-sent');
  }

  if (phase === 'forgot' || phase === 'forgot-sent') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="max-w-md mx-auto" style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{ marginBottom: 10 }}><Logo size={38} /></div>
          </div>

          {phase === 'forgot' && (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: -0.3, color: INK, textAlign: 'center', margin: '0 0 6px' }}>
                Mot de passe oublié
              </h1>
              <p style={{ fontSize: 14.5, color: MUTED, textAlign: 'center', margin: '0 0 28px' }}>
                Indique ton adresse e-mail, on t'envoie un lien pour choisir un nouveau mot de passe.
              </p>
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="forgot-email" style={labelStyle}>Adresse e-mail</label>
                  <input
                    id="forgot-email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting} style={inputStyle}
                  />
                </div>
                {forgotError && (
                  <p role="alert" style={{ fontSize: 13, color: RED, margin: 0 }}>{forgotError}</p>
                )}
                <button type="submit" disabled={submitting || !email.trim()} style={primaryButtonStyle(submitting || !email.trim())}>
                  {submitting ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
                </button>
                <button type="button" onClick={() => { setPhase('signin'); setForgotError(''); }} style={secondaryButtonStyle}>
                  Retour à la connexion
                </button>
              </form>
            </>
          )}

          {phase === 'forgot-sent' && (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT_DISPLAY, color: INK, margin: '0 0 10px' }}>
                Vérifie ta boîte mail
              </h1>
              {/* Formulation volontairement conditionnelle ("si un compte existe") — même
                  logique anti-énumération que côté serveur (requestPasswordReset) : ne jamais
                  laisser deviner si l'adresse saisie correspond à un compte ABCZed ou non. */}
              <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.5, margin: '0 0 20px' }}>
                Si un compte existe pour {email.trim()}, un e-mail vient de lui être envoyé avec un lien pour choisir un nouveau mot de passe.
              </p>
              <button type="button" onClick={() => { setPhase('signin'); setForgotError(''); }} style={secondaryButtonStyle}>
                Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    );
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label htmlFor="login-password" style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                Mot de passe
              </label>
              <button
                type="button"
                onClick={() => { setPhase('forgot'); setForgotError(''); }}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: BLUE, cursor: 'pointer' }}
              >
                Mot de passe oublié ?
              </button>
            </div>
            <PasswordField
              id="login-password"
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

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 };
const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`,
  fontSize: 15, minHeight: 48, boxSizing: 'border-box',
};
const primaryButtonStyle = (disabled) => ({
  marginTop: 6, padding: '13px 0', borderRadius: 14, border: 'none', minHeight: 48,
  fontSize: 15, fontWeight: 750, background: BLUE, color: '#fff',
  opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
});
const secondaryButtonStyle = {
  padding: '12px 0', borderRadius: 14, border: `1px solid ${CARD_BORDER}`, minHeight: 48,
  fontSize: 14.5, fontWeight: 600, background: 'none', color: MUTED, cursor: 'pointer',
};
