// Re-chunk BodyParts3D's own parts by region so a region fetches only its own chunks.
//
// Skeletal, muscular, nervous and connective parts are assigned to one of the nine MVMT regions
// by the fit's blend weights (atlas.regions[].anchors: the landmarks of each region, in this
// frame) at the part's centroid, and listed as spanning the other regions whose weight at any
// bounds corner is strong; those four systems are written as body-<region>.bin, one chunk per
// region. Arteries and veins go to their own chunk set (body-vessels-*.bin) and every other
// system to body-organs-*.bin, so they are fetched only when toggled on. The MVMT layer chunks
// (mvmt-<region>.bin) and the overview are left as they are. atlas.chunkSets says which chunk
// indices a region, the whole body or a system needs. Idempotent: re-runs re-pack from the
// current chunks. Run before compress-models.mjs.
//   node scripts/rechunk-bp3d.mjs [mvmt-anatomy/region-assignment.csv]
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {NEIGHBOURS,REGION_OVERRIDES,SYSTEM_OVERRIDES} from './overrides.mjs';
const dir=new URL('../public/models/',import.meta.url);
const atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',dir),'utf8'));
// BP3D's own mislabels first, so region and chunk decisions see the right system
let moved=[];
for(const p of atlas.parts){if(p.source)continue;const o=SYSTEM_OVERRIDES.find(o=>o.match.test(p.name));if(o&&p.system!==o.system){moved.push(p.name+': '+p.system+' -> '+o.system);p.bp3dSystem=p.bp3dSystem||p.system;p.system=o.system;}}
const REGIONAL=new Set(['skeletal','muscular','nervous','connective','fascia']);
const VESSELS=new Set(['arterial','venous']);
if(!atlas.regions?.every(r=>r.anchors?.length))throw new Error('atlas.regions[].anchors missing: re-run merge-layers.mjs');
const sigma=atlas.layers?.blend?.sigma??0.12;

const source=atlas.chunks.map(c=>{const raw=new URL(c.url.split('/').pop(),dir);if(fs.existsSync(raw))return fs.readFileSync(raw);return gunzipSync(fs.readFileSync(new URL(c.gzip.split('/').pop(),dir)));});
// every read of a part's geometry goes through its layout as loaded: packInto rewrites the offsets as it packs, and
// the context copy below used to read the old chunk at the new offset - which only agreed because a re-run repacks
// identically, and crashed the first time a part changed region
const loadedLayout=new Map(atlas.parts.map(p=>[p.id,{chunk:p.chunk,positions:p.positions,normals:p.normals,indices:p.indices}]));
const readPart=p=>{const o=loadedLayout.get(p.id);const b=source[o.chunk];return {pos:new Float32Array(b.buffer,b.byteOffset+o.positions,p.vertexCount*3),nor:new Int16Array(b.buffer,b.byteOffset+o.normals,p.vertexCount*3),idx:new Uint32Array(b.buffer,b.byteOffset+o.indices,p.indexCount)};};
const weightsAt=p=>Object.fromEntries(atlas.regions.map(r=>{let d2=Infinity;for(const a of r.anchors){const d=(p[0]-a[0])**2+(p[1]-a[1])**2+(p[2]-a[2])**2;if(d<d2)d2=d;}return [r.id,Math.exp(-d2/(sigma*sigma))];}));
const argmax=w=>Object.entries(w).sort((a,b)=>b[1]-a[1])[0][0];

