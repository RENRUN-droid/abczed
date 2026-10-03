import { useRef, useState } from 'react';
import { X, Copy, Trash2 } from 'lucide-react';
import { MUTED, CARD_BORDER, BLUE, RED, FONT_DISPLAY } from '../theme';
import { useModalA11y } from '../useModalA11y';
import { getDebugLogText, clearDebugLog } from '../debugLog';

// V7.68 (3 oct.) — feuille de lecture du journal de diagnostic (voir debugLog.js). Objectif
// unique : permettre à l'utilisatrice de copier le texte du journal ET de le coller directement
// dans le chat, sans ordinateur ni câble — même geste que le copier-coller de code déjà utilisé
// pour les fichiers. `navigator.clipboard` en premier essai ; repli sur la sélection manuelle du
// <textarea> (bouton "Copier" peut échouer sans HTTPS/permission — le texte reste toujours
// sélectionnable à la main dans ce cas, jamais une impasse).
export default function DebugLogSheet({ onClose }) {
  const [text, setText] = useState(() => getDebugLogText());
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed
  const panelRef = useRef(null);
  const textareaRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      textareaRef.current?.select();
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2500);
  }

  function refresh() {
    setText(getDebugLogText());
  }

  function clear() {
    clearDebugLog();
    setText(getDebugLogText());
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(23,32,51,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 70 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Journal de diagnostic" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Journal de diagnostic</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 10px' }}>
          Reproduis le problème (Partages → Fichier → choisis un document), reviens ici, touche
          "Actualiser", puis "Copier" et colle le texte dans le chat.
        </p>

        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          rows={12}
          style={{
            width: '100%', boxSizing: 'border-box', flex: 1, minHeight: 200, padding: 10, borderRadius: 10,
            border: `1px solid ${CARD_BORDER}`, fontSize: 11.5, fontFamily: 'monospace', background: '#F7F7F5',
            resize: 'none',
          }}
          onFocus={(e) => e.target.select()}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={refresh}
            className="tap-surface"
            style={{ flex: 1, minHeight: 46, borderRadius: 12, border: `1.5px solid ${CARD_BORDER}`, background: '#fff', color: MUTED, fontSize: 13, fontWeight: 700 }}
          >
            Actualiser
          </button>
          <button
            onClick={copy}
            className="tap-surface"
            style={{ flex: 1, minHeight: 46, borderRadius: 12, border: 'none', background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Copy size={15} />
            {copyState === 'copied' ? 'Copié !' : copyState === 'failed' ? 'Sélectionné — copie à la main' : 'Copier'}
          </button>
        </div>
        <button
          onClick={clear}
          className="tap-surface"
          style={{ marginTop: 8, minHeight: 40, borderRadius: 12, border: 'none', background: 'none', color: RED, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Trash2 size={13} /> Vider le journal
        </button>
      </div>
    </div>
  );
}
