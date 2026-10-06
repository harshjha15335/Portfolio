export interface DrivingInput { throttle: number; steer: number; handbrake: boolean }
export interface VehicleTuning { acceleration: number; braking: number; maxSpeed: number; reverseSpeed: number; steering: number; grip: number; driftGrip: number; friction: number }
export const defaultTuning: VehicleTuning = { acceleration: 15, braking: 25, maxSpeed: 22, reverseSpeed: 8, steering: 0.58, grip: 10, driftGrip: 1.65, friction: 1.15 };
export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export function steeringAngle(input: number, speed: number, tuning = defaultTuning): number {
  return clamp(input, -1, 1) * tuning.steering / (1 + Math.abs(speed) * 0.055);
}
export function longitudinalAcceleration(throttle: number, speed: number, handbrake: boolean, tuning = defaultTuning): number {
  const control = clamp(throttle, -1, 1);
  const braking = control * speed < -0.5;
  const limit = control >= 0 ? tuning.maxSpeed : tuning.reverseSpeed;
  const engine = braking ? control * tuning.braking : control * tuning.acceleration * clamp(1 - Math.abs(speed) / limit, 0, 1);
  const drag = speed * tuning.friction * (handbrake ? 1.25 : 0.11);
  return engine - drag;
}
export function lateralAcceleration(lateralSpeed: number, handbrake: boolean, tuning = defaultTuning): number {
  return clamp(-lateralSpeed * (handbrake ? tuning.driftGrip : tuning.grip), -35, 35);
}
export function turnRate(steer: number, forwardSpeed: number, handbrake: boolean, tuning = defaultTuning): number {
  // Steering reverses naturally in reverse; the upper bound prevents high-speed pirouettes.
  return clamp(Math.tan(steeringAngle(steer, forwardSpeed, tuning)) * forwardSpeed / 2.45 * (handbrake ? 1.16 : 1), -1.75, 1.75);
}
export function nearestLandmark(position: [number, number], landmarks: Array<{ id: string; position: [number, number] }>, radius = 13): string | null {
  let nearest: string | null = null;
  let distance = radius;
  for (const landmark of landmarks) {
    const current = Math.hypot(position[0] - landmark.position[0], position[1] - landmark.position[1]);
    if (current < distance) { nearest = landmark.id; distance = current; }
  }
  return nearest;
}
