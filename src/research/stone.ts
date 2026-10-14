/**
 * Cartesian ↔ real spherical multipoles (Stone convention), ported from
 * theochem/ffprime @ 02ac79d, ffprime/electrostatics/spherical.py and cartesian.py:
 * dipole/quadrupole conversions, spherical_{dipole,quadrupole}_potential and the
 * Cartesian quadrupole_potential they must agree with. The upstream history of
 * spherical.py is Harsh's commits (Stone convention: d160e72). This is a TypeScript
 * teaching port, tested in tests/stone.test.ts against values from the Python module.
 */
import evidence from './evidence.json';

export const SPHERICAL_SOURCE = `https://github.com/theochem/ffprime/blob/${evidence.pinnedCommit}/ffprime/electrostatics/spherical.py`;
const SQRT3 = Math.sqrt(3);
export type Vec3 = [number, number, number];
export type Tensor = [Vec3, Vec3, Vec3];

/** dipole_cartesian_to_spherical: [Q10, Q11c, Q11s] = [pz, px, py] */
export const dipoleToSpherical = ([px, py, pz]: Vec3): Vec3 => [pz, px, py];
export const dipoleToCartesian = ([q10, q11c, q11s]: Vec3): Vec3 => [q11c, q11s, q10];

export class ConventionError extends Error {}
/** Python's `:.6e` formatting, so messages match the upstream ValueError text. */
const pyExp = (n: number) => n.toExponential(6).replace(/e([+-])(\d)$/, 'e$10$2');
/** quadrupole_cartesian_to_spherical, including its symmetry and trace checks. */
export function quadrupoleToSpherical(t: Tensor): [number, number, number, number, number] {
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (Math.abs(t[a][b] - t[b][a]) > 1e-10) throw new ConventionError('quadrupole tensor must be symmetric');
  const trace = t[0][0] + t[1][1] + t[2][2];
  if (Math.abs(trace) > 1e-10) throw new ConventionError(`quadrupole tensor must be traceless, got trace = ${pyExp(trace)}`);
  return [t[2][2], 2 / SQRT3 * t[0][2], 2 / SQRT3 * t[1][2], (t[0][0] - t[1][1]) / SQRT3, 2 / SQRT3 * t[0][1]];
}
/** quadrupole_spherical_to_cartesian */
export function quadrupoleToCartesian([q20, q21c, q21s, q22c, q22s]: number[]): Tensor {
  const h = SQRT3 / 2;
  return [
    [-q20 / 2 + h * q22c, h * q22s, h * q21c],
    [h * q22s, -q20 / 2 - h * q22c, h * q21s],
    [h * q21c, h * q21s, q20],
  ];
}

const norm = ([x, y, z]: Vec3) => Math.hypot(x, y, z);
/** quadrupole_potential (Cartesian): Θ:rr / r⁵ at displacement r. */
export function cartesianQuadrupolePotential(t: Tensor, r: Vec3) {
  let qrr = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) qrr += t[a][b] * r[a] * r[b];
  return qrr / norm(r) ** 5;
}
/** spherical_quadrupole_potential: the direct formula in Q_lm, no detour through Θ. */
export function sphericalQuadrupolePotential([q20, q21c, q21s, q22c, q22s]: number[], [x, y, z]: Vec3) {
  return (q20 * (z * z - .5 * (x * x + y * y)) + SQRT3 / 2 * q22c * (x * x - y * y) + SQRT3 * q22s * x * y + SQRT3 * q21c * x * z + SQRT3 * q21s * y * z) / norm([x, y, z]) ** 5;
}
export const cartesianDipolePotential = (p: Vec3, r: Vec3) => (p[0] * r[0] + p[1] * r[1] + p[2] * r[2]) / norm(r) ** 3;
export const sphericalDipolePotential = ([q10, q11c, q11s]: Vec3, [x, y, z]: Vec3) => (q11c * x + q11s * y + q10 * z) / norm([x, y, z]) ** 3;
