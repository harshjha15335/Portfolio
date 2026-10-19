import * as CANNON from 'cannon-es';

/**
 * The world is hundreds of static boxes and one moving visitor. Sweep-and-prune still walks every
 * overlapping static pair along its axis each step (it skips them only after the overlap test), which
 * grows with the square of the box count. Testing each awake dynamic body against every body is linear.
 */
export class VisitorBroadphase extends CANNON.NaiveBroadphase {
  constructor() { super(); this.useBoundingBoxes = true; }
  collisionPairs(world: CANNON.World, pairs1: CANNON.Body[], pairs2: CANNON.Body[]) {
    const bodies = world.bodies;
    for (const a of bodies) {
      if (a.type === CANNON.Body.STATIC || a.sleepState === CANNON.Body.SLEEPING) continue;
      for (const b of bodies) {
        // Two moving bodies are tested once, from the one listed first.
        if (b === a || (b.type !== CANNON.Body.STATIC && b.sleepState !== CANNON.Body.SLEEPING && b.id < a.id)) continue;
        if (this.needBroadphaseCollision(a, b)) this.intersectionTest(a, b, pairs1, pairs2);
      }
    }
  }
}
