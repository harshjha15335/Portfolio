/**
 * RideFlow route search, ported from harshjha15335/rideflow @ 83167f8:
 * - calculate_score / rank_routes: backend/app/services/routing_engine.py
 * - POST /routes/search and /routes/{id}/explanation: backend/app/main.py
 * - routes.json and locations.json: backend/data/
 * The backend validates that source and destination are present, then scores and ranks
 * the same three sample routes for every pair. The exhibit keeps that behaviour visible
 * instead of pretending the endpoints change the result.
 */
export const RIDEFLOW_COMMIT = '83167f8e18579652fc77a8d82ad30f4287eb1843';
export const rideflowSource = (path: string) => `https://github.com/harshjha15335/rideflow/blob/${RIDEFLOW_COMMIT}/${path}`;

type Level = 'High' | 'Medium' | 'Low';
export interface Route { routeId: string; name: string; summary: string; totalTime: number; totalFare: number; transfers: number; walkingDistance: number; carbonScore: Level; safetyScore: Level; reliability: Level; tag: string; score: number; mapPathPoints: { x: number; y: number }[] }
export type Preference = 'recommended' | 'fastest' | 'cheapest' | 'safest' | 'greenest';

export const LOCATIONS = ['Central Railway Station', 'Metro Central', 'City Bus Depot', 'Tech Park', 'University Campus', 'Airport Road'];

export const ROUTES: Route[] = [
  { routeId: 'RF-R1', name: 'Multi-Modal Green Link', summary: 'Walk → Bus → Metro → Auto', totalTime: 54, totalFare: 82, transfers: 2, walkingDistance: 650, carbonScore: 'Low', safetyScore: 'Medium', reliability: 'High', tag: 'Recommended', score: 78, mapPathPoints: [{ x: 120, y: 150 }, { x: 100, y: 180 }, { x: 280, y: 190 }, { x: 240, y: 200 }, { x: 480, y: 350 }] },
  { routeId: 'RF-R2', name: 'Transit Economizer', summary: 'Walk → Train → Bus → Walk', totalTime: 62, totalFare: 48, transfers: 2, walkingDistance: 900, carbonScore: 'Low', safetyScore: 'High', reliability: 'Medium', tag: 'Cheapest', score: 84, mapPathPoints: [{ x: 120, y: 150 }, { x: 70, y: 160 }, { x: 150, y: 110 }, { x: 180, y: 380 }, { x: 480, y: 350 }] },
  { routeId: 'RF-R3', name: 'Express Direct Combo', summary: 'Auto → Metro → Walk', totalTime: 45, totalFare: 120, transfers: 1, walkingDistance: 250, carbonScore: 'Medium', safetyScore: 'High', reliability: 'High', tag: 'Fastest', score: 81, mapPathPoints: [{ x: 120, y: 150 }, { x: 150, y: 120 }, { x: 240, y: 200 }, { x: 480, y: 350 }] },
];

export const EXPLANATIONS: Record<string, string> = {
  'RF-R1': 'This route is recommended because it offers the best balance of time, cost, transfers, and walking distance.',
  'RF-R2': 'This is the most eco-friendly and cheapest option, though it takes longer and requires more walking.',
  'RF-R3': 'This is the fastest route with the fewest transfers, ideal for urgent travel, but it is the most expensive.',
};

const RELIABILITY = { High: 20, Medium: 10, Low: 0 }, SAFETY = { High: 15, Medium: 8, Low: 0 };
const round2 = (n: number) => Math.round(n * 100) / 100;
/** calculate_score: higher is better. */
export function calculateScore(r: Route) {
  const time = Math.max(0, 100 - r.totalTime), fare = Math.max(0, 100 - r.totalFare);
  return { time: round2(.4 * time), fare: round2(.3 * fare), reliability: RELIABILITY[r.reliability], safety: SAFETY[r.safetyScore], total: round2(.4 * time + .3 * fare + RELIABILITY[r.reliability] + SAFETY[r.safetyScore]) };
}
const ORDER = { High: 3, Medium: 2, Low: 1 }, GREEN = { Low: 3, Medium: 2, High: 1 };
/** rank_routes: Python's sorted() is stable, and so is Array.prototype.sort. */
export function rankRoutes(routes: Route[], preference: Preference) {
  const by = (key: (r: Route) => number) => [...routes].sort((a, b) => key(a) - key(b));
  if (preference === 'fastest') return by(r => r.totalTime);
  if (preference === 'cheapest') return by(r => r.totalFare);
  if (preference === 'safest') return by(r => -ORDER[r.safetyScore]);
  if (preference === 'greenest') return by(r => -GREEN[r.carbonScore]);
  return by(r => -r.score);
}
/** POST /routes/search */
export function searchRoutes(source: string, destination: string, preference: Preference) {
  if (!source || !destination) return { status: 400 as const, detail: 'source and destination are required' };
  const scored = ROUTES.map(r => ({ ...r, score: calculateScore(r).total }));
  return { status: 200 as const, preference, routes: rankRoutes(scored, preference) };
}
