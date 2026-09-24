import { useAuth } from '../auth/AuthProvider';
import { BLUE, INK, MUTED, BG, FONT_DISPLAY } from '../theme';
import Logo from '../components/Logo';

// V7.32 — cette page affichait jusqu'ici le fichier image maître (/abczed-logo-master.png) tel
// quel, en entier, au lieu de passer par le composant <Logo/> utilisé partout ailleurs
// (Login.jsx, InviteAccept.jsx, ResetPassword.jsx). Or ce fichier maître contient encore, à
// gauche du mot "ABCZed", l'ancien symbole en deux blocs façon puzzle — remplacé depuis par
// l'icône soleil (V7.14/V7.17) mais jamais retiré du PNG lui-même : <Logo/> le sait et ne
// prélève dans ce fichier que la zone du mot-symbole (recadrage CSS), en dessinant l'icône
// soleil séparément — cette page-ci affichait le fichier brut, donc les deux blocs restaient
// visibles. C'est très exactement l'écran vu par Soizic lors du premier partage réel (avant le
// correctif V7.31 du lien de confirmation) — signalé deux fois par l'utilisatrice ("les 2 blocs
// puzzles qui faisaient le premier logo"). Aucune autre page ni icône (favicons/PWA) n'était
// concernée — déjà toutes propres, vérifié.
export default function AccessUnavailable() {
  const { signOut } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="max-w-md mx-auto" style={{ width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: 28 }}><Logo size={38} /></div>
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
