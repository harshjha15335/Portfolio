import * as THREE from 'three';

/**
 * The pointer over the visitor's hailed taxi or auto, so they can tell which vehicle in the traffic is theirs: a small
 * downward triangle, drawn over everything (it shows through buildings and other vehicles) and grown a little with
 * distance so it can still be picked out down the street.
 */
export class CabPointer {
  readonly group = new THREE.Group();
  private readonly material: THREE.MeshBasicMaterial;
  constructor() {
    this.material = new THREE.MeshBasicMaterial({ color: '#ffc21a', transparent: true, opacity: .95, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.3, .55, 4), this.material); arrow.rotation.x = Math.PI;
    arrow.renderOrder = 999; arrow.frustumCulled = false;
    this.group.add(arrow); this.group.name = 'Hailed cab pointer'; this.group.visible = false;
  }
  /**
   * Show it over the vehicle at `target` whose roof is `roof` m up (seconds `time`), sized for a camera at `eye`;
   * it bobs and turns unless motion is reduced.
   */
  update(target: THREE.Vector3, roof: number, eye: THREE.Vector3, time: number, reduced: boolean) {
    // It fades out as the cab reaches the visitor, where it is plainly the one beside them.
    const distance = eye.distanceTo(target), scale = THREE.MathUtils.clamp(distance / 16, .8, 3);
    this.material.opacity = .95 * THREE.MathUtils.clamp((distance - 4) / 5, 0, 1);
    this.group.visible = this.material.opacity > 0;
    this.group.position.set(target.x, target.y + roof + .5 + scale * .28 + (reduced ? 0 : Math.sin(time * 3) * .08), target.z);
    this.group.scale.setScalar(scale); this.group.rotation.y = reduced ? Math.PI / 4 : time * 1.6;
  }
  hide() { this.group.visible = false; }
}
