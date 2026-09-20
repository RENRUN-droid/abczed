import { useRef } from 'react';
import { X } from 'lucide-react';
import { BLUE, RED, INK, MUTED, buttonStyle, FONT_DISPLAY } from '../theme';
import { useModalA11y } from '../useModalA11y';

// V7.14 (phase 3, item 8) — confirmation générique pour toute action destructrice, EXTRAITE
// du patron déjà validé et en production dans EventDetail.jsx (`ConfirmCancelDialog`/
// `ConfirmDeleteEventDialog`, non touchés ici — EventDetail.jsx est hors périmètre de cette
// phase) plutôt que dupliqué à la main : même contrat visuel/interaction — titre, texte
// d'avertissement, `useModalA11y` (Escape, clic sur le fond, piège de focus Tab/Shift+Tab,
// retour de focus + repère visuel sur le déclencheur réel à la fermeture), l'option prudente
// ("Annuler"/"Conserver...") toujours PREMIÈRE dans l'ordre du DOM (donc premier élément
// focusable, focus initial), l'action destructive en second, protection anti double-soumission
// via `busy`. Réutilisable par tout futur écran qui a besoin d'une confirmation destructrice
// sans réinventer ce patron une troisième fois — Messages.jsx (suppression d'un message) est le
// premier appelant réel.
//
// Props :
//  - `title`, `message` : texte du dialogue.
//  - `cautiousLabel` (def. "Annuler"), `confirmLabel`/`confirmBusyLabel` : libellés des deux
//    boutons.
//  - `onCautious` : fermeture "sûre" (Escape, fond, X, ET le bouton prudent lui-même) — ne fait
//    jamais rien d'autre que fermer.
//  - `onConfirm` : action destructrice réelle, appelée UNIQUEMENT sur clic explicite du bouton
//    destructif.
//  - `busy` : désactive les deux boutons et remplace le libellé de confirmation (protection
//    contre le double-clic/double-soumission, même contrat que `deleteBusy`/`rsvpBusy`
//    ailleurs dans l'app — jamais une suppression optimiste).
export default function ConfirmDialog({
  title, message, cautiousLabel = 'Annuler', confirmLabel, confirmBusyLabel,
  onCautious, onConfirm, busy, titleId = 'confirm-dialog-title',
}) {
  const panelRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onCautious);

  return (
    <div
      onClick={onBackdropClick}
      style={{ position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 20 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 18, padding: '20px 18px 18px' }}
      >
        <div id={titleId} style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT_DISPLAY, marginBottom: 8, paddingRight: 28, color: INK }}>
          {title}
        </div>
        <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.4, margin: '0 0 18px' }}>{message}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Option prudente : premier élément focusable du panneau (focus initial donné par
              useModalA11y) et mise en avant visuellement (bouton plein). */}
          <button onClick={onCautious} disabled={busy} className={busy ? undefined : 'tap-surface'} style={buttonStyle('primary', { color: BLUE })}>
            {cautiousLabel}
          </button>
          {/* Option destructive : accessible mais délibérément en second plan visuellement. */}
          <button onClick={onConfirm} disabled={busy} className={busy ? undefined : 'tap-surface'} style={buttonStyle('destructive')}>
            {busy ? confirmBusyLabel : confirmLabel}
          </button>
        </div>
        <button
          onClick={onCautious}
          aria-label="Fermer"
          className="tap-surface"
          style={{
            position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: '50%',
            background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} color={INK} />
        </button>
      </div>
    </div>
  );
}
