// Ported from src/Graphwar/Soldier.java. The idle-animation timing
// (isAnimating/endAnimation, used to randomly play a sprite fidget loop) is
// cosmetic and not part of combat logic, so it's left out of this port.

export class Soldier {
  constructor(x, y, team, color) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.color = color;
    this.angle = 0;

    this.alive = true;
    this.exploding = false;
    this.timeExplodingStarted = 0;
    this.killPosition = 0;

    this.function = "";
  }

  setExploding(exploding) {
    this.exploding = exploding;
    if (exploding) this.timeExplodingStarted = performance.now();
  }

  getTimeExploding() {
    return performance.now() - this.timeExplodingStarted;
  }
}