// assign: a BP3D part whose name matches one of ours takes our region (mvmt-anatomy's clinical
// assignment, region-assignment.csv, matched by normalised token set: "Left tenth rib" is
// "Tenth rib.l"); anything else takes the region whose landmarks its centroid is nearest, by
// the fit's blend weights. Landmark distance alone put the ribs in the shoulder.
const assignmentPath=process.argv[2];
const norm=s=>{s=s.toLowerCase().replace(/\.[lr]$/,'').replace(/[()]/g,'').replace(/\bcolli\b/g,'cervicis');const drop=new Set(['muscle','of','part','the','bone','left','right','and']);return s.split(/[^a-z0-9-]+/).filter(w=>w&&!drop.has(w)).sort().join(' ');};
const ourRegion=new Map();
if(assignmentPath){for(const line of fs.readFileSync(assignmentPath,'utf8').split(/\r?\n/).slice(1)){const [name,region]=line.split(',');if(name&&region&&!ourRegion.has(norm(name)))ourRegion.set(norm(name),region);}}
const ROMAN=[['first','1'],['second','2'],['third','3'],['fourth','4'],['fifth','5'],['sixth','6'],['seventh','7'],['eighth','8'],['ninth','9'],['tenth','10'],['eleventh','11'],['twelfth','12']];
const aliases=name=>{ // BP3D's words in Z-Anatomy's: "Tenth thoracic vertebra" is "Vertebra T10"
 const out=[name];const m=name.match(/^(?:Intervertebral disk of )?(\w+) (cervical|thoracic|lumbar) vertebra$/i);
 if(m){const n=ROMAN.find(([w])=>w===m[1].toLowerCase());if(n)out.push('Vertebra '+m[2][0].toUpperCase()+n[1]);}   // a disc goes with its vertebra
 const c=name.match(/^(?:Left|Right) (\w+) costal cartilage$/i);if(c)out.push('Costal cartilage of '+c[1].toLowerCase()+' rib');   // "Left second costal cartilage" is "Costal cartilage of second rib.l"
 return out;
};
const assigned={};let byName=0,byLandmark=0,byOverride=0;const overridden=[];
for(const p of atlas.parts){
 if(p.source||!REGIONAL.has(p.system))continue;
 const [lo,hi]=p.bounds;const c=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];
 let home=null;for(const a of aliases(p.name)){const r=ourRegion.get(norm(a));if(r){home=r;break;}}
 if(home)byName++;
 else{const o=REGION_OVERRIDES.find(o=>o.match.test(p.name));if(o){home=o.region;byOverride++;overridden.push(p.name+' -> '+o.region);}else{home=argmax(weightsAt(c));byLandmark++;}}
 assigned[p.id]={home,spans:[]};
}
// spanning: a part reaches into another region when its centroid lies inside that region's box or
// at least 15% of its triangles do. The box is the region as the fit knows it: the box around its
// landmark anchors, grown by SPAN_MARGIN. The union of the region's parts was tried first and is
// not a region - the tibia belongs to the knee and reaches the ankle, the forearm hangs beside the
// abdomen - and a bounds corner alone was looser still.
// Three definitions of "the region's bounds" were measured (context bytes, cervical / shoulder /
// elbow-wrist): the union of every part assigned to the region, 9.2 / 11.6 / 12.8 MB; the box
// around its landmark anchors + 50 mm, 9.5 / 6.9 / 6.6 MB; the union of its own bones, below.
// Bones define a region; anchors reach across it (the cervical region's acromion anchors put both
// shoulders in its box), and a region's soft tissue reaches further still.
// A paired region (shoulder, elbow-wrist, hip, knee, ankle-foot) is two boxes, one per side: one box
// around both arms spans the whole trunk between them, and the abdomen is not in the elbow-wrist
// region. A bone within 2 cm of the midline goes in both.
const regionBoxes={};
const grow=(rid,side,[lo,hi])=>{const set=regionBoxes[rid]=regionBoxes[rid]||{};const b=set[side];if(!b){set[side]=[[...lo],[...hi]];return;}for(let i=0;i<3;i++){b[0][i]=Math.min(b[0][i],lo[i]);b[1][i]=Math.max(b[1][i],hi[i]);}};
for(const p of atlas.parts){if(p.source||p.system!=='skeletal')continue;const rid=assigned[p.id]?.home;if(!rid)continue;const cx=(p.bounds[0][0]+p.bounds[1][0])/2;if(cx>0.02)grow(rid,'l',p.bounds);else if(cx<-0.02)grow(rid,'r',p.bounds);else{grow(rid,'l',p.bounds);grow(rid,'r',p.bounds);}}
const regionBox={};
for(const r of atlas.regions){
 const set=regionBoxes[r.id];
 if(!set&&r.anchors?.length){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const a of r.anchors)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],a[i]-0.05);hi[i]=Math.max(hi[i],a[i]+0.05);}regionBox[r.id]=[[lo,hi]];continue;}
 if(!set)continue;
 const boxes=Object.values(set);
 // an axial region's two half-boxes meet at the midline: merge them into one
 const axial=boxes.length===2&&Math.min(boxes[0][1][0],boxes[1][1][0])>=Math.max(boxes[0][0][0],boxes[1][0][0])-0.01;
 regionBox[r.id]=axial?[[boxes[0][0].map((v,i)=>Math.min(v,boxes[1][0][i])),boxes[0][1].map((v,i)=>Math.max(v,boxes[1][1][i]))]]:boxes;
 r.bounds=[regionBox[r.id][0][0].map((v,i)=>Math.min(...regionBox[r.id].map(b=>b[0][i]))),regionBox[r.id][0][1].map((v,i)=>Math.max(...regionBox[r.id].map(b=>b[1][i])))];
}
const inside=(pt,[lo,hi])=>pt[0]>=lo[0]&&pt[0]<=hi[0]&&pt[1]>=lo[1]&&pt[1]<=hi[1]&&pt[2]>=lo[2]&&pt[2]<=hi[2];
const SPAN_FRACTION=0.15;
// returns the regions the part spans and, for every region whose box its bounds touch, the fraction of its
// triangles inside that box - the context cap below reads the fraction, so it is measured for every box, not
// only until the first hit
const spansOf=(p,home)=>{
 const {pos,idx}=readPart(p);
 const [lo,hi]=p.bounds;const c=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];
 const out=[],fractions={};
 for(const [rid,boxes] of Object.entries(regionBox)){
  if(rid===home)continue;
  let hit=false,frac=0;
  for(const box of boxes){
   if(!(lo[0]<=box[1][0]&&hi[0]>=box[0][0]&&lo[1]<=box[1][1]&&hi[1]>=box[0][1]&&lo[2]<=box[1][2]&&hi[2]>=box[0][2]))continue;   // boxes do not even touch
   let n=0;const tris=idx.length/3;
   for(let t=0;t<idx.length;t+=3){const a=idx[t]*3,bb=idx[t+1]*3,cc=idx[t+2]*3;const tc=[(pos[a]+pos[bb]+pos[cc])/3,(pos[a+1]+pos[bb+1]+pos[cc+1])/3,(pos[a+2]+pos[bb+2]+pos[cc+2])/3];if(inside(tc,box))n++;}
   frac=Math.max(frac,n/tris);
   if(inside(c,box)||n/tris>=SPAN_FRACTION)hit=true;
  }
  if(hit){out.push(rid);fractions[rid]=frac;}
 }
 return {spans:out,fractions};
};
for(const p of atlas.parts){
 if(p.source){const s=spansOf(p,p.region);p.spans=s.spans;p.spanFractions=s.fractions;continue;}
 if(assigned[p.id]){const s=spansOf(p,assigned[p.id].home);assigned[p.id].spans=s.spans;assigned[p.id].fractions=s.fractions;}
}
for(const r of atlas.regions)r.spanningParts=atlas.parts.filter(p=>p.source&&p.spans.includes(r.id)).map(p=>p.id);

