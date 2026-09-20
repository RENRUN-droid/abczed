// V7.14 — composant bouton partagé, construit sur `buttonStyle()` (src/theme.js), pour les
// phases suivantes qui n'ont pas besoin de composer le style à la main. Volontairement fin :
// aucune des pages existantes n'est réécrite pour l'utiliser dans cette passe (hors périmètre,
// voir MATRICE_LIVRAISON.md V7.14) — seuls les DEUX boutons rapides de l'Accueil (Accueil.jsx)
// l'utilisent déjà, comme preuve d'usage réelle plutôt que théorique.
//
// Applique automatiquement l'anneau de focus/le retour "pressé" déjà partagés par toute
// l'app via la classe CSS globale `.tap-surface` (voir le <style> de App.jsx) — aucun style
// de focus/pressed à redéfinir ici ni dans les composants qui l'utilisent.
import { buttonStyle } from '../theme';

export default function Button({
  variant = 'primary', color, onColor, compact, icon: Icon, iconSize = 17,
  children, style, className, as: Tag = 'button', ...rest
}) {
  const computed = buttonStyle(variant, { color, onColor, compact });
  return (
    <Tag
      className={['tap-surface', className].filter(Boolean).join(' ')}
      style={{ ...computed, ...style }}
      {...rest}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
    </Tag>
  );
}
