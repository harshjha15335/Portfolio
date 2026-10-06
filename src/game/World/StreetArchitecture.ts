export const WORLD_SEED = 'HARSH_MUMBAI_2026';
export function seededRandom(label: string) {
  let seed = 2166136261;
  for (const ch of `${WORLD_SEED}:${label}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return () => { seed += 0x6D2B79F5; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export type FacadeStyle = 'heritage' | 'chawl' | 'art-deco' | 'commercial';
export interface FacadeSpec { style: FacadeStyle; width: number; height: number; floors: number; floorHeight: number; color: string; setback: number; seed: string }
const styles: FacadeStyle[] = ['heritage', 'chawl', 'commercial', 'art-deco', 'heritage', 'commercial', 'chawl'];
const colors = ['#b9a48a', '#b5a18d', '#8b9c92', '#bd9989', '#c0b195', '#a39788', '#899a99'];
export function facadeSpec(side: number, index: number): FacadeSpec {
  const seed = `${side}:${index}`, random = seededRandom(seed);
  const style = styles[(index + (side > 0 ? 3 : 0)) % styles.length];
  const floors = [3, 4, 2, 3, 4, 3, 2][index];
  const floorHeight = style === 'heritage' ? 2.85 : 2.55;
  return { style, floors, floorHeight, width: 8.65 + random() * .45, height: 3.2 + floors * floorHeight, color: colors[(index + (side > 0 ? 2 : 0)) % colors.length], setback: index === 4 && side < 0 ? 0 : random() * .25, seed };
}
