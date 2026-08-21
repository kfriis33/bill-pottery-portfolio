// Ported from src/Graphwar/Obstacle.java. The Java version rasterizes
// obstacle circles into a java.awt.BufferedImage and does collision
// detection by reading pixel color; an HTML canvas + getImageData is the
// direct equivalent, so this is a close 1:1 port rather than a rewrite.
//
// Simplification: this only reproduces the circle count/size distribution
// (see randomCircles below), not any no-overlap placement — turns out
// neither does the real game (verified against generateCircles() in
// GraphServer.java: plain uniform-random placement, no spawn-clearing
// logic), so a circle landing on top of a soldier's spawn is a real
// upstream gap too, not just a port simplification. clearSpawnPoints below
// fixes it client-side after the fact instead, which works the same way
// whether the circles came from randomCircles() (sandbox) or a server
// broadcast (multiplayer, where terrain isn't ours to generate).

import {
  PLANE_LENGTH,
  PLANE_HEIGHT,
  CIRCLE_MEAN_RADIUS,
  CIRCLE_STANDARD_DEVIATION,
  NUM_CIRCLES_MEAN_VALUE,
  NUM_CIRCLES_STANDARD_DEVIATION,
  SOLDIER_RADIUS,
} from "./constants.js";

// Extra breathing room beyond just-not-touching, so a soldier doesn't spawn
// wedged right up against an obstacle's edge either.
const SPAWN_CLEARANCE_MARGIN = 8;

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Obstacle {
  // `hitsToDestroy` is only meaningful for teaching levels (see levels.js'
  // obstacleHitsToDestroy): null (the default) preserves today's behavior,
  // where a hit only ever punches a small cosmetic hole exactly where the
  // shot landed (via explodePoint) and a circle otherwise blocks forever.
  // When set, registerHit() additionally tracks a hit count per circle and
  // opens a real lane through the *entire* circle once it's exhausted, so a
  // straight line is never permanently walled off the way an unlucky single
  // hit could otherwise leave it.
  constructor(circles, { hitsToDestroy = null } = {}) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = PLANE_LENGTH;
    this.canvas.height = PLANE_HEIGHT;

    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, PLANE_LENGTH, PLANE_HEIGHT);

    this.ctx.fillStyle = "black";
    for (const circle of circles) {
      this.ctx.beginPath();
      this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.hitsToDestroy = hitsToDestroy;
    this.circles = circles.map((circle) => ({ ...circle, hp: hitsToDestroy, destroyed: false }));

    this.expX = 0;
    this.expY = 0;
    this.expRadius = 0;
  }

  static randomCircles() {
    let numCircles = Math.round(gaussianRandom() * NUM_CIRCLES_STANDARD_DEVIATION + NUM_CIRCLES_MEAN_VALUE);
    while (numCircles < 0) {
      numCircles = Math.round(gaussianRandom() * NUM_CIRCLES_STANDARD_DEVIATION + NUM_CIRCLES_MEAN_VALUE);
    }

    const circles = [];
    for (let i = 0; i < numCircles; i++) {
      const radius = Math.max(4, Math.round(gaussianRandom() * CIRCLE_STANDARD_DEVIATION + CIRCLE_MEAN_RADIUS));
      const x = Math.round(Math.random() * PLANE_LENGTH);
      const y = Math.round(Math.random() * PLANE_HEIGHT);
      circles.push({ x, y, radius });
    }

    return circles;
  }

  // Drops any circle that would overlap a soldier's spawn point (with a
  // small margin beyond just-not-touching). Applied identically on every
  // client to the same already-shared circle list — deterministic
  // filtering, not a different terrain layout, so nothing needs to go over
  // the wire to stay in sync in multiplayer.
  static clearSpawnPoints(circles, soldiers) {
    return circles.filter((circle) =>
      soldiers.every((soldier) => {
        const dx = soldier.x - circle.x;
        const dy = soldier.y - circle.y;
        const clearance = circle.radius + SOLDIER_RADIUS + SPAWN_CLEARANCE_MARGIN;
        return dx * dx + dy * dy >= clearance * clearance;
      }),
    );
  }

  collidePoint(x, y) {
    if (x < 0 || x >= PLANE_LENGTH) return true;
    if (y < 0 || y >= PLANE_HEIGHT) return true;

    const [r, g, b] = this.ctx.getImageData(x, y, 1, 1).data;
    return !(r === 255 && g === 255 && b === 255);
  }

  setExplosion(x, y, radius) {
    this.expX = x;
    this.expY = y;
    this.expRadius = radius;
  }

  explodePoint() {
    this.ctx.fillStyle = "white";
    this.ctx.beginPath();
    this.ctx.arc(this.expX, this.expY, this.expRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Finds the live circle (if any) containing (x, y), decrements its hit
  // count, and once it reaches 0 clears that circle's entire area — not
  // just the small explosion-radius hole explodePoint() already punched.
  // No-op when this Obstacle wasn't built with hitsToDestroy.
  registerHit(x, y) {
    if (this.hitsToDestroy === null) return;

    for (const circle of this.circles) {
      if (circle.destroyed) continue;

      const dx = x - circle.x;
      const dy = y - circle.y;
      if (dx * dx + dy * dy > circle.radius * circle.radius) continue;

      circle.hp -= 1;
      if (circle.hp <= 0) {
        circle.destroyed = true;
        this.ctx.fillStyle = "white";
        this.ctx.beginPath();
        this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
      break;
    }
  }

  getCanvas() {
    return this.canvas;
  }
}
