// V7.14 (correctif UAT point 14) : petit système de confirmation, construit parce qu'aucun
// n'existait déjà dans le projet (vérifié avant d'écrire ce fichier — recherche de "toast"/
// "Toast" dans src/, aucun résultat) — pas une bibliothèque tierce, brief explicite ("garde
// simple, ce projet n'a pas de système de toast"). Conventions reprises de theme.js plutôt
// qu'inventées : `SHADOW_ELEVATED` (même niveau qu'une sheet/modale, cohérent — ce message
// doit nettement se détacher du contenu en dessous), `RADIUS_MD`, `TEXT.body`, `SPACING`.
//
// Auto-disparition après `duration` (3.2s par défaut) — assez long pour être lu, assez court
// pour ne jamais bloquer une action suivante. `role="status"` + `aria-live="polite"` : annoncé
// par un lecteur d'écran sans interrompre ce qu'il lisait déjà (contrairement à `role="alert"`,
// réservé aux erreurs qui doivent interrompre).
import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { INK, SHADOW_ELEVATED, RADIUS_MD, TEXT, SPACING } from '../theme';

export default function Toast({ message, onDismiss, duration = 3200 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: '50%', bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)', zIndex: 80,
        maxWidth: 'calc(100vw - 32px)', width: 'max-content',
        display: 'flex', alignItems: 'center', gap: SPACING.sm,
        background: INK, color: '#FFFFFF', borderRadius: RADIUS_MD,
        padding: `${SPACING.md}px ${SPACING.lg}px`, boxShadow: SHADOW_ELEVATED,
        fontSize: TEXT.body.fontSize, fontWeight: 700, lineHeight: 1.3,
      }}
    >
      <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
}
