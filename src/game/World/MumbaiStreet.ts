import type {VerifiedGLB,GLBAssetLibrary} from './assets/GLBAssetLibrary';
import type {GLBCharacter} from './assets/GLBCharacter';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { pointedArchGeometry, heritageDomeGeometry } from './architecture/HeritageDetails';
import { awningGeometry, patinaGeometry } from './architecture/StreetArt';
import { createTransitModel, animateTransit } from './TransitModel';
import { StreetMaterials, type Surface } from './StreetMaterials';
import { facadeSpec, seededRandom } from './StreetArchitecture';
import { FacadePanels } from './architecture/FacadePanels';
import { SpatialIndex } from './spatial/SpatialIndex';
import { createHuman } from './npc/NPCFactory';
import { NavMeshManager, type Obstacle } from './navigation/NavMeshManager';
import { RoadTraffic, pedestrianGreen } from './traffic/RoadTraffic';
import type { CrowdAgent } from '@recast-navigation/core';

type Triple = [number, number, number];
export interface StreetInteraction { id: string; position: THREE.Vector3; label: string }


/** Original modular Mumbai-inspired CST/Fort lane. One art-directed vertical slice. */
export class MumbaiStreet {
  readonly group = new THREE.Group();
  readonly interactions: StreetInteraction[] = [];
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private roundedGeometry = new RoundedBoxGeometry(1,1,1,2,.075);
  private awnings=[0,1,2,3].map(awningGeometry);
  private patina:THREE.Mesh[]=[];
  private patinaMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  private cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  private sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
  private spectacleGeometry = new THREE.TorusGeometry(.031,.004,5,12);
  private materials = new Map<string, THREE.Material>();
  private statics: THREE.Mesh[] = [];
  private dynamicParts: THREE.Mesh[] = [];
  private dynamicBatches: Array<{ instance: THREE.InstancedMesh; meshes: THREE.Mesh[] }> = [];
  private motion: Array<(time: number) => void> = [];
  private surfaces = new StreetMaterials();
  private archGeometry = this.makeArch();
  private distantWindow=new THREE.PlaneGeometry(1,1);
  private pointedArch=pointedArchGeometry();
  private dome=heritageDomeGeometry();
  private hippedRoof=new THREE.ConeGeometry(1,1,4);
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
  private panels = new FacadePanels();
  private colliderGeometry: THREE.BufferGeometry[] = [];
  private obstacles: Obstacle[] = [];
  spatial!: SpatialIndex;
  private navigation: NavMeshManager | null = null;
  private disposed = false;
  private assetLibrary:GLBAssetLibrary|null=null;
  private stationHost:THREE.Group|null=null;
  private stationCharacter:GLBCharacter|null=null;
  private walkers: Array<{group:THREE.Group;agent?:CrowdAgent;target:number;wait:number}> = [];
  private trafficSystem = new RoadTraffic();
  private trafficVehicles: THREE.Group[] = [];
  private previousTime = 0;
  private viewPosition = new THREE.Vector3();
  navigationStatus = 'loading';
  npcUpdateMs = 0; trafficUpdateMs = 0;
  private destinations = [{x:4.9,y:0,z:8},{x:5,y:0,z:-26},{x:4.8,y:0,z:-45},{x:-4.9,y:0,z:-43},{x:-4.8,y:0,z:-22},{x:-4.8,y:0,z:7}];

