// Ported from src/Graphwar/Obstacle.java. The Java version rasterizes
// obstacle circles into a java.awt.BufferedImage and does collision
// detection by reading pixel color; an HTML canvas + getImageData is the
// direct equivalent, so this is a close 1:1 port rather than a rewrite.
//
// Simplification: the real game generates terrain server-side (in
// GraphServer, not ported here) with logic that keeps circles clear of
// soldier spawn points. This prototype only reproduces the circle
// count/size distribution (see randomCircles below), not the no-overlap
// placement — fine for a rendering/physics prototype, not for real terrain.

import {
  PLANE_LENGTH,
  PLANE_HEIGHT,
  CIRCLE_MEAN_RADIUS,
  CIRCLE_STANDARD_DEVIATION,
  NUM_CIRCLES_MEAN_VALUE,
  NUM_CIRCLES_STANDARD_DEVIATION,
} from "./constants.js";

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Obstacle {
  constructor(circles) {
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

  getCanvas() {
    return this.canvas;
  }
}
