import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTransitModel, animateTransit } from './TransitModel';
import { StreetMaterials, type Surface } from './StreetMaterials';
import { facadeSpec, seededRandom } from './StreetArchitecture';
import { pointAtDistance, routeLength } from './transit';

type Triple = [number, number, number];
export interface StreetInteraction { id: string; position: THREE.Vector3; label: string }


/** Original modular Mumbai-inspired CST/Fort lane. One art-directed vertical slice. */
export class MumbaiStreet {
  readonly group = new THREE.Group();
  readonly interactions: StreetInteraction[] = [];
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  private sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
  private materials = new Map<string, THREE.Material>();
  private statics: THREE.Mesh[] = [];
  private dynamicParts: THREE.Mesh[] = [];
  private dynamicBatches: Array<{ instance: THREE.InstancedMesh; meshes: THREE.Mesh[] }> = [];
  private motion: Array<(time: number) => void> = [];
  private surfaces = new StreetMaterials();
  private archGeometry = this.makeArch();
  private torsoGeometry = new THREE.CylinderGeometry(.19, .145, 1, 10);
  private leafGeometry = this.makeLeafCluster();
  private poolGeometry=new THREE.CircleGeometry(2.5,16);
  private contactGeometry = new THREE.CircleGeometry(1, 16);
  private contactMaterial = new THREE.MeshBasicMaterial({color: '#20272a', transparent:true, opacity:.16, depthWrite:false});
  private pedestrians: THREE.Group[] = [];
  private signAtlas: THREE.CanvasTexture;
  private signs: THREE.Mesh[] = [];
  private signIndex = 0;
  private signCanvas: HTMLCanvasElement;
  readonly facadeCount = 14;

