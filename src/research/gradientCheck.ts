/**
 * Fort research activity: which quadrupole field implementation is right?
 * The potential of a symmetric quadrupole is V = rᵀQr / r⁵, so E = −∇V = 5(rᵀQr) r / r⁷ − 2Qr / r⁵.
 * The FFprime contribution corrected exactly this factor of two (see the exhibition's third panel)
 * and added finite-difference gradient checks. The visitor runs the same kind of check here.
 * Teaching inputs only: arbitrary symmetric Q, no molecular data.
 */
import type { Tensor, Vec3 } from './stone';

export interface FieldCandidate { id: string; label: string; formula: string; field: (q: Tensor, r: Vec3) => Vec3 }

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mul = (q: Tensor, r: Vec3): Vec3 => [dot(q[0], r), dot(q[1], r), dot(q[2], r)];
const norm = (r: Vec3) => Math.hypot(r[0], r[1], r[2]);

export const quadrupolePotential = (q: Tensor, r: Vec3) => dot(r, mul(q, r)) / norm(r) ** 5;

const candidate = (a: number, b: number) => (q: Tensor, r: Vec3): Vec3 => {
  const n = norm(r), qr = mul(q, r), rqr = dot(r, qr);
  return [0, 1, 2].map(i => a * rqr * r[i] / n ** 7 - b * qr[i] / n ** 5) as Vec3;
};

/** Order is fixed; the correct one is deliberately not first. */
export const FIELD_CANDIDATES: FieldCandidate[] = [
  { id: 'missing-two', label: 'Implementation A', formula: 'E = 5(rᵀQr) r / r⁷ − Qr / r⁵', field: candidate(5, 1) },
  { id: 'wrong-power', label: 'Implementation B', formula: 'E = 3(rᵀQr) r / r⁷ − 2Qr / r⁵', field: candidate(3, 2) },
  { id: 'correct', label: 'Implementation C', formula: 'E = 5(rᵀQr) r / r⁷ − 2Qr / r⁵', field: candidate(5, 2) },
];
export const CORRECT_FIELD = 'correct';

/** Same arbitrary symmetric, traceless teaching tensor used elsewhere in the Fort exhibits. */
export const TEACHING_Q: Tensor = [[-.4, .15, .1], [.15, .8, -.2], [.1, -.2, -.4]];

/** Deterministic sample points away from the singular origin. */
export function samplePoints(count = 8, seed = 7): Vec3[] {
  let s = seed >>> 0; const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  return Array.from({ length: count }, () => {
    const theta = Math.acos(2 * rand() - 1), phi = 2 * Math.PI * rand(), radius = .8 + 1.6 * rand();
    return [radius * Math.sin(theta) * Math.cos(phi), radius * Math.sin(theta) * Math.sin(phi), radius * Math.cos(theta)] as Vec3;
  });
}

export interface CheckResult { candidate: string; maxRelativeError: number; passed: boolean; points: number; step: number }
/** Central differences of V against the candidate field (E = −∇V). Tolerance suits h = 1e-4 in double precision. */
export function finiteDifferenceCheck(candidate: FieldCandidate, q: Tensor = TEACHING_Q, points = samplePoints(), h = 1e-4, tolerance = 1e-6): CheckResult {
  let worst = 0;
  for (const r of points) {
    const e = candidate.field(q, r);
    for (let i = 0; i < 3; i++) {
      const plus = [...r] as Vec3, minus = [...r] as Vec3; plus[i] += h; minus[i] -= h;
      const numeric = -(quadrupolePotential(q, plus) - quadrupolePotential(q, minus)) / (2 * h);
      const scale = Math.max(1e-12, Math.hypot(...e), Math.abs(numeric));
      worst = Math.max(worst, Math.abs(numeric - e[i]) / scale);
    }
  }
  return { candidate: candidate.id, maxRelativeError: worst, passed: worst < tolerance, points: points.length, step: h };
}
