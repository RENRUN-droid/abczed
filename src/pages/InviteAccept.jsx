import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchInvitationPreview, acceptInvitation } from '../invitationsApi';
import { BLUE, RED, INK, MUTED, BG, CARD_BORDER, FONT_DISPLAY } from '../theme';
import Logo from '../components/Logo';
import PasswordField from '../components/PasswordField';

// V7.18 — page d'atterrissage d'un lien d'invitation (/invite/<token>), rendue par Root.jsx
// AVANT toute branche selon `status` (voir Root.jsx : un visiteur qui clique ce lien n'a, par
// définition, pas encore de session ni d'appartenance — le faire passer par Login/
// AccessUnavailable n'aurait aucun sens). États explicites, un seul rendu possible par état,
// même principe que Root.jsx/AuthProvider.jsx pour le reste de l'authentification :
// loading -> not-found | expired | ready (formulaire d'inscription) | wrong-account | success.
export default function InviteAccept({ token }) {
  // Backlog point 5 (24 sept.) : `signIn`/`authError` (renommé pour ne jamais entrer en
  // collision avec `error`/`setError`, l'état local déjà utilisé par le parcours d'inscription
  // ci-dessous) — chemin de connexion pour l'adresse invitée qui possède déjà un compte
  // confirmé. `signIn()` (AuthProvider.jsx) pose lui-même l'erreur générique "Identifiants
  // incorrects." dans ce champ de contexte, jamais renvoyée dans son retour (contrairement à
  // `signUp`) — même endroit déjà lu par Login.jsx, sans conflit possible : les deux pages ne
  // sont jamais montées en même temps.
  const { session, signUp, signIn, signOut, refreshMemberships, requestPasswordReset, error: authError } = useAuth();
  const [phase, setPhase] = useState('loading');
  const [invitation, setInvitation] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchInvitationPreview(token)
      .then((row) => {
        if (cancelled) return;
        if (!row) { setPhase('not-found'); return; }
        if (row.status === 'accepted') { setPhase('already-accepted'); setInvitation(row); return; }
        if (row.status === 'expired' || new Date(row.expires_at) < new Date()) { setPhase('expired'); setInvitation(row); return; }
        setInvitation(row);
        // Un compte déjà connecté (revient après avoir confirmé son e-mail, ou possède déjà un
        // compte ABCZed pour une autre communauté) : jamais un formulaire d'inscription à
        // nouveau — soit on peut accepter directement (email correspondant), soit on l'explique.
        if (session) {
          const sameEmail = (session.user.email || '').toLowerCase() === row.email.toLowerCase();
          setPhase(sameEmail ? 'ready-signed-in' : 'wrong-account');
        } else {
          setPhase('ready-signup');
        }
      })
      .catch(() => { if (!cancelled) setPhase('not-found'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // V7.19 (correctif recette du 23 septembre) — tant que cet onglet reste sur l'écran "Vérifie
  // ta boîte mail", confirmer l'e-mail se fait forcément AILLEURS (l'e-mail s'ouvre dans un
  // autre onglet, ou sur un autre appareil) : cet onglet-ci ne se recharge jamais tout seul.
  // Avant ce correctif, rien ici ne réagissait à l'arrivée d'une session — il fallait recharger
  // la page à la main (F5) pour que quoi que ce soit change, ce qui n'était pas du tout évident
  // pour l'utilisateur (défaut signalé en recette). `session` (AuthProvider.jsx) se met bien à
  // jour tout seul dès la confirmation — supabase-js synchronise la session entre onglets par
  // BroadcastChannel/stockage local — le problème n'a jamais été le manque de mise à jour de
  // `session`, seulement que CE COMPOSANT ne l'observait pas. On a déjà le prénom saisi au
  // moment de l'inscription (`displayName`, toujours en mémoire ici puisque l'onglet n'a jamais
  // été rechargé) : autant terminer l'adhésion tout de suite plutôt que de forcer un clic
  // "Rejoindre" supplémentaire une fois revenu sur l'onglet.
  // Volontairement restreint à la phase 'check-email' — jamais un effet général sur toute
  // valeur de `session`, qui écraserait à tort un écran déjà stable comme 'success' au moindre
  // rafraîchissement de jeton (événement TOKEN_REFRESHED, sans rapport avec l'invitation).
  useEffect(() => {
    if (phase !== 'check-email' || !session || !invitation) return;
    const sameEmail = (session.user.email || '').toLowerCase() === invitation.email.toLowerCase();
    if (!sameEmail) { setPhase('wrong-account'); return; }
    finishAcceptance(displayName.trim() || invitation.email.split('@')[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, phase, invitation]);

  // Backlog point 5 (24 sept.) — chemin "Se connecter" : `signIn()` ne renvoie qu'un booléen
  // (voir AuthProvider.jsx), jamais la session elle-même — celle-ci arrive de façon asynchrone
  // via onAuthStateChange, qui met à jour `session` un instant après. Une fois connecté avec la
  // même adresse que l'invitation, on rebascule simplement sur l'écran 'ready-signed-in' déjà
  // existant (celui affiché à un utilisateur qui arrivait déjà connecté) plutôt que de dupliquer
  // un écran de confirmation — même bouton "Rejoindre ABCZed", même fonction
  // `handleAcceptSignedIn`, aucune logique nouvelle à ce niveau. Restreint à la phase
  // 'ready-login' pour la même raison que l'effet 'check-email' ci-dessus : ne jamais réagir à
  // un `session` qui changerait pour une tout autre raison (rafraîchissement de jeton) pendant
  // qu'un autre écran, déjà stable, est affiché.
  useEffect(() => {
    if (phase !== 'ready-login' || !session || !invitation) return;
    const sameEmail = (session.user.email || '').toLowerCase() === invitation.email.toLowerCase();
    setPhase(sameEmail ? 'ready-signed-in' : 'wrong-account');
  }, [session, phase, invitation]);

  // V7.31 (25 sept.) — conséquence directe du correctif `emailRedirectTo` (voir handleSignUp
  // ci-dessous / signUp() dans AuthProvider.jsx) : le lien de confirmation reçu par e-mail peut
  // désormais ramener ICI-MÊME, dans un contexte de navigateur tout neuf (celui qui a ouvert le
  // lien) où AUCUNE inscription n'a jamais été commencée dans ce composant. Au premier rendu,
  // l'effet initial (fetchInvitationPreview, tout en haut) évalue `session` AVANT que le SDK
  // Supabase ait fini d'échanger le jeton présent dans l'URL — donc `session` y est encore nul,
  // et la phase retombe sur 'ready-signup' (formulaire de création de compte) alors que la
  // session arrive en réalité un instant après. Sans cet effet, l'écran resterait bloqué sur ce
  // formulaire malgré une session déjà active et confirmée — même symptôme, dans ce composant
  // cette fois, que le bug qui envoyait auparavant vers "Accès indisponible" (AccessUnavailable.jsx).
  // Même garde que les deux effets ci-dessus (restreint à UNE phase précise) pour ne jamais
  // réagir à un `session` qui changerait pour une autre raison pendant qu'un écran déjà stable
  // (ex. 'success') est affiché.
  useEffect(() => {
    if (phase !== 'ready-signup' || !session || !invitation) return;
    const sameEmail = (session.user.email || '').toLowerCase() === invitation.email.toLowerCase();
    setPhase(sameEmail ? 'ready-signed-in' : 'wrong-account');
  }, [session, phase, invitation]);

  async function finishAcceptance(name) {
    try {
      const result = await acceptInvitation(token, name);
      refreshMemberships();
      setInvitation((prev) => ({ ...prev, community_name: result?.joined_community_name || prev?.community_name }));
      setPhase('success');
    } catch (err) {
      setError(err.message || "Impossible de rejoindre la communauté — réessaie.");
      setPhase('error');
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (submitting || !displayName.trim() || !password) return;
    setSubmitting(true);
    setError('');
    // V7.31 — voir le commentaire détaillé sur signUp() (AuthProvider.jsx) : sans ça, le lien de
    // confirmation reçu par e-mail ramène vers la racine du site plutôt que sur CETTE invitation
    // précise, quel que soit l'endroit où il est ouvert (souvent différent de cet onglet-ci).
    const result = await signUp(invitation.email, password, `${window.location.origin}/invite/${token}`);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error === 'not-configured' ? "L'application n'est pas configurée." : result.error);
      return;
    }
    if (result.hasSession) {
      await finishAcceptance(displayName.trim());
    } else {
      // Confirmation d'e-mail activée sur ce projet Supabase — pas de session immédiate.
      setPhase('check-email');
    }
  }

  // Backlog point 5 (24 sept.) : contrairement à handleSignUp, aucune vérification de succès à
  // faire ici sur le retour de `signIn()` — un échec laisse `authError` renseigné par
  // AuthProvider.jsx ("Identifiants incorrects.", déjà affiché ci-dessous) et `session` ne
  // change simplement pas, donc l'effet 'ready-login' ci-dessus ne se déclenche pas ; un succès
  // fait le contraire (session mise à jour, effet déclenché) — pas de branchement ok/erreur à
  // gérer explicitement dans ce composant.
  async function handleLogin(e) {
    e.preventDefault();
    if (loginSubmitting || !loginPassword) return;
    setLoginSubmitting(true);
    await signIn(invitation.email, loginPassword);
    setLoginSubmitting(false);
  }

  // Signalé par l'utilisateur en recette (24 sept.) : le bouton "Mot de passe oublié ?" de
  // Login.jsx (V7.19, déjà résolu — point 2) n'existe que sur CET écran-là ; rien ne l'affiche
  // sur le nouvel écran de connexion de la page d'invitation, laissant sans issue quiconque a
  // oublié son mot de passe juste à ce moment précis. Même fonction `requestPasswordReset`
  // (AuthProvider.jsx) que Login.jsx, mais sans son champ e-mail à saisir : l'adresse est déjà
  // connue avec certitude (fixée par l'invitation), un seul geste suffit — pas de phase
  // intermédiaire "confirme avant l'envoi" ajoutée exprès pour ça, elle n'apporterait rien de
  // plus qu'un clic supplémentaire. Le lien reçu par e-mail ramène sur la racine du site (comme
  // pour Login.jsx — `redirectTo` de requestPasswordReset ne dépend jamais de la page
  // d'origine) : après avoir choisi un nouveau mot de passe là-bas, revenir sur CE lien
  // d'invitation (toujours valide, conservé) affiche alors directement "Rejoindre ABCZed"
  // (phase `ready-signed-in`, déjà existante) puisque la session sera active à ce moment-là.
  async function handleForgotPassword() {
    if (forgotSubmitting) return;
    setForgotSubmitting(true);
    setForgotError('');
    const result = await requestPasswordReset(invitation.email);
    setForgotSubmitting(false);
    if (!result.ok) {
      setForgotError(result.error === 'not-configured' ? "L'application n'est pas configurée." : result.error);
      return;
    }
    setPhase('ready-login-forgot-sent');
  }

  async function handleAcceptSignedIn() {
    setSubmitting(true);
    setError('');
    await finishAcceptance(session.user.user_metadata?.display_name || invitation.email.split('@')[0]);
    setSubmitting(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="max-w-md mx-auto" style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ marginBottom: 10 }}><Logo size={38} /></div>
        </div>

        {phase === 'loading' && (
          <p style={{ textAlign: 'center', color: MUTED, fontSize: 14.5 }}>Vérification de l'invitation…</p>
        )}

        {phase === 'not-found' && (
          <MessageCard title="Invitation introuvable" text="Ce lien est incorrect ou ne correspond à aucune invitation — vérifie que tu l'as copié en entier." />
        )}
        {phase === 'expired' && (
          <MessageCard title="Invitation expirée" text="Ce lien n'est plus valide — demande à l'administrateur de la communauté de t'en envoyer un nouveau." />
        )}
        {phase === 'already-accepted' && (
          <MessageCard title="Déjà rejoint" text="Cette invitation a déjà été acceptée. Connecte-toi normalement pour retrouver ta communauté." />
        )}

        {phase === 'wrong-account' && invitation && (
          <MessageCard
            title="Mauvais compte connecté"
            text={`Tu es actuellement connecté avec un autre compte que ${invitation.email}, l'adresse invitée. Déconnecte-toi puis rouvre ce lien.`}
          >
            <button onClick={signOut} style={secondaryButtonStyle}>Se déconnecter</button>
          </MessageCard>
        )}

        {phase === 'check-email' && invitation && (
          <MessageCard
            title="Vérifie ta boîte mail"
            text={`Un e-mail de confirmation vient d'être envoyé à ${invitation.email}. Ouvre-le et clique sur son lien pour confirmer ton adresse — reviens ensuite sur cet onglet : tu rejoindras alors automatiquement ${invitation.community_name}.`}
          />
        )}

        {phase === 'success' && invitation && (
          <MessageCard title="Bienvenue !" text={`Tu fais maintenant partie de ${invitation.community_name}.`}>
            <button onClick={() => { window.location.href = '/'; }} style={primaryButtonStyle}>Ouvrir ABCZed</button>
          </MessageCard>
        )}

        {phase === 'ready-signed-in' && invitation && (
          <MessageCard title="Rejoindre ABCZed" text={`Tu es connecté avec ${session.user.email}. Confirme pour rejoindre ABCZed.`}>
            {error && <p role="alert" style={{ fontSize: 13, color: RED, margin: '0 0 10px' }}>{error}</p>}
            <button onClick={handleAcceptSignedIn} disabled={submitting} style={primaryButtonStyle}>
              {submitting ? 'Un instant…' : 'Rejoindre ABCZed'}
            </button>
          </MessageCard>
        )}

        {phase === 'ready-signup' && invitation && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: -0.3, color: INK, textAlign: 'center', margin: '0 0 6px' }}>
              Tu es invité·e !
            </h1>
            <p style={{ fontSize: 14.5, color: MUTED, textAlign: 'center', margin: '0 0 28px' }}>
              Crée ton compte pour rejoindre <strong style={{ color: INK }}>{invitation.community_name}</strong>.
            </p>
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="invite-email" style={labelStyle}>Adresse e-mail</label>
                <input id="invite-email" type="email" value={invitation.email} disabled style={{ ...inputStyle, opacity: 0.7 }} />
              </div>
              <div>
                <label htmlFor="invite-name" style={labelStyle}>Ton prénom (affiché aux autres parents)</label>
                <input
                  id="invite-name" type="text" required autoComplete="name"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  disabled={submitting} style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="invite-password" style={labelStyle}>Choisis un mot de passe</label>
                <PasswordField
                  id="invite-password" required autoComplete="new-password" minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting} style={inputStyle}
                />
              </div>
              {error && <p role="alert" style={{ fontSize: 13, color: RED, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={submitting || !displayName.trim() || !password} style={primaryButtonStyle}>
                {submitting ? 'Création…' : 'Créer mon compte et rejoindre'}
              </button>
            </form>
            {/* Backlog point 5 : `signUp()` sur une adresse déjà titulaire d'un compte CONFIRMÉ
                réussit silencieusement côté Supabase (protection anti-énumération — voir
                AuthProvider.jsx), sans renvoyer d'erreur ni de session, ce qui affichait "Vérifie
                ta boîte mail" à tort alors qu'aucun e-mail n'était réellement envoyé. Impossible à
                détecter automatiquement avant coup — ce lien reste donc un choix manuel, visible
                d'emblée, pour qui sait déjà avoir un compte plutôt qu'une détection fiable. */}
            <button
              type="button"
              onClick={() => { setError(''); setPhase('ready-login'); }}
              style={{ ...linkButtonStyle, marginTop: 16 }}
            >
              Tu as déjà un compte avec {invitation.email} ? Se connecter
            </button>
          </>
        )}

        {phase === 'ready-login' && invitation && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: -0.3, color: INK, textAlign: 'center', margin: '0 0 6px' }}>
              Content de te revoir !
            </h1>
            <p style={{ fontSize: 14.5, color: MUTED, textAlign: 'center', margin: '0 0 28px' }}>
              Connecte-toi pour rejoindre <strong style={{ color: INK }}>ABCZed</strong>.
            </p>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label htmlFor="invite-login-email" style={labelStyle}>Adresse e-mail</label>
                <input id="invite-login-email" type="email" value={invitation.email} disabled style={{ ...inputStyle, opacity: 0.7 }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <label htmlFor="invite-login-password" style={{ fontSize: 13, fontWeight: 600, color: INK }}>Mot de passe</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={forgotSubmitting}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: BLUE, cursor: 'pointer', opacity: forgotSubmitting ? 0.6 : 1 }}
                  >
                    {forgotSubmitting ? 'Envoi…' : 'Mot de passe oublié ?'}
                  </button>
                </div>
                <PasswordField
                  id="invite-login-password" required autoComplete="current-password"
                  value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loginSubmitting} style={inputStyle}
                />
              </div>
              {authError && <p role="alert" style={{ fontSize: 13, color: RED, margin: 0 }}>{authError}</p>}
              {forgotError && <p role="alert" style={{ fontSize: 13, color: RED, margin: 0 }}>{forgotError}</p>}
              <button type="submit" disabled={loginSubmitting || !loginPassword} style={primaryButtonStyle}>
                {loginSubmitting ? 'Connexion…' : 'Se connecter et rejoindre'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setPhase('ready-signup'); }}
              style={{ ...linkButtonStyle, marginTop: 16 }}
            >
              Pas encore de compte ? Créer mon compte
            </button>
          </>
        )}

        {phase === 'ready-login-forgot-sent' && invitation && (
          <MessageCard
            title="Vérifie ta boîte mail"
            text={`Si un compte existe pour ${invitation.email}, un e-mail vient de lui être envoyé avec un lien pour choisir un nouveau mot de passe. Une fois ton nouveau mot de passe choisi, reviens sur ce lien d'invitation.`}
          >
            <button type="button" onClick={() => setPhase('ready-login')} style={secondaryButtonStyle}>
              Retour à la connexion
            </button>
          </MessageCard>
        )}

        {phase === 'error' && (
          <MessageCard title="Une erreur est survenue" text={error || "Réessaie dans un instant."} />
        )}
      </div>
    </div>
  );
}

function MessageCard({ title, text, children }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT_DISPLAY, color: INK, margin: '0 0 10px' }}>{title}</h1>
      <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.5, margin: '0 0 20px' }}>{text}</p>
      {children}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`,
  fontSize: 15, minHeight: 48,
};
const primaryButtonStyle = {
  width: '100%', marginTop: 6, padding: '13px 0', borderRadius: 14, border: 'none', minHeight: 48,
  fontSize: 15, fontWeight: 750, background: BLUE, color: '#fff', cursor: 'pointer',
};
const secondaryButtonStyle = {
  width: '100%', padding: '12px 0', borderRadius: 14, border: `1px solid ${BLUE}`, minHeight: 48,
  fontSize: 14.5, fontWeight: 600, background: 'none', color: BLUE, cursor: 'pointer',
};
const linkButtonStyle = {
  width: '100%', padding: '4px 0', border: 'none', background: 'none', minHeight: 32,
  fontSize: 13.5, fontWeight: 600, color: BLUE, cursor: 'pointer', textAlign: 'center',
};
