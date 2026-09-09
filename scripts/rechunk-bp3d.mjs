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
const dir=new URL('../public/models/',import.meta.url);
const atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',dir),'utf8'));
const REGIONAL=new Set(['skeletal','muscular','nervous','connective']);
const VESSELS=new Set(['arterial','venous']);
if(!atlas.regions?.every(r=>r.anchors?.length))throw new Error('atlas.regions[].anchors missing: re-run merge-layers.mjs');
const sigma=atlas.layers?.blend?.sigma??0.12;

const source=atlas.chunks.map(c=>{const raw=new URL(c.url.split('/').pop(),dir);if(fs.existsSync(raw))return fs.readFileSync(raw);return gunzipSync(fs.readFileSync(new URL(c.gzip.split('/').pop(),dir)));});
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
const assigned={};let byName=0,byLandmark=0;
for(const p of atlas.parts){
 if(p.source||!REGIONAL.has(p.system))continue;
 const [lo,hi]=p.bounds;const c=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];
 let home=null;for(const a of aliases(p.name)){const r=ourRegion.get(norm(a));if(r){home=r;break;}}
 if(home)byName++;else{home=argmax(weightsAt(c));byLandmark++;}
 const spans=new Set();
 for(let k=0;k<8;k++){const corner=[(k&1)?hi[0]:lo[0],(k&2)?hi[1]:lo[1],(k&4)?hi[2]:lo[2]];const w=weightsAt(corner);const best=argmax(w);if(best!==home&&w[best]>0.5)spans.add(best);}
 assigned[p.id]={home,spans:[...spans]};
}

// every old BP3D chunk file goes before the new ones are written (the sources are already in
// memory): a re-run writes the same body-<region> names, and deleting afterwards deleted them
const oldMvmt=atlas.chunks.filter(c=>c.region&&c.url.includes('/mvmt-'));
for(const c of atlas.chunks){if(!(c.region&&c.url.includes('/mvmt-'))){for(const f of [c.url,c.gzip].filter(Boolean)){const p=new URL(f.split('/').pop(),dir);if(fs.existsSync(p))fs.unlinkSync(p);}}}
// pack
let chunks=[];const chunkOf=new Map();
const writer=()=>{const segs=[];let bytes=0;const append=a=>{const pad=(4-bytes%4)%4;if(pad){segs.push(Buffer.alloc(pad));bytes+=pad;}const off=bytes;const b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);segs.push(b);bytes+=b.length;return off;};return {append,bytes:()=>bytes,buffer:()=>Buffer.concat(segs)};};
const packInto=(name,parts,meta)=>{ // one or more chunks named name-<n>.bin, split at 4 MB
 let w=writer(),n=0,tris=0,count=0;
 const flush=()=>{if(!w.bytes())return;const url=`/models/${name}-${n++}.bin`;fs.writeFileSync(new URL(url.split('/').pop(),dir),w.buffer());chunks.push({url,bytes:w.bytes(),...meta,triangles:tris,parts:count});w=writer();tris=0;count=0;};
 for(const p of parts){
  const b=source[p.chunk];const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),nor=new Int16Array(b.buffer,b.byteOffset+p.normals,p.vertexCount*3),idx=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);
  if(w.bytes()>4_000_000)flush();
  p.positions=w.append(pos);p.normals=w.append(nor);p.indices=w.append(idx);chunkOf.set(p.id,chunks.length);
  tris+=p.indexCount/3;count++;
 }
 flush();
};
for(const r of atlas.regions){const parts=atlas.parts.filter(p=>!p.source&&assigned[p.id]?.home===r.id);packInto(`body-${r.id}`,parts,{bp3dRegion:r.id});}
packInto('body-vessels',atlas.parts.filter(p=>!p.source&&VESSELS.has(p.system)),{systems:['arterial','venous']});
packInto('body-organs',atlas.parts.filter(p=>!p.source&&!REGIONAL.has(p.system)&&!VESSELS.has(p.system)),{systems:'organs'});
// keep the MVMT chunks, re-indexed after the new BP3D chunks
const base=chunks.length;
for(const c of oldMvmt)chunks.push(c);
for(const p of atlas.parts){if(p.source){const old=atlas.chunks[p.chunk];p.chunk=base+oldMvmt.indexOf(old);}else p.chunk=chunkOf.get(p.id);}
for(const r of atlas.regions){r.chunk=base+oldMvmt.findIndex(c=>c.region===r.id);r.bp3dChunks=chunks.map((c,i)=>c.bp3dRegion===r.id?i:-1).filter(i=>i>=0);r.bp3dParts=atlas.parts.filter(p=>!p.source&&assigned[p.id]?.home===r.id).length;r.bp3dSpanningParts=atlas.parts.filter(p=>!p.source&&assigned[p.id]?.spans.includes(r.id)).map(p=>p.id);}
for(const p of atlas.parts)if(assigned[p.id]){p.region=assigned[p.id].home;p.spans=assigned[p.id].spans;}
atlas.chunks=chunks;
atlas.chunkSets={
 note:'Chunk indices to fetch. A region needs its BP3D chunk(s) and its MVMT chunk; whole body needs the overview instead; arteries, veins and organs load only when toggled on.',
 regions:Object.fromEntries(atlas.regions.map(r=>[r.id,{bp3d:r.bp3dChunks,mvmt:[r.chunk],neighbours:[]}])),
 vessels:chunks.map((c,i)=>c.systems&&Array.isArray(c.systems)?i:-1).filter(i=>i>=0),
 organs:chunks.map((c,i)=>c.systems==='organs'?i:-1).filter(i=>i>=0),
};
atlas.triangles=atlas.parts.reduce((n,p)=>n+p.indexCount/3,0);
delete atlas.overview; // its offsets refer to the old chunk files; build-overview.mjs rebuilds it
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));
const summary=atlas.regions.map(r=>({region:r.id,bp3dParts:r.bp3dParts,spanning:r.bp3dSpanningParts.length,bp3dBytes:r.bp3dChunks.reduce((n,i)=>n+chunks[i].bytes,0)}));
console.log(JSON.stringify({chunks:chunks.length,regional:Object.keys(assigned).length,assignedByName:byName,assignedByLandmark:byLandmark,vessels:chunks.filter(c=>Array.isArray(c.systems)).reduce((n,c)=>n+c.parts,0),organs:chunks.filter(c=>c.systems==='organs').reduce((n,c)=>n+c.parts,0),summary},null,1));
