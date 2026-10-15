/** Bounded real-time catch-up for fixed-step walking physics.
 * Rendering/NPC interpolation still uses the smaller visual delta. Fifteen 60Hz
 * steps cover up to 250ms; multi-second stalls remain capped, never one large step.
 */
export function walkingSimulationDelta(elapsed:number){return Number.isFinite(elapsed)&&elapsed>0?Math.min(elapsed,.25):0;}
