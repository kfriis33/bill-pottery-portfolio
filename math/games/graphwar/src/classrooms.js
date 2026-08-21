// Hardcoded for now — no teacher accounts/roster/room-reservation system
// exists yet (that's real future work: auth, a database, a VPS
// reconfiguration). Each classroom is just a fixed room number, so
// students picking the same classroom land in the same room without
// browsing the public lobby list. A room fits up to MAX_PLAYERS
// (constants.js) total, split across two teams — fine for now, but this is
// the thing that'll need real per-classroom room *pools* once class sizes
// matter.
export const CLASSROOMS = [{ id: "russitano-holmes-k", label: "Mr. Russitano - Mr. Holmes - Mr. K", roomNum: 0 }];

export function getClassroom(id) {
  return CLASSROOMS.find((classroom) => classroom.id === id) ?? null;
}