  constructor(private physics: CANNON.World) {
    this.signCanvas = document.createElement('canvas'); this.signCanvas.width = 2048; this.signCanvas.height = 2048;
    this.signAtlas = new THREE.CanvasTexture(this.signCanvas); this.signAtlas.colorSpace = THREE.SRGBColorSpace;
    this.landscape();
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) this.facade(side, 4 - i * 9.5, i);
    this.station(); this.researchRoom(); this.streetDetails(); this.vegetation(); this.people(); this.traffic();
    this.signAtlas.needsUpdate = true; this.instanceStatics(); this.mergeSigns(); this.instancePedestrians();
  }
  private material(color: string, glow = false, wall = false, surface: Surface = 'solid') {
    return this.surfaces.get(color, glow ? 'glow' : wall ? 'plaster' : surface);
  }
  private shape(geometry: THREE.BufferGeometry, size: Triple, position: Triple, color: string, parent: THREE.Object3D = this.group, glow = false, wall = false, batch = true, surface: Surface = 'solid') {
    const mesh = new THREE.Mesh(geometry, this.material(color, glow, wall, surface)); mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = !glow && size[1] > .4; mesh.receiveShadow = !glow; parent.add(mesh); if (batch) this.statics.push(mesh); else this.dynamicParts.push(mesh); return mesh;
  }
  private box(size: Triple, position: Triple, color: string, solid = false, parent: THREE.Object3D = this.group, glow = false, wall = false, surface: Surface = 'solid') {
    const mesh = this.shape(this.boxGeometry, size, position, color, parent, glow, wall, true, surface);
    if (solid) {
      parent.updateWorldMatrix(true, false); const p = mesh.getWorldPosition(new THREE.Vector3());
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), position: new CANNON.Vec3(p.x, p.y, p.z) });
      const q = mesh.getWorldQuaternion(new THREE.Quaternion()); body.quaternion.set(q.x, q.y, q.z, q.w); this.physics.addBody(body);
    }
    return mesh;
  }
  private solidProxy(size:Triple,position:Triple,parent:THREE.Object3D) {
    parent.updateWorldMatrix(true,false);const p=new THREE.Vector3(...position).applyMatrix4(parent.matrixWorld),q=parent.getWorldQuaternion(new THREE.Quaternion());
    const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(size[0]/2,size[1]/2,size[2]/2)),position:new CANNON.Vec3(p.x,p.y,p.z)});body.quaternion.set(q.x,q.y,q.z,q.w);this.physics.addBody(body);
  }
  private cylinder(radius: number, height: number, position: Triple, color: string, parent: THREE.Object3D = this.group, glow = false) { return this.shape(this.cylinderGeometry, [radius, height, radius], position, color, parent, glow); }
  private wire(a: THREE.Vector3, b: THREE.Vector3, width = .024, color = '#242635', parent: THREE.Object3D = this.group) {
    const mesh = this.shape(this.cylinderGeometry, [width, a.distanceTo(b), width], a.clone().add(b).multiplyScalar(.5).toArray() as Triple, color, parent);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  private sign(parent: THREE.Object3D, english: string, local: string, position: Triple, width: number, bg = '#273e40', fg = '#eac992') {
    const index = this.signIndex++, col = index % 4, row = Math.floor(index / 4), x = col * 512, y = row * 128;
    const ctx = this.signCanvas.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(x, y, 512, 128); ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.strokeRect(x + 6, y + 6, 500, 116);
    ctx.textAlign = 'center'; ctx.fillStyle = fg; ctx.font = 'bold 29px Arial, sans-serif'; ctx.fillText(local, x + 256, y + 44, 480);
    ctx.font = 'bold 36px Arial, sans-serif'; ctx.fillText(english, x + 256, y + 94, 480);
    const geometry = new THREE.PlaneGeometry(width, width / 6);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 4, 1 - (row + 1 - uv.getY(i)) / 16);
    const key = 'sign-atlas';
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshBasicMaterial({ map: this.signAtlas, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geometry, this.materials.get(key)!); mesh.position.set(...position); parent.add(mesh); this.signs.push(mesh); return mesh;
  }
  private makeArch() {
    const shape = new THREE.Shape();
    shape.moveTo(-.95,0);shape.lineTo(-.95,.62);shape.absarc(0,.62,.95,Math.PI,0,true);shape.lineTo(.95,0);shape.lineTo(.76,0);shape.lineTo(.76,.62);shape.absarc(0,.62,.76,0,Math.PI,false);shape.lineTo(-.76,0);shape.closePath();
    return new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:false,curveSegments:12});
  }
  private makeLeafCluster() {
    const random=seededRandom('leaf-cluster');const pieces:THREE.BufferGeometry[]=[];
    for(let i=0;i<14;i++) {
      const leaf=new THREE.SphereGeometry(1,4,2);leaf.scale(.12+random()*.08,.028,.055+random()*.05);leaf.rotateY(random()*Math.PI);leaf.rotateZ(random()*.8-.4);leaf.translate((random()-.5)*.9,(random()-.5)*.3,(random()-.5)*.9);pieces.push(leaf);
    }
    const merged=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());return merged;
  }
  private contact(x:number,z:number,rx:number,rz:number,parent:THREE.Object3D=this.group) {
    const shadow=new THREE.Mesh(this.contactGeometry,this.contactMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.016,z);shadow.scale.set(rx,rz,1);parent.add(shadow);this.dynamicParts.push(shadow);
  }
  private landscape() {
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); this.physics.addBody(ground);
    this.box([100, .1, 150], [0, -.1, -26], '#585963');
    this.box([7.8, .04, 78], [0, -.02, -22], '#585b5d', false, this.group, false, false, 'asphalt');
    // Human-height physics floor stays flat; the pavement lip is deliberately low.
    for (const side of [-1, 1]) {
      this.box([2.8, .06, 75], [side * 5.3, .01, -22], '#afa392', false, this.group, false, false, 'paving');
      // Low, interrupted curb; broad visual ramps keep the existing flat collision floor stable.
      for(let z=-58;z<13;z+=1.7) this.box([2.5,.008,.025],[side*5.4,.045,z],'#726c62');
      for (let z = -58; z < 16; z += .85) this.box([.22, .12, .75], [side * 3.98, .055, z], Math.floor(z / 1.7) % 2 ? '#b69858' : '#32312e');
      // Keep the pedestrian inside the authored lane.
      this.box([1, 4, 82], [side * 19, 2, -22], '#3c404a', true);
    }
    this.box([38, 4, 1], [0, 2, -63], '#817d74', true);
    // End-of-lane workshop and layered skyline close the view instead of an empty wall.
    for(let i=0;i<7;i++){const h=9+(i%3)*4;this.box([5.8,h,5],[-18+i*6,h/2,-69-i%2*3],'#9d9a90',false,this.group,false,true);for(let y=3;y<h;y+=2.6)for(let x=0;x<3;x++)this.box([.8,1.2,.04],[-19.8+i*6+x*1.5,y,-66.45-i%2*3],'#626e6d');}
    for(let i=0;i<4;i++)this.box([3,.5,1.2],[-10+i*6,4.3,-62.4],'#aaa08f');
    this.box([38, 4, 1], [0, 2, 20], '#4d4b52', true);
    for (let z = -54; z < 12; z += 6) this.box([.08, .008, 2], [0, .005, z], '#a2997e');
    for (let i = 0; i < 8; i++) this.box([.55, .008, 2.4], [-3 + i * .85, .008, -12], '#aaa28b');
    for (const side of [-1, 1]) for (let z = -55; z < 10; z += 4.5) {
      this.box([.65, .013, .45], [side * 3.5, .012, z], '#282d34');
      for (let n = 0; n < 5; n++) this.box([.035, .015, .38], [side * 3.5 - .22 + n * .11, .02, z], '#53545a');
    }
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshStandardMaterial({ color: '#736172', transparent: true, opacity: .5, roughness: .35 }));
    puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.2, .38, 1); puddle.position.set(2.6, .014, -17); this.group.add(puddle);
  }
  private facade(side: number, z: number, index: number) {
    const spec=facadeSpec(side,index),random=seededRandom(spec.seed);
    const g=new THREE.Group();g.position.set(side*(7+spec.setback),0,z);g.rotation.y=side<0?Math.PI/2:-Math.PI/2;this.group.add(g);
    // Local constructors default to the building, so every decorative module inherits its placement.
    const frontageBox=(size:Triple,position:Triple,tint:string,solid=false,parent:THREE.Object3D=g,glow=false,wall=false,surface:Surface='solid')=>this.box(size,position,tint,solid,parent,glow,wall,surface);
    const {height,width,color,style}=spec;const fort=side<0&&index===4;
    // Rear mass provides simple collision. The visible face is built around actual window recesses.
    frontageBox([width,height-3.2,5.85],[0,3.2+(height-3.2)/2,-3.75],color,false,g,false,true);
    this.solidProxy([width,height-3.2,6.5],[0,3.2+(height-3.2)/2,-3.4],g);
    if(!fort) {
      frontageBox([width,3.2,5.85],[0,1.6,-3.75],color,false,g,false,true);
      this.solidProxy([width,3.2,6.5],[0,1.6,-3.4],g);
      for(const x of [-2.15,2.15]) {
        frontageBox([3.7,2.35,.09],[x,1.23,-.6],'#333c3c',false,g);
        for(const fx of [x-1.88,x+1.88])frontageBox([.2,2.55,.6],[fx,1.28,-.25],color,false,g,false,true);
        const open=(index+(x>0?1:0))%3!==0;
        if(open) {
          frontageBox([3.35,1.95,.035],[x,1.25,-.55],'#756851',false,g,false,false,'wood');
          for(const shelf of [.5,1,1.5]){
            frontageBox([3.3,.07,.45],[x,shelf,-.22],'#9e8261',false,g,false,false,'wood');
            for(let n=0;n<8;n++)frontageBox([.14+random()*.12,.15+random()*.14,.15],[x-1.38+n*.38,shelf+.12,-.16],['#ac9172','#808c70','#b07553','#bead83'][n%4]);
          }
          frontageBox([2.85,.055,.09],[x,2.24,-.15],index%2?'#bfdbd1':'#e5bf7c',false,g,true);
          frontageBox([3.3,.54,.5],[x,.3,.13],'#867158',false,g,false,false,'wood');
        } else {
          frontageBox([3.4,2.18,.09],[x,1.19,-.12],'#8b8c87',false,g,false,false,'metal');
          for(let y=.21;y<2.3;y+=.13)frontageBox([3.42,.035,.035],[x,y,-.06],'#636d6c',false,g);
        }
      }
      frontageBox([width,.28,.68],[0,2.82,-.1],color,false,g,false,true);
    }
    const names=side<0?[['IRANI CHAI','चाय'],['RADIO REPAIR','रेडियो'],['FORT BOOK HOUSE','किताबें'],['SADAF TEXTILES','कपड़े'],['FORT RESEARCH INSTITUTE','फोर्ट'],['SHANTI STORES','दुकान'],['COASTAL CAFE','चाय']]:[['CST NEWS & PAPERS','मुंबई'],['SAHIL ELECTRICALS','बिजली'],['PRABHAT OPTICS','चश्मे'],['CITY CYCLE WORKS','साइकिल'],['VIDYA STATIONERY','किताबें'],['AZAD BAKERY','बेकरी'],['KONKAN LUNCH HOME','भोजन']];
    // Shop boards sit at the ground floor, not across first-floor windows.
    frontageBox([width,.36,.7],[0,3.12,-.15],style==='heritage'?'#b8aa91':'#918c7d',false,g,false,false,'stone');
    this.sign(g,names[index][0],names[index][1],[0,2.83,.32],6.35,index%2?'#744d3c':'#35504b');
    if(!fort) {
      const awning=frontageBox([7.65,.06,1.17],[0,2.37,.61],['#877866','#a18766','#637f77'][index%3],false,g,false,false,'fabric');awning.rotation.x=.14;
      for(let x=-3.65;x<3.7;x+=.55)frontageBox([.25,.17,.04],[x,2.19,1.16],'#bcad92');
    }
    for(let floor=0;floor<spec.floors;floor++) {
      const y=4.55+floor*spec.floorHeight;
      // Spandrels and piers frame sunken glass. Thin shaded reveals bake recess occlusion.
      frontageBox([width,spec.floorHeight-1.65,.6],[0,y-1.65/2-(spec.floorHeight-1.65)/2,-.43],color,false,g,false,true);
      for(const x of [-4.05,-1.42,1.42,4.05])frontageBox([x===-4.05||x===4.05?.8:1.08,1.68,.62],[x,y,-.42],color,false,g,false,true);
      for(const [column,x] of [-2.8,0,2.8].entries()) {
        frontageBox([1.79,1.7,.12],[x,y,-.35],'#4d504c');
        const lit=(floor+column+index+(side>0?1:0))%4===0;
        frontageBox([1.42,1.4,.025],[x,y,-.29],lit?'#c3aa7f':'#536569',false,g,lit,false,'glass');
        for(const sx of [-.84,.84])frontageBox([.09,1.73,.19],[x+sx,y,-.16],'#a6977e');
        frontageBox([1.8,.1,.29],[x,y-.87,-.13],'#b8aa92',false,g,false,false,'stone');
        frontageBox([1.79,.12,.21],[x,y+.88,-.17],'#b8aa92',false,g,false,false,'stone');
        frontageBox([.045,1.45,.045],[x,y,-.21],'#526560');
        frontageBox([1.42,.045,.05],[x,y+.1,-.2],'#526560');
        if(lit) {frontageBox([.27,1.37,.035],[x-.48,y,-.24],'#8f8266');frontageBox([.2,1.37,.035],[x+.51,y,-.24],'#8f8266');}
        else if((column+floor+index)%3===0) for(const shutter of [-1,1]) {
          const sh=new THREE.Group();sh.position.set(x+shutter*.92,y,-.02);sh.rotation.y=shutter*.2;g.add(sh);
          frontageBox([.3,1.52,.07],[0,0,0],'#677c71',false,sh);for(let n=0;n<9;n++)frontageBox([.32,.03,.08],[0,-.61+n*.15,.04],'#84917b',false,sh);
        }
        if(style==='heritage') {
          this.shape(this.archGeometry,[.96,.65,1],[x,y+.69,-.18],'#c5b499',g,false,false,true,'stone');
          frontageBox([2.05,.09,.72],[x,y+1.09,.03],'#afa18a',false,g,false,false,'stone');
        } else if(style==='commercial') {
          frontageBox([1.98,.07,.8],[x,y+.96,.13],'#a59a86');
          for(let n=0;n<6;n++)frontageBox([.025,1.35,.045],[x-.64+n*.26,y,-.05],'#3f504d');
        }
        if(style==='heritage'||style==='art-deco') {
          frontageBox([2.03,.14,.94],[x,y-.94,.22],'#a99e89',false,g,false,false,'stone');
          frontageBox([2.03,.055,.055],[x,y-.24,.69],'#48534f',false,g,false,false,'metal');
          for(let n=0;n<8;n++)frontageBox([.025,.65,.035],[x-.91+n*.26,y-.6,.69],'#52605a',false,g,false,false,'metal');
          for(const dx of [-.97,.97])frontageBox([.04,.69,.84],[x+dx,y-.6,.25],'#647166');
        }
      }
      if(style==='chawl') {
        frontageBox([width,.14,1.12],[0,y-.92,.29],'#a2957d');frontageBox([width,.06,.08],[0,y-.17,.86],'#5b6c63');
        for(let x=-4.1;x<4.2;x+=.3)frontageBox([.025,.72,.035],[x,y-.57,.86],'#556c60');
        this.wire(new THREE.Vector3(-4,y+.36,.82),new THREE.Vector3(4,y+.36,.82),.013,'#655e54',g);
        for(let n=0;n<4;n++){const cloth=frontageBox([.35+random()*.2,.55+random()*.25,.015],[-2.8+n*1.7,y,.84],['#b9b3a2','#927d74','#718986'][n%3],false,g,false,false,'fabric');cloth.rotation.z=random()*.18-.09;}
      }
      const acx=3.71;
      frontageBox([.67,.43,.44],[acx,y-.19,-.05],'#bbbaab');for(let n=0;n<5;n++)frontageBox([.48,.022,.02],[acx,y-.33+n*.07,.183],'#6f7874');
      frontageBox([width,.08,.13],[0,y+1.2,-.05],style==='art-deco'?'#cec1a6':color);
    }
    // Distinct silhouette: stepped Art Deco parapets, heritage cornices, utility terraces.
    frontageBox([width+.18,.18,6.6],[0,height,-3.45],'#8e8878');
    frontageBox([width,.55,.22],[0,height+.3,-.06],color,false,g,false,true);
    if(style==='art-deco')for(let n=0;n<3;n++)frontageBox([2.6-n*.68,.27,.3],[0,height+.61+n*.24,-.04],'#cbbda0');
    if(style==='heritage') {
      for(let n=0;n<3;n++)frontageBox([width+.35+n*.1,.09,.35+n*.1],[0,height-.24+n*.13,.01],'#bbaa8e');
      for(let x=-4;x<=4;x+=.7)frontageBox([.12,.18,.26],[x,height-.45,.03],'#a79880');
      for(const x of [-4.1,4.1])frontageBox([.25,height-3.2,.33],[x,(height+3.2)/2,-.01],'#c3b397');
    }
    this.cylinder(.68,1.05,[2,height+.75,-2.8],'#414a49',g);this.cylinder(.72,.09,[2,height+1.3,-2.8],'#333d3c',g);
    this.wire(new THREE.Vector3(-3.9,1,-.03),new THREE.Vector3(-3.9,height+.55,-.03),.035,'#7c8176',g);
    this.wire(new THREE.Vector3(-3.9,1,-.03),new THREE.Vector3(-3.45,.24,.17),.035,'#7c8176',g);
    const dish=this.shape(this.sphereGeometry,[.34,.12,.34],[-1.5,height+.9,-2],'#a2a49a',g);dish.rotation.x=.65;
    this.wire(new THREE.Vector3(-1.5,height,-2),new THREE.Vector3(-1.5,height+.8,-2),.025,'#67716b',g);
    this.sign(g,index%2?'EVENING CLASSES':'THE JOURNEY SO FAR','मुंबई',[3.78,1.62,-.005],.52,'#c2ad88','#454944').scale.y=2.7;
    // Patched paint and faint damp along the skirting are geometry-level decals.
    for(let n=0;n<4;n++)frontageBox([.23+random()*.7,.12+random()*.25,.015],[-3.7+random()*7.4,.18+random()*.14,-.08],'#6f776d');
  }
  private station() {
    this.box([12,7,3],[0,3.5,18],'#b8a286',true,this.group,false,false,'stone');
    for(const x of [-4,-2,0,2,4]) {
      this.box([1.5,3.5,.05],[x,2.15,16.43],'#4e5f58');
      this.shape(this.archGeometry,[.96,1,1],[x,2.72,16.12],'#d0bea0',this.group,false,false,true,'stone');
      for(const dx of [-.9,.9])this.box([.23,3.7,.36],[x+dx,1.85,16.1],'#cfbb98',false,this.group,false,false,'stone');
      this.box([1.8,.11,.4],[x,.08,16.15],'#a79880');
    }
    const sign=this.sign(this.group,'CST ARRIVAL TERMINUS','छत्रपती शिवाजी महाराज टर्मिनस',[0,5.2,16.08],9.3,'#4d5c50','#e4d4ae');sign.rotation.y=Math.PI;
    for(let n=0;n<3;n++)this.box([12.3+n*.16,.1,.36+n*.14],[0,6.6+n*.18,16.3],'#ccb593');
    this.box([12.6,.2,3.6],[0,7.13,18],'#88766a');
    for(const x of [-5,5]) {
      this.box([1.5,2.5,2],[x,8.38,18],'#b09b7e');this.cylinder(.93,.3,[x,9.75,18],'#a69173');
      this.shape(new THREE.ConeGeometry(.97,1.45,8),[1,1,1],[x,10.6,18],'#857269');this.cylinder(.06,.55,[x,11.6,18],'#7d7b6d');
      const clock=new THREE.Mesh(new THREE.CircleGeometry(.48,24),this.surfaces.get('#e4d7b9','stone'));clock.position.set(x,8.58,16.97);clock.rotation.y=Math.PI;this.group.add(clock);
      this.box([.027,.33,.025],[x,8.69,16.93],'#514d42');const hand=this.box([.26,.028,.025],[x+.1,8.58,16.93],'#514d42');hand.rotation.z=.35;
    }
    this.person([5.8,0,8.3],'#829382',false);
    this.interactions.push({id:'cst',position:new THREE.Vector3(5.8,1.45,8.3),label:'Talk to the station host'});
    const board=this.sign(this.group,'FORT ROAD →','फोर्ट',[6.3,2.9,7.8],1.2,'#3e5c51');board.rotation.y=-.1;
    // Arrival canopy, ribs and transport notice board.
    this.box([10,.09,1.4],[0,3.7,15.82],'#80765e');for(const x of [-4.5,4.5])this.cylinder(.06,3.65,[x,1.83,15.5],'#69756a');
  }
  private researchRoom() {
    const g = new THREE.Group(); g.position.set(-7, 0, -34); g.rotation.y = Math.PI / 2; this.group.add(g);
    // The open research entrance is made from separate walls, never an invisible solid box.
    for (const x of [-3.1, 3.1]) this.box([2.5, 3.1, .3], [x, 1.55, -.08], '#78938d', true, g, false, true);
    this.box([2.9, .42, .35], [0, 2.95, -.08], '#78938d', true, g);
    this.box([8.5, .035, 6.5], [0, .025, -3.3], '#aaa793', false, g, false, false, 'stone');
    this.box([8.5, 3, .3], [0, 1.5, -6.5], '#91a39a', true, g);
    for (const x of [-4.25, 4.25]) this.box([.3, 3, 6.5], [x, 1.5, -3.3], '#8b9d92', true, g);
    this.box([8.5, .12, 6.5], [0, 3.1, -3.3], '#6b7875', false, g);
    this.box([1.2, .08, .45], [0, 2.85, -2], '#eee1b1', false, g, true);
    this.sign(g, 'FFPRIME / OPEN SCIENCE', 'फोर्ट', [0, 2.3, -6.28], 5.8, '#344d48', '#dce2c8');
    this.sign(g, 'GSOC 2026 · QC-DEVS', 'Research, reviewed upstream', [-2.4, 1.6, -6.22], 2.8);
    this.sign(g, '5 MERGED PULL REQUESTS', 'Source: final report', [2.2, 1.6, -6.22], 2.8);
    this.box([4.2, .15, .85], [0, .78, -4.7], '#8c775a', true, g, false, false, 'wood');
    for(const x of [-1.9,1.9])for(const z of [-4.96,-4.44])this.box([.055,.7,.055],[x,.35,z],'#5d6c62',false,g,false,false,'metal');
    this.box([.045,1.15,2.6],[-4.05,1.78,-3.2],'#dbd8c4',false,g);
    // Original dipole-style field sketch in geometry, kept separate from factual performance claims.
    for(const side of [-1,1])for(let ring=1;ring<=3;ring++){
      const cy=1.78,cz=-3.2+side*.4;for(let n=0;n<20;n++){const point=(t:number)=>new THREE.Vector3(-4.016,cy+Math.sin(t)*ring*.13,cz+Math.cos(t)*ring*.22);this.wire(point(n/20*Math.PI*2),point((n+1)/20*Math.PI*2),.008,side>0?'#a16d50':'#527f80',g);}
    }
    const notebook=this.box([.28,.02,.2],[.25,.874,-4.6],'#c1b28f',false,g);notebook.rotation.y=.2;
    this.box([.8,.09,.6],[2.7,.46,-4.4],'#6c7769',false,g);this.box([.8,.55,.08],[2.7,.75,-4.1],'#6c7769',false,g);
    for(const x of [2.4,3])this.box([.055,.45,.45],[x,.225,-4.4],'#58655b',false,g);
    this.cylinder(.12,.32,[-3.2,.16,-5.8],'#a88965',g);this.shape(this.leafGeometry,[.5,.7,.5],[-3.2,.68,-5.8],'#718763',g);
    for (const x of [-1.25, 1.25]) {
      this.box([1, .7, .07], [x, 1.25, -4.75], '#172e32', false, g);
      this.sign(g, x < 0 ? 'MULTIPOLE ELECTROSTATICS' : 'PYTHON · NUMERICAL TESTS', 'FFprime', [x, 1.25, -4.69], .9);
      this.box([.07, .3, .15], [x, .95, -4.75], '#283638', false, g);
    }
    this.person([-5.9, 0, -35.8], '#718d86', false);
    this.interactions.push({ id: 'fort', position: new THREE.Vector3(-5.9, 1.4, -35.8), label: 'Talk to the research fellow' });
    this.interactions.push({ id: 'ffprime', position: new THREE.Vector3(-11.8, 1.3, -34), label: 'Read the FFprime research' });
    const light = new THREE.PointLight('#ffe5ba', 10, 9, 2); light.position.set(-10, 2.5, -34); this.group.add(light);
  }
  private streetDetails() {
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const z = 7 - i * 13, x = side * 5.95;
      this.cylinder(.09, 6.2, [x, 3.1, z], '#43454b');
      this.box([.8, .09, .12], [x - side * .35, 5.9, z], '#454750');
      this.box([.5, .1, .25], [x - side * .7, 5.83, z], '#e4b978', false, this.group, true);
      this.box([.18, .6, .14], [x, 3.1, z], '#737571');
      for (let cable = 0; cable < 3; cable++) for (let n = 0; n < 8; n++) {
        const point = (t: number) => new THREE.Vector3(x + cable * .12, 6 - Math.sin(t * Math.PI) * .7, z - t * 13);
        this.wire(point(n / 8), point((n + 1) / 8), .018);
      }
      // Warm pools are translucent original geometry; no costly light per lamp.
      const pool = new THREE.Mesh(this.poolGeometry, new THREE.MeshBasicMaterial({ color: '#e8ae61', transparent: true, opacity: .07, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x - side * 1.4, .013, z); pool.material.userData.surface='pool';this.group.add(pool);this.statics.push(pool);
      if (i < 3 && side === 1) { const light = new THREE.PointLight('#fbc487', 7, 10, 2); light.position.set(x - .7, 4.6, z); this.group.add(light); }
      this.box([.5, .65, .5], [side * 6.2, .325, z - 4.5], '#465e56', true);
      this.cylinder(.23, .45, [side * 6.1, .23, z + 3], '#8c6551');
      this.shape(this.leafGeometry, [.55, .9, .55], [side * 6.1, .85, z + 3], '#698159');
      if (i % 2 === 0) this.scooter(side * 5.6, z - 5, side);
    }
    // Hanging cross-street service wires frame the view above eye level.
    for (const z of [-8, -30, -47]) for (let cable = 0; cable < 3; cable++) for (let n = 0; n < 10; n++) {
      const point = (t: number) => new THREE.Vector3(-7 + t * 14, 7.5 - Math.sin(t * Math.PI) * 1.2 + cable * .16, z + cable * .3);
      this.wire(point(n / 10), point((n + 1) / 10), .021);
    }
    // Chai counter with cups, kettle, crates and a vendor.
    this.box([1.6, .9, .65], [-5.6, .45, 3], '#5f4c3a', true);
    this.box([1.7, .1, .75], [-5.6, .94, 3], '#a18b67');
    this.cylinder(.14, .25, [-5.6, 1.12, 3], '#adb0a4');
    for (let i = 0; i < 4; i++) this.cylinder(.045, .1, [-6.15 + i * .19, 1.05, 3.15], '#b19772');
    for (let i = 0; i < 3; i++) this.box([.55, .5, .55], [-6.4, .25 + i * .5, .8], '#7d664b', true);
    this.person([-6.2, 0, 3.5], '#ac8b67', false);
    this.box([1.7, .13, .45], [5.9, .48, -16], '#715b48', true);
    for (const x of [5.25, 6.5]) this.box([.09, .48, .35], [x, .24, -16], '#3e4948');
  }
  private vegetation() {
    for(const [i,x,z] of [[0,-6,-18],[1,6.1,-39],[2,-6,-53],[3,6,1]]) {
      const random=seededRandom(`gulmohar:${i}`),height=4.8+random()*.6;
      const trunk=[new THREE.Vector3(x,0,z),new THREE.Vector3(x+.16,2.1,z+.1),new THREE.Vector3(x-.08,height-.9,z)];
      for(let n=0;n<2;n++)this.wire(trunk[n],trunk[n+1],n?.075:.11,'#716659');
      for(let branch=0;branch<7;branch++) {
        const angle=branch/7*Math.PI*2,reach=1+random()*1.1;
        const start=new THREE.Vector3(x-.08,height-1.3,z),end=new THREE.Vector3(x+Math.cos(angle)*reach,height-.35+random()*.55,z+Math.sin(angle)*reach);
        this.wire(start,end,.037,'#7d7361');
        for(let leaf=0;leaf<6;leaf++) {
          const position=end.clone().add(new THREE.Vector3((random()-.5)*1.35,(random()-.5)*.65,(random()-.5)*1.35));
          const mesh=this.shape(this.leafGeometry,[1.5,1.5,1.5],position.toArray() as Triple,['#697e52','#829362','#526d50','#8a9865'][leaf%4]);mesh.rotation.y=random()*Math.PI;
          if((branch+leaf)%5===0)this.shape(this.sphereGeometry,[.10,.055,.10],position.toArray() as Triple,'#b87b50');
        }
      }
      this.box([1.15,.07,1.15],[x,.05,z],'#827c68');
      this.contact(x,z,.8,.8);
    }
    for(let i=0;i<16;i++)this.shape(this.leafGeometry,[.4,.5,.4],[i%2?6.1:-6.1,.85,9-i*4],'#788e63');
  }
  private scooter(x: number, z: number, side: number) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = side * .4; this.group.add(g);
    for (const wz of [-.65, .65]) { const wheel = this.cylinder(.25, .15, [0, .25, wz], '#242b30', g); wheel.rotation.z = Math.PI / 2; }
    this.box([.42, .45, .9], [0, .5, .1], '#627e7b', false, g);
    this.box([.38, .12, .65], [0, .8, .15], '#252d32', false, g);
    this.box([.45, .6, .17], [0, .65, -.5], '#9e8b62', false, g);
    this.box([.65, .05, .06], [0, 1, -.55], '#45494c', false, g);
  }
  private person(position: Triple, shirt: string, moving: boolean, seated=false) {
    const g=new THREE.Group();g.position.set(...position);this.group.add(g);this.pedestrians.push(g);
    const random=seededRandom(`person:${position.join(':')}`),height=.94+random()*.12;g.scale.setScalar(height);
    const skin=['#a77c5e','#bc9374','#86644d','#c09c7b'][Math.floor(random()*4)];const pants=['#59615c','#52636a','#787164'][Math.floor(random()*3)];
    const make=(geometry:THREE.BufferGeometry,size:Triple,p:Triple,color:string,parent:THREE.Object3D=g)=>this.shape(geometry,size,p,color,parent,false,false,false);
    make(this.torsoGeometry,[1,.5,.7],[0,1.15,0],shirt);
    make(this.sphereGeometry,[.145,.12,.105],[0,.91,0],pants);
    make(this.cylinderGeometry,[.052,.1,.052],[0,1.45,0],skin);
    make(this.sphereGeometry,[.105,.135,.102],[0,1.62,0],skin);
    make(this.sphereGeometry,[.109,.055,.106],[0,1.721,.011],'#393a34');
    make(this.sphereGeometry,[.02,.03,.026],[0,1.61,-.098],skin);
    for(const side of [-1,1]){make(this.sphereGeometry,[.015,.026,.019],[side*.105,1.62,0],skin);make(this.sphereGeometry,[.007,.009,.004],[side*.034,1.642,-.096],'#4a4338');}
    const hips:THREE.Group[]=[],knees:THREE.Group[]=[],shoulders:THREE.Group[]=[],elbows:THREE.Group[]=[];
    for(const side of [-1,1]) {
      const hip=new THREE.Group();hip.position.set(side*.095,.9,0);g.add(hip);hips.push(hip);
      make(this.cylinderGeometry,[.068,.38,.068],[0,-.19,0],pants,hip);
      make(this.sphereGeometry,[.073,.077,.074],[0,-.39,0],pants,hip);
      const knee=new THREE.Group();knee.position.y=-.39;hip.add(knee);knees.push(knee);
      make(this.cylinderGeometry,[.052,.39,.052],[0,-.195,0],pants,knee);
      make(this.sphereGeometry,[.075,.048,.14],[0,-.43,-.045],'#343b38',knee);
      const shoulder=new THREE.Group();shoulder.position.set(side*.18,1.37,0);g.add(shoulder);shoulders.push(shoulder);
      make(this.sphereGeometry,[.081,.08,.082],[0,0,0],shirt,shoulder);
      make(this.cylinderGeometry,[.052,.245,.052],[side*.015,-.12,0],shirt,shoulder);
      const elbow=new THREE.Group();elbow.position.set(side*.015,-.245,0);shoulder.add(elbow);elbows.push(elbow);
      make(this.sphereGeometry,[.052,.06,.052],[0,0,0],skin,elbow);
      make(this.cylinderGeometry,[.039,.23,.039],[0,-.115,0],skin,elbow);
      make(this.sphereGeometry,[.039,.059,.035],[0,-.27,0],skin,elbow);
    }
    if(seated){g.position.y-=.45;hips.forEach(h=>h.rotation.x=-Math.PI/2);knees.forEach(k=>k.rotation.x=Math.PI/2);}
    if(!moving&&random()>.5) {shoulders[0].rotation.x=-.6;elbows[0].rotation.x=-.8;make(this.boxGeometry,[.06,.1,.008],[-.19,1.13,-.22],'#555e59');}
    this.contact(0,0,.23,.15,g);
    const speed=.7+random()*.32,phase=random()*Math.PI*2;
    this.motion.push(time=>{
      if(moving) {
        // Continuous pavement back-and-forth; turn at endpoints without respawning in view.
        const cycle=(time*speed+position[2]+60)%104,progress=cycle<52?cycle:104-cycle;
        g.position.z=8-progress;const desired=cycle<52?0:Math.PI;
        const turn=Math.atan2(Math.sin(desired-g.rotation.y),Math.cos(desired-g.rotation.y));g.rotation.y+=turn*.18;
        const gait=time*speed*6+phase;g.position.y=Math.abs(Math.sin(gait))*.014;
        for(let i=0;i<2;i++){const swing=Math.sin(gait+i*Math.PI);hips[i].rotation.x=swing*.34;knees[i].rotation.x=Math.max(0,-swing)*.52;shoulders[i].rotation.x=-swing*.24;elbows[i].rotation.x=-.12-Math.max(0,swing)*.12;}
      } else {g.rotation.y=Math.sin(time*.35+phase)*.045; if(!seated){shoulders[1].rotation.z=Math.sin(time*.7+phase)*.035;elbows[1].rotation.x=-.18+Math.sin(time*.4+phase)*.07;}}
    });
    return g;
  }
  private people() {
    for(let i=0;i<10;i++)this.person([i%2?4.9:-4.9,0,7-i*6],['#8b968c','#9c8279','#788d80','#b0a081','#748b99'][i%5],true);
    for(const [x,z] of [[-6,-10],[6,-23],[-6,-43],[5.8,-46]])this.person([x,0,z],'#a38f78',false);
    this.person([5.9,.03,-16],'#8a9b93',false,true);
  }
  setQuality(low:boolean) { this.pedestrians.forEach((p,i)=>{p.visible=!low||i<3||i%2===0;}); }
  private traffic() {
    for (const kind of ['taxi', 'auto'] as const) {
      const vehicle = createTransitModel(kind); vehicle.position.set(kind === 'taxi' ? 2.1 : -2.1, .02, 5); vehicle.rotation.y = kind === 'auto' ? Math.PI : 0; this.group.add(vehicle);
      this.interactions.push({ id: `hail-${kind}`, label: `Hail ${kind === 'taxi' ? 'kaali-peeli taxi' : 'auto'}`, position: new THREE.Vector3(vehicle.position.x, 1, vehicle.position.z) });
    }
    const loop = [{ x: 1.75, z: 12 }, { x: 1.75, z: -52 }, { x: 0, z: -54 }, { x: -1.75, z: -52 }, { x: -1.75, z: 12 }, { x: 0, z: 14 }, { x: 1.75, z: 12 }];
    const length = routeLength(loop);
    for (let i = 0; i < 3; i++) {
      const vehicle = createTransitModel(i === 1 ? 'auto' : 'taxi'); this.group.add(vehicle);
      this.motion.push(time => {
        // Shared phase maintains spacing. A pause at the zebra crossing acts as a signal.
        const clock = Math.floor(time / 24) * 20 + Math.min(time % 24, 20);
        const p = pointAtDistance(loop, (clock * 3 + i * length / 3) % length);
        vehicle.position.set(p.x, .02, p.z);
        const turn=Math.atan2(Math.sin(p.heading-vehicle.rotation.y),Math.cos(p.heading-vehicle.rotation.y));vehicle.rotation.y+=turn*.18;animateTransit(vehicle,clock*3,turn);
      });
    }
  }
  private instanceStatics() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; meshes: THREE.Mesh[] }>();
    for (const mesh of this.statics) {
      const source = mesh.material as THREE.MeshStandardMaterial;
      const family = source.userData.surface ?? 'solid';
      const key = `${mesh.geometry.uuid}-${family}`;
      let bucket = buckets.get(key);
      if (!bucket) { const material = source.clone(); material.color.set('#ffffff'); bucket = { geometry: mesh.geometry, material, meshes: [] }; buckets.set(key, bucket); }
      bucket.meshes.push(mesh);
    }
    for (const { geometry, material, meshes } of buckets.values()) {
      const instance = new THREE.InstancedMesh(geometry, material, meshes.length);
      meshes.forEach((mesh, i) => { instance.setMatrixAt(i, mesh.matrixWorld); instance.setColorAt(i, (mesh.material as THREE.MeshStandardMaterial).color); mesh.removeFromParent(); });
      instance.castShadow = meshes.some(m => m.castShadow); instance.receiveShadow = true; instance.computeBoundingSphere(); this.group.add(instance);
    }
  }
  private mergeSigns() {
    this.group.updateMatrixWorld(true);
    const geometries = this.signs.map(sign => { const geometry = sign.geometry.clone().applyMatrix4(sign.matrixWorld); sign.removeFromParent(); sign.geometry.dispose(); return geometry; });
    this.group.add(new THREE.Mesh(mergeGeometries(geometries)!, this.signs[0].material)); geometries.forEach(g => g.dispose());
  }
  private instancePedestrians() {
    const buckets = new Map<string, THREE.Mesh[]>();
    for (const mesh of this.dynamicParts) { const key=`${mesh.geometry.uuid}:${mesh.material===this.contactMaterial?'contact':'human'}`;const parts = buckets.get(key) ?? []; parts.push(mesh); buckets.set(key, parts); mesh.visible = false; }
    for (const meshes of buckets.values()) {
      const source=meshes[0].material as THREE.MeshStandardMaterial;const material=source.clone();material.color.set('#ffffff');
      const instance = new THREE.InstancedMesh(meshes[0].geometry, material, meshes.length);
      meshes.forEach((mesh, i) => instance.setColorAt(i, (mesh.material as THREE.MeshStandardMaterial).color));
      instance.castShadow = meshes[0].material!==this.contactMaterial; instance.receiveShadow = true; instance.frustumCulled = false; this.group.add(instance); this.dynamicBatches.push({ instance, meshes });
    }
  }
  update(time: number, reduced: boolean) {
    for (const animate of this.motion) animate(reduced ? 0 : time);
    this.group.updateMatrixWorld(true);
    for (const { instance, meshes } of this.dynamicBatches) { meshes.forEach((mesh, i) => { let visible=true; for(let p:THREE.Object3D|null=mesh.parent;p&&p!==this.group;p=p.parent)if(!p.visible)visible=false; instance.setMatrixAt(i,visible?mesh.matrixWorld:new THREE.Matrix4().makeScale(0,0,0)); }); instance.instanceMatrix.needsUpdate = true; }
  }
}
