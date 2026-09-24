import { useState } from 'react';
import { MUTED } from '../theme';

// V7.32 — champ mot de passe avec bouton "œil" (afficher/masquer), demandé explicitement par
// l'utilisatrice après le premier partage réel : jusqu'ici, chaque champ mot de passe (Login.jsx,
// InviteAccept.jsx ×2, ResetPassword.jsx ×2) était un <input type="password"> nu, sans aucun
// moyen de vérifier ce qu'on vient de taper avant de valider — source d'erreurs de frappe
// silencieuses, en particulier à la création du compte où rien ne les révèle avant le prochain
// essai de connexion. Un seul composant partagé plutôt que dupliquer la logique dans les 3
// pages : reçoit exactement les mêmes props qu'un <input> ordinaire (id/value/onChange/
// disabled/autoComplete/required/minLength/style) pour rester un remplacement direct, sans
// toucher à la logique des formulaires qui l'utilisent. État "visible/masqué" strictement local
// à chaque champ (jamais partagé entre deux champs différents, ex. mot de passe + confirmation
// sur ResetPassword.jsx).
export default function PasswordField({ id, value, onChange, disabled, autoComplete, required, minLength, style }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{ ...style, paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{
          position: 'absolute', right: 2, top: 0, bottom: 0, width: 42,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', padding: 0,
          color: MUTED, cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M10.6 5.2C11.05 5.07 11.52 5 12 5c7 0 11 7 11 7-.6 1.06-1.4 2.17-2.42 3.2M6.6 6.6C3.4 8.5 1 12 1 12s4 7 11 7c1.5 0 2.86-.33 4.06-.9"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M9.5 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.6-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
