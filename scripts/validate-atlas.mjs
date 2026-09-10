import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
const filename=process.argv[2]??'atlas.json';
const base=new URL('../public/models/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL(filename,base)));
// BodyParts3D's own parts and concepts are fixed counts; the MVMT layers merged beside them (source set) vary with the export.
assert.equal(atlas.parts.filter(p=>!p.source).length,2234);assert.equal(atlas.concepts.filter(c=>!c.source).length,3432);
const ids=new Set(atlas.parts.map(p=>p.id));assert.equal(ids.size,atlas.parts.length);
for(const p of atlas.parts.filter(p=>p.source))assert.ok(p.region&&p.system&&p.sourceName,`${p.id}: layer part missing region, system or sourceName`);
// Only the gzipped chunks are committed; read the raw .bin when a rebuild has left one, otherwise decompress.
const chunkBytes=c=>{const raw=new URL(c.url.split('/').pop(),base);if(fs.existsSync(raw))return fs.readFileSync(raw);assert.ok(c.gzip,`${c.url}: no raw or gzipped chunk`);const gz=fs.readFileSync(new URL(c.gzip.split('/').pop(),base));assert.equal(gz.length,c.gzipBytes);return gunzipSync(gz);};
const files=atlas.chunks.map(c=>{const b=chunkBytes(c);assert.equal(b.length,c.bytes);return b;});
let tris=0;
for(const p of atlas.parts){assert.ok(p.name.trim()&&p.name!=='-'&&!p.name.includes('Bounds('));assert.ok(p.conceptId!=='-');assert.ok(p.system);const b=files[p.chunk];assert.ok(p.indices+p.indexCount*4<=b.length);const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);assert.ok(indices.length>=3);for(const i of indices)assert.ok(i<p.vertexCount,`${p.id}: invalid vertex`);for(const value of pos)assert.ok(Number.isFinite(value));tris+=p.indexCount/3;}
for(const c of atlas.concepts){assert.ok(c.elements.length);for(const id of c.elements)assert.ok(ids.has(id),`${c.id}: missing ${id}`);}
assert.equal(tris,atlas.triangles);
// every region's context chunk names parts that exist, with layouts inside the chunk - an empty context loads nothing, silently, in the viewer
for(const [rid,cx] of Object.entries(atlas.contexts??{})){const entries=Object.entries(cx.parts);assert.ok(entries.length>0,`${rid}: context chunk names no parts`);const c=atlas.chunks[cx.chunk];assert.ok(c&&c.context===rid,`${rid}: context chunk index wrong`);const b=files[cx.chunk];for(const [id,l] of entries){assert.ok(ids.has(id),`${rid}: context part ${id} missing`);assert.ok(l.indices+l.indexCount*4<=b.length,`${rid}: context layout of ${id} overruns`);const ix=new Uint32Array(b.buffer,b.byteOffset+l.indices,l.indexCount);for(const i of ix)assert.ok(i<l.vertexCount,`${rid}: context vertex of ${id}`);}}
if(atlas.chunkSets)for(const [rid,s] of Object.entries(atlas.chunkSets.regions))for(const i of s.context??[])assert.ok(atlas.chunks[i]?.context===rid,`${rid}: chunkSets.context points at the wrong chunk`);
// no two carried parts in one region may sit inside each other on more than 2% of their triangles (parts of one
// muscle, listed as siblings by the export, are measured but exempt): the winding number (Jacobson 2013) of one
// part's sampled triangle centroids against the other's surface, both ways
const winding=(P,V,F)=>{const out=new Float64Array(P.length/3);for(let t=0;t<F.length;t+=3){const a=F[t]*3,b=F[t+1]*3,c=F[t+2]*3;for(let k=0;k<out.length;k++){const px=P[k*3],py=P[k*3+1],pz=P[k*3+2];const ax=V[a]-px,ay=V[a+1]-py,az=V[a+2]-pz,bx=V[b]-px,by=V[b+1]-py,bz=V[b+2]-pz,cx=V[c]-px,cy=V[c+1]-py,cz=V[c+2]-pz;const la=Math.hypot(ax,ay,az),lb=Math.hypot(bx,by,bz),lc=Math.hypot(cx,cy,cz);const num=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);const den=la*lb*lc+(ax*bx+ay*by+az*bz)*lc+(bx*cx+by*cy+bz*cz)*la+(cx*ax+cy*ay+cz*az)*lb;out[k]+=Math.atan2(num,den);}}return out.map(w=>w/(2*Math.PI));};
const geometry=p=>{const b=files[p.chunk];return {pos:new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),idx:new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount)};};
const centroids=(g,n)=>{const tris=g.idx.length/3,step=Math.max(1,Math.floor(tris/n)),out=[];for(let t=0;t<tris;t+=step){const a=g.idx[t*3]*3,b=g.idx[t*3+1]*3,c=g.idx[t*3+2]*3;out.push((g.pos[a]+g.pos[b]+g.pos[c])/3,(g.pos[a+1]+g.pos[b+1]+g.pos[c+1])/3,(g.pos[a+2]+g.pos[b+2]+g.pos[c+2])/3);}return new Float64Array(out);};
const insideFraction=(A,B)=>{const w=winding(centroids(A,800),B.pos,B.idx);let n=0;for(const x of w)if(x>0.5)n++;return n/w.length;};
const siblings=atlas.layers?.report?.layerSeparation?.siblings??[];const baseName=p=>(p.sourceName||'').replace(/\.[lr]$/,'');
const carried=atlas.parts.filter(p=>p.carried);let checked=0,exempt=0,worst=null;
for(let i=0;i<carried.length;i++)for(let j=i+1;j<carried.length;j++){const a=carried[i],b=carried[j];if(a.region!==b.region||a.side!==b.side)continue;const [alo,ahi]=a.bounds,[blo,bhi]=b.bounds;if(alo.some((v,k)=>v>bhi[k])||blo.some((v,k)=>v>ahi[k]))continue;if(siblings.some(g=>g.includes(baseName(a))&&g.includes(baseName(b)))){exempt++;continue;}const A=geometry(a),B=geometry(b);const ab=insideFraction(A,B),ba=insideFraction(B,A);checked++;const m=Math.max(ab,ba);if(!worst||m>worst.m)worst={m,a:a.name,b:b.name};assert.ok(m<=0.02,a.name+' / '+b.name+': '+Math.round(ab*100)+'% / '+Math.round(ba*100)+'% of their triangles inside each other (limit 2%)');}
if(checked)console.log('Carried parts: '+checked+' pairs in one region checked ('+exempt+' sibling pairs exempt), none inside another beyond 2%; worst '+worst.a+' / '+worst.b+' at '+(worst.m*100).toFixed(1)+'%.');
if(atlas.contexts)console.log(`Contexts: ${Object.keys(atlas.contexts).length} regions, ${Object.values(atlas.contexts).reduce((n,c)=>n+Object.keys(c.parts).length,0)} part copies.`);
if(atlas.overview){const files=atlas.overview.chunks.map(c=>{const b=chunkBytes(c);assert.equal(b.length,c.bytes);return b;});let t=0;for(const [id,o] of Object.entries(atlas.overview.parts)){assert.ok(ids.has(id));const b=files[o.chunk];assert.ok(o.indices+o.indexCount*4<=b.length);const ix=new Uint32Array(b.buffer,b.byteOffset+o.indices,o.indexCount);for(const i of ix)assert.ok(i<o.vertexCount,`${id}: overview vertex`);t+=o.indexCount/3;}assert.equal(t,atlas.overview.triangles);console.log(`Overview: ${Object.keys(atlas.overview.parts).length} parts, ${t.toLocaleString()} triangles.`);
 // the copy-whole set (carried muscles and the BodyParts3D sheets they were separated from) is the region's bytes
 // verbatim: positions, normals and indices identical between the region chunk and the overview, none decimated
 const wholeBp3d=new Set(atlas.overview.copiedWholeBp3d??[]);const region=atlas.chunks.map(c=>chunkBytes(c));let whole=0;
 for(const p of atlas.parts){if(!(p.carried||wholeBp3d.has(p.name)))continue;const o=atlas.overview.parts[p.id];assert.ok(o,`${p.name}: copy-whole part missing from the overview`);
  assert.ok(o.vertexCount===p.vertexCount&&o.indexCount===p.indexCount,`${p.name}: decimated in the overview (${o.indexCount/3} of ${p.indexCount/3} triangles)`);
  const a=region[p.chunk],b=files[o.chunk];
  for(const [name,off,ooff,len] of [['positions',p.positions,o.positions,p.vertexCount*12],['normals',p.normals,o.normals,p.vertexCount*6],['indices',p.indices,o.indices,p.indexCount*4]])assert.ok(a.subarray(off,off+len).equals(b.subarray(ooff,ooff+len)),`${p.name}: ${name} differ between the region chunk and the overview`);
  whole++;}
 assert.equal(whole,atlas.overview.copiedWhole??0,'copy-whole count disagrees with atlas.overview.copiedWhole');
 if(whole)console.log(`Copied whole: ${whole} parts byte-identical between their region chunk and the overview.`);}
console.log(`Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every binary buffer.`);
