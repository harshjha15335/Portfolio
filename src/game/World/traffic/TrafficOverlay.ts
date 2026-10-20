import * as THREE from 'three';
import { separation, type DriveState, type TrafficSpace } from './TrafficSafety';

/** Outline colours: what each envelope is doing this frame. */
const COLORS: Record<DriveState | 'person' | 'visitor' | 'parked', string> = {
  inactive: '#666666', spawning: '#8a8aff', cruising: '#3fd07a', following: '#9be05a', stopping: '#ffb43a', stopped: '#ff6a3a',
  'waiting-signal': '#ff3a3a', yielding: '#ff3ad0', exiting: '#8a8aff', person: '#ffe14a', visitor: '#ffffff', parked: '#4a6aa0',
};

/**
 * Developer overlay (`?debug&traffic`, dev builds only): every envelope in the shared traffic space drawn as a box
 * outline on the road, coloured by its driving state, plus a one-line summary for the debug readout. One line
 * buffer, rewritten each frame; nothing is allocated per vehicle.
 */
export class TrafficOverlay {
  readonly lines: THREE.LineSegments;
  private positions: Float32Array; private colors: Float32Array; private color = new THREE.Color();
  constructor(private capacity = 160) {
    const g = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 8 * 2 * 3); this.colors = new Float32Array(capacity * 8 * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lines.name = 'debug:traffic'; this.lines.renderOrder = 999; this.lines.frustumCulled = false;
  }
  /** Redraw from `space` (whose coordinates are offset by `originX` from the world) and return the summary line. */
  update(space: TrafficSpace, originX: number) {
    let n = 0, held = 0, interventions = 0, nearest = Infinity;
    const vehicles = space.entries.filter(e => e.category === 'vehicle' || e.category === 'ride');
    for (const e of space.entries.slice(0, this.capacity)) {
      const driver = space.drivers.get(e.id), state = driver?.state ?? (e.category === 'person' || e.category === 'visitor' || e.category === 'parked' ? e.category : 'cruising');
      if (driver && (state === 'stopped' || state === 'waiting-signal' || state === 'yielding')) held++;
      interventions += driver?.interventions ?? 0;
      this.color.set(COLORS[state]);
      const c = Math.cos(e.yaw), s = Math.sin(e.yaw), corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => {
        // Heading is -z at yaw 0 (the convention of the street's vehicles).
        const along = a * e.halfLength, across = b * e.halfWidth;
        return [e.x + originX - s * along + c * across, e.z - c * along - s * across];
      });
      for (const y of [.06, 1.2]) for (let k = 0; k < 4; k++) {
        const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4], i = n * 6;
        this.positions.set([x0, y, z0, x1, y, z1], i); this.colors.set([this.color.r, this.color.g, this.color.b, this.color.r, this.color.g, this.color.b], i); n++;
      }
    }
    for (let i = 0; i < vehicles.length; i++) for (let j = i + 1; j < vehicles.length; j++) nearest = Math.min(nearest, separation(vehicles[i], vehicles[j]));
    const g = this.lines.geometry; g.setDrawRange(0, n * 2); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    return `traffic ${vehicles.length} vehicles · ${held} held · closest gap ${Number.isFinite(nearest) ? nearest.toFixed(2) : '–'} m · ${interventions} interventions`;
  }
  dispose() { this.lines.geometry.dispose(); (this.lines.material as THREE.Material).dispose(); }
}
