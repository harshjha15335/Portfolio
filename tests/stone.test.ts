import { describe, expect, it } from 'vitest';
import { ConventionError, cartesianDipolePotential, cartesianQuadrupolePotential, dipoleToCartesian, dipoleToSpherical, quadrupoleToCartesian, quadrupoleToSpherical, sphericalDipolePotential, sphericalQuadrupolePotential, type Tensor, type Vec3 } from '../src/research/stone';

// Values printed by theochem/ffprime @ 02ac79d (spherical.py / cartesian.py), run with NumPy 2.5.
const ref = {
  theta: [[0.4, 0.25, -0.3], [0.25, -1.1, 0.15], [-0.3, 0.15, 0.7]] as Tensor,
  p: [0.3, -0.5, 0.8] as Vec3,
  points: [[1.2, 0.4, -0.7], [-0.6, 1.5, 0.9]] as Vec3[],
  q: [0.7, -0.3464101615137755, 0.17320508075688776, 0.8660254037844387, 0.2886751345948129],
  dip: [0.8, 0.3, -0.5],
  Vq: [0.22217334603239444, -0.068653263790335],
  Vd: [-0.13238554332365063, -0.033203214851325644],
};

describe('Stone-convention multipoles (FFprime spherical.py port)', () => {
  it('converts like the upstream module', () => {
    quadrupoleToSpherical(ref.theta).forEach((v, i) => expect(v).toBeCloseTo(ref.q[i], 12));
    expect(dipoleToSpherical(ref.p)).toEqual(ref.dip);
  });
  it('round-trips both representations', () => {
    quadrupoleToCartesian(quadrupoleToSpherical(ref.theta)).forEach((row, a) => row.forEach((v, b) => expect(v).toBeCloseTo(ref.theta[a][b], 12)));
    expect(dipoleToCartesian(dipoleToSpherical(ref.p))).toEqual(ref.p);
  });
  it('direct spherical potentials equal the Cartesian ones and the upstream values', () => {
    ref.points.forEach((r, i) => {
      expect(sphericalQuadrupolePotential(quadrupoleToSpherical(ref.theta), r)).toBeCloseTo(ref.Vq[i], 12);
      expect(cartesianQuadrupolePotential(ref.theta, r)).toBeCloseTo(ref.Vq[i], 12);
      expect(sphericalDipolePotential(dipoleToSpherical(ref.p), r)).toBeCloseTo(ref.Vd[i], 12);
      expect(cartesianDipolePotential(ref.p, r)).toBeCloseTo(ref.Vd[i], 12);
    });
  });
  it('rejects tensors the upstream function rejects', () => {
    expect(() => quadrupoleToSpherical([[1, 0, 0], [0, 0, 0], [0, 0, 0]])).toThrow('quadrupole tensor must be traceless, got trace = 1.000000e+00');
    expect(() => quadrupoleToSpherical([[0, 1, 0], [0, 0, 0], [0, 0, 0]])).toThrow(/symmetric/);
  });
});
