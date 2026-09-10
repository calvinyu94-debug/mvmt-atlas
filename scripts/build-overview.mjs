// A decimated whole-body chunk set for orientation: every part of atlas.json (BodyParts3D's and
// ours) simplified with meshoptimizer into its own chunks, recorded under atlas.overview with the
// same per-part layout as the main chunks. Run after merge-layers.mjs and before compress-models.mjs.
//   node scripts/build-overview.mjs [bp3dRatio=0.12] [ourRatio=0.3] [maxRelativeError=0.03]
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
const dir=new URL('../public/models/',import.meta.url);
const atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',dir),'utf8'));
const bp3dRatio=+(process.argv[2]??0.12),ourRatio=+(process.argv[3]??0.3),error=+(process.argv[4]??0.03);
const source=atlas.chunks.map(c=>{const raw=new URL(c.url.split('/').pop(),dir);if(fs.existsSync(raw))return fs.readFileSync(raw);return gunzipSync(fs.readFileSync(new URL(c.gzip.split('/').pop(),dir)));});
for(const old of atlas.overview?.chunks??[]){const p=new URL(old.url.split('/').pop(),dir);if(fs.existsSync(p))fs.unlinkSync(p);const g=new URL(old.url.split('/').pop()+'.gz',dir);if(fs.existsSync(g))fs.unlinkSync(g);}
let chunks=[],segments=[],bytes=0,triangles=0,sourceTriangles=0,maxError=0,sloppy=0;const parts={};
const flush=()=>{if(!bytes)return;const url=`/models/overview-${chunks.length}.bin`;fs.writeFileSync(new URL(url.split('/').pop(),dir),Buffer.concat(segments));chunks.push({url,bytes});segments=[];bytes=0;};
const append=a=>{const padding=(4-bytes%4)%4;if(padding){segments.push(Buffer.alloc(padding));bytes+=padding;}const offset=bytes;const b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);segments.push(b);bytes+=b.length;return offset;};
const sheetNames=(atlas.layers?.report?.layerSeparation?.stacks??[]).flatMap(s=>s.rules.flatMap(r=>r.against.bp3d??[]));
const sheetNeighbour=p=>{const n=p.name.toLowerCase();return sheetNames.some(x=>n.endsWith(x));};
const t0=Date.now();
for(const p of atlas.parts){
 const b=source[p.chunk];const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),normal=new Int16Array(b.buffer,b.byteOffset+p.normals,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);
 // the muscles carried from Z-Anatomy are thin sheets, and the sloppy simplifier tore the abdominal wall into
 // shards in the overview; they are small (144k triangles in all) and are copied whole. So are the BodyParts3D
 // sheets they were separated from (the external oblique, the erector spinae, the serrati): decimated to 12% with a
 // 3% error bound, the external oblique wobbled through the 2 mm gaps the export had just opened.
 const ratio=p.carried||(!p.source&&sheetNeighbour(p))?1:p.source?ourRatio:bp3dRatio;
 const target=Math.max(24*3,Math.floor(p.indexCount*ratio/3)*3);
 // Quadric simplification first; where the error bound stops it early (thin vessels, flat patches) the
 // topology-free sloppy simplifier finishes the job, since the overview is for orientation only.
 let [simplified,err]=ratio>=1?[indices,0]:MeshoptSimplifier.simplify(indices,pos,3,Math.min(indices.length,target),error);
 if(ratio<1&&simplified.length>target*1.5&&indices.length>target*1.5){const [sl,se]=MeshoptSimplifier.simplifySloppy(indices,pos,3,null,Math.min(indices.length,target),error);if(sl.length>=3&&sl.length<simplified.length){simplified=sl;err=se;sloppy++;}}
 maxError=Math.max(maxError,err);const [remap,count]=MeshoptSimplifier.compactMesh(simplified);
 const positions=new Float32Array(count*3),normals=new Int16Array(count*3);
 for(let old=0;old<remap.length;old++){const n=remap[old];if(n===0xffffffff)continue;positions.set(pos.subarray(old*3,old*3+3),n*3);normals.set(normal.subarray(old*3,old*3+3),n*3);}
 if(bytes>4_000_000)flush();
 parts[p.id]={chunk:chunks.length,positions:append(positions),normals:append(normals),indices:append(simplified),vertexCount:count,indexCount:simplified.length};
 triangles+=simplified.length/3;sourceTriangles+=p.indexCount/3;
}
flush();
atlas.overview={note:'Decimated whole body for orientation: the same part ids, simplified with meshoptimizer, in their own chunks. Bounds are the full-detail bounds.',method:'meshoptimizer quadric simplification',bp3dRatio,ourRatio,maximumRelativeError:error,measuredMaxError:maxError,chunks,parts,triangles,sourceTriangles,bytes:chunks.reduce((n,c)=>n+c.bytes,0),sloppyParts:sloppy,copiedWhole:atlas.parts.filter(p=>p.carried||(!p.source&&sheetNeighbour(p))).length,copiedWholeBp3d:atlas.parts.filter(p=>!p.source&&sheetNeighbour(p)).map(p=>p.name),seconds:(Date.now()-t0)/1000};
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));
console.log(JSON.stringify({sloppyParts:sloppy,parts:Object.keys(parts).length,triangles,sourceTriangles,ratio:+(triangles/sourceTriangles).toFixed(4),bytes:atlas.overview.bytes,chunks:chunks.length,maxError,seconds:atlas.overview.seconds}));
