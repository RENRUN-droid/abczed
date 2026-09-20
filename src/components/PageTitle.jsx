import { INK, SECTION_THEMES, TEXT } from '../theme';

// V7.14 : les valeurs de style ci-dessous sont désormais tirées de `TEXT.h1` (src/theme.js) —
// mêmes valeurs exactes qu'avant cette passe (32/820/-0.55/1.06), aucun changement visuel ;
// seule la source de vérité change, pour que les phases suivantes réutilisent `TEXT.h1` au
// lieu de recopier ces quatre nombres à la main s'il leur faut un titre de niveau équivalent.
export default function PageTitle({ section, children }) {
  const theme = SECTION_THEMES[section] || SECTION_THEMES.accueil;
  return (
    <div className="page-title" data-section={section} style={{ textAlign: 'center', margin: '2px 0 18px' }}>
      <h1
        style={{
          ...TEXT.h1,
          color: INK,
          margin: 0,
        }}
      >
        {children}
      </h1>
      <span
        aria-hidden="true"
        className="page-title-accent"
        style={{
          display: 'block', width: 34, height: 4, borderRadius: 999,
          background: theme.color, margin: '9px auto 0',
        }}
      />
    </div>
  );
}
