/** Original teaching implementation of the pinned upstream convention.
 * Arbitrary point moments, atomic-unit-style dimensions; no molecular data or benchmark.
 * The singular origin is excluded, not silently softened. Q is symmetric/traceless.
 */
export function sampleMultipole(x:number,y:number,order:number){
 const r=Math.hypot(x,y);if(r<.3)return null;
 const p=.7,dot=p*x,qxx=-.4,qyy=.8,qrX=qxx*x,qrY=qyy*y,qrr=x*qrX+y*qrY;
 let potential=1/r,ex=x/r**3,ey=y/r**3;
 if(order>=1){potential+=dot/r**3;ex+=3*dot*x/r**5-p/r**3;ey+=3*dot*y/r**5;}
 if(order>=2){potential+=qrr/r**5;ex+=5*qrr*x/r**7-2*qrX/r**5;ey+=5*qrr*y/r**7-2*qrY/r**5;}
 return {potential,ex,ey};
}