  constructor(private physics: CANNON.World) {
    this.signCanvas = document.createElement('canvas'); this.signCanvas.width = 2048; this.signCanvas.height = 2048;
    this.signAtlas = new THREE.CanvasTexture(this.signCanvas); this.signAtlas.colorSpace = THREE.SRGBColorSpace;
    this.landscape();
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) this.facade(side, 4 - i * 9.5, i);
    this.station(); this.researchRoom(); this.streetDetails(); this.vegetation(); this.people(); this.traffic();
    this.spatial = new SpatialIndex(this.colliderGeometry); this.colliderGeometry.forEach(g=>g.dispose()); this.colliderGeometry=[];
    void NavMeshManager.create(this.obstacles).then(nav=>{if(this.disposed){nav.dispose();return;}this.navigation=nav;this.navigationStatus='ready';for(const [i,w] of this.walkers.entries()){w.agent=nav.add({x:w.group.position.x,y:0,z:w.group.position.z});w.target=i%this.destinations.length;w.agent.requestMoveTarget(this.destinations[w.target]);}}).catch(()=>{this.navigationStatus='unavailable';});
    this.signAtlas.needsUpdate = true; this.instanceStatics(); this.mergeSigns(); this.mergePatina(); this.instancePedestrians();
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
      const q = mesh.getWorldQuaternion(new THREE.Quaternion()); body.quaternion.set(q.x, q.y, q.z, q.w); this.physics.addBody(body); this.recordCollider(size,p,q);
    }
    return mesh;
  }
  private solidProxy(size:Triple,position:Triple,parent:THREE.Object3D) {
    parent.updateWorldMatrix(true,false);const p=new THREE.Vector3(...position).applyMatrix4(parent.matrixWorld),q=parent.getWorldQuaternion(new THREE.Quaternion());
    const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(size[0]/2,size[1]/2,size[2]/2)),position:new CANNON.Vec3(p.x,p.y,p.z)});body.quaternion.set(q.x,q.y,q.z,q.w);this.physics.addBody(body);this.recordCollider(size,p,q);
  }
  private recordCollider(size:Triple,p:THREE.Vector3,q:THREE.Quaternion) {
    const geometry=new THREE.BoxGeometry(...size).applyMatrix4(new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1)));this.colliderGeometry.push(geometry);
    const bounds=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);if(bounds.min.y<1.8&&bounds.max.y>.2)this.obstacles.push({minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z});
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
    const random=seededRandom('pinnate-gulmohar'),vertices:number[]=[],colors:number[]=[],indices:number[]=[];
    const dark=new THREE.Color('#78915d'),light=new THREE.Color('#c0c99a');
    const triangleLeaf=(x:number,z:number,side:number,angle:number)=>{
      const points=[[0,0,0],[side*.044,-.006,-.019],[side*.13,.012,-.018],[side*.07,-.005,.025],[side*.026,0,.027]];
      const n=vertices.length/3;
      for(const [i,p] of points.entries()){const v=new THREE.Vector3(x+p[0],p[1],z+p[2]);v.applyAxisAngle(new THREE.Vector3(0,1,0),angle);vertices.push(v.x,v.y,v.z);const c=i===2?light:dark;colors.push(c.r,c.g,c.b);}
      indices.push(n,n+2,n+1,n,n+3,n+2,n,n+4,n+3,n,n+1,n+4);
    };
    for(let frond=0;frond<2;frond++){
      const angle=frond*Math.PI*.73+random()*.35;
      for(let n=0;n<6;n++)for(const side of [-1,1])triangleLeaf(side*.007,-.30+n*.105,side,angle);
      // A thin central rachis, included in the same foliage draw.
      const start=vertices.length/3;
      for(const [x,z] of [[-.005,-.36],[.005,-.36],[.004,.31],[-.004,.31]]){const v=new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),angle);vertices.push(v.x,v.y,v.z);colors.push(dark.r,dark.g,dark.b);}
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  private contact(x:number,z:number,rx:number,rz:number,parent:THREE.Object3D=this.group) {
    const shadow=new THREE.Mesh(this.contactGeometry,this.contactMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.set(x,.016,z);shadow.scale.set(rx,rz,1);parent.add(shadow);this.dynamicParts.push(shadow);
  }
  private landscape() {
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); this.physics.addBody(ground);
    this.box([340, .1, 380], [0, -.1, -26], '#777970', false, this.group, false, false, 'asphalt');
    this.colliderGeometry.push(new THREE.BoxGeometry(100,.1,150).translate(0,-.05,-26));
    this.box([7.8, .04, 78], [0, -.02, -22], '#585b5d', false, this.group, false, false, 'asphalt');
    // Human-height physics floor stays flat; the pavement lip is deliberately low.
    for (const side of [-1, 1]) {
      this.box([2.8, .06, 75], [side * 5.3, .01, -22], '#afa392', false, this.group, false, false, 'paving');
      // Low, interrupted curb; broad visual ramps keep the existing flat collision floor stable.
      for(let z=-58;z<13;z+=1.7) this.box([2.5,.008,.025],[side*5.4,.045,z],'#726c62');
      for (let z = -58; z < 16; z += .85) this.box([.22, .12, .75], [side * 3.98, .055, z], Math.floor(z / 1.7) % 2 ? '#b69858' : '#32312e');
      // Keep the pedestrian inside the authored lane.
      this.solidProxy([1,4,82],[side*19,2,-22],this.group);
    }
    // Original invisible safety limits remain exactly where route/nav authoring expects them.
    this.solidProxy([38,4,1],[0,2,-63],this.group);
    this.solidProxy([38,4,1],[0,2,20],this.group);
    this.streetContinuation();
    for (let z = -54; z < 12; z += 6) this.box([.08, .008, 2], [0, .005, z], '#a2997e');
    for (let i = 0; i < 8; i++) this.box([.55, .008, 2.4], [-3 + i * .85, .008, -12], '#aaa28b');
    for (const side of [-1, 1]) for (let z = -55; z < 10; z += 4.5) {
      this.box([.65, .013, .45], [side * 3.5, .012, z], '#282d34');
      for (let n = 0; n < 5; n++) this.box([.035, .015, .38], [side * 3.5 - .22 + n * .11, .02, z], '#53545a');
    }
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshStandardMaterial({ color: '#736172', transparent: true, opacity: .5, roughness: .35 }));
    puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.2, .38, 1); puddle.position.set(2.6, .014, -17); this.group.add(puddle);
  }
  private streetContinuation(){
    // A cross street and oblique corner mask the non-traversable north limit.
    this.box([72,.035,9],[0,-.012,-62],'#585b5d',false,this.group,false,false,'asphalt');
    this.box([9,.035,48],[-23,-.012,-83],'#585b5d',false,this.group,false,false,'asphalt');
    for(const z of [-67,-57])this.box([74,.05,2.0],[0,.014,z],'#afa392',false,this.group,false,false,'paving');
    // Three layers continue beyond both termini. No distant façade is a navigation surface.
    const blocks=[[-1.5,-112,18,13,12],[-26,-23,15,13,18],[26,-29,18,14,20],[-9,-75,13,10,13],[8,-72,12,8,11],[26,-71,17,12,16],[-34,-82,14,10,12],[-10,-99,18,11,14],[13,-104,22,12,16],[34,-112,26,14,17],[-36,-116,24,13,16],[-14,41,16,12,15],[15,44,19,13,15],[-36,58,23,14,17],[34,66,27,15,18],[-12,82,29,16,18],[12,108,32,17,20]];
    for(const [i,[x,z,h,w,d]] of blocks.entries()){
      const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=(i>0&&i<5?-.22:i%3===0?.13:0);this.group.add(g);
      const color=['#aa9987','#9b9e93','#b5aa98','#8e9994'][i%4];
      this.box([w,h,d],[0,h/2,0],color,false,g,false,true);
      const face=z<0?d/2:-d/2;
      for(let y=2.0;y<h-1;y+=2.7){this.box([w+.12,.10,.24],[0,y-1.03,face],'#b6aa94',false,g,false,false,'stone');for(let col=0;col<4;col++){
        const wx=(col-1.5)*w/4;const pane=this.shape(this.distantWindow,[1.0,1.42,1],[wx,y,face+(z<0?.06:-.06)],'#43575b',g,false,false,true,'glass');pane.rotation.y=z<0?0:Math.PI;
        if((i+col+Math.floor(y))%5===0)this.box([.68,1.05,.012],[wx,y,face+(z<0?.06:-.06)],'#b6a074',false,g,true);
      }}
      // Side elevation is visible along the bend; it must not read as another terminal slab.
      if(i>0&&i<5)for(const side of [-1,1])for(let y=2.1;y<h-1;y+=2.7)for(let n=0;n<3;n++){
        const pane=this.shape(this.distantWindow,[.95,1.35,1],[side*(w/2+.04),y,(n-1)*d*.28],'#43575b',g,false,false,true,'glass');pane.rotation.y=side*Math.PI/2;
        this.box([.19,.09,1.12],[side*(w/2+.05),y-.72,(n-1)*d*.28],'#b6aa94',false,g,false,false,'stone');
      }
      this.box([w+.3,.26,d+.3],[0,h+.12,0],'#958c7c',false,g,false,false,'stone');
      if(i%3===0){this.box([w*.65,.6,.2],[0,h+.55,face],color,false,g,false,true);this.cylinder(.7,1.1,[w*.27,h+.75,0],'#49534e',g);}
      if(i>0&&i<5){for(const wx of [-w*.3,0,w*.3]){this.box([2.1,2.3,.15],[wx,1.2,face],'#4c655e',false,g);this.box([2.2,.1,1.0],[wx,2.48,face+.25],'#9b8b70',false,g,false,false,'fabric');}}
    }
    // Back-lot silhouettes close the narrow gaps between near façades without exposing a perimeter wall.
    for(const side of [-1,1])for(let i=0;i<4;i++){
      const x=side*(25+(i%2)*2),z=5-i*22,h=11+(i%3)*3;
      this.box([10,h,21],[x,h/2,z],i%2?'#a99d8a':'#87988f',false,this.group,false,true);
      this.box([10.4,.22,21.4],[x,h+.12,z],'#958c7c',false,this.group,false,false,'stone');
      for(let y=2.5;y<h;y+=2.8)for(let n=0;n<6;n++){const pane=this.shape(this.distantWindow,[.95,1.3,1],[x-side*5.05,y,z-8+n*3.1],'#526465',this.group,false,false,true,'glass');pane.rotation.y=-side*Math.PI/2;}
    }
    // Fogged, overlapping skyline closes every azimuth instead of revealing a bare ground/sky seam.
    // It is static backdrop geometry outside the original safety envelope, not explorable districts.
    for(let i=0;i<32;i++){
      const angle=i*Math.PI/16,h=16+(i%5)*3,g=new THREE.Group();g.position.set(Math.sin(angle)*120,0,-22+Math.cos(angle)*120);g.rotation.y=angle;this.group.add(g);
      this.box([25,h,12],[0,h/2,0],['#9ba69e','#afb1a2','#97a4a0'][i%3],false,g,false,true).castShadow=false;
      this.box([25.2,.25,12.2],[0,h+.13,0],'#8a938b',false,g,false,false,'stone').castShadow=false;
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){
        const pane=this.shape(this.distantWindow,[1.2,1.5,1],[-8+col*5.3,3+row*4.1,-6.04],'#677c79',g,false,false,true,'glass');pane.rotation.y=Math.PI;pane.castShadow=false;
      }
    }
    // Near corners carry a real roofline; sky/fog, rather than a flat cap, finishes the vista.
    for(const x of [-32,31])this.box([15,.07,7],[x,.02,24],'#afa392',false,this.group,false,false,'paving');
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
      frontageBox([width,3.2,4.5],[0,1.6,-4.55],color,false,g,false,true);
      this.solidProxy([width,3.2,6.5],[0,1.6,-3.4],g);
      for(const x of [-2.15,2.15]) {
        frontageBox([3.7,2.35,.09],[x,1.23,-2.22],'#333c3c',false,g);
        for(const fx of [x-1.88,x+1.88])frontageBox([.2,2.55,.6],[fx,1.28,-.25],color,false,g,false,true);
        const open=(index+(x>0?1:0))%3!==0;
        if(open) {
          frontageBox([3.5,.04,2.2],[x,.025,-1.05],'#a79b85',false,g,false,false,'paving');
          frontageBox([3.35,1.95,.035],[x,1.25,-2.16],'#756851',false,g,false,false,'wood');
          for(const shelf of [.5,1,1.5]){
            frontageBox([3.3,.07,.45],[x,shelf,-1.56],'#9e8261',false,g,false,false,'wood');
            for(let n=0;n<8;n++){
              const px=x-1.38+n*.38,tint=['#ac9172','#808c70','#b07553','#bead83'][n%4];
              if(index===0||index===5){this.cylinder(.067,.18,[px,shelf+.13,-1.52],tint,g);frontageBox([.16,.018,.16],[px,shelf+.23,-1.52],'#c5bca6');}
              else if(index===2||index===4){const book=frontageBox([.055,.23+random()*.1,.17],[px,shelf+.15,-1.51],tint);book.rotation.z=random()*.12-.06;for(const dy of [-.06,.06])frontageBox([.057,.012,.012],[px,shelf+.15+dy,-1.418],'#d0c4a5');}
              else if(index===3){frontageBox([.29,.07,.22],[px,shelf+.06,-1.5],tint,false,g,false,false,'fabric');frontageBox([.24,.06,.2],[px,shelf+.125,-1.5],'#9a9f87',false,g,false,false,'fabric');}
              else frontageBox([.15,.17,.16],[px,shelf+.12,-1.5],tint);
            }
          }
          frontageBox([2.85,.055,.09],[x,2.24,-1.3],index%2?'#bfdbd1':'#e5bf7c',false,g,true);
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
      const awning=this.shape(this.awnings[(index+(side>0?1:0))%4],[1,1,1],[0,2.40,.61],'#ffffff',g,false,false,true,'fabric');
      const cloth=awning.material as THREE.MeshStandardMaterial;cloth.vertexColors=true;cloth.side=THREE.DoubleSide;
      for(let x=-3.65;x<3.7;x+=.55){const hem=frontageBox([.48,.095,.025],[x,2.19,1.19],index%2?'#61786b':'#b6a17d',false,g,false,false,'fabric');hem.rotation.z=Math.sin(x*13)*.035;}
      this.shopDressing(g,index,side);
    }
    for(let floor=0;floor<spec.floors;floor++) {
      const y=4.55+floor*spec.floorHeight;
      // Spandrels and piers frame sunken glass. Thin shaded reveals bake recess occlusion.
      // Cached through-cut wall panels expose continuous, physically deep reveals.
      for(const x of [-2.8,0,2.8]){const panel=this.shape(this.panels.window(style),[1,1,1],[x,y,-.3],color,g,false,false,true,'plaster');panel.updateWorldMatrix(true,false);this.colliderGeometry.push(panel.geometry.clone().applyMatrix4(panel.matrixWorld));}
      for(const x of [-4.27,4.27])frontageBox([.32,spec.floorHeight,.54],[x,y,-.3],color,false,g,false,true);
      if(spec.floorHeight>2.55)frontageBox([width,spec.floorHeight-2.55,.54],[0,y+1.275+(spec.floorHeight-2.55)/2,-.3],color,false,g,false,true);
      for(const [column,x] of [-2.8,0,2.8].entries()) {
        frontageBox([1.79,1.7,.12],[x,y,-.75],'#494b43');
        const lit=(floor+column+index+(side>0?1:0))%4===0;
        frontageBox([1.42,1.4,.025],[x,y,-.62],lit?'#c3aa7f':'#536569',false,g,lit,false,'glass');
        for(const sx of [-.84,.84])frontageBox([.09,1.73,.19],[x+sx,y,-.16],'#a6977e');
        frontageBox([1.8,.1,.29],[x,y-.87,-.13],'#b8aa92',false,g,false,false,'stone');
        frontageBox([1.79,.12,.21],[x,y+.88,-.17],'#b8aa92',false,g,false,false,'stone');
        frontageBox([.045,1.45,.045],[x,y,-.21],'#526560');
        frontageBox([1.42,.045,.05],[x,y+.1,-.2],'#526560');
        if(lit) {frontageBox([.27,1.37,.035],[x-.48,y,-.59],'#8f8266');frontageBox([.2,1.37,.035],[x+.51,y,-.59],'#8f8266');}
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
          for(let n=0;n<6;n++)frontageBox([.025,.65,.035],[x-.91+n*.36,y-.6,.69],'#52605a',false,g,false,false,'metal');
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
    // Author distinct upper-storey composition without changing ground-floor collision or Fort access.
    if(style==='art-deco'){
      frontageBox([.95,height-3.2,.45],[2.7,(height+3.2)/2,.12],'#cbbda0',false,g,false,false,'stone');
      for(let floor=0;floor<spec.floors;floor++)for(const dx of [2.22,3.18])frontageBox([.08,1.65,.12],[dx,4.55+floor*spec.floorHeight,.37],'#897d67');
    }
    if(style==='heritage'&&index!==4){
      const bay=new THREE.Group();bay.position.set(2.8,0,.33);bay.rotation.y=.10;g.add(bay);
      for(let floor=0;floor<spec.floors;floor++){
        const y=4.55+floor*spec.floorHeight;
        frontageBox([1.86,.18,1.1],[0,y-.94,.13],'#b5a185',false,bay,false,false,'stone');
        for(const side of [-1,1]){const cheek=frontageBox([.42,1.8,.18],[side*.83,y,.11],color,false,bay,false,true);cheek.rotation.y=side*.32;}
        frontageBox([1.83,.12,1.12],[0,y+.94,.12],'#c1ad8a',false,bay,false,false,'stone');
      }
    }
    if(style==='commercial'&&index%2===0)frontageBox([width*.52,1.2,4.1],[-1.8,height+.65,-3.1],color,false,g,false,true);
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
    // Local aging is aligned with piers and water paths, not scattered across windows.
    if(!fort)for(const x of [-4.03,4.03])this.paintWear(g,[x,1.05,.065],.145,1.15,color,`${spec.seed}:damp:${x}`);
    for(let floor=0;floor<spec.floors;floor++)for(const x of [-1.06,1.06])this.paintWear(g,[x,4.3+floor*spec.floorHeight,-.016],.19,.42,color,`${spec.seed}:pier:${floor}:${x}`);
    if(index===0||index===2){const blade=this.sign(g,index===0?(side<0?'CHAI':'PAPERS'):(side<0?'BOOKS':'OPTICS'),'मुंबई',[3.5,3.45,.9],1.0,index%2?'#734d3c':'#3c5148');blade.rotation.y=Math.PI/2;this.wire(new THREE.Vector3(3.5,3.55,0),new THREE.Vector3(3.5,3.55,1.4),.021,'#5f675e',g);}
  }
  private paintWear(parent:THREE.Object3D,position:Triple,width:number,height:number,base:string,seed:string){
    const geometry=patinaGeometry(width,height,seed),color=new THREE.Color(base).lerp(new THREE.Color('#555b4d'),.24),colors=[];
    for(let i=0;i<geometry.attributes.position.count;i++)colors.push(color.r,color.g,color.b);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const mesh=new THREE.Mesh(geometry,this.patinaMaterial);mesh.position.set(...position);mesh.receiveShadow=true;parent.add(mesh);this.patina.push(mesh);
  }
  private mergePatina(){
    this.group.updateMatrixWorld(true);const pieces=this.patina.map(mesh=>{const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);mesh.removeFromParent();mesh.geometry.dispose();return g;});
    const mesh=new THREE.Mesh(mergeGeometries(pieces)!,this.patinaMaterial);mesh.receiveShadow=true;this.group.add(mesh);pieces.forEach(g=>g.dispose());this.patina=[];
  }
  private shopDressing(g:THREE.Group,index:number,side:number){
    const rounded=(size:Triple,p:Triple,color:string,surface:Surface='solid')=>this.shape(this.roundedGeometry,size,p,color,g,false,false,true,surface);
    // Repair bench: housings, speaker grilles, tuning dials and tools.
    if(index===1){for(const [n,x] of [-2.7,-1.2,1.6].entries()){
      rounded([.54,.32,.20],[x,.87,.31],['#7f664d','#8b9585','#6f7976'][n],'wood');
      for(let i=0;i<5;i++)this.box([.026,.20,.015],[x-.15+i*.045,.87,.423],'#373f3c',false,g);
      this.shape(this.sphereGeometry,[.033,.033,.018],[x+.17,.81,.426],'#c2b79a',g);
      this.box([.18,.055,.012],[x+.09,.96,.425],'#bfae86',false,g);
      this.wire(new THREE.Vector3(x-.15,1.02,.32),new THREE.Vector3(x-.25,1.37,.32),.008,'#969b8a',g);
    }}
    // Books are stacked and opened at the stall, rather than all sharing one upright rhythm.
    if(index===2&&side<0){for(let n=0;n<5;n++){
      const p=this.box([.38,.04,.26],[-1.1+n*.48,.66+n%2*.04,.46],['#98836a','#75877c','#936d57'][n%3],false,g);p.rotation.y=(n%3-1)*.18;
      this.box([.34,.021,.23],[-1.1+n*.48,.69+n%2*.04,.46],'#c8bea1',false,g);
    }}
    if(index===2&&side>0){for(let n=0;n<3;n++){
      for(const dx of [-.043,.043]){const lens=this.shape(this.spectacleGeometry,[1,1,1],[-1+n*.35+dx,1.01,.30],'#746d55',g);lens.rotation.x=-.28;}
      this.wire(new THREE.Vector3(-1+n*.35-.014,1.01,.30),new THREE.Vector3(-1+n*.35+.014,1.01,.30),.004,'#746d55',g);
    }}
    // Warm bakery display: rounded loaves and a shallow paper tray.
    if(index===5&&side>0){rounded([1.5,.045,.43],[-1.7,.68,.40],'#ac9270','wood');for(let n=0;n<5;n++){
      this.shape(this.sphereGeometry,[.13,.075,.20],[-2.28+n*.28,.75,.40],n%2?'#b69055':'#c6a36a',g);
      for(let line=0;line<3;line++)this.box([.095,.008,.01],[-2.28+n*.28,.814,.33+line*.06],'#92704a',false,g);
    }}
    if(index===0&&side<0){
      rounded([.65,.035,.42],[1.2,.66,.45],'#a3a28d','metal');
      this.shape(this.sphereGeometry,[.115,.15,.115],[1.2,.835,.42],'#a9a58e',g,false,false,true,'metal');
      this.cylinder(.085,.035,[1.2,.985,.42],'#b3ae94',g);
      for(const x of [.92,1.48])this.cylinder(.037,.073,[x,.72,.48],'#bda88a',g);
      const menu=this.sign(g,'CHAI · BUN MASKA','इरानी कैफ़े',[-3.76,1.66,.23],.48,'#b5a07d','#414b43');menu.scale.y=1.55;
    }
  }
  private station() {
    // Shallow open arcades frame the forecourt and replace the empty boundary-wall backdrop.
    for(const side of [-1,1]){
      const x=side*9.25;
      this.box([5.8,.055,3.7],[x,.015,18.1],'#a79880',false,this.group,false,false,'paving');
      this.box([5.8,3.5,.28],[x,1.75,19.7],'#aa9678',true,this.group,false,true);
      this.box([5.8,.94,3.1],[x,3.95,18.25],'#ad9779',true,this.group,false,true);
      for(const dx of [-2.9,-.97,.97,2.9])this.box([.22,3.5,.33],[x+dx,1.75,16.9],'#c1af90',true,this.group,false,false,'stone');
      for(const dx of [-1.93,0,1.93]){
        this.shape(this.archGeometry,[.87,.88,1],[x+dx,2.19,16.71],'#cbb797',this.group,false,false,true,'stone');
        this.box([1.48,.055,.47],[x+dx,1.0,19.0],'#8b765b',false,this.group,false,false,'wood');
        this.box([.43,.58,.08],[x+dx,1.52,19.35],'#43594d');
        this.box([.28,.18,.02],[x+dx,1.59,19.29],'#b3a17d');
      }
      for(const y of [3.49,4.36])this.box([6.0,.085,.35],[x,y,16.74],'#c1ac8a',false,this.group,false,false,'stone');
      const board=this.sign(this.group,side<0?'MUMBAI LOCAL · TICKETS':'CST · INFORMATION','मुंबई लोकल',[x,3.87,16.66],4.5,'#4d5c50','#e4d4ae');board.rotation.y=Math.PI;
    }
    // Indo-Gothic composition: broad wings, central drum/dome, pointed galleries and corner turrets.
    // Mumbai CST-inspired massing; not a measured replica of the protected monument.
    this.box([23.5,7.0,6.0],[0,3.5,21.5],'#ae9776',true,this.group,false,false,'stone');
    for(const x of [-10,-8,-6,-4,0,4,6,8,10]){
      this.box([1.36,2.66,.08],[x,1.75,18.43],'#485653');
      this.shape(this.pointedArch,[1,1.02,1],[x,1.2,18.18],'#c9b492',this.group,false,false,true,'stone');
      this.box([1.19,1.42,.05],[x,4.9,18.4],'#576562',false,this.group,false,false,'glass');
      this.shape(this.pointedArch,[.91,.78,1],[x,4.23,18.14],'#c7b38f',this.group,false,false,true,'stone');
      for(const dx of [-.9,.9])this.box([.16,6.35,.31],[x+dx,3.2,18.13],'#c3af8a',false,this.group,false,false,'stone');
      this.box([1.7,.12,.48],[x,3.55,18.16],'#8f7e65',false,this.group,false,false,'stone');
    }
    for(const y of [3.58,6.66,6.9])this.box([24,.13,.52],[0,y,18.22],'#cfb994',false,this.group,false,false,'stone');
    for(const x of [-8,8]){const roof=this.shape(this.hippedRoof,[6.0,1.95,4.8],[x,7.87,21.3],'#686e69',this.group,false,false,true,'metal');roof.rotation.y=Math.PI/4;}
    this.box([4.6,3.5,4.6],[0,8.55,21.4],'#b29a76',false,this.group,false,false,'stone');
    this.cylinder(2.47,.28,[0,10.30,21.4],'#d0b68e');
    this.shape(this.dome,[2.8,3.15,2.8],[0,10.45,21.4],'#7f897b',this.group,false,false,true,'metal');
    this.cylinder(.11,.95,[0,14.60,21.4],'#bba47b');
    for(let rib=0;rib<12;rib++)for(let segment=0;segment<5;segment++){
      const point=(t:number)=>{const r=2.65*Math.cos(t*Math.PI/2),y=10.65+3.25*Math.sin(t*Math.PI/2);return new THREE.Vector3(Math.sin(rib*Math.PI/6)*r,y,21.4+Math.cos(rib*Math.PI/6)*r);};
      this.wire(point(segment/5),point((segment+1)/5),.018,'#7f897b');
    }
    for(const x of [-1.48,0,1.48]){
      this.box([.64,1.42,.05],[x,8.65,19.06],'#4c625d',false,this.group,false,false,'glass');
      this.shape(this.pointedArch,[.55,.68,1],[x,7.94,18.96],'#c8b38c',this.group,false,false,true,'stone');
    }
    for(const x of [-11.15,11.15]){
      this.box([1.6,9.5,2.2],[x,4.75,20.1],'#b69c77',false,this.group,false,false,'stone');
      this.cylinder(1.05,.25,[x,9.6,20.1],'#cfb68c');
      this.shape(this.dome,[1.25,1.45,1.25],[x,9.8,20.1],'#7f897b',this.group,false,false,true,'metal');
      this.cylinder(.065,.6,[x,11.75,20.1],'#bba47b');
    }
    // Human-scale plaque, not an oversized billboard carrying the building's identity.
    const sign=this.sign(this.group,'CHHATRAPATI SHIVAJI TERMINUS','छत्रपती शिवाजी टर्मिनस',[0,3.73,18.02],3.4,'#4d5c50','#e4d4ae');sign.rotation.y=Math.PI;
    for(const x of [-2.65,2.65]){
      const clock=new THREE.Mesh(new THREE.CircleGeometry(.38,24),this.surfaces.get('#e4d7b9','stone'));clock.position.set(x,6.00,18.04);clock.rotation.y=Math.PI;this.group.add(clock);
      // Fixed 17:40 scene time, seen from the forecourt (front face points toward -Z).
      const centre=new THREE.Vector3(x,6.0,17.99);
      for(const [angle,length] of [[40*Math.PI/30,.30],[((17+40/60)%12)*Math.PI/6,.22]])this.wire(centre,new THREE.Vector3(x-Math.sin(angle)*length,6+Math.cos(angle)*length,17.99),.012,'#514d42');
    }
    this.stationHost=this.person([5.8,0,8.3],'#829382',false);
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
    // A legible heritage doorway gives Fort its own street-level silhouette.
    for(const side of [-1,1]){
      this.box([.13,2.7,.18],[side*1.6,1.38,.17],'#bdad8e',false,g,false,false,'stone');
      const door=new THREE.Group();door.position.set(side*1.51,.08,.01);door.rotation.y=side*Math.PI*.47;g.add(door);
      this.box([.76,2.48,.065],[side*.38,1.24,0],'#49665c',false,door,false,false,'wood');
      this.box([.60,1.56,.021],[side*.38,1.62,.043],'#66857b',false,door,false,false,'glass');
      for(const x of [side*.1,side*.66])this.box([.022,2.30,.025],[x,1.26,.056],'#b7a686',false,door);
      this.box([.075,.022,.035],[side*.64,1.09,.08],'#c0ac81',false,door,false,false,'metal');
      this.cylinder(.14,.36,[side*2.15,.18,.34],'#a18568',g);
      this.shape(this.leafGeometry,[.75,.8,.75],[side*2.15,.63,.34],'#758f64',g,false,false,true,'foliage');
    }
    this.shape(this.archGeometry,[1.70,.65,.7],[0,2.23,.14],'#c5b394',g,false,false,true,'stone');
    this.sign(g,'RESEARCH · OPEN SOURCE','फोर्ट',[2.48,1.70,.12],.88,'#d0b994','#3c5147').scale.y=1.3;
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
    // Authored teaching exhibit: opposite point charges and sampled field directions.
    // This is a schematic, not a claimed FFprime result or measured benchmark.
    this.box([1.75,.08,.86],[-2.45,1.02,-4.5],'#b3b1a0',false,g,false,false,'stone');
    for(const x of [-3.12,-1.78])this.box([.045,1,.56],[x,.5,-4.5],'#677168',false,g,false,false,'metal');
    const diagram=new THREE.Group();diagram.position.set(-2.45,1.25,-4.5);g.add(diagram);
    for(const side of [-1,1]){this.shape(this.sphereGeometry,[.075,.075,.075],[side*.32,0,0],side>0?'#b17855':'#5c8588',diagram);this.sign(diagram,side>0?'+q':'−q','',[side*.32,.17,.1],.23,'#b9b6a5','#394c4c');}
    for(let ix=-3;ix<=3;ix++)for(let iz=-2;iz<=2;iz++){
      const x=ix*.19,z=iz*.19;if(Math.hypot(x-.32,z)<.15||Math.hypot(x+.32,z)<.15)continue;
      let ex=0,ez=0;for(const charge of [-1,1]){const dx=x-charge*.32,r=Math.max(.08,Math.hypot(dx,z)),scale=charge/(r*r*r);ex+=dx*scale;ez+=z*scale;}
      const length=Math.hypot(ex,ez),a=new THREE.Vector3(x,0,z),b=new THREE.Vector3(x+ex/length*.075,.015,z+ez/length*.075);this.wire(a,b,.006,'#536d68',diagram);
    }
    this.sign(g,'POINT-CHARGE FIELD · SCHEMATIC','Read the interactive research terminal',[-2.45,1.65,-4.9],1.85,'#b4b09b','#394c49');
    // Research-library shelves, journals, pin board and a glazed cabinet create purposeful room depth.
    this.box([.4,2.05,2.6],[3.7,1.05,-3.1],'#81745f',true,g,false,false,'wood');
    for(const y of [.35,.9,1.45,1.95]){
      this.box([.5,.045,2.65],[3.6,y,-3.1],'#b2a185',false,g,false,false,'wood');
      for(let n=0;n<10;n++){this.box([.31,.32,.09],[3.55,y+.18,-4.18+n*.23],['#87988c','#aa9271','#677e80'][n%3],false,g);this.box([.02,.018,.09],[3.385,y+.26,-4.18+n*.23],'#d3c7a9',false,g);}
    }
    this.box([1.4,.9,.04],[1.55,1.8,-6.29],'#a69070',false,g,false,false,'wood');
    for(const x of [1.15,1.65]){this.box([.36,.52,.018],[x,1.83,-6.26],'#d6d1bb',false,g);for(let n=0;n<6;n++)this.box([.27,.013,.02],[x,1.97-n*.05,-6.247],'#75837b',false,g);}
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
      if (i < 3 && side === 1) { const light = new THREE.PointLight('#ffd198', 8, 7, 2);const shop=[[-7.25,1.9,4],[-7.25,1.9,-15],[7.25,1.9,-43.5]][i];light.position.set(...shop as Triple);this.group.add(light); }
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
        for(let leaf=0;leaf<5;leaf++) {
          const position=end.clone().add(new THREE.Vector3((random()-.5)*1.35,(random()-.5)*.65,(random()-.5)*1.35));
          const mesh=this.shape(this.leafGeometry,[1.65,1.65,1.65],position.toArray() as Triple,['#697e52','#829362','#526d50','#8a9865'][leaf%4],this.group,false,false,true,'foliage');mesh.rotation.y=random()*Math.PI;
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
    const human=createHuman(`person:${position.join(':')}`,shirt),g=human.group;g.position.set(...position);if(seated)g.position.y-=.45;this.group.add(g);this.pedestrians.push(g);this.contact(0,0,.23,.15,g);
    if(moving)this.walkers.push({group:g,target:0,wait:0});
    let lastAnimation=-1;
    this.motion.push(time=>{if(g===this.stationHost&&this.stationCharacter){human.mesh.visible=false;this.stationCharacter.update(Math.min(.08,Math.max(0,time-lastAnimation)),false);lastAnimation=time;return;}const distance=g.position.distanceTo(this.viewPosition);human.mesh.visible=distance<48;human.setDetail(distance<10);if(distance>18&&time-lastAnimation<.1)return;lastAnimation=time;const velocity=this.walkers.find(w=>w.group===g)?.agent?.velocity();human.animate(time,moving&&Boolean(velocity&&Math.hypot(velocity.x,velocity.z)>.08),seated);});return g;
  }
  private people() {
    for(let i=0;i<10;i++)this.person([i%2?4.9:-4.9,0,7-i*6],['#8b968c','#9c8279','#788d80','#b0a081','#748b99'][i%5],true);
    for(const [x,z] of [[-6,-10],[6,-23],[-6,-43],[5.8,-46]])this.person([x,0,z],'#a38f78',false);
    this.person([5.9,.03,-16],'#8a9b93',false,true);
  }
  setQuality(low:boolean) { this.pedestrians.forEach((p,i)=>{p.visible=!low||i<3||i%2===0;}); }
  private traffic() {
    for (const kind of ['taxi', 'auto'] as const) {
      const vehicle = createTransitModel(kind); vehicle.position.set(kind === 'taxi' ? 7.4 : -7.4, .02, 12); vehicle.rotation.y = kind === 'auto' ? Math.PI : 0; this.group.add(vehicle);this.solidProxy([2,1.5,3.8],[0,.8,0],vehicle);
      this.interactions.push({ id: `hail-${kind}`, label: `Hail ${kind === 'taxi' ? 'kaali-peeli taxi' : 'auto'}`, position: new THREE.Vector3(kind==='taxi'?6.1:-6.1, 1, vehicle.position.z) });
    }
    for (let i=0;i<3;i++){const vehicle=createTransitModel(i===1?'auto':'taxi');this.group.add(vehicle);this.trafficVehicles.push(vehicle);const pose=this.trafficSystem.pose(i);vehicle.position.set(pose.x,.02,pose.z);vehicle.rotation.y=pose.heading;}
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
  /** Called only by trusted application code once an individually verified asset is approved. */
  async installStationCharacter(asset:VerifiedGLB){
    if(this.disposed||!this.stationHost)throw new Error('Street unavailable');
    const [{GLBAssetLibrary},{GLBCharacter}]=await Promise.all([import('./assets/GLBAssetLibrary'),import('./assets/GLBCharacter')]);
    if(this.disposed)throw new Error('Street disposed during loader initialization');
    this.assetLibrary??=new GLBAssetLibrary(window.location.origin);
    const lease=await this.assetLibrary.acquire(asset);
    if(this.disposed){lease.release();throw new Error('Street disposed during character load');}
    const actor=new GLBCharacter(lease);this.stationCharacter?.dispose();this.stationCharacter=actor;this.stationHost.add(actor.root);
  }
  dispose(){this.disposed=true;this.stationCharacter?.dispose();void this.assetLibrary?.dispose();this.navigation?.dispose();this.navigation=null;this.spatial.dispose();this.panels.dispose();}
  update(time: number, reduced: boolean, viewPosition?:THREE.Vector3) {
    if(viewPosition)this.viewPosition.copy(viewPosition);const delta=reduced?0:Math.min(.08,Math.max(0,time-this.previousTime));this.previousTime=time;
    const start=performance.now();
    if(this.navigation&&delta){
      for(const w of this.walkers){if(!w.agent)continue;const p=w.agent.position(),v=w.agent.velocity();
        if(Math.hypot(p.x-this.destinations[w.target].x,p.z-this.destinations[w.target].z)<.65){w.agent.resetMoveTarget();w.wait+=delta;if(w.wait>3+(w.target%3)){w.target=(w.target+1)%this.destinations.length;w.wait=0;w.agent.requestMoveTarget(this.destinations[w.target]);}}
        const approaching=Math.abs(p.z+12)<2.8&&Math.abs(p.x)>3.9&&Math.abs(p.x)<4.8;
        w.agent.maxSpeed=approaching&&!pedestrianGreen(time)?0:Math.hypot(p.x-this.viewPosition.x,p.z-this.viewPosition.z)<.75?0:1;
        w.group.position.set(p.x,.04,p.z);if(Math.hypot(v.x,v.z)>.05){const yaw=Math.atan2(-v.x,-v.z),turn=Math.atan2(Math.sin(yaw-w.group.rotation.y),Math.cos(yaw-w.group.rotation.y));w.group.rotation.y+=turn*(1-Math.exp(-7*delta));}
      }
      this.navigation.crowd.update(1/30,delta,3);
    }
    this.npcUpdateMs=performance.now()-start;const trafficStart=performance.now();this.trafficSystem.step(delta,time,[{x:this.viewPosition.x,z:this.viewPosition.z},...this.walkers.filter(w=>Math.abs(w.group.position.x)<3.9).map(w=>({x:w.group.position.x,z:w.group.position.z}))]);
    this.trafficVehicles.forEach((vehicle,i)=>{const p=this.trafficSystem.pose(i),turn=Math.atan2(Math.sin(p.heading-vehicle.rotation.y),Math.cos(p.heading-vehicle.rotation.y));vehicle.position.set(p.x,.02,p.z);vehicle.rotation.y+=turn*(1-Math.exp(-8*delta));animateTransit(vehicle,this.trafficSystem.agents[i].distance,turn);});this.trafficUpdateMs=performance.now()-trafficStart;
    for (const animate of this.motion) animate(reduced ? 0 : time);
    this.group.updateMatrixWorld(true);
    for (const { instance, meshes } of this.dynamicBatches) { meshes.forEach((mesh, i) => { let visible=true; for(let p:THREE.Object3D|null=mesh.parent;p&&p!==this.group;p=p.parent)if(!p.visible)visible=false; instance.setMatrixAt(i,visible?mesh.matrixWorld:new THREE.Matrix4().makeScale(0,0,0)); }); instance.instanceMatrix.needsUpdate = true; }
  }
}
