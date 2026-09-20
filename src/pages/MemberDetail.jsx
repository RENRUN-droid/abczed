import { ArrowLeft, MessageCircle, Phone, Send, Mail } from 'lucide-react';
import { INK, MUTED, CARD_BORDER, SECTION_THEMES, FONT_DISPLAY } from '../theme';
import { MEMBERS, childrenOf } from '../data';

// Delta §19 : `phone_number`/`email` uniques sur le membre + flags de partage indépendants
// (`share_whatsapp`/`share_phone`/`share_sms`/`share_email`) — remplace l'ancien modèle où
// chaque canal avait sa propre paire {value, shared}, ce qui pouvait faire diverger un même
// numéro selon le canal sans raison. `valueField` dit où lire la donnée réelle, `shareFlag`
// dit si CE canal précis est autorisé à l'afficher.
const CONTACT_METHODS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, shareFlag: 'share_whatsapp', valueField: 'phone_number', href: (v) => `https://wa.me/${v.replace(/[^\d+]/g, '').replace('+', '')}` },
  { key: 'phone', label: 'Téléphone', icon: Phone, shareFlag: 'share_phone', valueField: 'phone_number', href: (v) => `tel:${v.replace(/\s/g, '')}` },
  { key: 'sms', label: 'SMS', icon: Send, shareFlag: 'share_sms', valueField: 'phone_number', href: (v) => `sms:${v.replace(/\s/g, '')}` },
  { key: 'email', label: 'E-mail', icon: Mail, shareFlag: 'share_email', valueField: 'email', href: (v) => `mailto:${v}` },
];

// Note (delta §18) : ce composant ne reçoit plus jamais memberId === 'mem-vous' — App.jsx
// (fonction openMember) intercepte ce cas en amont et ouvre la modale Mon profil à la place,
// pour ne jamais présenter ses propres coordonnées comme celles d'un tiers ("Contacter Vous").
export default function MemberDetail({ memberId, onBack }) {
  const member = MEMBERS.find((m) => m.id === memberId);
  if (!member) return null;
  const kids = childrenOf(member);
  const sharedContacts = CONTACT_METHODS.filter((c) => member[c.shareFlag] && member[c.valueField]);

  return (
    <div className="page-shell" style={{ paddingTop: 18, '--section-accent': SECTION_THEMES.labande.color }}>
      {/* Delta §3/§17 : header de détail à 3 zones — la flèche et "Fiche parent" étaient dans
          un même bloc aligné à gauche alors que le reste de la fiche suit un axe central ;
          le titre est maintenant mathématiquement centré, indépendamment de la largeur de la
          flèche (zone gauche/droite de largeur fixe et symétrique). */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={onBack} aria-label="Retour" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}>
          <ArrowLeft size={20} color={INK} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT_DISPLAY, textAlign: 'center' }}>Fiche parent</span>
        <span aria-hidden="true" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: member.avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
          {member.firstName.slice(0, 1)}
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: INK }}>{member.firstName} {member.lastName}</div>
        {kids.length > 0 && (
          <div style={{ fontSize: 14, color: MUTED, marginTop: 4, textAlign: 'center' }}>
            {kids.map((c) => `${c.label} de ${c.firstName} · ${c.groupLabel}`).join(' — ')}
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: INK, margin: '0 0 10px' }}>Contacter {member.firstName}</div>

      {sharedContacts.length === 0 ? (
        <div style={{ background: '#F1F1EF', borderRadius: 14, padding: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: MUTED, margin: 0 }}>{member.firstName} n'a pas partagé de coordonnées de contact.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sharedContacts.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                disabled
                title="Désactivé tant qu'aucun service de messagerie/téléphonie réel n'est branché — pour éviter d'appeler ou d'écrire à un vrai numéro par erreur"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                  background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: '13px 16px', minHeight: 48,
                  opacity: 0.55, cursor: 'not-allowed',
                }}
              >
                <Icon size={18} color={MUTED} />
                <span style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{c.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Correction post-livraison : limitation fonctionnelle réelle et actuelle, pas un texte
          de développement — reste visible en production tant qu'elle est vraie. */}
      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 16, lineHeight: 1.4 }}>
        Ces boutons restent volontairement inactifs tant qu'aucun service de messagerie/téléphonie réel n'est branché à ABCZed — pas de vrai numéro à risquer d'appeler.
        Une fois branchés, ils ouvriront l'application externe correspondante (WhatsApp, téléphone, SMS, e-mail) ;
        aucune messagerie n'est stockée dans ABCZed.
      </p>
    </div>
  );
}
