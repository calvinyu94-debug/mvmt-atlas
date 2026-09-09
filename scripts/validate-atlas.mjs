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
if(atlas.contexts)console.log(`Contexts: ${Object.keys(atlas.contexts).length} regions, ${Object.values(atlas.contexts).reduce((n,c)=>n+Object.keys(c.parts).length,0)} part copies.`);
if(atlas.overview){const files=atlas.overview.chunks.map(c=>{const b=chunkBytes(c);assert.equal(b.length,c.bytes);return b;});let t=0;for(const [id,o] of Object.entries(atlas.overview.parts)){assert.ok(ids.has(id));const b=files[o.chunk];assert.ok(o.indices+o.indexCount*4<=b.length);const ix=new Uint32Array(b.buffer,b.byteOffset+o.indices,o.indexCount);for(const i of ix)assert.ok(i<o.vertexCount,`${id}: overview vertex`);t+=o.indexCount/3;}assert.equal(t,atlas.overview.triangles);console.log(`Overview: ${Object.keys(atlas.overview.parts).length} parts, ${t.toLocaleString()} triangles.`);}
console.log(`Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every binary buffer.`);
