// Choix provisoire V1 quand un compte a plusieurs adhésions actives — isolé dans cette
// fonction, et rien qu'ici, pour pouvoir être remplacé par un vrai sélecteur d'espace
// plus tard sans toucher à AuthProvider ni au reste du parcours d'authentification.
//
// Ce n'est PAS une règle métier ("la plus ancienne adhésion compte plus") — juste un tri
// stable et déterministe pour que le même compte retombe toujours sur le même choix tant
// qu'aucun sélecteur n'existe.
export function selectActiveCommunity(memberships) {
  if (!memberships || memberships.length === 0) return null;
  const sorted = [...memberships].sort((a, b) => a.community_id.localeCompare(b.community_id));
  return sorted[0];
}
