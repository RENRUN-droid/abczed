import { useEffect, useState } from 'react';
import { getAvatarSignedUrl } from '../avatarApi';

// V7.34 — cercle d'avatar partagé : affiche la vraie photo si `avatarPath` est renseigné (résout
// une URL signée temporaire, le bucket `avatars` étant privé — voir src/avatarApi.js), sinon
// retombe sur EXACTEMENT le même rendu qu'avant cette version (aplat de couleur + initiale) —
// aucune régression visuelle pour qui n'a pas encore mis de photo. Un seul composant plutôt que
// dupliquer cette logique dans les 6 endroits qui affichaient un cercle avatar (en-tête, La
// Bande, fiche parent, Mon profil, Messages, en-tête compact).
export default function Avatar({ avatarPath, color, initials, size = 40, alt = '' }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!avatarPath) return undefined;
    getAvatarSignedUrl(avatarPath).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl);
    });
    return () => { cancelled = true; };
  }, [avatarPath]);

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }}
      />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : 'true'}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color, color: '#fff', fontSize: Math.max(10, Math.round(size * 0.38)), fontWeight: 700,
      }}
    >
      {initials}
    </span>
  );
}
