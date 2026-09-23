import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { BLUE, RED, INK, MUTED, BG, CARD_BORDER, FONT_DISPLAY } from '../theme';
import Logo from '../components/Logo';

// V7.19 — écran de changement de mot de passe, rendu par Root.jsx quand status ===
// 'password-recovery' (voir AuthProvider.jsx : atteint uniquement en ouvrant le lien reçu après
// "Mot de passe oublié ?" sur Login.jsx, jamais par une connexion normale). Une fois le nouveau
// mot de passe accepté, updatePassword() relance loadMemberships lui-même — Root.jsx bascule
// alors naturellement vers App/AccessUnavailable selon les adhésions du compte, sans action
// supplémentaire ici (même principe que InviteAccept.jsx après acceptation réussie).
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !password) return;
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await updatePassword(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error === 'not-configured' ? "L'application n'est pas configurée." : result.error);
    }
    // Succès : pas d'écran de confirmation séparé — le changement de `status` (loadMemberships,
    // déclenché par updatePassword) fait basculer Root.jsx directement vers l'app.
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="max-w-md mx-auto" style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 10 }}><Logo size={38} /></div>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: -0.3, color: INK, textAlign: 'center', margin: '0 0 6px' }}>
          Choisis un nouveau mot de passe
        </h1>
        <p style={{ fontSize: 14.5, color: MUTED, textAlign: 'center', margin: '0 0 28px' }}>
          Ce mot de passe remplacera l'ancien pour ton compte.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="reset-password" style={labelStyle}>Nouveau mot de passe</label>
            <input
              id="reset-password" type="password" autoComplete="new-password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              disabled={submitting} style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="reset-password-confirm" style={labelStyle}>Confirme le mot de passe</label>
            <input
              id="reset-password-confirm" type="password" autoComplete="new-password" required minLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              disabled={submitting} style={inputStyle}
            />
          </div>

          {error && (
            <p role="alert" style={{ fontSize: 13, color: RED, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !password || !confirm}
            style={{
              marginTop: 6, padding: '13px 0', borderRadius: 14, border: 'none', minHeight: 48,
              fontSize: 15, fontWeight: 750,
              background: BLUE, color: '#fff',
              opacity: (submitting || !password || !confirm) ? 0.6 : 1,
              cursor: (submitting || !password || !confirm) ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Enregistrement…' : 'Valider le nouveau mot de passe'}
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
