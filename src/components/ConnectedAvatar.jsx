// V7.11 (P1) — Avatar du membre connecté, dynamique : remplace le "V" figé en dur qui
// s'affichait auparavant pour n'importe quel compte (défaut confirmé en UAT réelle — A1 et A2
// affichaient tous deux la même lettre "V", sans rapport avec le compte réellement connecté).
//
// Réutilise `avatarColorFor`/`initialsOf` (src/avatarColor.js) TELS QUELS — mêmes fonctions
// déjà utilisées pour les avatars des messages (messagesApi.js) — jamais une nouvelle logique
// de couleur/initiales dupliquée ici. `displayName` doit venir de `members.display_name`
// (jamais d'un fragment d'e-mail, d'UUID, ni d'une valeur inventée) — c'est la responsabilité
// de l'appelant (voir AuthProvider.jsx, qui l'ajoute désormais à la lecture `members`).
//
// Repli neutre EXPLICITEMENT différent de tout avatar "chargé" (brief P1) : utilisé uniquement
// quand `displayName` est vide/absent (profil pas encore chargé, ou membre sans display_name
// enregistré) — jamais un "?" ni une lettre devinée, jamais un fragment d'e-mail. Mêmes
// dimensions que l'avatar chargé (`size`), fond gris neutre cohérent avec le thème existant,
// icône Lucide `UserRound`, libellé accessible "Profil non chargé" (texte EXACT demandé par le
// brief).
//
// V7.34 — `avatarPath` (nouveau prop optionnel) : chemin de la vraie photo dans le bucket privé
// `avatars` (AuthProvider.jsx, `activeCommunity.avatar_url`), délégué au composant partagé
// `Avatar` (résolution d'URL signée + repli couleur/initiale identique à avant si absent) —
// jamais dupliqué ici.
import { UserRound } from 'lucide-react';
import { avatarColorFor, initialsOf } from '../avatarColor';
import Avatar from './Avatar';

export default function ConnectedAvatar({ userId, displayName, avatarPath, size = 30, onClick, className, style }) {
  const hasProfile = Boolean((displayName || '').trim());
  const base = {
    width: Math.max(44, size),
    height: Math.max(44, size),
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    background: 'transparent',
    ...style,
  };
  const circle = {
    width: size, height: size, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
  const classes = ['tap-surface', 'icon-button', className].filter(Boolean).join(' ');

  if (!hasProfile) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Profil non chargé"
        title="Profil non chargé"
        className={classes}
        style={base}
      >
        <span style={{ ...circle, background: '#B9C0CC' }}>
          <UserRound size={Math.round(size * 0.58)} color="#fff" aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Mon profil"
      title="Mon profil"
      className={classes}
      style={base}
    >
      <Avatar avatarPath={avatarPath} color={avatarColorFor(userId)} initials={initialsOf(displayName)} size={size} />
    </button>
  );
}
