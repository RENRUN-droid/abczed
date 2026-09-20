import { BLUE, RED } from '../theme';

// V7.14 — correctif UAT point 1 : l'ancien symbole (cercle bleu décentré vers le bas + trois
// éclats rouges accrochés uniquement au tiers supérieur, entre ~10h et ~14h) lisait comme
// "amassé"/asymétrique plutôt que comme un vrai soleil. Redessiné en un cercle bleu centré
// (cx=cy=20, r=8) entouré de HUIT rayons rouges répartis à intervalles angulaires strictement
// égaux (45° : 0/45/90/135/180/225/270/315, mesurés depuis midi, sens horaire) — un vrai motif
// solaire, plus une pointe unique en haut.
//
// V7.17 — dernier ajustement demandé (retour utilisateur explicite, dernier point avant bêta) :
// le jeu visible entre le disque et les rayons devait être "davantage marqué", et les rayons
// eux-mêmes "un tout petit peu plus longs" et "un peu plus loin" du disque. Avant ce lot, chaque
// rayon commençait à r=10.5 (2.5 unités de jeu au-delà du disque, r=8) et s'arrêtait à r=15.5
// (longueur 5.0). Désormais : début à r=12 (4 unités de jeu, contre 2.5) et fin à r=17.5
// (longueur 5.5) — écart et longueur augmentés, mais modérément ("un tout petit peu"), pas
// redessinés en profondeur. Répartition angulaire (45° constant) et épaisseur de trait (3.2)
// inchangées — seule la géométrie radiale bouge. Revérifié géométriquement par
// scripts/test-design-system.mjs, qui n'impose qu'un jeu MINIMUM (≥1.5 unités, largement
// respecté) et une extension maximale restant dans le viewBox 40×40 (rayon max 20 depuis le
// centre) : extension réelle désormais 17.5 + 3.2/2 = 19.1, encore nettement à l'intérieur.
// `strokeLinecap="round"` conservé pour le rendu ludique/amical déjà en place. Le mot-symbole
// ABCZed (bloc `backgroundImage` ci-dessous) n'est pas concerné par ce correctif — pixel-
// identique à la version précédente, comme à chaque passe sur ce composant.
export default function Logo({ size = 30 }) {
  const wordmarkHeight = size * 0.68;
  // Zone exacte du mot-symbole dans le master 1520 × 460 : x=552, y=174, 924 × 194.
  // Le cadrage CSS évite toute réinterprétation des lettres ABCZed.
  const scale = wordmarkHeight / 194;
  return (
    <span
      role="img"
      aria-label="ABCZed"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(4, size * 0.18), height: size, flexShrink: 0 }}
    >
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block', overflow: 'visible' }}>
        <circle cx="20" cy="20" r="8" fill={BLUE} />
        <path
          d="M20 8L20 2.5 M28.49 11.51L32.37 7.63 M32 20L37.5 20 M28.49 28.49L32.37 32.37 M20 32L20 37.5 M11.51 28.49L7.63 32.37 M8 20L2.5 20 M11.51 11.51L7.63 7.63"
          fill="none"
          stroke={RED}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: 924 * scale,
          height: wordmarkHeight,
          backgroundImage: 'url(/abczed-logo-master.png)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${1520 * scale}px ${460 * scale}px`,
          backgroundPosition: `${-552 * scale}px ${-174 * scale}px`,
          flexShrink: 0,
        }}
      />
    </span>
  );
}
