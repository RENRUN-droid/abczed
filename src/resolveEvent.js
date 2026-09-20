// Fonction pure unique pour résoudre un événement par id à partir de deux sources : les
// événements "live" (Supabase quand AGENDA_FROM_SUPABASE=true, sinon les mêmes données de
// démonstration) puis, en repli, les événements de démonstration (MOCK_EVENTS/EVENTS de
// data.js). Existe pour que TOUT endroit qui résout un événement par id partage exactement le
// même comportement — voir la 6e passe : `filteredEvent` (discussion liée) n'utilisait QUE la
// première source, sans ce repli, contrairement à `selectedEvent` qui l'avait déjà. Résultat :
// un événement encore mocké (ex. celui référencé par les messages/partages de démonstration,
// eux-mêmes non branchés sur Supabase) devenait introuvable dès que l'agenda réel ne le
// contenait pas — exactement le bug constaté en usage réel sur "Voir la discussion liée".
export function resolveEventById(liveEvents, mockEvents, id) {
  if (id == null) return null;
  return (
    liveEvents.find((e) => e.id === id)
    || mockEvents.find((e) => e.id === id)
    || null
  );
}
