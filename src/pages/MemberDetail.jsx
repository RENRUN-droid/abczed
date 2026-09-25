import { useState } from 'react';
import { ArrowLeft, MessageCircle, Phone, Send, Mail } from 'lucide-react';
import { INK, MUTED, CARD_BORDER, SECTION_THEMES, FONT_DISPLAY, buttonStyle } from '../theme';
import { childrenOf } from '../data';
import ConfirmDialog from '../components/ConfirmDialog';
import Avatar from '../components/Avatar';

// Delta §19 : `phone_number`/`email` uniques sur le membre + flags de partage indépendants
// (`share_whatsapp`/`share_phone`/`share_sms`/`share_email`) — remplace l'ancien modèle où
// chaque canal avait sa propre paire {value, shared}, ce qui pouvait faire diverger un même
// numéro selon le canal sans raison. `valueField` dit où lire la donnée réelle, `shareFlag`
// dit si CE canal précis est autorisé à l'afficher.
//
// V7.38 (25 sept.) — `tel:`/`sms:`/`mailto:` acceptent un numéro local (ex. "0693810788") sans
// problème : le téléphone qui ouvre le lien sait déjà dans quel pays il est. `wa.me` (WhatsApp)
// est différent : il exige le format international complet, SANS le 0 initial (ex.
// "262693810788"), sinon le lien ne résout aucune conversation. `normalizeForWhatsapp` ajoute
// l'indicatif +262 (La Réunion) uniquement pour ce lien-là, uniquement si le numéro est local (10
// chiffres commençant par 0) et ne contient pas déjà un indicatif — jamais pour tel:/sms:, et
// jamais en modifiant la donnée enregistrée elle-même (seulement le lien généré à l'affichage).
// Limite connue et acceptée : un numéro de mobile métropolitain tapé en format local (ex.
// "0612345678") sera à tort préfixé de +262 au lieu de +33 — cas rare dans une appli d'école à
// La Réunion, et la personne concernée peut contourner en tapant directement son numéro complet
// avec indicatif ("+33612345678"), auquel cas ce préfixage ne s'applique plus (voir la condition
// `!digits.startsWith('+')` ci-dessous).
function normalizeForWhatsapp(v) {
  const digits = v.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('0') && digits.length === 10) return `262${digits.slice(1)}`;
  return digits;
}

const CONTACT_METHODS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, shareFlag: 'share_whatsapp', valueField: 'phone_number', href: (v) => `https://wa.me/${normalizeForWhatsapp(v)}` },
  { key: 'phone', label: 'Téléphone', icon: Phone, shareFlag: 'share_phone', valueField: 'phone_number', href: (v) => `tel:${v.replace(/\s/g, '')}` },
  { key: 'sms', label: 'SMS', icon: Send, shareFlag: 'share_sms', valueField: 'phone_number', href: (v) => `sms:${v.replace(/\s/g, '')}` },
  { key: 'email', label: 'E-mail', icon: Mail, shareFlag: 'share_email', valueField: 'email', href: (v) => `mailto:${v}` },
];

// Note (delta §18) : ce composant ne reçoit plus jamais memberId === 'mem-vous' — App.jsx
// (fonction openMember) intercepte ce cas en amont et ouvre la modale Mon profil à la place,
// pour ne jamais présenter ses propres coordonnées comme celles d'un tiers ("Contacter Vous").
// Conséquence utile pour V7.30 ci-dessous : cette page ne montre donc JAMAIS la fiche de
// l'utilisateur courant — pas besoin de vérifier "est-ce moi ?" avant d'afficher le bouton
// "Retirer ce membre", ce cas est structurellement déjà exclu en amont.
// V7.18 : `members` reçu en prop (annuaire réel) — remplace l'import direct de MEMBERS.
// V7.30 (25 sept.) — "Retirer un membre" : `isAdmin`/`onRemoveMember` transmis par App.jsx.
// `onRemoveMember` seul (pas de flag séparé) : si absent (mode démo, MEMBERS_FROM_SUPABASE
// désactivé), le bouton ne s'affiche simplement pas plutôt que d'appeler une fonction inexistante.
export default function MemberDetail({ members, memberId, onBack, isAdmin, onRemoveMember }) {
  const member = members.find((m) => m.id === memberId);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
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
        {/* V7.34 — Avatar partagé : vraie photo si mise, sinon même cercle couleur+initiale. */}
        <div style={{ marginBottom: 12 }}>
          <Avatar avatarPath={member.avatarUrl} color={member.avatarColor} initials={member.firstName.slice(0, 1)} size={72} />
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
        // V7.37 (25 sept.) — coordonnées réelles : ces boutons étaient volontairement désactivés
        // (voir historique) tant que `phone_number`/`email` n'étaient que de la donnée de
        // démonstration — appeler un faux numéro par erreur. Maintenant que ce sont de vraies
        // coordonnées saisies par la personne elle-même (sql/13_coordonnees_contact.sql,
        // MyProfileSheet.jsx), ils redeviennent des liens natifs classiques (tel:/sms:/mailto:/
        // wa.me) : aucun service tiers à "brancher", le téléphone ouvre juste l'application
        // correspondante déjà installée.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sharedContacts.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.key}
                href={c.href(member[c.valueField])}
                className="tap-surface"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                  background: '#FFFFFF', border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: '13px 16px', minHeight: 48,
                  textDecoration: 'none',
                }}
              >
                <Icon size={18} color={MUTED} />
                <span style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{c.label}</span>
              </a>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: MUTED, marginTop: 16, lineHeight: 1.4 }}>
        Ces boutons ouvrent directement l'application correspondante sur votre téléphone (WhatsApp, téléphone, SMS ou e-mail)
        avec les coordonnées que {member.firstName} a choisi de partager. Aucune messagerie n'est stockée dans ABCZed.
      </p>

      {/* V7.30 — "Retirer ce membre" : admin uniquement. Cette page n'affiche jamais la fiche
          de l'utilisateur courant (voir la note en tête de fichier), donc pas de garde
          "pas moi-même" à ajouter ici — déjà garanti par App.jsx (openMember). */}
      {isAdmin && onRemoveMember && (
        <button
          onClick={() => setConfirmingRemove(true)}
          className="tap-surface"
          style={{ ...buttonStyle('destructive'), width: '100%', marginTop: 20 }}
        >
          Retirer {member.firstName} de la communauté
        </button>
      )}

      {confirmingRemove && (
        <ConfirmDialog
          title={`Retirer ${member.firstName} ?`}
          message={`${member.firstName} perdra immédiatement l'accès à cette communauté ABCZed (messages, partages, agenda). Cette action peut être annulée seulement en la ré-invitant plus tard.`}
          cautiousLabel="Annuler"
          confirmLabel="Retirer"
          confirmBusyLabel="Retrait…"
          busy={removing}
          onCautious={() => setConfirmingRemove(false)}
          onConfirm={async () => {
            setRemoving(true);
            try {
              await onRemoveMember(member.id);
              setConfirmingRemove(false);
              onBack();
            } finally {
              setRemoving(false);
            }
          }}
        />
      )}
    </div>
  );
}
