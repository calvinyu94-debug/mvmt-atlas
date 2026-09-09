// Merge the MVMT layers (mvmt-anatomy tools/bp3d_export.py -> public/models/mvmt-layers.json and
// mvmt-<region>.bin) into atlas.json beside BodyParts3D's own parts, which are left untouched.
// Idempotent: a previous merge is stripped first. Also writes the FMA match table and the fascial
// lines with each station resolved to BP3D and MVMT concepts.
//   node scripts/merge-layers.mjs <anatomy.json from mvmt-program> <structure-meshes.json>
import fs from 'node:fs';
const dir=new URL('../public/models/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const [anatomyPath,joinPath]=process.argv.slice(2);
if(!anatomyPath||!joinPath)throw new Error('usage: merge-layers.mjs <anatomy.json> <structure-meshes.json>');
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
atlas.regions=layers.regions.map(r=>({...r,chunk:r.chunk+offset}));
atlas.layers={generatedFrom:layers.generatedFrom,fit:layers.fit,systems:layers.systems,report:layers.report};
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

// ---- fascial lines: named-structure storage, each station resolved to concept ids on this atlas
const anat=new Map(anatomy.map(s=>[s.id,s]));
const MANUAL={ // MVMT structure id -> BP3D concept names, where the structure is a group BP3D names differently
 'knee-hamstrings':['biceps femoris','semitendinosus','semimembranosus'],
 'spine-erector-spinae':['iliocostalis','longissimus','spinalis'],
 'ankle-foot-layer-1':['abductor hallucis','flexor digitorum brevis','abductor digiti minimi of foot'],
 'ankle-achilles':['calcaneal tendon'],
 'hip-gluteus-maximus':['gluteus maximus'],'hip-tfl':['tensor fasciae latae'],'hip-it-band':['iliotibial tract'],
 'shoulder-rotator-cuff':['supraspinatus','infraspinatus','teres minor','subscapularis'],
 'thoracic-pectoralis-major':['pectoralis major'],'thoracic-latissimus':['latissimus dorsi'],
 'elbow-wrist-flexors':['flexor carpi radialis','flexor carpi ulnaris','palmaris longus','flexor digitorum superficialis'],
 'elbow-wrist-extensors':['extensor carpi radialis longus','extensor carpi radialis brevis','extensor digitorum','extensor carpi ulnaris'],
 'hip-adductors':['adductor longus','adductor brevis','adductor magnus','gracilis','pectineus'],
};
const conceptByNorm=new Map();for(const c of atlas.concepts)if(!conceptByNorm.has(norm(c.name)))conceptByNorm.set(norm(c.name),c);
const lines=[],unresolved=[];
for(const [k,line] of Object.entries(join.fascialLines)){
 const stations=line.structures.map(sid=>{
  const s=anat.get(sid);const name=s?s.name:sid;const resolve=[];
  if(byId.has(sid))resolve.push({kind:'mvmt',id:sid});                       // our exported meshes claimed by it
  const direct=s&&conceptByNorm.get(norm(s.name));if(direct&&!direct.source)resolve.push({kind:'bp3d',id:direct.id,name:direct.name});
  for(const n of MANUAL[sid]||[]){const c=conceptByNorm.get(norm(n));if(c&&!c.source)resolve.push({kind:'bp3d',id:c.id,name:c.name});}
  if(!resolve.length)unresolved.push({line:k,structure:sid,name,latin:s?.latin??null,system:s?.system??null});
  return {structure:sid,name,resolve};
 });
 lines.push({id:k,name:line.name,stations});
}
fs.writeFileSync(new URL('fascial-lines.json',dir),JSON.stringify({note:'Twelve myofascial lines as ordered lists of MVMT structures; each station resolves at load to the concept ids listed (mvmt = our exported meshes, bp3d = BodyParts3D concepts). Stations with no resolution are listed under unresolved.',lines,unresolved},null,1));
console.log(JSON.stringify({parts:atlas.parts.length,addedParts:layers.parts.length,concepts:atlas.concepts.length,addedConcepts:added,extendedConcepts:extended,chunks:atlas.chunks.length,triangles:atlas.triangles,fmaMatch:matchSummary,fascialLines:lines.length,unresolvedStations:unresolved.length},null,1));
