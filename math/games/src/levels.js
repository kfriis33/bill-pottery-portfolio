// Extensible presets for teaching-focused rooms. A level bundles the
// constraints a pedagogical mode needs (allowed function shapes, visual
// scaffolding, obstacle durability) so adding a harder level later (e.g.
// quadratics) is just another entry here — nothing else needs to change
// structurally. `null` (no level selected) means unrestricted freeplay,
// today's default behavior everywhere.

export const LEVELS = [
  {
    id: 0,
    label: "Level 0: Lines only (grid on)",
    allowedKinds: ["linear"],
    showGrid: true,
    obstacleHitsToDestroy: 3,
    obstacleDensity: 0.5,
    obstacleRadiusScale: 0.6,
  },
  {
    id: 1,
    label: "Level 1: Lines only (no grid)",
    allowedKinds: ["linear"],
    showGrid: false,
    obstacleHitsToDestroy: 3,
    obstacleDensity: 0.5,
    obstacleRadiusScale: 0.6,
  },
];

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

// Default obstacle generation (see obstacle.js's randomCircles, and
// GraphServer.java's generateCircles for multiplayer) makes no attempt to
// leave firing lanes clear — fine for freeplay's curved functions, which
// can arc around a cluster, but a straight line has no such escape, so a
// level restricted to linear functions needs a lighter, smaller obstacle
// field. Applied identically on every client to the SAME already-shared
// circle list (client-generated in the sandbox, server-broadcast in
// multiplayer) — deterministic thinning, not a different obstacle layout,
// so nothing needs to go over the wire to stay in sync.
export function thinObstacles(circles, level) {
  if (!level) return circles;

  const density = level.obstacleDensity ?? 1;
  const radiusScale = level.obstacleRadiusScale ?? 1;
  const keepEvery = density > 0 ? Math.round(1 / density) : Infinity;

  return circles.filter((_, i) => i % keepEvery === 0).map((circle) => ({ ...circle, radius: circle.radius * radiusScale }));
}

// Rooms have no built-in "arbitrary state" broadcast, so level selection
// piggybacks on CHAT_MSG (see RoomClient.setLevel/_handleLine in
// roomClient.js) using this prefix to distinguish a level-sync message from
// a real chat line. Doesn't start with "-" (GraphServer.handleCommands only
// special-cases that prefix), so the server just relays it untouched like
// any other chat text.
export const LEVEL_SYNC_PREFIX = "@@LEVEL@@:";
