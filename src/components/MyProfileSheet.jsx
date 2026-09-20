import { useRef } from 'react';
import { X, LogOut } from 'lucide-react';
import { BLUE, MUTED, CARD_BORDER, FONT_DISPLAY } from '../theme';
import { MEMBERS, childrenOf } from '../data';
import { useAuth } from '../auth/AuthProvider';
import { useModalA11y } from '../useModalA11y';

// Delta §19 : flags de partage indépendants sur un numéro/e-mail uniques (voir data.js) —
// remplace les 4 paires {value, shared} par canal de l'ancien modèle. `LABELS` fait
// correspondre chaque case à cocher au flag qu'elle contrôle.
const LABELS = { share_whatsapp: 'WhatsApp', share_phone: 'Téléphone', share_sms: 'SMS', share_email: 'E-mail' };

// Correction post-livraison (contre-vérification indépendante) : les flags de partage sont
// désormais un état contrôlé, reçus en props (`shareFlags`/`onToggleShareFlag`) depuis App.jsx,
// qui ne démonte jamais — un useState local ici perdait silencieusement tout changement à
// chaque fermeture de la modale (ce composant est démonté/remonté via
// `{showMyProfile && <MyProfileSheet .../>}`).
export default function MyProfileSheet({ onClose, shareFlags, onToggleShareFlag }) {
  const { signOut } = useAuth();
  const me = MEMBERS.find((m) => m.id === 'mem-vous');
  const kids = childrenOf(me);
  // Brief pt 6/45 : Escape, clic hors modale, piège de focus, et retour du focus (+ repère
  // visuel) sur l'élément qui a ouvert cette modale (l'avatar du header ou la carte "Vous" de
  // La Bande, selon d'où on vient) — un seul mécanisme générique, voir useModalA11y.js.
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(23,32,51,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Mon profil" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Mon profil</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>
        {/* Lot consolidé UX/navigation (point 4) : reformulé — l'authentification Supabase est
            déjà réelle (voir auth/AuthProvider.jsx), donc "un seul compte est actif dans cette
            version" était trompeur. Ce qui reste réellement local, c'est la PERSISTANCE de ces
            4 cases (src/shareFlags.js, état levé dans App.jsx, pas encore un appel Supabase) —
            texte limité à cette vraie limitation, reste visible tant qu'elle est vraie. */}
        <p style={{ fontSize: 11.5, color: MUTED, margin: '0 0 16px', lineHeight: 1.4 }}>
          Ces préférences sont enregistrées uniquement pour cette session et ne sont pas encore synchronisées avec Supabase.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: me.avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
            {me.firstName.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{me.firstName}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>
              {kids.map((c) => `${c.label} de ${c.firstName} · ${c.groupLabel}`).join(' — ')}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#172033', margin: '0 0 4px' }}>
          Votre numéro et votre e-mail ne sont visibles par les autres membres que si vous choisissez de les partager ici.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
          {Object.keys(LABELS).map((key) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderBottom: `1px solid ${CARD_BORDER}`, minHeight: 44 }}>
              <span style={{ fontSize: 14 }}>Partager mon {LABELS[key].toLowerCase()} avec La Bande</span>
              <input type="checkbox" checked={shareFlags[key]} onChange={() => onToggleShareFlag(key)} style={{ width: 20, height: 20, accentColor: BLUE }} />
            </label>
          ))}
        </div>

        {/* Point 4 (recette réelle sur PC, audit transversal des couleurs) : "Se déconnecter"
            utilisait RED (#E53935 codé en dur, sans même importer le token) — RED est réservé
            à l'annulation/suppression dans le reste de l'app (annuler une participation,
            supprimer un partage) ; se déconnecter n'annule ni ne supprime rien, c'est une
            action neutre. La couleur RED sur un bouton aussi visible aurait laissé croire à
            une action destructrice qu'elle n'est pas. Style neutre (bordure/texte gris,
            cohérent avec CARD_BORDER/MUTED déjà utilisés dans cette même modale) à la place. */}
        <button
          onClick={signOut}
          className="tap-surface"
          style={{
            width: '100%', marginTop: 20, padding: '12px 0', borderRadius: 14, minHeight: 44,
            border: `1px solid ${CARD_BORDER}`, background: 'none', color: MUTED,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 14, fontWeight: 600,
          }}
        >
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
