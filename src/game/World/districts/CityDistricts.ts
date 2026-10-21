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
  /** District for a zone index (1…7), complete; null for the CST–Fort street (index 0). A build in progress is finished now. */
  get(index: number) {
    if (index <= 0 || index >= cityZones.length) return null;
    const district = this.built.get(index) ?? this.create(index);
    this.settle(district, Infinity);
    return district;
  }
  /** The district for `index` if one exists, finished or not, without building anything. */
  peek(index: number) { return this.built.get(index) ?? null; }
  /** True when arriving at `index` needs no more building (the street, or a finished district). */
  isReady(index: number) { return index <= 0 || index >= cityZones.length || Boolean(this.built.get(index)?.ready); }
  /**
   * Show only `index`. Districts left behind are released so memory stays at one district, except the one being
   * prepared and `keep` (the district the visitor just walked out of along an avenue, which they may turn back to).
   */
  activate(index: number, keep = -1) {
    const active = this.get(index);
    for (const [i, d] of this.built) { if (i === index) d.setActive(true); else { d.setActive(false); if (i !== this.pending && i !== keep) { d.dispose(); this.built.delete(i); } } }
    if (index === this.pending) this.pending = -1;
    if (keep > 0 && this.built.has(keep)) this.pending = keep;
    return active;
  }
  /** Release every district but `index` and `keep` (once the visitor has left the avenue between them). */
  trim(index: number, keep = -1) {
    for (const [i, d] of this.built) if (i !== index && i !== keep) { d.dispose(); this.built.delete(i); if (i === this.pending) this.pending = -1; }
  }
  /** How many districts exist now (built or building). */
  get size() { return this.built.size; }
  private pending = -1;
  /** Start building a district ahead of arrival (a ride or jump towards it) without disposing the current one; `tick` continues it. */
  prepare(index: number) {
    if (index <= 0 || index >= cityZones.length) return;
    this.pending = index; if (!this.built.has(index)) this.create(index);
  }
  /** Spend about `budgetMs` of this frame on the district being prepared. */
  tick(budgetMs: number) { const district = this.built.get(this.pending); if (district) this.settle(district, budgetMs); }
  private announced = new WeakSet<District>();
  private create(index: number) {
    const zone = cityZones[index], district = new District(this.physics, this.surfaces, zone, DISTRICT_SPECS[zone.id], true);
    this.built.set(index, district); this.root.add(district.group); return district;
  }
  private settle(district: District, budgetMs: number) {
    if (district.step(budgetMs) && !this.announced.has(district)) { this.announced.add(district); this.onBuilt(district); }
  }
  /** Give every built district's crowd the licensed cast once it has loaded. */
  /** Rebuild built districts' traffic and parked vehicles with the modelled bodies once they have loaded. */
  refreshVehicles() { for (const d of this.built.values()) d.refreshVehicles(); }
  adoptCast(cast: DistrictCast) { for (const d of this.built.values()) { d.crowd.adopt(cast); d.traffic.adopt(cast); } }
  dispose() { for (const d of this.built.values()) d.dispose(); this.built.clear(); }
}
