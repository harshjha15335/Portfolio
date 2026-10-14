import type * as CANNON from 'cannon-es';
import type * as THREE from 'three';
import type { StreetMaterials } from '../StreetMaterials';
import { cityZones } from '../streetLayout';
import { District } from './District';
import { DISTRICT_SPECS } from './catalog';
import type { DistrictCast } from './DistrictCast';

/**
 * The seven districts beyond CST–Fort. Each is built the first time it is needed
 * (a ride towards it, a directory jump, a review pose) and only the active one is drawn
 * and simulated, so every district gets the whole render budget to itself.
 */
export class CityDistricts {
  private built = new Map<number, District>();
  constructor(private physics: CANNON.World, private surfaces: StreetMaterials, private root: THREE.Object3D, private onBuilt: (district: District) => void) {}
  /** District for a zone index (1…7); null for the CST–Fort street (index 0). */
  get(index: number) {
    if (index <= 0 || index >= cityZones.length) return null;
    let district = this.built.get(index);
    if (!district) {
      const zone = cityZones[index]; district = new District(this.physics, this.surfaces, zone, DISTRICT_SPECS[zone.id]);
      this.built.set(index, district); this.root.add(district.group); this.onBuilt(district);
    }
    return district;
  }
  /** Show only `index`; districts left behind are released so memory stays at one district. */
  activate(index: number) {
    const active = this.get(index);
    for (const [i, d] of this.built) { if (i === index) d.setActive(true); else if (i !== this.pending) { d.dispose(); this.built.delete(i); } }
    if (index === this.pending) this.pending = -1;
    return active;
  }
  private pending = -1;
  /** Build a district ahead of arrival (a ride towards it) without disposing the current one. */
  prepare(index: number) { if (index > 0) { this.pending = index; this.get(index); } }
  /** Give every built district's crowd the licensed cast once it has loaded. */
  adoptCast(cast: DistrictCast) { for (const d of this.built.values()) { d.crowd.adopt(cast); d.traffic.adopt(cast); } }
  dispose() { for (const d of this.built.values()) d.dispose(); this.built.clear(); }
}
