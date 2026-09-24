import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BLUE, RED, MUTED, CARD_BORDER, SECTION_THEMES, FONT_DISPLAY } from '../theme';
import { useModalA11y } from '../useModalA11y';

// "Le p'tit billet" (Accueil) — édition réservée à l'administrateur (le bouton qui ouvre cette
// feuille n'existe déjà que pour lui côté Accueil.jsx, jamais revérifié ici : même principe que
// InviteParentSheet.jsx/La Bande, la vraie barrière est côté serveur, sql/10_billet.sql). Même
// patron de feuille que InviteParentSheet.jsx/AddShareSheet.jsx — un seul champ (texte libre,
// plusieurs paragraphes), pas de titre séparé : le billet est un seul bloc de texte, affiché
// tel quel (voir le correctif `white-space: pre-line` déjà posé sur Partages.jsx pour la même
// raison, dupliqué ici pour l'aperçu).
export default function EditBilletSheet({ initialContent, onSave, onClose }) {
  const [content, setContent] = useState(initialContent || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef(null);
  const textareaRef = useRef(null);
  const { onBackdropClick } = useModalA11y(panelRef, onClose);

  async function submit(e) {
    e.preventDefault();
    if (submitting || !content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await onSave(content.trim());
      onClose();
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer le billet — réessaie.");
      textareaRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onBackdropClick} style={{ position: 'fixed', inset: 0, background: 'rgba(23,32,51,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60, '--section-accent': SECTION_THEMES.accueil.color }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Modifier le p'tit billet" className="max-w-md mx-auto" style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT_DISPLAY }}>Le p'tit billet</span>
          <button onClick={onClose} aria-label="Fermer" className="tap-surface icon-button" style={{ background: 'none', border: 'none' }}><X size={20} /></button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13.5, color: MUTED, margin: '0 0 4px' }}>
            Ce texte remplace le billet actuellement affiché en haut de l'Accueil, pour tous les membres.
          </p>
          <div>
            <label htmlFor="billet-content" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Contenu du billet</label>
            <textarea
              id="billet-content" ref={textareaRef} required
              value={content} onChange={(e) => setContent(e.target.value)} disabled={submitting}
              rows={10}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${CARD_BORDER}`, fontSize: 14, lineHeight: 1.45, background: '#fff', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          {error && <p role="alert" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: RED }}>{error}</p>}
          <button
            type="submit" disabled={submitting || !content.trim()}
            style={{ marginTop: 4, padding: '13px 0', borderRadius: 14, border: 'none', fontSize: 14.5, fontWeight: 700, minHeight: 48, background: BLUE, color: '#fff', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Enregistrement…' : 'Publier ce billet'}
          </button>
        </form>
      </div>
    </div>
  );
}
