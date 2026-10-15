import type {VerifiedGLB} from './GLBAssetLibrary';
export interface CharacterAdmission {
 status:'candidate'|'approved';
 visualReview:null|{reviewer:string;date:string;notes:string};
 asset:VerifiedGLB;
 provenance:Record<string,unknown>;
 inspection:{triangles:number;primitives:number;materials:number;joints:number[];textures:Array<{width:number;height:number;mimeType:string}>;clips:Array<{name:string;duration:number;channels:number}>;visualReviewRequired:string[]};
}
