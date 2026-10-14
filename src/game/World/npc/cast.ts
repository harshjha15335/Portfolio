import type {VerifiedGLB} from '../assets/GLBAssetLibrary';
/** One admitted, licensed character (see scripts/import-cast.mjs and docs/STREET_CAST.md). */
export interface CastMember {
 status:'candidate'|'approved';
 visualReview:null|{reviewer:string;date:string;notes:string};
 role:string;
 height:number;
 asset:VerifiedGLB;
 inspection:{triangles:number;primitives:number;joints:number[];textures:Array<{width:number;height:number;mimeType:string}>;clips:Array<{name:string;duration:number;channels:number}>};
}
/** Deterministic 0–1 value per placement, so phase/rate variety is stable between reloads. */
export function placementNoise(key:string){let h=2166136261;for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%10007)/10007;}
/** Walkers cycle through everyday commuters; the same base model never walks next to itself. */
export const WALKER_CAST=['office-man','shopper','commuter','office-woman','student','clerk'] as const;
export const STANDING_CAST=['clerk','commuter','office-woman','shopper'] as const;
export function loadable(member:CastMember|undefined,preview:boolean):member is CastMember{return Boolean(member&&(member.status==='approved'&&member.visualReview||preview));}
