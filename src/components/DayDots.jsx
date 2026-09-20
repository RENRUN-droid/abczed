import { CATEGORIES, MUTED } from '../theme';
import { distinctCategoriesOf } from '../agendaSearch';

// Règle verrouillée : jusqu'à 3 pastilles = une par CATÉGORIE présente ce jour-là (pas une
// par événement — plusieurs sorties le même jour ne doivent pas produire trois points verts
// identiques ; l'objectif est d'indiquer quelles catégories sont présentes, brief §12).
// À partir de la 4e catégorie (cas théorique, il n'y en a que 4 au total) = 3 points + "+".
export default function DayDots({ events }) {
  if (!events || events.length === 0) return <div style={{ height: 6 }} />;
  const categories = distinctCategoriesOf(events);
  const shown = categories.slice(0, 3);
  const hasMore = categories.length > 3;
  return (
    <div className="day-dots" aria-hidden="true" style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 8, alignItems: 'center' }}>
      {shown.map((cat) => (
        <span
          key={cat}
          data-category={cat}
          style={{ width: 6, height: 6, borderRadius: '50%', background: CATEGORIES[cat]?.color || CATEGORIES.autre.color }}
        />
      ))}
      {hasMore && (
        <span style={{ fontSize: 8, lineHeight: 1, color: MUTED, fontWeight: 700 }}>+</span>
      )}
    </div>
  );
}
