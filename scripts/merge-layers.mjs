// Merge the MVMT layers (mvmt-anatomy tools/bp3d_export.py -> public/models/mvmt-layers.json and
// mvmt-<region>.bin) into atlas.json beside BodyParts3D's own parts, which are left untouched.
// Idempotent: a previous merge is stripped first. Also writes the FMA match table and the fascial
// lines with each station resolved to BP3D and MVMT concepts.
//   node scripts/merge-layers.mjs <anatomy.json from mvmt-program> <structure-meshes.json> <bp3d-fit.json>
import fs from 'node:fs';
const dir=new URL('../public/models/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const [anatomyPath,joinPath,fitPath]=process.argv.slice(2);
if(!anatomyPath||!joinPath||!fitPath)throw new Error('usage: merge-layers.mjs <anatomy.json> <structure-meshes.json> <bp3d-fit.json>');
const fit=JSON.parse(fs.readFileSync(fitPath,'utf8'));
const atlas=read('atlas.json'),layers=read('mvmt-layers.json');
const anatomy=JSON.parse(fs.readFileSync(anatomyPath,'utf8')),join=JSON.parse(fs.readFileSync(joinPath,'utf8'));

// strip a previous merge
atlas.parts=atlas.parts.filter(p=>!p.source);
atlas.chunks=atlas.chunks.filter(c=>!c.region);
atlas.concepts=atlas.concepts.filter(c=>!c.source);
for(const c of atlas.concepts)if(c.bp3dElements){c.elements=c.bp3dElements;delete c.bp3dElements;}
delete atlas.layers;delete atlas.regions;

const offset=atlas.chunks.length;
for(const c of layers.chunks)atlas.chunks.push({url:c.url,bytes:c.bytes,region:c.region,triangles:c.triangles,parts:c.parts});
for(const p of layers.parts){p.chunk+=offset;atlas.parts.push(p);}
const byId=new Map(atlas.concepts.map(c=>[c.id,c]));
let extended=0,added=0;
for(const c of layers.concepts){
 const existing=byId.get(c.id);
 if(existing){existing.bp3dElements=existing.elements.slice();existing.elements=[...existing.elements,...c.elements];extended++;}
 else{atlas.concepts.push(c);byId.set(c.id,c);added++;}
}
// each region carries its landmark anchors in this (Y-up, +Z anterior) frame, so rechunk-bp3d.mjs can
// assign BP3D parts by the same blend weights the layers were fitted with
const toBp3d=p=>[p[0],p[2],-p[1]];
atlas.regions=layers.regions.map(r=>({...r,chunk:r.chunk+offset,anchors:(fit.regions[r.id]?.anchors??[]).map(toBp3d)}));
atlas.layers={generatedFrom:layers.generatedFrom,fit:layers.fit,systems:layers.systems,blend:fit.blend,report:layers.report};
atlas.triangles=atlas.parts.reduce((n,p)=>n+p.indexCount/3,0);
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));

// ---- the FMA match table: every unique source name we carry across, and what BP3D calls it
const norm=s=>{s=s.toLowerCase().replace(/\.[lr]$/,'').replace(/[()]/g,'').replace(/\bcolli\b/g,'cervicis');const drop=new Set(['muscle','of','part','the','bone','left','right','and']);return s.split(/[^a-z0-9-]+/).filter(w=>w&&!drop.has(w)).sort().join(' ');};
const fmaByNorm=new Map();for(const c of atlas.concepts)if(!c.source&&!fmaByNorm.has(norm(c.name)))fmaByNorm.set(norm(c.name),c);
const seen=new Map();
for(const p of layers.parts){if(p.source!=='zanatomy')continue;const base=p.sourceName.replace(/\.[lr]$/,'');if(seen.has(base))continue;const c=fmaByNorm.get(norm(base));seen.set(base,{sourceName:base,system:p.system,structures:p.structures,fma:c?c.id:null,fmaName:c?c.name:null});}
const match=[...seen.values()].sort((a,b)=>a.sourceName.localeCompare(b.sourceName));
const matchSummary={};for(const m of match){const s=matchSummary[m.system]=matchSummary[m.system]||{names:0,fma:0};s.names++;if(m.fma)s.fma++;}
fs.writeFileSync(new URL('mvmt-fma-match.json',dir),JSON.stringify({note:'Our source names (side stripped) matched to BodyParts3D concepts by normalised token set (content words, colli = cervicis, order-free). null = no BP3D concept of that name.',summary:matchSummary,matches:match},null,1));

// fascial lines and muscle depth: scripts/build-index.mjs, run after the re-chunk
console.log(JSON.stringify({parts:atlas.parts.length,addedParts:layers.parts.length,concepts:atlas.concepts.length,addedConcepts:added,extendedConcepts:extended,chunks:atlas.chunks.length,triangles:atlas.triangles,fmaMatch:matchSummary},null,1));
