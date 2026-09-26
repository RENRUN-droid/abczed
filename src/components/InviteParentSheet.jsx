import { useRef, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { BLUE, INK, MUTED, RED, CARD_BORDER, SECTION_THEMES, FONT_DISPLAY } from '../theme';
import { useModalA11y } from '../useModalA11y';
import { createInvitation, requestInvitation } from '../invitationsApi';

// V7.18 — remplace le bouton "Inviter un parent — bientôt disponible" de LaBande.jsx (désormais
// vraiment disponible). Même patron de feuille que AddShareSheet.jsx/CreateEventSheet.jsx.
// Un seul champ (e-mail) : le lien généré (sql/09_invitations.sql, createInvitation()) est fait
// pour être envoyé par l'admin lui-même (WhatsApp, SMS...) — ABCZed n'envoie aucun e-mail à sa
// place dans ce lot, il produit juste le lien à copier/coller.
// RÉVISION (2026-09-21) : plus de prop `invitedByUserId` — create_invitation() (sql/09) détermine
// l'appelant elle-même via auth.uid(), jamais une valeur transmise par le client.
//
// RÉVISION V7.46 (26 sept.) — jusqu'ici réservée à l'admin (LaBande.jsx la montrait derrière
// `isAdmin &&`, désormais ouverte à tout membre actif, voir ce fichier). Le libellé et le geste
// restent identiques pour l'admin (lien généré immédiatement, elle est déjà l'autorité de
// validation — se demander sa propre validation n'aurait aucun sens). Pour un parent non-admin,
// ce même formulaire ("Inviter un parent", jamais "parrainer" à l'écran) ne génère PLUS le lien
// directement : il crée une DEMANDE (requestInvitation, sql/17_invitation_requests.sql) que
// l'admin devra valider — le parent la retrouvera ensuite (avec le lien, une fois validée) dans
// son propre suivi ("Tes invitations", voir LaBande.jsx), pas ici dans cette feuille.
export default function InviteParentSheet({ communityId, isAdmin, onClose, onRequested }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [link, setLink] = useState('');
  const [requested, setRequested] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef(null);
  const emailRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  async function submit(e) {
    e.preventDefault();
    if (submitting || !email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      if (isAdmin) {
        const url = await createInvitation(communityId, email.trim());
        setLink(url);
      } else {
        await requestInvitation(communityId, email.trim(), name);
        setRequested(true);
        // V7.46 — App.jsx tient la liste "Tes invitations" (LaBande.jsx) : ce rechargement lui
        // signale la nouvelle demande immédiatement, sans attendre un cycle Realtime séparé (pas
        // de temps réel branché sur invitation_requests dans ce lot, volontairement — le volume
        // attendu, une poignée de demandes ponctuelles, ne le justifie pas).
        onRequested?.();
      }
    } catch (err) {
      setError(err.message || "Impossible d'envoyer la demande — réessaie.");
      emailRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (navigateur ancien, contexte non sécurisé) — le lien reste
      // affiché en clair et sélectionnable manuellement, jamais une action silencieusement ratée.
      setError("Copie automatique indisponible — sélectionne le lien manuellement.");
    }
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(23,32,51,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60, '--section-accent': SECTION_THEMES.labande.color }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Inviter un parent" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Inviter un parent</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        {requested ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13.5, color: MUTED, margin: 0 }}>
              Ta demande pour <strong style={{ color: INK }}>{email.trim()}</strong> a été envoyée à l'administrateur de la communauté. Une fois validée, tu retrouveras le lien à envoyer toi-même dans "Tes invitations" — tu seras prévenu·e.
            </p>
            <button onClick={onClose} style={{ padding: '11px 0', borderRadius: 14, border: `1px solid ${CARD_BORDER}`, background: 'none', fontSize: 13.5, fontWeight: 600, color: MUTED, minHeight: 44 }}>
              Fermer
            </button>
          </div>
        ) : !link ? (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13.5, color: MUTED, margin: '0 0 4px' }}>
              {isAdmin
                ? "Indique l'adresse e-mail du parent à inviter — un lien à lui envoyer toi-même (WhatsApp, SMS…) sera généré."
                : "Indique l'adresse e-mail du parent à inviter — ta demande sera d'abord soumise à l'administrateur de la communauté."}
            </p>
            <div>
              <label htmlFor="invite-parent-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Adresse e-mail</label>
              <input
                id="invite-parent-email" ref={emailRef} type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '10px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, fontSize: 14, background: '#fff' }}
              />
            </div>
            {/* V7.46 — champ nom optionnel, uniquement pour la demande d'un parent non-admin :
                c'est ce qui permet à l'admin de voir clairement "qui est parrainé" dans son écran
                de validation, pas seulement une adresse e-mail brute. Sans utilité pour le
                parcours admin (lien généré immédiatement, aucun écran de validation à traverser),
                donc pas affiché dans ce cas — jamais un champ inutile proposé à l'écran. */}
            {!isAdmin && (
              <div>
                <label htmlFor="invite-parent-name" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Prénom (optionnel, pour que l'administrateur sache qui c'est)</label>
                <input
                  id="invite-parent-name" type="text" autoComplete="off"
                  value={name} onChange={(e) => setName(e.target.value)} disabled={submitting}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '10px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, fontSize: 14, background: '#fff' }}
                />
              </div>
            )}
            {error && <p role="alert" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: RED }}>{error}</p>}
            <button
              type="submit" disabled={submitting || !email.trim()}
              style={{ marginTop: 4, padding: '13px 0', borderRadius: 14, border: 'none', fontSize: 14.5, fontWeight: 700, minHeight: 48, background: SECTION_THEMES.labande.color, color: '#fff', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? (isAdmin ? 'Génération…' : 'Envoi…') : (isAdmin ? 'Générer le lien d’invitation' : 'Envoyer la demande')}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13.5, color: MUTED, margin: 0 }}>
              Lien prêt pour <strong style={{ color: INK }}>{email.trim()}</strong> — copie-le et envoie-le toi-même à cette personne.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F1F1EF', border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
              <span style={{ flex: 1, fontSize: 12.5, color: INK, wordBreak: 'break-all' }}>{link}</span>
            </div>
            <button
              onClick={copyLink}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 14, border: 'none', fontSize: 14.5, fontWeight: 700, minHeight: 48, background: BLUE, color: '#fff' }}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? 'Copié !' : 'Copier le lien'}
            </button>
            {error && <p role="alert" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: RED }}>{error}</p>}
            <button onClick={onClose} style={{ padding: '11px 0', borderRadius: 14, border: `1px solid ${CARD_BORDER}`, background: 'none', fontSize: 13.5, fontWeight: 600, color: MUTED, minHeight: 44 }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
