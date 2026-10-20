// Minimal typings for the Node built-ins and admission script used by cast tests (no @types/node in this project).
declare module 'node:fs'{export function readFileSync(path:string):Uint8Array;}
declare module 'node:crypto'{export function createHash(algorithm:'sha256'):{update(bytes:Uint8Array):{digest(encoding:'hex'):string}};}
declare module '*/inspect-character.mjs'{export function inspectCharacter(bytes:Uint8Array):{triangles:number;lodTriangles:number;primitives:number;joints:number[];textures:unknown[]};}
declare module 'node:fs'{export function writeFileSync(path:string,data:string):void;}
declare const process:{env:Record<string,string|undefined>};
