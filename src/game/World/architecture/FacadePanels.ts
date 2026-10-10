import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

/** Cached, authored through-openings; never evaluates CSG in the animation loop. */
export class FacadePanels {
  private cache = new Map<string, THREE.BufferGeometry>();
  window(_style: string) {
    // All current grammars share this opening topology; decoration varies outside the panel.
    const style="shared-through-window";
    if (this.cache.has(style)) return this.cache.get(style)!;
    const wall = new Brush(new THREE.BoxGeometry(2.64, 2.55, .54));
    const opening = new Brush(new THREE.BoxGeometry(1.54, 1.65, 1.2));
    wall.updateMatrixWorld(); opening.updateMatrixWorld();
    const evaluator = new Evaluator(); evaluator.useGroups = false;
    const result = evaluator.evaluate(wall, opening, SUBTRACTION);
    const geometry = result.geometry.clone(); geometry.computeBoundingSphere();
    for (const brush of [wall, opening, result]) { brush.disposeCacheData(); brush.geometry.dispose(); }
    this.cache.set(style, geometry); return geometry;
  }
  dispose() { this.cache.forEach(g=>g.dispose()); this.cache.clear(); }
}
