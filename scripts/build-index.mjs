// The indexes the viewer reads beside the geometry, rebuilt from atlas.json alone (idempotent, no
// chunk files touched): muscle depth for every BP3D and MVMT muscle part, and the twelve fascial
// lines resolved to concept ids on this body. Run after merge-layers.mjs and rechunk-bp3d.mjs.
//   node scripts/build-index.mjs <anatomy.json from mvmt-program> <structure-meshes.json>
import fs from 'node:fs';
const dir=new URL('../public/models/',import.meta.url);
const [anatomyPath,joinPath]=process.argv.slice(2);
if(!anatomyPath||!joinPath)throw new Error('usage: build-index.mjs <anatomy.json> <structure-meshes.json>');
const atlas=JSON.parse(fs.readFileSync(new URL('atlas.json',dir),'utf8'));
const anatomy=JSON.parse(fs.readFileSync(anatomyPath,'utf8')),join=JSON.parse(fs.readFileSync(joinPath,'utf8'));
const norm=s=>{s=s.toLowerCase().replace(/[()]/g,'').replace(/\bcolli\b/g,'cervicis');const drop=new Set(['muscle','of','part','the','bone','left','right','and']);return s.split(/[^a-z0-9-]+/).filter(w=>w&&!drop.has(w)).sort().join(' ');};
const tokens=s=>new Set(norm(s).split(' ').filter(Boolean));
const bp3dConcepts=atlas.concepts.filter(c=>!c.source);
const byNorm=new Map();for(const c of bp3dConcepts)if(!byNorm.has(norm(c.name)))byNorm.set(norm(c.name),c);
const byId=new Map(atlas.concepts.map(c=>[c.id,c]));
// exact token-set match first; then the smallest BP3D concept whose tokens contain the structure's
// ("Masseter, Superficial Part" is BP3D's "superficial part of masseter" once "part" and "of" go)
const conceptFor=name=>{const exact=byNorm.get(norm(name));if(exact)return exact;const t=tokens(name);if(t.size<2)return null;let best=null;for(const c of bp3dConcepts){const ct=tokens(c.name);if([...t].every(w=>ct.has(w))&&(!best||ct.size<tokens(best.name).size))best=c;}return best;};

// ---- muscle depth: 1 superficial, 2 deep, from ANATOMY's layer through the structures that claim
// a part, shallowest claim winning (the same rule as mvmt-program's v3MuscleLayerOf)
const depth={};const note=(id,layer)=>{if(layer!==1&&layer!==2)return;depth[id]=Math.min(depth[id]??9,layer);};
let matchedStructures=0,unmatched=[];
for(const s of anatomy){
 if(s.system!=='muscular'||!s.layer)continue;
 const own=byId.get(s.id);if(own)for(const e of own.elements)note(e,s.layer);          // our own exported meshes it claims
 const c=conceptFor(s.name);if(c){matchedStructures++;for(const e of c.elements)note(e,s.layer);}else unmatched.push(s.name);
}
const muscles=atlas.parts.filter(p=>p.system==='muscular');
const classified=muscles.filter(p=>depth[p.id]).length;
atlas.layers=atlas.layers||{};
atlas.layers.muscleDepth={note:'1 superficial, 2 deep, from MVMT ANATOMY layer through name-matched BP3D concepts; a muscle without an entry is shown under every depth setting',parts:depth,
 summary:{muscularParts:muscles.length,classified,superficial:muscles.filter(p=>depth[p.id]===1).length,deep:muscles.filter(p=>depth[p.id]===2).length,structuresMatched:matchedStructures,structuresUnmatched:unmatched.length},unmatchedStructures:unmatched};
fs.writeFileSync(new URL('atlas.json',dir),JSON.stringify(atlas));

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
 // BP3D names each intercostal space separately; the Lateral Line's intercostals are the lot
 'thoracic-intercostals':['intercostal muscle','external intercostal muscle','internal intercostal muscle','innermost intercostal muscle'],
};
const lines=[],unresolved=[];
for(const [k,line] of Object.entries(join.fascialLines)){
 const stations=line.structures.map(sid=>{
  const s=anat.get(sid);const name=s?s.name:sid;const resolve=[];
  if(byId.has(sid))resolve.push({kind:'mvmt',id:sid});
  const direct=s&&conceptFor(s.name);if(direct)resolve.push({kind:'bp3d',id:direct.id,name:direct.name});
  for(const n of MANUAL[sid]||[]){const c=byNorm.get(norm(n));if(c)resolve.push({kind:'bp3d',id:c.id,name:c.name});}
  if(!resolve.length)unresolved.push({line:k,structure:sid,name,latin:s?.latin??null,system:s?.system??null});
  return {structure:sid,name,resolve};
 });
 lines.push({id:k,name:line.name,stations});
}
fs.writeFileSync(new URL('fascial-lines.json',dir),JSON.stringify({note:'Twelve myofascial lines as ordered lists of MVMT structures; each station resolves at load to the concept ids listed (mvmt = our exported meshes, bp3d = BodyParts3D concepts). Stations with no resolution are listed under unresolved.',lines,unresolved},null,1));
console.log(JSON.stringify({muscleDepth:atlas.layers.muscleDepth.summary,fascialLines:lines.length,stations:lines.reduce((n,l)=>n+l.stations.length,0),unresolvedStations:unresolved.length,unresolved:unresolved.map(u=>u.structure)}));
