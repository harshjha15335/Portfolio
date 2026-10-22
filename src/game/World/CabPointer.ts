import * as THREE from 'three';

/**
 * The pointer over the visitor's hailed taxi or auto, so they can tell which vehicle in the traffic is theirs: a
 * downward chevron under a halo, drawn over everything (it shows through buildings and other vehicles) and grown with
 * distance so it can still be picked out far down the street.
 */
export class CabPointer {
  readonly group = new THREE.Group();
  private readonly spin = new THREE.Group(); private readonly beam: THREE.Mesh; private readonly material: THREE.MeshBasicMaterial;
  constructor() {
    const material = this.material = new THREE.MeshBasicMaterial({ color: '#ffc21a', transparent: true, opacity: .95, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.3, .6, 4), material); arrow.rotation.x = Math.PI;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.4, .045, 6, 28), material); halo.rotation.x = Math.PI / 2; halo.position.y = .52;
    // A thin line from the chevron's tip down to the roof ties it to that one vehicle in a queue of traffic.
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), material); this.beam.position.y = -.5;
    for (const mesh of [arrow, halo, this.beam]) { mesh.renderOrder = 999; mesh.frustumCulled = false; }
    this.spin.add(arrow, halo); this.group.add(this.spin, this.beam); this.group.name = 'Hailed cab pointer'; this.group.visible = false;
  }
  /**
   * Show it over the vehicle at `target` whose roof is `roof` m up (seconds `time`), sized for a camera at `eye`;
   * it bobs and turns unless motion is reduced.
   */
  update(target: THREE.Vector3, roof: number, eye: THREE.Vector3, time: number, reduced: boolean) {
    // Grown with distance; it fades out as the cab reaches the visitor, where it is plainly the one beside them.
    const distance = eye.distanceTo(target), scale = THREE.MathUtils.clamp(distance / 10, .7, 6);
    this.material.opacity = .95 * THREE.MathUtils.clamp((distance - 4) / 5, 0, 1);
    const tip = roof + .5 + scale * .3 + (reduced ? 0 : Math.sin(time * 3) * .12);
    this.group.visible = this.material.opacity > 0; this.group.position.set(target.x, target.y + tip + scale * .3, target.z);
    this.spin.scale.setScalar(scale); this.spin.position.y = 0; this.spin.rotation.y = reduced ? Math.PI / 4 : time * 1.6;
    // The beam runs from just under the chevron's tip (scale × .3 below the group) to the roof.
    const top = -scale * .3, length = tip - roof; this.beam.scale.set(.03 * scale, length, .03 * scale); this.beam.position.y = top - length / 2;
  }
  hide() { this.group.visible = false; }
}
