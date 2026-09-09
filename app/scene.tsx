import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout} from './explosion-layout';
import {decodeModelResponse} from './model-download';
import {assetUrl} from './base-url';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,type Atlas,type SceneState} from './anatomy';
/** Colour lives in globals.css. The stage asks for a token by name and holds no literal of its own. */
const token=(name:string,fallback:string)=>{const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();return v||fallback;};
const tokenVec=(name:string,fallback:string)=>{const c=new T.Color(token(name,fallback));return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`;};
interface Props {atlas:Atlas;state:SceneState;onSelect:(id:string)=>void;onFrame?:(id:string)=>void;onProgress:(n:number)=>void;onError:(s:string)=>void}
export default function AnatomyScene({atlas,state,onSelect,onFrame,onProgress,onError}:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),select=useRef(onSelect),frameCb=useRef(onFrame);
 latest.current=state;select.current=onSelect;frameCb.current=onFrame;
 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true,ready=false,lastView='',lastReset=-1,lastIsolate='',layoutKey='',amount=0;
  let lastState:SceneState|null=null;
  const abort=new AbortController();
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{onError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<768?1.5:2));renderer.setClearColor(token('--stage','#f5efe8'));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);
  camera.position.set(1.4,1.05,3.6);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.07;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.96;controls.addEventListener('change',()=>{dirty=true;});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0xa7acb2,1.05));
  const key=new T.DirectionalLight(0xfffaf4,2.3);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0xe9f0ff,1.8);rim.position.set(2,2,-3);scene.add(rim);
  const ground=new T.Mesh(new T.CircleGeometry(30,96),new T.MeshStandardMaterial({color:token('--stage-ground','#eae1d6'),roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.019;scene.add(ground);
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:token('--stage-platform','#f8f3ed'),metalness:.12,roughness:.67}));platform.position.y=-.016;scene.add(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.632,128),new T.MeshBasicMaterial({color:token('--stage-ring','#a08b7a'),transparent:true,opacity:.4,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;scene.add(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.55,.551,128),new T.MeshBasicMaterial({color:token('--stage-ring','#a08b7a'),transparent:true,opacity:.16,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;scene.add(innerRing);
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,T.FloatType);partTexture.needsUpdate=true;
  const selectedData=new Uint8Array(width*4),selectionTexture=new T.DataTexture(selectedData,width,1);selectionTexture.needsUpdate=true;
  // per-part fibre direction for the ligament sheen: the long axis of the part's bounds, in the atlas frame
  const fibreData=new Float32Array(width*4);atlas.parts.forEach((p,i)=>{const s=[p.bounds[1][0]-p.bounds[0][0],p.bounds[1][1]-p.bounds[0][1],p.bounds[1][2]-p.bounds[0][2]];const k=s.indexOf(Math.max(...s));fibreData[i*4+k]=1;fibreData[i*4+3]=1;});
  const fibreTexture=new T.DataTexture(fibreData,width,1,T.RGBAFormat,T.FloatType);fibreTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[],centers=atlas.parts.map(p=>new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(.5));
  const offsets:T.Vector3[]=[],bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  let packingWidth=1,packingHeight=1;
  const markerPositions=new Float32Array(atlas.parts.length*3),markerGeometry=new T.BufferGeometry();markerGeometry.setAttribute('position',new T.BufferAttribute(markerPositions,3));
  const markerMaterial=new T.PointsMaterial({color:token('--ink-3','#7e6c5e'),size:5,sizeAttenuation:false,transparent:true,opacity:.72,depthTest:false});
  markerMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  const markers=new T.Points(markerGeometry,markerMaterial);markers.frustumCulled=false;markers.renderOrder=10;markers.visible=false;scene.add(markers);
  const hover=document.createElement('div');hover.className='part-hover';hover.setAttribute('role','tooltip');hover.hidden=true;el.appendChild(hover);
  type Target={index:number;x:number;y:number;left:number;right:number;top:number;bottom:number};let targets:Target[]=[];
  const projected=new T.Vector3();
  const findTarget=(x:number,y:number,radius:number)=>{
   let best=-1,score=Infinity;
   for(const t of targets){const dx=Math.max(t.left-x,0,x-t.right),dy=Math.max(t.top-y,0,y-t.bottom),distance=Math.hypot(dx,dy);if(distance>radius)continue;const candidate=distance+Math.hypot(t.x-x,t.y-y)*.025;if(candidate<score){score=candidate;best=t.index;}}
   return best;
  };
  const selectColor=tokenVec('--stage-select','#2e7181');
  const contextColor=token('--v3-context','#dad3cb'),ghostColor=token('--v3-ghost','#5a473a'),lineColor=token('--v3-line','#7a3e9d');
  // Every material draws from the same per-part state: an explode offset and a visibility flag in partState, the selection in
  // selectionState.r and the fascial-line station flag in selectionState.g. Shared by the system looks, the ghost and the line.
  const partStateShader=(shader:Parameters<NonNullable<T.Material['onBeforeCompile']>>[0],tint:boolean)=>{
   shader.uniforms.partState={value:partTexture};shader.uniforms.selectionState={value:selectionTexture};shader.uniforms.stateWidth={value:width};
   shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected; varying float partStation;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; vec4 sel = texture2D(selectionState, stateUv); partSelected = sel.r; partStation = sel.g;');
   shader.fragmentShader='varying float partVisible; varying float partSelected; varying float partStation;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
   if(tint)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, '+selectColor+', partSelected * 0.75);');
  };
  // The authored layers get their own looks (Phase 4B). Nerves and the cord: matte pale cream, no gloss, a faint fibrous grain
  // along their length. Ligaments: ivory, a sheen that runs along the fibre direction (the part's long axis) rather than a
  // round highlight. Fascia: translucent off-white sheets at 0.35, drawn before the insertion patches so those sit on top.
  // The dura is a translucent sheath. Colours are tokens in globals.css.
  const LOOKS:Record<string,{color:string;roughness:number;metalness?:number;opacity?:number;order?:number;grain?:boolean;sheen?:boolean}>={
   'peripheral-nerves':{color:token('--v3-nerve-surface','#ede3c9'),roughness:.96,grain:true},
   'central-nerves':{color:token('--v3-nerve-surface','#ede3c9'),roughness:.96,grain:true},
   'ligaments':{color:token('--v3-ligament-surface','#f2ecdd'),roughness:.62,sheen:true},
   'fascia':{color:token('--v3-fascia-surface','#f4efe6'),roughness:.7,opacity:.35,order:-2},
   'dura':{color:token('--v3-dura-surface','#e6e0d8'),roughness:.6,opacity:.28,order:-2},
   'insertions':{color:SYSTEMS.find(s=>s.id==='insertions')?.color??'#8e3b2f',roughness:.5,order:2},
  };
  const materialFor=(system:string,context=false)=>{
   // context: a neighbouring region's part drawn dim and unselectable, depthWrite off so it never occludes the region itself
   const look=context?null:LOOKS[system];
   const translucent=!!look?.opacity;
   const m=new T.MeshStandardMaterial({color:context?contextColor:look?.color??SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:look?.metalness??.08,roughness:context?.9:look?.roughness??.53,side:T.DoubleSide,transparent:context||translucent||system==='integumentary',opacity:context?.22:look?.opacity??(system==='integumentary'?.1:1),depthWrite:!context&&!translucent&&system!=='integumentary'});
   m.onBeforeCompile=shader=>{
    if(look?.grain){
     // a fine fibrous grain: the normal is tilted by a longitudinal hash of the position, so the tube reads as bundled fibres
     shader.vertexShader='varying vec3 vFibrePos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFibrePos = transformed;');
     shader.fragmentShader='varying vec3 vFibrePos;\nfloat fibreHash(vec3 p){return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);}\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{ vec3 q = vFibrePos * 900.0; float g = fibreHash(floor(vec3(q.x, q.y * 0.08, q.z))) - 0.5; normal = normalize(normal + 0.12 * g * vec3(1.0, 0.0, 1.0)); }');
    }
    if(look?.sheen){
     // anisotropic sheen along the fibre direction: the part's long axis, read per part from the fibre texture
     shader.uniforms.fibreState={value:fibreTexture};
     shader.vertexShader='varying vec3 vFibreDir;\nuniform sampler2D fibreState;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFibreDir = normalize((modelMatrix * vec4(texture2D(fibreState, vec2((partIndex + 0.5) / stateWidth, 0.5)).xyz, 0.0)).xyz);');
     shader.fragmentShader='varying vec3 vFibreDir;\n'+shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n{ vec3 t = normalize(vFibreDir - normal * dot(vFibreDir, normal)); vec3 v = normalize(vViewPosition); vec3 l = normalize(vec3(-0.4, 0.8, 0.6)); vec3 h = normalize(l + v); float th = dot(t, h); float sheen = pow(max(0.0, sqrt(1.0 - th * th)), 24.0); reflectedLight.directSpecular += vec3(0.18) * sheen; }');
    }
    partStateShader(shader,true);
   };materials.push(m);return m;
  };
  const mats=new Map<string,T.Material>([...SYSTEMS.map(s=>[s.id,materialFor(s.id)] as [string,T.Material]),['dura',materialFor('dura')]]),contextMats=new Map<string,T.Material>([...SYSTEMS.map(s=>[s.id,materialFor(s.id,true)] as [string,T.Material]),['dura',materialFor('central-nerves',true)]]);
  // A picked fascial line, drawn the way mvmt-program draws one: its stations opaque in the line colour, lit and glowing so they
  // keep their shape; every other loaded part a ghost - flat, 12% alpha, no depth write, unpickable - so the body is there to
  // place the line on and nothing else competes with it. No tube, no path: the connective tissue between stations has no
  // geometry here, and drawing one would claim it does. Station fragments are discarded from the ghost pass and drawn by the
  // line mesh alone, which keeps them opaque with their own depth; the ghost is one material swapped onto every loaded mesh
  // while a line is lit, and the system looks come back after. One ghost colour makes the blending order-independent.
  const ghostMat=new T.MeshBasicMaterial({color:ghostColor,transparent:true,opacity:.12,depthWrite:false,side:T.DoubleSide});
  ghostMat.onBeforeCompile=shader=>{partStateShader(shader,false);shader.fragmentShader=shader.fragmentShader.replace('if (partVisible < 0.5) discard;','if (partVisible < 0.5 || partStation > 0.5) discard;');};
  const lineMat=new T.MeshStandardMaterial({color:lineColor,emissive:lineColor,emissiveIntensity:.3,roughness:.6,metalness:0,side:T.DoubleSide});
  lineMat.onBeforeCompile=shader=>partStateShader(shader,true);
  materials.push(ghostMat,lineMat);
  const depthMap=atlas.layers?.muscleDepth?.parts??{};
  // Chunks are fetched on demand. A chunk key is 'main:<i>' (atlas.chunks) or 'overview:<i>'
  // (atlas.overview.chunks, the decimated whole body, same part ids at other offsets). The page
  // says which keys it wants (a region's own chunks, the overview, a system's chunks); sets no
  // longer wanted are disposed, so a part is drawn from at most one layout at a time and a
  // region view never holds the whole body in memory.
  const partLoaded=new Uint8Array(atlas.parts.length);           // 0 absent, 1 full detail, 2 overview, 3 context (dim, unselectable)
  const loadedSets=new Map<string,{meshes:T.Mesh[];geometries:T.BufferGeometry[];parts:number[]}>();
  const inflight=new Map<string,Promise<void>>();
  let wantedKeys:string[]=[],wantedContext:string[]=[],syncing=0,ownComplete=false;
  // the fascial line: whether one is lit right now, and which parts are its stations (1) - kept beside the shader flag for picking
  let lineActive=false;const stationFlag=new Uint8Array(atlas.parts.length);
  const partIndex=new Map(atlas.parts.map((p,i)=>[p.id,i]));
  const layoutsIn=(key:string):[number,{chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number}][]=>{
   const [kind,ci]=key.split(':');const index=+ci;
   if(kind==='overview'){const ov=atlas.overview;if(!ov)return[];return atlas.parts.map((p,i)=>[i,ov.parts[p.id]] as const).filter(([,l])=>l&&l.chunk===index).map(([i,l])=>[i,l]);}
   if(kind==='context'){const cx=atlas.contexts?.[ci];if(!cx)return[];return Object.entries(cx.parts).map(([id,l])=>[partIndex.get(id)!,l] as [number,typeof l]).filter(([i])=>i!==undefined);}
   return atlas.parts.map((p,i)=>[i,p] as const).filter(([,p])=>p.chunk===index).map(([i,p])=>[i,p]);
  };
  const loadSet=async(key:string)=>{
   const [kind,ci]=key.split(':');const chunk=kind==='overview'?atlas.overview!.chunks[+ci]:kind==='context'?atlas.chunks[atlas.contexts![ci].chunk]:atlas.chunks[+ci];
   // Only the gzipped chunks ship (GitHub Pages serves them as raw bytes), so decoding is not optional.
   if(!chunk.gzip)throw new Error('This anatomy catalogue has no compressed geometry.');if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress the anatomy files. Please use a current browser.');
   const t0=performance.now();
   const response=await fetch(assetUrl(chunk.gzip),{signal:abort.signal});const t1=performance.now();const buffer=await decodeModelResponse(response,chunk.bytes,true);const t2=performance.now();if(disposed||!(wantedKeys.includes(key)||wantedContext.includes(key)))return;
   const groups=new Map<string,T.BufferGeometry[]>(),own:T.BufferGeometry[]=[],parts:number[]=[];
   const layouts=layoutsIn(key);
   if(kind==='context'&&!layouts.length){console.error('context set '+key+' names no parts: atlas.contexts is out of step with atlas.parts');throw new Error('context set '+key+' is empty');}
   for(const [i,l] of layouts){
    if(partLoaded[i])continue;const p=atlas.parts[i];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,l.positions,l.vertexCount*3),3));
    // GPU normalized signed-short normals keep the complete atlas compact in memory.
    g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,l.normals,l.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,l.indices,l.indexCount),1));
    g.boundingBox=bounds[i].clone();g.computeBoundingSphere();const pick=new T.Mesh(g);pick.matrixAutoUpdate=false;pickers[i]=pick;own.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(l.vertexCount).fill(i),1));
    // the dura is drawn with its own translucent look, grouped apart from the rest of the central nerves
    const groupKey=(p as {material?:string}).material==='Dura'?'dura':p.system;
    const list=groups.get(groupKey)??[];list.push(g);groups.set(groupKey,list);partLoaded[i]=kind==='overview'?2:kind==='context'?3:1;parts.push(i);
   }
   const meshes:T.Mesh[]=[];
   groups.forEach((gs,system)=>{const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('Could not assemble anatomy geometry.');own.push(geometry);const base=(kind==='context'?contextMats:mats).get(system as never)??mats.get(system==='dura'?'central-nerves' as never:system as never)!;const mesh=new T.Mesh(geometry,lineActive&&kind!=='context'?ghostMat:base);mesh.userData.base=base;mesh.frustumCulled=false;mesh.renderOrder=kind==='context'?-1:LOOKS[system]?.order??0;scene.add(mesh);meshes.push(mesh);});
   loadedSets.set(key,{meshes,geometries:own,parts});lastState=null;layoutKey='';lineKey='';dirty=true;
   // timing per chunk set, readable as performance.getEntriesByName('chunk') and in window.__atlas.timings
   const t3=performance.now();timings.push({key,parts:parts.length,fetchMs:Math.round(t1-t0),decodeMs:Math.round(t2-t1),buildMs:Math.round(t3-t2)});performance.measure('chunk',{start:t0,end:t3,detail:key});
  };
  const timings:{key:string;parts:number;fetchMs:number;decodeMs:number;buildMs:number}[]=[];
  // The region's context is fetched only once every one of its own chunks has been drawn.
  const syncContext=(keys:string[])=>{
   wantedContext=keys;
   for(const key of [...loadedSets.keys()])if(key.startsWith('context:')&&!keys.includes(key))unloadSet(key);
   if(!ownComplete)return;
   // a context set that fails is a dim surround missing, not a broken view: reported, never fatal
   for(const key of keys){if(loadedSets.has(key)||inflight.has(key))continue;const job=loadSet(key).catch(e=>{if(!disposed)console.warn('context set '+key+' could not load',e);}).finally(()=>inflight.delete(key));inflight.set(key,job);}
  };
  const unloadSet=(key:string)=>{
   const rec=loadedSets.get(key);if(!rec)return;loadedSets.delete(key);
   rec.meshes.forEach(m=>scene.remove(m));rec.geometries.forEach(g=>g.dispose());rec.parts.forEach(i=>{pickers[i]=undefined;partLoaded[i]=0;});lastState=null;layoutKey='';lineKey='';dirty=true;
  };
  const sync=(keys:string[])=>{
   wantedKeys=keys;const generation=++syncing;ownComplete=false;
   for(const key of [...loadedSets.keys()])if(!keys.includes(key)&&!key.startsWith('context:'))unloadSet(key);
   const missing=keys.filter(k=>!loadedSets.has(k)&&!inflight.has(k));
   const report=()=>{const done=keys.filter(k=>loadedSets.has(k)).length;onProgress(keys.length?Math.round(done/keys.length*100):100);};
   report();
   (async()=>{try{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<missing.length){const key=missing[cursor++];const job=loadSet(key).finally(()=>inflight.delete(key));inflight.set(key,job);await job;if(generation===syncing)report();}}));if(!disposed&&generation===syncing){ready=true;dirty=true;report();ownComplete=true;syncContext(wantedContext);}}catch(e){if(!disposed)onError(e instanceof Error?e.message:'Could not load the anatomy.');}})();
  };
  let lastKeys='',lastContextKeys='',lineKey='',lastFrame=-1,lineMesh:T.Mesh|null=null;
  // the station set of the picked line: written to selectionState.g for the shaders and kept in stationFlag for picking
  const setStations=(line:{id:string;parts:string[]}|null|undefined)=>{stationFlag.fill(0);for(const id of line?.parts??[]){const i=partIndex.get(id);if(i!==undefined)stationFlag[i]=1;}for(let i=0;i<atlas.parts.length;i++)selectedData[i*4+1]=stationFlag[i]?255:0;selectionTexture.needsUpdate=true;};
  // the line mesh: every loaded station part merged into one opaque mesh in the line material. Rebuilt when the line or the
  // loaded sets change (loadSet and unloadSet clear lineKey). A context copy of a station is not lit: a region view lights
  // the stations it holds itself, and the whole body holds every part in the overview.
  const buildLine=()=>{
   if(lineMesh){scene.remove(lineMesh);lineMesh.geometry.dispose();lineMesh=null;}
   const gs:T.BufferGeometry[]=[];for(let i=0;i<atlas.parts.length;i++)if(stationFlag[i]&&pickers[i]&&partLoaded[i]===1||stationFlag[i]&&pickers[i]&&partLoaded[i]===2)gs.push(pickers[i]!.geometry);
   if(!gs.length)return;
   const geometry=mergeGeometries(gs,false);if(!geometry)return;
   lineMesh=new T.Mesh(geometry,lineMat);lineMesh.frustumCulled=false;lineMesh.renderOrder=1;lineMesh.visible=lineActive;scene.add(lineMesh);dirty=true;
  };
  // lights or unlights the line: every loaded mesh swaps between its system look and the ghost, and the line mesh follows
  const setLineActive=(on:boolean)=>{
   if(on===lineActive)return;lineActive=on;
   loadedSets.forEach((rec,key)=>{const context=key.startsWith('context:');rec.meshes.forEach(m=>{m.material=on&&!context?ghostMat:m.userData.base as T.Material;});});
   if(lineMesh)lineMesh.visible=on;dirty=true;
  };
  // inspection hook for the browser console: which sets are held, how each part is loaded, and what a lit line is drawing
  (window as unknown as {__atlas?:unknown}).__atlas={loaded:()=>[...loadedSets.entries()].map(([k,v])=>[k,v.parts.length,v.meshes.length]),kinds:()=>{const c=[0,0,0,0];partLoaded.forEach(v=>c[v]++);return c;},visible:()=>{let n=0;for(let i=0;i<atlas.parts.length;i++)if(data[i*4+3]>.5)n++;return n;},timings:()=>timings.slice(),
   line:()=>{let stations=0,lit=0,ghost=0;for(let i=0;i<atlas.parts.length;i++){if(stationFlag[i])stations++;if(data[i*4+3]>.5){if(stationFlag[i])lit++;else ghost++;}}return {active:lineActive,stations,lit,ghost,mesh:lineMesh?lineMesh.geometry.getAttribute('position').count:0};}};
  const fit=(view:string,extent=0)=>{
   const aspect=camera.aspect,mobile=el.clientWidth<768,normalDistance=mobile?Math.max(4.5,1.8*el.clientHeight/Math.max(160,el.clientHeight-350)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))):4;
   const reservedHeight=mobile?350:270;const availableAspect=Math.max(.35,(el.clientWidth-(mobile?40:340))/Math.max(160,el.clientHeight-reservedHeight));const atlasDistance=Math.max(packingHeight,packingWidth/availableAspect)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*(el.clientHeight/Math.max(160,el.clientHeight-reservedHeight))*1.08;
   let distance=T.MathUtils.lerp(normalDistance,Math.max(.2,atlasDistance),extent);if(extent>.8)view='front';
   const direction=view==='front'?new T.Vector3(0,.02,1):view==='back'?new T.Vector3(0,.02,-1):view==='side'?new T.Vector3(1,.02,0):view==='right'?new T.Vector3(-1,.02,0):view==='top'?new T.Vector3(0,1,.02).normalize():new T.Vector3(.35,.06,1).normalize();
   controls.target.set(extent>.1&&el.clientWidth>767?-packingWidth*.12:0,extent>.1||mobile?.85:.68,0);
   // a region view frames the region's own bounds instead of the body
   const focus=latest.current.focus;
   if(focus&&extent<.1){const box=new T.Box3(new T.Vector3().fromArray(focus[0]),new T.Vector3().fromArray(focus[1]));const size=box.getSize(new T.Vector3());box.getCenter(controls.target);distance=Math.max(.3,Math.max(size.y,size.x/Math.max(.6,camera.aspect),size.z)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*1.45);}
   camera.position.copy(controls.target).addScaledVector(direction,distance);controls.update();dirty=true;
  };
  const resize=()=>{layoutKey='';lastState=null;renderer.setPixelRatio(Math.min(devicePixelRatio,el.clientWidth<768||el.clientHeight<600?1.5:2));camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);fit(latest.current.view,amount);};const observer=new ResizeObserver(resize);observer.observe(el);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap(),worldBox=new T.Box3(),hitPoint=new T.Vector3();
  const down=(e:PointerEvent)=>{hover.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);};
  const move=(e:PointerEvent)=>{tap.move(e.pointerId,e.clientX,e.clientY);if(e.buttons||amount<.5||e.pointerType==='touch'){hover.hidden=true;return;}const rect=el.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,index=findTarget(x,y,12);hover.hidden=index<0;renderer.domElement.style.cursor=index<0?'grab':'pointer';if(index>=0){hover.textContent=atlas.parts[index].name;hover.style.left=`${Math.max(8,Math.min(x+14,el.clientWidth-260))}px`;hover.style.top=`${Math.max(8,Math.min(y+18,el.clientHeight-55))}px`;}};
  const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);
  const up=(e:PointerEvent)=>{
   const validTap=tap.up(e.pointerId,e.clientX,e.clientY);if(!validTap||!ready)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   let nearest=Infinity,found=-1;const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);
   // the ghost of a lit line is not pickable: only its stations answer a tap
   pickers.forEach((mesh,i)=>{if(!mesh||partLoaded[i]===3||data[i*4+3]<.5||(lineActive&&!stationFlag[i])||(hasSolid&&atlas.parts[i].system==='integumentary'))return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}});
   if(found<0&&amount>.45)found=findTarget(e.clientX-rect.left,e.clientY-rect.top,e.pointerType==='touch'?24:16);if(found>=0){hover.hidden=true;select.current(atlas.parts[found].id);}
  };
  // double-click frames the part under the pointer (and selects it); the same ray as a tap, context parts excluded
  const pickAt=(e:MouseEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);let nearest=Infinity,found=-1;pickers.forEach((mesh,i)=>{if(!mesh||partLoaded[i]===3||data[i*4+3]<.5||(lineActive&&!stationFlag[i]))return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}});return found;};
  const dbl=(e:MouseEvent)=>{if(!ready||amount>.45)return;const found=pickAt(e);if(found>=0)frameCb.current?.(atlas.parts[found].id);};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('dblclick',dbl);
  const clock=new T.Clock();let lastExtent=-1;
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),s=latest.current;
   const keys=(s.chunkKeys??[]).join(',');if(keys!==lastKeys){lastKeys=keys;sync(s.chunkKeys??[]);}
   const ckeys=(s.contextKeys??[]).join(',');if(ckeys!==lastContextKeys){lastContextKeys=ckeys;syncContext(s.contextKeys??[]);}
   // the picked line: its station set and mesh follow the line and the loaded sets; it is lit only assembled and not
   // isolated, since stations pulled apart, or one part on its own, are not a line
   const nextLineKey=s.line?s.line.id+':'+s.line.parts.length:'';if(nextLineKey!==lineKey){lineKey=nextLineKey;setStations(s.line);buildLine();}
   const wasLit=lineActive;setLineActive(!!s.line&&amount<.05&&!s.isolate);
   const changed=lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate||lastState?.hiddenParts!==s.hiddenParts||lastState?.depth!==s.depth||lastState?.line!==s.line||wasLit!==lineActive;
   const moving=Math.abs(amount-s.explode)>.0001;
   if(moving){amount=T.MathUtils.damp(amount,s.explode,8,dt);dirty=true;}
   if(changed||moving||lastExtent<0){
    const visible=new Set(s.visible),selection=new Set(s.selected),hidden=new Set(s.hiddenParts??[]),anyOn=s.visible.length>0;
    // muscle depth: a muscle with no depth entry is shown under every setting rather than lost
    const shown=(p:typeof atlas.parts[number],i:number)=>{if(!partLoaded[i]||hidden.has(p.id))return false;if(s.depth&&p.system==='muscular'){const d=depthMap[p.id];if(d&&d!==s.depth&&!selection.has(p.id))return false;}return s.isolate?selection.has(p.id):visible.has(p.system)||selection.has(p.id);};
    const visibleParts=atlas.parts.filter((p,i)=>partLoaded[i]!==3&&shown(p,i));
    const nextLayoutKey=visibleParts.map(p=>p.id).join(',')+':'+camera.aspect.toFixed(3);
    if(nextLayoutKey!==layoutKey){const layout=createExplosionLayout(visibleParts,camera.aspect);packingWidth=layout.width;packingHeight=layout.height;atlas.parts.forEach((p,i)=>{const cell=layout.cells.get(p.id);offsets[i]=cell?new T.Vector3(cell.x,cell.y+.85,0):centers[i].clone();});layoutKey=nextLayoutKey;if(amount>.05&&!s.isolate)fit(s.view,Math.max(0,(amount-.3)/.7));}

    atlas.parts.forEach((p,i)=>{
     const c=centers[i],destination=offsets[i];let dx=0,dy=0,dz=0;
     if(amount<=.45){const t=amount/.45;const group=SYSTEMS.findIndex(sys=>sys.id===p.system);const angle=group/SYSTEMS.length*Math.PI*2;dx=Math.sin(angle)*t*.48;dy=(c.y-.85)*t*.28;dz=Math.cos(angle)*t*.48;}
     else {const t=(amount-.45)/.55,group=SYSTEMS.findIndex(sys=>sys.id===p.system),angle=group/SYSTEMS.length*Math.PI*2;dx=T.MathUtils.lerp(Math.sin(angle)*.48,destination.x-c.x,t);dy=T.MathUtils.lerp((c.y-.85)*.28,destination.y-c.y,t);dz=T.MathUtils.lerp(Math.cos(angle)*.48,-c.z,t);}
     const selected=selection.has(p.id);
     // a lit line: its stations shown whatever the toggles say, the rest the ghost - what the toggles show, or the skeleton
     // and muscles when nothing is on, so there is a body to place the line on - and context copies hidden
     const on=lineActive?(!partLoaded[i]||partLoaded[i]===3||hidden.has(p.id)?false:stationFlag[i]===1||(anyOn?shown(p,i):p.system==='skeletal'||p.system==='muscular')):partLoaded[i]===3?(!s.isolate&&visible.has(p.system)&&amount<.05):shown(p,i);
     data.set([dx,dy,dz,on?1:0],i*4);selectedData[i*4]=selected?255:0;
     markerPositions.set(data[i*4+3]>.5?[c.x+dx,c.y+dy,c.z+dz]:[10000,10000,10000],i*3);const mesh=pickers[i];if(mesh){mesh.position.set(dx,dy,dz);mesh.updateMatrix();mesh.updateMatrixWorld(true);}
    });partTexture.needsUpdate=true;selectionTexture.needsUpdate=true;markerGeometry.attributes.position.needsUpdate=true;lastState=s;lastExtent=amount;dirty=true;
   }
   if(s.view!==lastView||s.reset!==lastReset){fit(s.view,amount);lastView=s.view;lastReset=s.reset;}
   // framing: move the camera to the part without hiding anything else; the current view direction is kept
   if(s.frame&&s.frame.n!==lastFrame){lastFrame=s.frame.n;const i=partIndex.get(s.frame.id);if(i!==undefined&&pickers[i]){const box=bounds[i].clone().translate(pickers[i]!.position);const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()).length();const dir=camera.position.clone().sub(controls.target).normalize();const distance=Math.max(.12,size/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*1.6);controls.target.copy(center);camera.position.copy(center).addScaledVector(dir,distance);controls.update();dirty=true;}}
   if(moving&&!s.isolate)fit(amount>.5?'front':s.view,Math.max(0,(amount-.3)/.7));
   const isolateKey=s.isolate?s.selected.join(',')+':'+s.reset+':'+s.inspectorOpen+':'+camera.aspect:'';
   if(isolateKey!==lastIsolate||(s.isolate&&moving)){
    if(s.isolate){const box=new T.Box3();atlas.parts.forEach((p,i)=>{if(s.selected.includes(p.id))box.union(bounds[i].clone().translate(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])));});
     if(!box.isEmpty()){const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const w=el.clientWidth,h=el.clientHeight,mobile=w<768,landscape=w>h&&h<=600;let left=20,right=w-20,top=mobile?175:110,bottom=h-170;if(s.inspectorOpen){if(landscape){right=w-335;top=100;bottom=h-125;}else if(mobile){const sheet=document.querySelector('.detail-sheet')?.getBoundingClientRect(),header=document.querySelector('.identity')?.getBoundingClientRect();top=(header?.bottom??94)+16;bottom=(sheet?.top??h*.58-139)-16;}else{right=w-370;left=w>1100?285:25;}}const availableWidth=Math.max(150,right-left),availableHeight=Math.max(40,bottom-top);camera.setViewOffset(w,h,w/2-(left+right)/2,h/2-(top+bottom)/2,w,h);const distance=Math.max(.07,Math.max(size.y*h/availableHeight,size.x*w/availableWidth/camera.aspect,size.z)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*1.35);controls.maxDistance=Math.max(40,distance*2);controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(.2,.1,1).normalize().multiplyScalar(distance));controls.update();dirty=true;}
    }else if(lastIsolate){camera.clearViewOffset();fit(s.view,amount);}
    lastIsolate=isolateKey;
   }
   controls.enableRotate=amount<.8;controls.mouseButtons.LEFT=amount<.8?T.MOUSE.ROTATE:T.MOUSE.PAN;controls.touches.ONE=amount<.8?T.TOUCH.ROTATE:T.TOUCH.PAN;ground.visible=platform.visible=ring.visible=innerRing.visible=amount<.5&&!s.isolate;markers.visible=amount>.75;controls.autoRotate=s.rotate&&!s.isolate&&amount<.4;controls.autoRotateSpeed=.65;controls.update();if(controls.autoRotate)dirty=true;
   if(dirty){renderer.render(scene,camera);targets=[];if(amount>.45){const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);atlas.parts.forEach((p,i)=>{if(data[i*4+3]<.5||(hasSolid&&p.system==='integumentary'))return;let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(let corner=0;corner<8;corner++){projected.set(p.bounds[(corner&1)?1:0][0]+data[i*4],p.bounds[(corner&2)?1:0][1]+data[i*4+1],p.bounds[(corner&4)?1:0][2]+data[i*4+2]).project(camera);const x=(projected.x+1)*el.clientWidth/2,y=(1-projected.y)*el.clientHeight/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}projected.copy(centers[i]).add(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])).project(camera);if(projected.z< -1||projected.z>1)return;targets.push({index:i,x:(projected.x+1)*el.clientWidth/2,y:(1-projected.y)*el.clientHeight/2,left,right,top,bottom});});}dirty=false;}

  };animate();
  const contextLost=(e:Event)=>{e.preventDefault();onError('The 3D session was paused by your device. Reload to continue.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('dblclick',dbl);if(lineMesh){scene.remove(lineMesh);lineMesh.geometry.dispose();lineMesh=null;}[...loadedSets.keys()].forEach(unloadSet);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});env.dispose();partTexture.dispose();selectionTexture.dispose();markerGeometry.dispose();markerMaterial.dispose();hover.remove();renderer.dispose();renderer.domElement.remove();};
 },[atlas]);
 return <div className="scene" ref={host}/>;
}