// every old BP3D chunk file goes before the new ones are written (the sources are already in
// memory): a re-run writes the same body-<region> names, and deleting afterwards deleted them
const oldMvmt=atlas.chunks.filter(c=>c.region&&c.url.includes('/mvmt-'));
for(const c of atlas.chunks){if(!(c.region&&c.url.includes('/mvmt-'))){for(const f of [c.url,c.gzip].filter(Boolean)){const p=new URL(f.split('/').pop(),dir);if(fs.existsSync(p))fs.unlinkSync(p);}}}
delete atlas.contexts;   // rebuilt below from the fresh assignment
// pack
let chunks=[];const chunkOf=new Map();
const writer=()=>{const segs=[];let bytes=0;const append=a=>{const pad=(4-bytes%4)%4;if(pad){segs.push(Buffer.alloc(pad));bytes+=pad;}const off=bytes;const b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);segs.push(b);bytes+=b.length;return off;};return {append,bytes:()=>bytes,buffer:()=>Buffer.concat(segs)};};
const packInto=(name,parts,meta)=>{ // one or more chunks named name-<n>.bin, split at 4 MB
 let w=writer(),n=0,tris=0,count=0;
 const flush=()=>{if(!w.bytes())return;const url=`/models/${name}-${n++}.bin`;fs.writeFileSync(new URL(url.split('/').pop(),dir),w.buffer());chunks.push({url,bytes:w.bytes(),...meta,triangles:tris,parts:count});w=writer();tris=0;count=0;};
 for(const p of parts){
  const {pos,nor,idx}=readPart(p);
  if(w.bytes()>4_000_000)flush();
  p.positions=w.append(pos);p.normals=w.append(nor);p.indices=w.append(idx);chunkOf.set(p.id,chunks.length);
  tris+=p.indexCount/3;count++;
 }
 flush();
};
for(const r of atlas.regions){const parts=atlas.parts.filter(p=>!p.source&&assigned[p.id]?.home===r.id);packInto(`body-${r.id}`,parts,{bp3dRegion:r.id});}
packInto('body-vessels',atlas.parts.filter(p=>!p.source&&VESSELS.has(p.system)),{systems:['arterial','venous']});
packInto('body-organs',atlas.parts.filter(p=>!p.source&&!REGIONAL.has(p.system)&&!VESSELS.has(p.system)),{systems:'organs'});
// context chunks: for each region, a copy of the parts that reach into it from its neighbours
// (BP3D spanning parts and MVMT spanning parts), so a region view can draw its surroundings
// dimmed without fetching a whole neighbour. Copies, so atlas.contexts carries their own layouts.
// The cap: a part whose home is a neighbour, that has under 15% of its triangles inside the region (it is in the
// context because its centroid fell in the box) and that is larger than 200 KB is left out of the context and
// listed under atlas.contexts[region].excluded. The thoracic context had grown to 6.35 MB gzipped on the
// centroid rule: the long back and chest sheets whose centroid sits in the thorax with most of their triangles
// in the lumbar spine or the shoulder.
const CONTEXT_CAP_BYTES=200_000;
const partBytes=p=>p.vertexCount*18+p.indexCount*4;
const contexts={};
const mvmtSpanning=Object.fromEntries(atlas.regions.map(r=>[r.id,new Set(r.spanningParts||[])]));
const layoutOf=new Map();
for(const r of atlas.regions){
 const bp3dSpan=new Set(atlas.parts.filter(p=>!p.source&&assigned[p.id]?.spans.includes(r.id)).map(p=>p.id));
 const candidates=atlas.parts.filter(p=>bp3dSpan.has(p.id)||(p.source&&mvmtSpanning[r.id].has(p.id)));
 const excluded=[];
 const parts=candidates.filter(p=>{const home=p.source?p.region:assigned[p.id].home;const frac=(p.source?p.spanFractions:assigned[p.id].fractions)?.[r.id]??0;const bytes=partBytes(p);if((NEIGHBOURS[r.id]||[]).includes(home)&&frac<SPAN_FRACTION&&bytes>CONTEXT_CAP_BYTES){excluded.push({id:p.id,name:p.name,home,fraction:+frac.toFixed(3),bytes});return false;}return true;});
 if(!parts.length)continue;
 let w=writer(),tris=0;const layouts={};
 for(const p of parts){
  const {pos,nor,idx}=readPart(p);
  layouts[p.id]={chunk:chunks.length,positions:w.append(pos),normals:w.append(nor),indices:w.append(idx),vertexCount:p.vertexCount,indexCount:p.indexCount};tris+=p.indexCount/3;
 }
 const url=`/models/body-${r.id}-context.bin`;fs.writeFileSync(new URL(url.split('/').pop(),dir),w.buffer());
 chunks.push({url,bytes:w.bytes(),context:r.id,triangles:tris,parts:parts.length});
 contexts[r.id]={chunk:chunks.length-1,parts:layouts,count:parts.length,bp3d:parts.filter(p=>!p.source).length,mvmt:parts.filter(p=>p.source).length,bytes:w.bytes(),excluded,excludedBytes:excluded.reduce((n,e)=>n+e.bytes,0)};
}
atlas.contexts=contexts;
// keep the MVMT chunks, re-indexed after the new BP3D chunks
const base=chunks.length;
for(const c of oldMvmt)chunks.push(c);
for(const p of atlas.parts){if(p.source){const old=atlas.chunks[p.chunk];p.chunk=base+oldMvmt.indexOf(old);}else p.chunk=chunkOf.get(p.id);}
for(const r of atlas.regions){r.chunk=base+oldMvmt.findIndex(c=>c.region===r.id);r.bp3dChunks=chunks.map((c,i)=>c.bp3dRegion===r.id?i:-1).filter(i=>i>=0);r.bp3dParts=atlas.parts.filter(p=>!p.source&&assigned[p.id]?.home===r.id).length;r.bp3dSpanningParts=atlas.parts.filter(p=>!p.source&&assigned[p.id]?.spans.includes(r.id)).map(p=>p.id);}
for(const p of atlas.parts)if(assigned[p.id]){p.region=assigned[p.id].home;p.spans=assigned[p.id].spans;p.spanFractions=assigned[p.id].fractions;}   // the fraction of triangles in each spanned region, for the record
atlas.chunks=chunks;
atlas.chunkSets={
 note:'Chunk indices to fetch. A region needs its BP3D chunk(s) and its MVMT chunk; whole body needs the overview instead; arteries, veins and organs load only when toggled on.',
 regions:Object.fromEntries(atlas.regions.map(r=>[r.id,{bp3d:r.bp3dChunks,mvmt:[r.chunk],context:contexts[r.id]?[contexts[r.id].chunk]:[]}])),
 vessels:chunks.map((c,i)=>c.systems&&Array.isArray(c.systems)?i:-1).filter(i=>i>=0),
 organs:chunks.map((c,i)=>c.systems==='organs'?i:-1).filter(i=>i>=0),
};
atlas.triangles=atlas.parts.reduce((n,p)=>n+p.indexCount/3,0);
delete atlas.overview; // its offsets refer to the old chunk files; build-overview.mjs rebuilds it
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));
const summary=atlas.regions.map(r=>({region:r.id,bp3dParts:r.bp3dParts,spanning:r.bp3dSpanningParts.length,bp3dBytes:r.bp3dChunks.reduce((n,i)=>n+chunks[i].bytes,0),contextParts:contexts[r.id]?.count??0,contextBytes:contexts[r.id]?.bytes??0,contextExcluded:contexts[r.id]?.excluded.length??0,contextExcludedBytes:contexts[r.id]?.excludedBytes??0}));
atlas.layers=atlas.layers||{};atlas.layers.systemOverrides={note:'BP3D parts moved out of the system BP3D files them under (scripts/overrides.mjs); bp3dSystem on the part keeps the original',moved};
atlas.layers.regionOverrides={note:'BP3D parts homed by scripts/overrides.mjs REGION_OVERRIDES rather than by name or landmark distance',parts:overridden};
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));
console.log(JSON.stringify({chunks:chunks.length,regional:Object.keys(assigned).length,assignedByName:byName,assignedByOverride:byOverride,assignedByLandmark:byLandmark,regionOverrides:overridden,systemOverrides:moved,spanning:atlas.regions.map(r=>r.id+':'+r.bp3dSpanningParts.length+'+'+r.spanningParts.length),vessels:chunks.filter(c=>Array.isArray(c.systems)).reduce((n,c)=>n+c.parts,0),organs:chunks.filter(c=>c.systems==='organs').reduce((n,c)=>n+c.parts,0),summary},null,1));
